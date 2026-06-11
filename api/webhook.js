/**
 * 飞书事件订阅 Webhook — Vercel Serverless
 *
 * 流程:
 *   收到飞书消息
 *   → 规则匹配 (快速通道)
 *   → 没命中? → 搜索补充背景 → DeepSeek 分析 (通用通道)
 *   → 回复飞书
 */

const { analyze } = require('../lib/engine');
const { sendMessage, verifyWebhook } = require('../lib/feishu');
const { buildSignalReport, buildDefaultReply, buildHelpText } = require('../lib/templates');
const { searchNewsEnhancement } = require('../lib/search');

const HELP_COMMANDS = ['帮助', 'help', 'usage', '菜单', 'start'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // === 1. 飞书 URL 验证 ===
    const challenge = verifyWebhook(req);
    if (challenge) {
      return res.status(200).json(challenge);
    }

    // === 2. 处理消息事件 ===
    const event = body.type === 'event_callback'
      ? (body.event || body)
      : (body.event || body);

    const message = event.message || {};
    const sender = event.sender || {};

    if (!message.content) {
      return res.status(200).json({ ok: true });
    }

    // 解析文本消息
    let content = '';
    try {
      const parsed = JSON.parse(message.content);
      content = parsed.text || '';
    } catch {
      content = message.content || '';
    }

    // 去掉 @机器人
    content = content.replace(/@_user_\d+/g, '').replace(/@/g, '').trim();
    if (!content) return res.status(200).json({ ok: true });

    // 判断私聊还是群聊
    const chatType = message.chat_type;
    const chatId = message.chat_id;
    const openId = sender.sender_id?.open_id || sender.open_id;
    const receiveId = chatType === 'group' ? chatId : openId;
    const receiveType = chatType === 'group' ? 'chat_id' : 'open_id';

    // 帮助指令
    if (HELP_COMMANDS.includes(content.toLowerCase())) {
      await sendMessage(receiveId, receiveType, buildHelpText());
      return res.status(200).json({ ok: true });
    }

    // === 3. 分析新闻 ===
    // 先发一条"正在分析"的提示 (飞书消息较长时防止超时)
    await sendMessage(receiveId, receiveType,
      '🔍 正在分析，请稍候...');

    // 执行分析 (规则匹配 + 搜索增强 + DeepSeek)
    let result;

    // 首先规则匹配
    result = await analyze(content);

    // 规则没命中 → 搜索补充背景再分析
    if (result.noMatch || (!result.stocks || result.stocks.length === 0)) {
      const background = await searchNewsEnhancement(content);
      if (background) {
        result = await analyze(content, background);
      }
    }

    // 还是没结果 → 尝试直接用 DeepSeek 裸分析
    if (result.noMatch || (!result.stocks || result.stocks.length === 0)) {
      const { analyzeWithLLM } = require('../lib/llm');
      const llmResult = await analyzeWithLLM(content);
      if (llmResult && llmResult.stocks && llmResult.stocks.length > 0) {
        result = {
          input: content,
          eventType: llmResult.eventType,
          eventLabel: llmResult.eventLabel,
          direction: llmResult.direction,
          sectors: llmResult.sectors,
          stocks: llmResult.stocks.map(s => ({
            name: s.name, code: s.code || '', role: s.reason || ''
          })),
          signalStars: llmResult.signalStars,
          logicChain: llmResult.logicChain,
          summary: llmResult.summary,
          fromLLM: true,
          descriptions: llmResult.summary ? [llmResult.summary] : []
        };
      }
    }

    // === 4. 生成并发送报告 ===
    const report = (!result.noMatch && result.stocks && result.stocks.length > 0)
      ? buildSignalReport(result)
      : buildDefaultReply(content);

    await sendMessage(receiveId, receiveType, report);

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook错误:', err);
    try {
      // 尝试通知用户出错了
      if (req.body?.event?.message?.chat_id) {
        await sendMessage(
          req.body.event.message.chat_id, 'chat_id',
          '⚠️ 分析出错了，请稍后重试'
        );
      }
    } catch {}
    return res.status(200).json({ ok: true });
  }
};
