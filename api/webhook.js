/**
 * 飞书事件订阅 Webhook — Vercel Serverless
 *
 * 流程:
 *   收到飞书消息
 *   → 规则匹配 (快速通道)
 *   → 没命中? → 搜索补充背景 → DeepSeek 分析 (通用通道)
 *   → 回复飞书
 *
 * 注意: 模块使用懒加载，降低冷启动时间
 */

const HELP_COMMANDS = ['帮助', 'help', 'usage', '菜单', 'start'];

// 懒加载模块（避免冷启动时加载大文件）
let _engine, _feishu, _templates, _search;
function getEngine() {
  if (!_engine) _engine = require('../lib/engine');
  return _engine;
}
function getFeishu() {
  if (!_feishu) _feishu = require('../lib/feishu');
  return _feishu;
}
function getTemplates() {
  if (!_templates) _templates = require('../lib/templates');
  return _templates;
}
function getSearch() {
  if (!_search) _search = require('../lib/search');
  return _search;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // === 1. 飞书 URL 验证（最快路径，不加载任何模块） ===
    if (body && body.challenge) {
      return res.status(200).json({ challenge: body.challenge });
    }

    // 延迟加载模块
    const { analyze } = getEngine();
    const { sendMessage } = getFeishu();
    const { buildSignalReport, buildDefaultReply, buildHelpText } = getTemplates();
    const { searchNewsEnhancement } = getSearch();

    // === 2. 处理消息事件 ===
    const event = body.type === 'event_callback'
      ? (body.event || {})
      : (body.event || {});

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

    // 截断过长内容（超过500字截断）
    if (content.length > 500) {
      content = content.slice(0, 500) + '...';
    }

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

    // 执行分析 (双通道: 规则匹配 + DeepSeek LLM)
    let result = await analyze(content);

    // 规则没命中 → 搜索补充背景 → 重新分析
    if (result.noMatch || !result.stocks || result.stocks.length === 0) {
      const background = await searchNewsEnhancement(content);
      if (background) {
        result = await analyze(content, background);
      }
    }

    // 还是没结果 → 二次尝试直接用 DeepSeek 裸分析（无背景版本）
    if (result.noMatch || !result.stocks || result.stocks.length === 0) {
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
          priceInfo: '',
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
        const { sendMessage } = require('../lib/feishu');
        await sendMessage(
          req.body.event.message.chat_id, 'chat_id',
          '⚠️ 分析出错了，请稍后重试'
        );
      }
    } catch {}
    return res.status(200).json({ ok: true });
  }
};
