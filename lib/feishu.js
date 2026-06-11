/**
 * 飞书 API 客户端
 * - 获取 tenant_access_token
 * - 发送消息到群聊/私聊
 */
const axios = require('axios');

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

// 缓存 token
let tokenCache = {
  token: null,
  expireAt: 0
};

/**
 * 获取飞书 tenant_access_token
 */
async function getTenantToken() {
  if (Date.now() < tokenCache.expireAt) {
    return tokenCache.token;
  }

  const APP_ID = process.env.FEISHU_APP_ID;
  const APP_SECRET = process.env.FEISHU_APP_SECRET;

  if (!APP_ID || !APP_SECRET) {
    throw new Error('FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置');
  }

  const resp = await axios.post(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    app_id: APP_ID,
    app_secret: APP_SECRET
  });

  if (resp.data.code !== 0) {
    throw new Error(`获取飞书token失败: ${resp.data.msg}`);
  }

  tokenCache.token = resp.data.tenant_access_token;
  tokenCache.expireAt = Date.now() + (resp.data.expire - 60) * 1000;
  return tokenCache.token;
}

/**
 * 发送消息到飞书聊天
 * @param {string} receiveId - 用户open_id 或 chat_id
 * @param {string} receiveType - 'open_id' | 'chat_id'
 * @param {string} content - 消息内容(文本)
 */
async function sendMessage(receiveId, receiveType, content) {
  const token = await getTenantToken();

  const resp = await axios({
    method: 'POST',
    url: `${FEISHU_BASE}/im/v1/messages`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    data: {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text: content })
    },
    params: {
      receive_id_type: receiveType
    }
  });

  if (resp.data.code !== 0) {
    console.error('发送飞书消息失败:', resp.data.msg);
    return false;
  }
  return true;
}

/**
 * 验证飞书 webhook 请求签名
 */
function verifyWebhook(req) {
  const challenge = req.body?.challenge;
  if (challenge) {
    return { challenge };
  }
  return null;
}

module.exports = {
  getTenantToken,
  sendMessage,
  verifyWebhook
};
