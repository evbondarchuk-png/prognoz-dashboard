/**
 * ir.js — расчёт Индекса Развития (ИР) по объекту агента из архива.
 *
 * ES-модуль. Импорт:
 *   import { calculateIR, getNormatives } from './ir.js';
 *   const ir = calculateIR(agent, getNormatives(agent.division));
 *
 * Формула — CLAUDE.md §5. Покупатель взвешивается по flowPct,
 * продавец — по доле сегмента в actON. 'all' в итерации не участвует.
 * Веса этапов: 0.33 / 0.33 / 0.34. Веса половин: 0.5 / 0.5.
 *
 * Выполнение каждой метрики по сегменту обрезается сверху на 1.0 (100%)
 * ДО взвешивания — перевыполнением коэффициент не поднять (бизнес-правило).
 * Возвращаем доли единицы (1.0 = 100%). Округление — задача рендера.
 *
 * Защита от пробелов в данных:
 *   - норматив отсутствует/0 → сегмент исключается, веса перенормируются
 *   - факт отсутствует → 0% выполнения по этому сегменту (сегмент остаётся)
 *   - сумма весов 0 → этап = 0
 *   - все сегменты этапа отброшены → этап = 0 + console.warn
 *
 * Нормативы здесь — заглушка-константа STUB_NORMATIVES на одну "среднюю"
 * зону, числа взяты из существующего хардкода в index.html (DATA.funnels)
 * для сегментов new/sec/out; для com/gar повторён sec как разумный дефолт.
 * Когда появится /data_division/ — заменить только тело getNormatives().
 * calculateIR() от источника нормативов не зависит.
 */

// ИР-расчёт использует flow/hot/deals (покупатель) и actON/hotPer/deals (продавец).
// Поля 'dep' (задатки) и сегмент 'all' — нужны для отображения воронок в UI,
// в calculateIR они не участвуют (итерация явно по [new,sec,out,com,gar]).
const STUB_NORMATIVES = {
  buyer: {
    all: { flow: 14, hot: 8, dep: 4, deals: 2 },
    new: { flow: 3,  hot: 2, dep: 1, deals: 1 },
    sec: { flow: 7,  hot: 4, dep: 2, deals: 1 },
    out: { flow: 4,  hot: 2, dep: 1, deals: 1 },
    com: { flow: 4,  hot: 2, dep: 1, deals: 1 },
    gar: { flow: 4,  hot: 2, dep: 1, deals: 1 },
  },
  seller: {
    all: { actON: 9, hotPer: 3, dep: 1.5, deals: 1 },
    sec: { actON: 5, hotPer: 2, dep: 1,   deals: 0.8 },
    out: { actON: 4, hotPer: 1, dep: 0.5, deals: 0.5 },
    com: { actON: 5, hotPer: 2, dep: 1,   deals: 0.8 },
    gar: { actON: 5, hotPer: 2, dep: 1,   deals: 0.8 },
  },
};

const BUYER_SEGMENTS = ['new', 'sec', 'out', 'com', 'gar'];
const SELLER_SEGMENTS = ['sec', 'out', 'com', 'gar'];

/**
 * Получить нормативы для зоны.
 * Сейчас зона игнорируется — возвращается общая заглушка.
 * Точка замены на чтение из /data_division/ по зоне.
 *
 * @param {string} [zone] — agent.division, например '401-500' или 'ТОП 1-5'
 * @returns {object}
 */
export function getNormatives(zone) {
  return STUB_NORMATIVES;
}

/**
 * Взвешенное выполнение одной метрики по сегментам.
 *
 * @param {object} agentSide — agent.b или agent.s
 * @param {object} normsSide — normatives.buyer или normatives.seller
 * @param {string[]} segments — список рассматриваемых сегментов
 * @param {string} metric — имя метрики ('flow' | 'hot' | 'deals' | 'actON' | 'hotPer')
 * @param {(side: object, seg: string) => number} getRawWeight — функция веса сегмента
 * @returns {number}
 */
