// =====================================================
// ПРОГНОЗ — Модуль чтения архива из Firebase
// =====================================================
// Этот файл подключается к дашборду (index.html / mop.html)
// и предоставляет функции для работы с историческими данными.
//
// Подключение: <script src="firebase-reader.js"></script>
// =====================================================

const PrognozArchive = (function() {
  
  // ⚠️ ВСТАВЬ СВОЙ URL FIREBASE (тот же что в архиваторе)
  const FIREBASE_URL = "https://prognoz-archive-default-rtdb.europe-west1.firebasedatabase.app/";
  
  
  // =====================================================
  // БАЗОВЫЕ ФУНКЦИИ ЧТЕНИЯ
  // =====================================================
  
  /** Прочитать данные из Firebase по URL */
  async function fetchJSON(path) {
    try {
      const url = `${FIREBASE_URL}/${path}.json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      console.error("Firebase read error:", e);
      return null;
    }
  }
  
  
  /** Получить индекс (список дат и последнюю дату) */
  async function getIndex() {
    return await fetchJSON("index");
  }
  
  
  /** Получить снимок за конкретную дату */
  async function getSnapshot(date) {
    const yearMonth = date.substring(0, 7);
    return await fetchJSON(`archive/${yearMonth}/${date}`);
  }
  
  
  /** Получить данные одного риэлтора за конкретную дату */
  async function getAgentOnDate(agentCode, date) {
    const yearMonth = date.substring(0, 7);
    return await fetchJSON(`archive/${yearMonth}/${date}/agents/${agentCode}`);
  }
  
  
  /** Получить список всех дат в месяце */
  async function getDatesInMonth(yearMonth) {
    const data = await fetchJSON(`index/months/${yearMonth}`);
    return data ? Object.keys(data).sort() : [];
  }
  
  
  // =====================================================
  // ИСТОРИЯ ИР ПО РИЭЛТОРУ
  // =====================================================
  
  /**
   * Получить историю ИР риэлтора за указанный период.
   * 
   * @param {string} agentCode - Код сотрудника
   * @param {string} period - 'week' | 'month' | '3months' | '6months' | 'year'
   * @returns {Array} [{ date, ir, irBuyer, irSeller, income, prod, position }]
   */
  async function getIRHistory(agentCode, period) {
    const dates = await getDateRange(period);
    const history = [];
    
    for (const date of dates) {
      const agent = await getAgentOnDate(agentCode, date);
      if (agent) {
        history.push({
          date: date,
          ir: agent.ir || 0,
          irBuyer: agent.irBuyer || 0,
          irSeller: agent.irSeller || 0,
          income: agent.income || 0,
          prod: agent.prod || 0,
          position: agent.position || null,
          buyerCode: agent.buyerCode || "000000",
          sellerCode: agent.sellerCode || "000000"
        });
      }
    }
    
    return history;
  }
  
  
  /**
   * Получить полную историю воронок риэлтора.
   * 
   * @param {string} agentCode - Код сотрудника
   * @param {string} period - 'week' | 'month' | '3months' | '6months' | 'year'
   * @returns {Array} [{ date, buyer: {...}, seller: {...} }]
   */
  async function getFunnelHistory(agentCode, period) {
    const dates = await getDateRange(period);
    const history = [];
    
    for (const date of dates) {
      const agent = await getAgentOnDate(agentCode, date);
      if (agent) {
        history.push({
          date: date,
          buyer: agent.buyer || {},
          seller: agent.seller || {},
          convHotBuyer: agent.convHotBuyer || 0,
          convDealBuyer: agent.convDealBuyer || 0,
          convHotSeller: agent.convHotSeller || 0,
          convDealSeller: agent.convDealSeller || 0
        });
      }
    }
    
    return history;
  }
  
  
  // =====================================================
  // СРЕДНИЕ ЗНАЧЕНИЯ ЗА ПЕРИОД
  // =====================================================
  
  /**
   * Рассчитать средние показатели риэлтора за период.
   * 
   * @param {string} agentCode - Код сотрудника
   * @param {string} period - 'week' | 'month' | '3months' | '6months' | 'year'
   * @returns {Object} { avgIR, avgIncome, avgProd, avgPosition, 
   *                      irTrend, incomeTrend, dataPoints, 
   *                      firstIR, lastIR, irDelta }
   */
  async function getAverages(agentCode, period) {
    const history = await getIRHistory(agentCode, period);
    
    if (history.length === 0) {
      return { 
        avgIR: 0, avgIncome: 0, avgProd: 0, avgPosition: null,
        irTrend: 'flat', incomeTrend: 'flat',
        dataPoints: 0, firstIR: 0, lastIR: 0, irDelta: 0
      };
    }
    
    const n = history.length;
    const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0);
    
    const avgIR = Math.round(sum(history, 'ir') / n);
    const avgIncome = Math.round(sum(history, 'income') / n);
    const avgProd = +(sum(history, 'prod') / n).toFixed(2);
    
    const positions = history.filter(h => h.position !== null);
    const avgPosition = positions.length > 0 
      ? Math.round(positions.reduce((s, h) => s + h.position, 0) / positions.length)
      : null;
    
    const firstIR = history[0].ir;
    const lastIR = history[n - 1].ir;
    const irDelta = lastIR - firstIR;
    
    // Тренд: сравниваем первую и вторую половину периода
    const half = Math.floor(n / 2);
    const firstHalfIR = sum(history.slice(0, half), 'ir') / (half || 1);
    const secondHalfIR = sum(history.slice(half), 'ir') / (n - half || 1);
    const irTrend = secondHalfIR > firstHalfIR + 2 ? 'up' : 
                    secondHalfIR < firstHalfIR - 2 ? 'down' : 'flat';
    
    const firstHalfIncome = sum(history.slice(0, half), 'income') / (half || 1);
    const secondHalfIncome = sum(history.slice(half), 'income') / (n - half || 1);
    const incomeTrend = secondHalfIncome > firstHalfIncome * 1.05 ? 'up' :
                        secondHalfIncome < firstHalfIncome * 0.95 ? 'down' : 'flat';
    
    return {
      avgIR, avgIncome, avgProd, avgPosition,
      irTrend, incomeTrend,
      dataPoints: n,
      firstIR, lastIR, irDelta
    };
  }
  
  
  /**
   * Рассчитать средние по ГРУППЕ менеджера за период.
   * 
   * @param {string} mopName - ФИО менеджера
   * @param {string} period - 'week' | 'month' | '6months'
   * @returns {Object} { avgIR, agentCount, greenCount, redCount, agents: [...] }
   */
  async function getGroupAverages(mopName, period) {
    const index = await getIndex();
    if (!index || !index.latest) return null;
    
    const latestDate = index.latest.date;
    const snapshot = await getSnapshot(latestDate);
    if (!snapshot || !snapshot.agents) return null;
    
    // Находим всех риэлторов менеджера
    const agentCodes = [];
    for (const code in snapshot.agents) {
      if (snapshot.agents[code].mop === mopName) {
        agentCodes.push(code);
      }
    }
    
    // Считаем средние по каждому
    const results = [];
    for (const code of agentCodes) {
      const avg = await getAverages(code, period);
      results.push({
        code: code,
        name: snapshot.agents[code].name,
        ...avg
      });
    }
    
    const n = results.length;
    if (n === 0) return { avgIR: 0, agentCount: 0, greenCount: 0, redCount: 0, agents: [] };
    
    const groupAvgIR = Math.round(results.reduce((s, r) => s + r.avgIR, 0) / n);
    const greenCount = results.filter(r => r.lastIR >= 60).length;
    const redCount = results.filter(r => r.lastIR < 35).length;
    
    return {
      avgIR: groupAvgIR,
      agentCount: n,
      greenCount: greenCount,
      redCount: redCount,
      agents: results.sort((a, b) => b.lastIR - a.lastIR) // отсортировано по ИР
    };
  }
  
  
  // =====================================================
  // ЭФФЕКТИВНОСТЬ РЕКОМЕНДАЦИЙ
  // =====================================================
  
  /**
   * Оценить эффективность рекомендаций: как изменился ИР
   * после определённой даты (когда были выданы рекомендации).
   * 
   * @param {string} agentCode - Код сотрудника
   * @param {string} recDate - Дата выдачи рекомендации (YYYY-MM-DD)
   * @param {number} daysAfter - Сколько дней после отслеживать (7, 14, 30)
   * @returns {Object} { irBefore, irAfter, irDelta, trend, 
   *                      codeBefore, codeAfter, improved }
   */
  async function evaluateRecommendation(agentCode, recDate, daysAfter) {
    daysAfter = daysAfter || 14;
    
    // ИР до рекомендации
    const before = await getAgentOnDate(agentCode, recDate);
    
    // ИР после
    const afterDate = addDays(recDate, daysAfter);
    const after = await getAgentOnDate(agentCode, afterDate);
    
    if (!before || !after) {
      return { irBefore: 0, irAfter: 0, irDelta: 0, trend: 'no_data', improved: false };
    }
    
    const irDelta = (after.ir || 0) - (before.ir || 0);
    
    return {
      irBefore: before.ir || 0,
      irAfter: after.ir || 0,
      irDelta: irDelta,
      trend: irDelta > 3 ? 'improved' : irDelta < -3 ? 'worsened' : 'stable',
      codeBefore: before.buyerCode + '/' + before.sellerCode,
      codeAfter: after.buyerCode + '/' + after.sellerCode,
      improved: irDelta > 0
    };
  }
  
  
  /**
   * Получить динамику кодов ситуаций (как менялась ситуация).
   * Полезно для отслеживания — улучшились ли "красные" зоны.
   * 
   * @param {string} agentCode
   * @param {string} period
   * @returns {Array} [{ date, buyerCode, sellerCode, buyerFlags, sellerFlags }]
   */
  async function getCodeHistory(agentCode, period) {
    const history = await getIRHistory(agentCode, period);
    
    return history.map(h => ({
      date: h.date,
      buyerCode: h.buyerCode,
      sellerCode: h.sellerCode,
      buyerFlags: parseCode(h.buyerCode),
      sellerFlags: parseCode(h.sellerCode)
    }));
  }
  
  
  // =====================================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // =====================================================
  
  /** Получить список дат за период */
  async function getDateRange(period) {
    const index = await getIndex();
    if (!index || !index.months) return [];
    
    const today = new Date();
    let startDate;
    
    switch (period) {
      case 'week':    startDate = addDays(formatDate(today), -7); break;
      case 'month':   startDate = addDays(formatDate(today), -30); break;
      case '3months': startDate = addDays(formatDate(today), -90); break;
      case '6months': startDate = addDays(formatDate(today), -180); break;
      case 'year':    startDate = addDays(formatDate(today), -365); break;
      default:        startDate = addDays(formatDate(today), -30);
    }
    
    const allDates = [];
    
    for (const yearMonth in index.months) {
      for (const date in index.months[yearMonth]) {
        if (date >= startDate) {
          allDates.push(date);
        }
      }
    }
    
    return allDates.sort();
  }
  
  
  /** Форматировать дату в YYYY-MM-DD */
  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  
  
  /** Добавить дни к дате */
  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return formatDate(d);
  }
  
  
  /** Распарсить 6-битный код в объект флагов */
  function parseCode(code) {
    const bits = String(code).padStart(6, '0').split('');
    return {
      distribution: bits[0] === '1',
      sufficiency: bits[1] === '1',
      hotEnough: bits[2] === '1',
      dealsEnough: bits[3] === '1',
      convHot: bits[4] === '1',
      convDeals: bits[5] === '1'
    };
  }
  
  
  /** Описание тренда для UI */
  function trendLabel(trend) {
    const labels = {
      up: '📈 Растёт',
      down: '📉 Падает',
      flat: '➡️ Стабильно',
      improved: '✅ Улучшение',
      worsened: '❌ Ухудшение',
      stable: '➡️ Без изменений',
      no_data: '❓ Нет данных'
    };
    return labels[trend] || trend;
  }
  
  
  // =====================================================
  // ПУБЛИЧНЫЙ API
  // =====================================================
  return {
    // Базовое чтение
    getIndex,
    getSnapshot,
    getAgentOnDate,
    getDatesInMonth,
    
    // История
    getIRHistory,
    getFunnelHistory,
    getCodeHistory,
    
    // Аналитика
    getAverages,
    getGroupAverages,
    evaluateRecommendation,
    
    // Утилиты
    parseCode,
    trendLabel
  };
  
})();


// =====================================================
// ПРИМЕР ИСПОЛЬЗОВАНИЯ В ДАШБОРДЕ:
// =====================================================
//
// // Получить средние за 6 месяцев для Веденёвой:
// const avg = await PrognozArchive.getAverages("1231215411", "6months");
// console.log(`Средний ИР: ${avg.avgIR}%, тренд: ${avg.irTrend}`);
//
// // Получить историю ИР для графика:
// const history = await PrognozArchive.getIRHistory("1231215411", "6months");
// // history = [{ date: "2026-01-15", ir: 44, ... }, { date: "2026-02-15", ir: 49, ... }, ...]
//
// // Оценить эффективность рекомендации:
// const eval = await PrognozArchive.evaluateRecommendation("1231215411", "2026-04-01", 14);
// console.log(`ИР до: ${eval.irBefore}%, после: ${eval.irAfter}%, ${eval.trend}`);
//
// // Средние по группе менеджера:
// const group = await PrognozArchive.getGroupAverages("Бондарчук Е.В.", "month");
// console.log(`Средний ИР группы: ${group.avgIR}%, зелёных: ${group.greenCount}`);
//
// =====================================================
