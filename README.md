# 📡 飞书信号机器人

> 在飞书里发一条新闻，自动分析是否产生交易信号

## 效果

```
你@机器人: 日本停产六氟化钨

机器人回复:
📡 **信号分析报告**
━━━━━━━━━━━━━━━━━━━━━

📰 **你关注的:**
  日本停产六氟化钨
📋 **事件类型:** 停产/断供事件
🏭 **涉及领域:** 钨矿开采/冶炼
🎯 **信号强度:** ⭐⭐⭐⭐⭐ (5/5)
🔍 **分析来源:** ⚡ 规则匹配

🏢 **相关标的:**
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

💰 **参考价格:**
  六氟化钨: 42万 元/吨 (📈 +2.5%)
  钨精矿: 15.8万 元/吨 (📈 +1.8%)
  APT: 24.5万 元/吨 (📈 +2.0%)
  数据截至: 2026/6/12（内置参考）
━━━━━━━━━━━━━━━━━━━━━
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
│   ├── engine.js          ← 分析引擎核心 (双通道)
│   ├── llm.js             ← DeepSeek LLM 客户端
│   ├── templates.js       ← 消息模板
│   ├── search.js          ← 搜索增强 (可选)
│   └── price.js           ← 商品实时价格模块 ✨
├── data/
│   └── event-map.json     ← 事件→原料→股票映射表 (28种原料)
├── package.json
├── vercel.json
└── .env.example
```

## 腾讯云部署

### 方式一：云函数控制台（推荐，最简单）

1. 打开 [腾讯云函数计算控制台](https://console.cloud.tencent.com/scf)
2. 新建函数 → **从头开始** → 函数名称 `stock-signal-bot`
3. 运行环境选择 **Nodejs 18.9** → 提交方法选 **本地上传 zip**
4. 将项目目录打成 zip（排除 node_modules、.git），上传
5. 创建 API 网关触发器：
   - **触发方式**：API 网关触发
   - **请求方法**：ANY
   - **发布环境**：发布
   - **启用集成响应**：✅ 开启
6. 部署完成后，在 **函数配置** → 环境变量中添加：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `DEEPSEEK_API_KEY`（可选）

### 方式二：Serverless Framework CLI

```bash
npm install -g serverless
serverless deploy
```

部署后拿到 **API 网关地址**（如 `https://service-xxx.gz.apigw.tencentcs.com/api/webhook`），去飞书后台填这个地址。

## 飞书配置

1. 打开 [飞书开放平台](https://open.feishu.cn) → 创建企业自建应用
2. 启用**机器人**能力
3. 在**事件订阅**中配置请求地址：
   ```
   https://你的域名/api/webhook
   ```
4. 订阅事件：`im.message.receive_v1`
5. 发布应用

## 文件结构

内置 **28 种原料/行业** 的映射规则，覆盖:

| 类别 | 品种 |
|:---|:---|
| ⚡ 小金属 | 钨·六氟化钨·稀土·锗·镓·锑·钼·电子特气 |
| 🔋 新能源材料 | 锂·硅·钴·镍·铜·铝·磷·纯碱·氟化工 |
| 🛢️ 能源 | 原油·天然气·煤炭 |
| 🏗️ 工业 | 钢铁·造纸·橡胶·粮食·尿素 |
| 💰 贵金属 | 黄金·白银 |
| 🚗 产业链 | 光伏·风电·新能源车·半导体·AI算力·电池·大消费·医药 |

## 自定义映射表

修改 `data/event-map.json`，可以:

- 添加新的原料/商品类型
- 添加新的受益股票
- 修改信号强度评分规则
- 添加新的关键词匹配规则

## 扩展思路

- 对接商品价格API（百川盈孚、生意社、上海钢联），获取实时价格
- 对接公司公告API，检测到涨价公告自动分析
- 增加更多事件类型（并购、订单、财报）
- 配合飞书卡片消息，展示更丰富的排版
- 增加用户自定义关注列表
- 定时扫描（每日早晨推送汇总）
- 增加回测功能（历史新闻→信号→实际涨跌验证）