function calcStage(agentSide, normsSide, segments, metric, getRawWeight) {
  if (!agentSide || !normsSide) return 0;

  // 1. Оставляем только сегменты, для которых норматив существует и > 0.
  const validSegments = segments.filter(seg => {
    const norm = normsSide[seg]?.[metric];
    return typeof norm === 'number' && norm > 0;
  });

  if (validSegments.length === 0) {
    console.warn(`[ir] этап "${metric}": нет валидных нормативов ни для одного сегмента`);
    return 0;
  }

  // 2. Собираем сырые веса и пере-нормализуем.
  const rawWeights = validSegments.map(seg => getRawWeight(agentSide, seg));
  const totalWeight = rawWeights.reduce((s, w) => s + w, 0);

  if (totalWeight <= 0) return 0;

  // 3. Взвешенная сумма выполнения. Отсутствующий факт = 0.
  //    Каждое выполнение обрезается на 100% ДО взвешивания — перевыполнение
  //    одного сегмента не компенсирует недовыполнение другого.
  let result = 0;
  validSegments.forEach((seg, i) => {
    const weight = rawWeights[i] / totalWeight;
    const fact = agentSide[seg]?.[metric] ?? 0;
    const norm = normsSide[seg][metric];
    const exec = Math.min(fact / norm, 1);
    result += weight * exec;
  });

  return result;
}

/**
 * Половина ИР по покупателю.
 * Вес сегмента — flowPct (доля сегмента во входящем потоке).
 */
function calcBuyer(b, buyerNorms) {
  const getRawWeight = (side, seg) => {
    const pct = side[seg]?.flowPct;
    return typeof pct === 'number' ? pct : 0;
  };

  const flow = calcStage(b, buyerNorms, BUYER_SEGMENTS, 'flow', getRawWeight);
  const hot = calcStage(b, buyerNorms, BUYER_SEGMENTS, 'hot', getRawWeight);
  const deals = calcStage(b, buyerNorms, BUYER_SEGMENTS, 'deals', getRawWeight);

  return {
    ir: flow * 0.33 + hot * 0.33 + deals * 0.34,
    stages: { flow, hot, deals },
  };
}

/**
 * Половина ИР по продавцу.
 * Вес сегмента — actON_сегмента / сумма_actON_по_сегментам
 * (симметрично покупателю: вес = доля сегмента в "первичной" базе работы).
 */
function calcSeller(s, sellerNorms) {
  const getRawWeight = (side, seg) => {
    const a = side[seg]?.actON;
    return typeof a === 'number' ? a : 0;
  };

  const actON = calcStage(s, sellerNorms, SELLER_SEGMENTS, 'actON', getRawWeight);
  const hotPer = calcStage(s, sellerNorms, SELLER_SEGMENTS, 'hotPer', getRawWeight);
  const deals = calcStage(s, sellerNorms, SELLER_SEGMENTS, 'deals', getRawWeight);

  return {
    ir: actON * 0.33 + hotPer * 0.33 + deals * 0.34,
    stages: { actON, hotPer, deals },
  };
}

/**
 * Полный расчёт ИР агента.
 *
 * @param {object} agent — объект из /archive/.../agents/{code}
 * @param {object} normatives — нормативы в формате STUB_NORMATIVES
 * @returns {{
 *   irTotal: number,
 *   irBuyer: number,
 *   irSeller: number,
 *   stages: {
 *     buyer: { flow: number, hot: number, deals: number },
 *     seller: { actON: number, hotPer: number, deals: number }
 *   }
 * } | null}
 */
export function calculateIR(agent, normatives) {
  if (!agent) {
    console.warn('[ir] calculateIR: agent не задан');
    return null;
  }
  if (!normatives) {
    console.warn('[ir] calculateIR: normatives не заданы');
    return null;
  }

  const buyer = calcBuyer(agent.b, normatives.buyer);
  const seller = calcSeller(agent.s, normatives.seller);

  return {
    irTotal: buyer.ir * 0.5 + seller.ir * 0.5,
    irBuyer: buyer.ir,
    irSeller: seller.ir,
    stages: {
      buyer: buyer.stages,
      seller: seller.stages,
    },
  };
}
