/**
 * 核心分析引擎 (双通道)
 *
 * 通道1 - 规则匹配 (快速通道):
 *   命中 data/event-map.json 中的已知模式 → 直接出结果
 *
 * 通道2 - DeepSeek LLM (通用通道):
 *   规则匹配不到 → 调用 DeepSeek 做语义理解
 *   能处理任意类型的新闻
 */
const eventMap = require('../data/event-map.json');
const { analyzeWithLLM } = require('./llm');
const { getPricesForMaterials } = require('./price');

// ========================================
// 通道1: 规则匹配 (快速通道)
// ========================================

function matchKeywords(text) {
  if (!text) return [];
  const matched = [];
  for (const kw of eventMap.keywords) {
    if (text.includes(kw.word)) {
      matched.push(kw);
    }
  }
  return matched;
}

function identifyEventType(matchedKeywords) {
  // 事件优先级：分数越高越优先匹配
  const priority = {
    '停产': 5, '管制': 5, '灾难': 5,
    '涨价': 4, '需求爆发': 3,
    '政策利好': 3, '政策利空': 3,
    '技术突破': 2, '发现': 2, '扩产': 1
  };
  let bestEvent = null;
  let bestScore = -1;
  for (const kw of matchedKeywords) {
    if (kw.type && eventMap.events[kw.type]) {
      const score = priority[kw.type] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestEvent = kw.type;
      }
    }
  }
  return bestEvent;
}

function identifyMaterials(matchedKeywords) {
  const materials = new Set();
  // 先收集所有匹配的原料
  for (const kw of matchedKeywords) {
    if (kw.material && eventMap.materials[kw.material]) {
      materials.add(kw.material);
    }
  }
  // 去除被更具体原料包含的（如"六氟化钨"已包含"钨"，则去掉"钨"）
  const materialList = Array.from(materials);
  return materialList.filter(m => {
    // 检查是否有其他原料名包含此原料名
    return !materialList.some(other => other !== m && other.includes(m));
  });
}

function findBeneficiaryStocks(materials, eventType) {
  const result = { stocks: [], sectors: new Set(), descriptions: [] };
  for (const matName of materials) {
    const mat = eventMap.materials[matName];
    if (!mat) continue;
    result.sectors.add(mat.upstream_sector);
    result.descriptions.push(mat.description);
    for (const stock of mat.stocks) {
      result.stocks.push({ ...stock, material: matName });
    }
    if (eventType && mat.links) {
      for (const link of mat.links) {
        if (link.event === eventType) {
          result.descriptions.push(link.impact);
        }
      }
    }
  }
  // 按股票代码去重
  result.stocks = result.stocks.filter((s, i, arr) =>
    arr.findIndex(x => x.code === s.code) === i
  );
  // 行业描述去重（去除包含关系）
  const sectorList = Array.from(result.sectors);
  result.sectors = sectorList.filter(s =>
    !sectorList.some(other => other !== s && other.includes(s))
  );
  // 描述去重
  result.descriptions = [...new Set(result.descriptions)];
  return result;
}

function calculateSignalStrength(eventType, materials, matchedKeywords) {
  let score = 0;
  if (eventType && eventMap.events[eventType]) {
    score += eventMap.events[eventType].score_base;
  }
  score += Math.min(materials.length * 1.5, 3);
  score += Math.min(matchedKeywords.length * 0.5, 2);
  if (matchedKeywords.some(kw => /\d/.test(kw.word))) score += 1;
  if (matchedKeywords.some(kw => /永久|全面|全部|归零|停摆|所有/.test(kw.word))) score += 1;
  return Math.min(Math.max(Math.round(score / 2.5), 1), 5);
}

function buildLogicChain(eventType, materials, beneficiaries) {
  if (!eventType || materials.length === 0) return null;
  const eventLabel = eventMap.events[eventType]?.label || eventType;
  const matNames = materials.join('/');
  const upstream = beneficiaries.sectors.join('→');

  // 根据不同事件类型生成不同的逻辑链中间步骤
  let middleStep;
  switch (eventType) {
    case '停产':
    case '管制':
      middleStep = `${matNames}供给受影响`;
      break;
    case '涨价':
      middleStep = `${matNames}价格上涨`;
      break;
    case '需求爆发':
      middleStep = `${matNames}需求激增`;
      break;
    case '政策利好':
      middleStep = `${matNames}政策支持/需求拉动`;
      break;
    case '政策利空':
      middleStep = `${matNames}政策收紧/需求受抑`;
      break;
    case '技术突破':
      middleStep = `${matNames}技术进步/成本下降`;
      break;
    case '扩产':
      middleStep = `${matNames}产能扩张`;
      break;
    case '发现':
      middleStep = `${matNames}资源储量增加`;
      break;
    case '灾难':
      middleStep = `${matNames}供给意外中断`;
      break;
    default:
      middleStep = `${matNames}受到影响`;
  }

  return [
    `🔄 逻辑链:`,
    `  ${eventLabel}`,
    `  ↓`,
    `  ${middleStep}`,
    `  ↓`,
    `  ${upstream}受益`,
    `  ↓`,
    `  ${beneficiaries.stocks.map(s => `${s.name}(${s.code})`).join('、')}`
  ].join('\n');
}

