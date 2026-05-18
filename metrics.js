/**
 * metrics.js — общие метрики над массивами агентов.
 *
 * ES-модуль. Используется в rop.html (Шаг 2 ТЗ кабинета РОПа), позже —
 * в mop.html (когда захотим разрезы по стажу там). НЕ переписывать
 * границы сегментов в дашбордах — править здесь.
 */

export const STAZH_SEGMENTS = [
  { key: '0-3',  label: '0–3 мес',  min: 0,  max: 3  },
  { key: '4-6',  label: '4–6 мес',  min: 4,  max: 6  },
  { key: '7-12', label: '7–12 мес', min: 7,  max: 12 },
  { key: '12+',  label: '12+ мес',  min: 13, max: Infinity },
];

/**
 * Разбить массив агентов на сегменты по `agent.stazh` (стаж в месяцах).
 *
 * @param {Array<object>} agents — объекты агентов из архива (должны иметь поле stazh)
 * @returns {Object} ключ сегмента → массив агентов; ключи из STAZH_SEGMENTS.
 *   Агенты без поля stazh попадают в сегмент '0-3' (наиболее консервативно —
 *   воспринимаем как новичков).
 */
export function segmentByStazh(agents) {
  const out = {};
  for (const seg of STAZH_SEGMENTS) out[seg.key] = [];
  for (const a of agents || []) {
    const stazh = (typeof a?.stazh === 'number') ? a.stazh : 0;
    const seg = STAZH_SEGMENTS.find(s => stazh >= s.min && stazh <= s.max);
    if (seg) out[seg.key].push(a);
  }
  return out;
}
