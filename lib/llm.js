/**
 * DeepSeek LLM 客户端
 * 
 * 用 DeepSeek 分析任意新闻，识别潜在价值
 * API: https://api.deepseek.com/v1/chat/completions
 * 模型: deepseek-chat
 */
const axios = require('axios');

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';

/**
 * 调用 DeepSeek 分析新闻
 * @param {string} newsText - 用户输入的新闻标题/内容
 * @param {string} background - 搜索到的补充背景（可选）
 * @returns {object|null} 结构化分析结果
 */
async function analyzeWithLLM(newsText, background = '') {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }

  const combinedInput = background
    ? `新闻: ${newsText}\n补充背景: ${background}`
    : newsText;

  const prompt = `你是一个A股交易信号分析师。分析下面这条新闻，输出JSON格式的分析结果。

分析要求：
1. 识别这条新闻属于什么类型（供给冲击/需求爆发/政策利好/政策利空/技术突破/公司事件/行业监管/地缘冲突/宏观变化/其他）
2. 分析它会影响哪些行业/公司，以及利好还是利空
3. 如果有对应的A股上市公司，列出代码
4. 说明完整的逻辑链条
5. 给出信号强度（1-5星），5星代表确定性最强

输出格式（严格的JSON，不要有其他文字）：
{
  "event_type": "事件类型",
  "event_label": "事件描述",
  "impact_direction": "利好" 或 "利空" 或 "中性",
  "affected_sectors": ["受影响行业1", "受影响行业2"],
  "stocks": [
    {"name": "公司名", "code": "000000", "reason": "受益/受损原因"}
  ],
  "logic_chain": "逻辑链条描述",
  "signal_stars": 3,
  "summary": "一句话总结"
}

注意：
- 如果新闻与该分析无关或无法判断，stocks返回空数组
- 不要编造不存在的信息
- 公司代码必须是真实的A股代码，不确定的可以留空
- signal_stars 范围1-5

新闻内容：
${combinedInput}`;

  try {
    const resp = await axios({
      method: 'POST',
      url: DEEPSEEK_API,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      },
      timeout: 30000
    });

    const content = resp.data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('DeepSeek 返回内容为空');
      return null;
    }

    // 从回复中提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('无法从DeepSeek回复中提取JSON:', content.slice(0, 200));
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      eventType: result.event_type,
      eventLabel: result.event_label,
      direction: result.impact_direction,
      sectors: result.affected_sectors || [],
      stocks: result.stocks || [],
      logicChain: result.logic_chain,
      signalStars: result.signal_stars || 1,
      summary: result.summary,
      fromLLM: true
    };
  } catch (err) {
    console.error('DeepSeek API 调用失败:', err.message);
    return null;
  }
}

module.exports = { analyzeWithLLM };
