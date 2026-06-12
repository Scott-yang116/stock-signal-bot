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

  const prompt = `你是一个专业A股交易信号分析师。分析下面这条新闻，输出JSON格式的分析结果。

分析要求：
1. 识别事件类型（从以下选择最匹配的）：
   - "供给冲击" = 停产/断供/减产/检修/事故等供给端收缩
   - "需求爆发" = 销量超预期/订单大增/产能供不应求
   - "政策利好" = 补贴/减税/产业支持/规划目标
   - "政策利空" = 加税/限购/监管收紧/集采
   - "技术突破" = 新技术/新产品/研发突破/专利
   - "公司事件" = 订单/并购/增发/回购/财报
   - "行业监管" = 反垄断/环保限产/行业整顿
   - "地缘冲突" = 战争/制裁/贸易摩擦
   - "宏观变化" = 利率/汇率/通胀/经济数据
   - "涨价事件" = 产品/原料涨价
   - "其他" = 不易归类的

2. 分析影响方向（利好/利空/中性）

3. 判断受影响的具体行业/领域，以及对应的A股上市公司：
   - 优先列出直接受益/受损的公司
   - 公司代码为6位数字，不确定的留空字符串
   - 如果涉及板块联动，可以列出3-5个公司

4. 说明完整的逻辑链（用"→"连接因果）

5. 给出信号强度（1-5星）：
   - 5星 = 直接利好，确定性高，短期影响大
   - 4星 = 明显利好，有一定确定性
   - 3星 = 中性利好，需要验证
   - 2星 = 间接影响，不确定性高
   - 1星 = 影响微弱或无法判断

输出格式（严格的JSON，不要有其他文字）：
{
  "event_type": "事件类型",
  "event_label": "事件描述（10字以内）",
  "impact_direction": "利好",
  "affected_sectors": ["受影响行业1", "受影响行业2"],
  "stocks": [
    {"name": "公司全名", "code": "000000", "reason": "受益/受损原因（10字以内）"}
  ],
  "logic_chain": "完整逻辑链（用→连接）",
  "signal_stars": 3,
  "summary": "一句话总结（20字以内）"
}

注意：
- 如果新闻与A股无关或无法判断影响，stocks返回空数组
- 不要编造不存在的信息
- 优先选择逻辑链最清晰、关联最直接的标的
- signal_stars 范围1-5，必须诚实评估

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
