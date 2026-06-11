/**
 * 消息模板
 * 格式化分析结果输出（支持规则匹配 + DeepSeek 两种结果）
 */

/**
 * 生成信号分析报告
 */
function buildSignalReport(result) {
  const starStr = '⭐'.repeat(result.signalStars) + '☆'.repeat(5 - result.signalStars);

  // 来源标记
  const sourceTag = result.fromLLM ? '🤖 DeepSeek' : '⚡ 规则匹配';

  // 方向标记
  const directionEmoji = result.direction === '利好' ? '📈' :
    result.direction === '利空' ? '📉' : '➖';

  // 股票列表
  const stocksStr = result.stocks.length > 0
    ? result.stocks.map(s =>
        `  ${s.name}(${s.code || '******'}) ${s.role ? '— ' + s.role : ''}`
      ).join('\n')
    : '  暂未匹配到具体标的';

  // 行业列表
  const sectorsStr = result.sectors && result.sectors.length > 0
    ? result.sectors.join('、')
    : (result.materials && result.materials.length > 0 ? result.materials.join('、') : '待识别');

  // 逻辑链
  const logicStr = result.logicChain || '';

  // 描述/分析
  const descStr = result.descriptions && result.descriptions.length > 0
    ? result.descriptions.map(d => `  • ${d}`).join('\n')
    : '';

  // summary (DeepSeek 输出)
  const summaryStr = result.summary ? `📌 ${result.summary}` : '';

  const lines = [
    '📡 **信号分析报告**',
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    `📰 **你关注的:**`,
    `  ${result.input}`,
    '',
    `📋 **事件类型:** ${result.eventLabel || '待分类'}`,
    result.direction ? `${directionEmoji} **影响方向:** ${result.direction}` : '',
    `🏭 **涉及领域:** ${sectorsStr}`,
    `🎯 **信号强度:** ${starStr} (${result.signalStars}/5)`,
    `🔍 **分析来源:** ${sourceTag}`,
    '',
    '🏢 **相关标的:**',
    stocksStr,
    '',
    logicStr,
    '',
    descStr,
    summaryStr,
    `⚡ 耗时: ${result.elapsed || 0}ms`,
    '━━━━━━━━━━━━━━━━━━━━━'
  ];

  return lines.filter(l => l !== '' && l !== null).join('\n');
}

/**
 * 生成简单回复（没有匹配到时的默认回复）
 */
function buildDefaultReply(input) {
  return [
    '📡 **信号分析**',
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    `收到: ${input}`,
    '',
    '🔍 暂未匹配到已知的事件类型，你可以:',
    '  1. 提供更完整的新闻标题',
    '  2. 包含具体公司/原料名称',
    '  3. 描述事件类型(停产/涨价/管制)',
    '',
    '📌 示例: "日本停产六氟化钨"',
    '━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n');
}

/**
 * 生成帮助信息
 */
function buildHelpText() {
  return [
    '🤖 **信号机器人使用说明**',
    '━━━━━━━━━━━━━━━━━━━━━',
    '',
    '发送与**小金属/资源/半导体材料**相关的新闻，',
    '我会自动分析是否产生交易信号。',
    '',
    '📌 **支持的原料:**',
    '  钨、六氟化钨、稀土、锗、镓、锑、钼、电子特气',
    '',
    '📌 **支持的事件:**',
    '  停产/断供、涨价、出口管制、扩产',
    '',
    '📌 **示例:**',
    '  "日本停产六氟化钨"',
    '  "钨精矿长单涨价25%"',
    '  "商务部出口管制稀土"',
    '',
    '━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n');
}

module.exports = {
  buildSignalReport,
  buildDefaultReply,
  buildHelpText
};
