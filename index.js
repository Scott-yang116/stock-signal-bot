/**
 * 腾讯云函数计算 (SCF) 入口
 *
 * 适配 Tencent Cloud API Gateway 触发器事件
 * 将事件格式转为 Vercel 风格的 (req, res) 传递给 webhook handler
 */

const webhookHandler = require('./api/webhook');

/**
 * 腾讯云 SCF 主入口
 * @param {object} event - API Gateway 触发事件
 * @param {object} context - 函数上下文
 * @returns {object} API Gateway 响应格式
 */
exports.main_handler = async (event, context) => {
  try {
    // === 解析请求 ===
    const method = event.httpMethod || 'POST';

    // 解析 body（API Gateway 传入的 body 可能是 string）
    let body = {};
    if (event.body) {
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch {
        body = { text: event.body };
      }
    }

    // 构建 req 对象（Vercel 风格）
    const req = {
      method,
      body,
      headers: event.headers || {},
      query: event.queryString || {},
      path: event.path || '/',
    };

    // === 构建 res 对象，捕获响应 ===
    let responseStatusCode = 200;
    let responseBody = {};

    const res = {
      status: (code) => {
        responseStatusCode = code;
        return {
          json: (data) => {
            responseBody = data;
          }
        };
      },
      json: (data) => {
        responseBody = data;
      },
    };

    // === 调用 webhook handler ===
    await webhookHandler(req, res);

    // === 返回 API Gateway 响应 ===
    return {
      isBase64Encoded: false,
      statusCode: responseStatusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(responseBody),
    };

  } catch (err) {
    console.error('SCF Handler 错误:', err);
    return {
      isBase64Encoded: false,
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