// ========================================
// 通道2: DeepSeek 通用分析
// ========================================

/**
 * 用 DeepSeek 分析任意新闻
 */
async function analyzeWithDeepSeek(userInput, background) {
  const llmResult = await analyzeWithLLM(userInput, background);
  if (!llmResult || !llmResult.stocks || llmResult.stocks.length === 0) {
    return null;
  }

  // 拼装逻辑链
  const chainParts = [llmResult.logicChain || `${llmResult.eventLabel}`];
  if (llmResult.sectors && llmResult.sectors.length > 0) {
    chainParts.push(`影响行业: ${llmResult.sectors.join('、')}`);
  }
  const chain = chainParts.join('\n');

  // 尝试获取价格信息（通过sectors关键词匹配）
  let priceInfo = '';
  if (llmResult.sectors && llmResult.sectors.length > 0) {
    // 将sectors映射到materials以获取价格
    const sectorToMaterial = {
      '钨': ['钨'],
      '稀土': ['稀土'],
      '锗': ['锗'],
      '镓': ['镓'],
      '锑': ['锑'],
      '钼': ['钼'],
      '锂': ['锂'],
      '硅': ['硅'],
      '铜': ['铜'],
      '铝': ['铝'],
      '磷': ['磷'],
      '纯碱': ['纯碱'],
      '钴': ['钴'],
      '镍': ['镍'],
      '黄金': ['黄金'],
      '白银': ['白银'],
      '煤炭': ['煤炭'],
      '钢铁': ['钢铁'],
      '原油': ['原油'],
      '天然气': ['天然气']
    };
    for (const sector of llmResult.sectors) {
      const mapped = sectorToMaterial[sector];
      if (mapped) {
        priceInfo = getPricesForMaterials(mapped);
        if (priceInfo) break;
      }
    }
  }

  return {
    input: userInput,
    eventType: llmResult.eventType,
    eventLabel: llmResult.eventLabel,
    direction: llmResult.direction,
    sectors: llmResult.sectors,
    stocks: llmResult.stocks.map(s => ({
      name: s.name,
      code: s.code || '??????',
      role: s.reason || llmResult.direction
    })),
    signalStars: llmResult.signalStars,
    logicChain: chain,
    priceInfo,
    summary: llmResult.summary,
    fromLLM: true,
    descriptions: llmResult.summary ? [llmResult.summary] : []
  };
}

// ========================================
// 统一入口
// ========================================

/**
 * 分析新闻，返回交易信号
 *
 * @param {string} userInput - 新闻标题/内容
 * @param {string} background - 搜索补充的背景（可选）
 * @returns {object} 分析结果
 */
async function analyze(userInput, background = '') {
  const startTime = Date.now();

  // 先走规则匹配（快速通道）
  const matchedKeywords = matchKeywords(userInput);
  const eventType = identifyEventType(matchedKeywords);
  const materials = identifyMaterials(matchedKeywords);

  // 如果规则匹配到了具体的原料和标的，直接返回
  if (eventType && materials.length > 0) {
    const beneficiaries = findBeneficiaryStocks(materials, eventType);
    const signalStars = calculateSignalStrength(eventType, materials, matchedKeywords);
    const logicChain = buildLogicChain(eventType, materials, beneficiaries);
    const priceInfo = getPricesForMaterials(materials);

    return {
      input: userInput,
      eventType,
      eventLabel: eventMap.events[eventType]?.label || eventType,
      materials,
      stocks: beneficiaries.stocks,
      sectors: beneficiaries.sectors,
      signalStars,
      logicChain,
      priceInfo,
      descriptions: [...new Set(beneficiaries.descriptions)],
      fromLLM: false,
      elapsed: Date.now() - startTime
    };
  }

  // 规则没命中 → 走 DeepSeek 通用通道
  const llmResult = await analyzeWithDeepSeek(userInput, background);
  if (llmResult) {
    llmResult.elapsed = Date.now() - startTime;
    return llmResult;
  }

  // 两个通道都无结果
  return {
    input: userInput,
    eventType: null,
    eventLabel: null,
    stocks: [],
    sectors: [],
    signalStars: 0,
    logicChain: null,
    descriptions: [],
    fromLLM: false,
    elapsed: Date.now() - startTime,
    noMatch: true
  };
}

module.exports = { analyze };
