/**
 * 搜索增强模块 (可选)
 *
 * 用 Tavily 搜索新闻背景，返回补充文本
 * 供 analyze() 或 DeepSeek 使用
 */
const axios = require('axios');

/**
 * 搜索新闻补充背景
 * @param {string} query - 搜索关键词
 * @returns {string|null} 背景文本，或 null
 */
async function searchNewsEnhancement(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const resp = await axios({
      method: 'POST',
      url: 'https://api.tavily.com/search',
      data: {
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_raw_content: false
      },
      timeout: 15000
    });

    if (!resp.data?.results?.length) {
      return null;
    }

    // 拼接成背景文本
    const parts = resp.data.results.map((r, i) =>
      `[来源${i+1}] ${r.title}\n${(r.content || '').slice(0, 500)}`
    );

    return parts.join('\n\n').slice(0, 3000);
  } catch (err) {
    console.error('搜索失败:', err.message);
    return null;
  }
}

module.exports = { searchNewsEnhancement };
