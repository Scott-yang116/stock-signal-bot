# 📡 飞书信号机器人

> 在飞书里发一条新闻，自动分析是否产生交易信号

## 效果

```
你@机器人: 日本停产六氟化钨

机器人回复:
📡 信号分析报告
━━━━━━━━━━━━━━━━━━━━━

📰 你关注的: 日本停产六氟化钨
📋 事件类型: 停产/断供事件
🧪 涉及原料: 六氟化钨
🎯 信号强度: ⭐⭐⭐⭐⭐ (5/5)

🏢 受益标的:
  翔鹭钨业(002842) — 上游钨矿
  章源钨业(002378) — 上游钨矿
  中船特气(688146) — 中游气体龙头

🔄 逻辑链:
  停产/断供事件
  ↓
  六氟化钨供给受影响
  ↓
  钨矿开采/冶炼受益
  ↓
  翔鹭钨业、章源钨业、中船特气
```

## 部署步骤

### 1. 在 Vercel 部署代码

```bash
# 把代码推到你的 GitHub 仓库
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/stock-signal-bot.git
git push -u origin main

# 去 https://vercel.com 导入这个仓库
# 部署后得到一个域名: https://xxx.vercel.app
```

### 2. 配置环境变量

在 Vercel 项目设置中添加:

| 变量 | 说明 | 必填 |
|:---|:---|:---:|
| `FEISHU_APP_ID` | 飞书应用的 App ID | ✅ |
| `FEISHU_APP_SECRET` | 飞书应用的 App Secret | ✅ |
| `TAVILY_API_KEY` | Tavily 搜索API Key (选填，填了分析更准) | ❌ |

### 3. 配置飞书机器人

1. 打开 [飞书开放平台](https://open.feishu.cn) → 创建企业自建应用
2. 在"应用功能"→"机器人"中启用机器人
3. 在"事件订阅"中:
   - 请求地址: `https://你的域名.vercel.app/api/webhook`
   - 订阅事件: `im.message.receive_v1` (接收消息)
4. 在"安全设置"中设置 IP 白名单（可选）
5. 发布应用

### 4. 测试

在飞书搜索你的机器人 → 发送私聊或在群里@它 → 发送:

```
日本停产六氟化钨
钨精矿涨价
稀土出口管制
```

## 项目结构

```
stock-buy/
├── api/
│   └── webhook.js         ← 飞书webhook入口 (Vercel Serverless)
├── lib/
│   ├── feishu.js          ← 飞书API客户端
│   ├── engine.js          ← 分析引擎核心
│   ├── templates.js       ← 消息模板
│   └── search.js          ← 搜索增强 (可选)
├── data/
│   └── event-map.json     ← 事件→原料→股票映射表
├── package.json
├── vercel.json
└── .env.example
```

## 自定义映射表

修改 `data/event-map.json`，可以:

- 添加新的原料/商品类型
- 添加新的受益股票
- 修改信号强度评分规则
- 添加新的关键词匹配规则

## 扩展思路

- 对接商品价格API（百川盈孚、上海钢联），实时价格自动附带
- 对接公司公告API，检测到涨价公告自动分析
- 增加更多事件类型（并购、政策利好、技术突破）
- 配合飞书卡片消息，展示更丰富的排版
