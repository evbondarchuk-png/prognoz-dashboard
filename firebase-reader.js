/**
 * firebase-reader.js — чтение архива «Прогноз» из Firebase RTDB.
 *
 * ES-модуль. Подключение в защищённой странице ПОСЛЕ requireAuth():
 *   <script type="module">
 *     import { requireAuth } from './auth-guard.js';
 *     import { getAgent, getSubordinates } from './firebase-reader.js';
 *     const user = await requireAuth();
 *     const me = await getAgent(user.code);   // мои данные из последнего снимка
 *   </script>
 *
 * Все запросы идут через Firebase SDK (использует токен текущего пользователя)
 * либо через REST с `?auth=<idToken>`. Firebase Rules применяются автоматически.
 *
 * Принцип: при отсутствии данных или ошибке прав — возвращаем null + console.warn.
 * Дашборд сам решает, показать ли хардкод-fallback или сообщение об ошибке.
 *
 * Структуры данных см. в CLAUDE.md §4. ИР здесь НЕ считаем — это отдельный модуль.
 */

import { initializeApp, getApps }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDatabase, ref, get }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

const firebaseConfig = {
  databaseURL: 'https://prognoz-archive-default-rtdb.europe-west1.firebasedatabase.app',
  apiKey: 'AIzaSyCOSLUKCQMhV4HL5Rgle38e3NHeZis6wyU',
  authDomain: 'prognoz-archive.firebaseapp.com',
  projectId: 'prognoz-archive',
  appId: '1:47892435250:web:2efc1123c3191ce556472b',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Кэш последней даты на время сессии страницы — чтобы не дёргать /archive повторно
let _cachedLatestDate = null;

/** Прочитать узел через SDK. Возвращает значение или null. */
async function readNode(path) {
  try {
    const snap = await get(ref(db, path));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.warn(`[firebase-reader] чтение ${path}: ${e.message}`);
    return null;
  }
}

/**
 * Получить только список ключей узла (без значений) через REST shallow-запрос.
 * Используется для поиска последней даты в /archive/{месяц}.
 */
async function listChildKeys(path) {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[firebase-reader] listChildKeys: пользователь не авторизован');
    return null;
  }
  try {
    const idToken = await user.getIdToken();
    const url = `${firebaseConfig.databaseURL}/${path}.json`
      + `?shallow=true&auth=${encodeURIComponent(idToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[firebase-reader] shallow ${path}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data ? Object.keys(data) : [];
  } catch (e) {
    console.warn(`[firebase-reader] shallow ${path}: ${e.message}`);
    return null;
  }
}

/**
 * Найти последнюю дату снимка в /archive/.
 * Алгоритм: читаем ключи /archive/{текущий-месяц}, берём максимальный.
 * Если месяц пуст — откатываемся на предыдущий, до 12 месяцев назад.
 *
 * @returns {Promise<string|null>} 'YYYY-MM-DD' или null, если ничего не найдено
 */
export async function getLatestSnapshotDate() {
  if (_cachedLatestDate) return _cachedLatestDate;

  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const keys = await listChildKeys(`archive/${ym}`);
    if (keys && keys.length > 0) {
      const dates = keys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
      if (dates.length > 0) {
        _cachedLatestDate = dates[dates.length - 1];
        return _cachedLatestDate;
      }
    }
  }
  console.warn('[firebase-reader] последний снимок не найден за 12 месяцев');
  return null;
}

/**
 * Прочитать данные одного агента из снимка архива.
 * Структура объекта — как в CLAUDE.md §4.2 (сырая, без преобразований).
 *
 * @param {string} code — код сотрудника
 * @param {string} [date] — 'YYYY-MM-DD'; если не указан, берётся последний снимок
 * @returns {Promise<object|null>}
 */
export async function getAgent(code, date) {
  if (!code) {
    console.warn('[firebase-reader] getAgent: не указан код агента');
    return null;
  }
  const snapDate = date || await getLatestSnapshotDate();
  if (!snapDate) return null;

  const ym = snapDate.substring(0, 7);
  const data = await readNode(`archive/${ym}/${snapDate}/agents/${code}`);
  if (!data) {
    console.warn(`[firebase-reader] агент ${code} на ${snapDate} не найден`);
  }
  return data;
}

/**
 * Прочитать профиль пользователя из /users/{code}.
 * Нужен для иерархии (subordinates/mopCode/ropCode) и для canRead().
 *
 * @param {string} code
 * @returns {Promise<object|null>}
 */
export async function getUser(code) {
  if (!code) {
    console.warn('[firebase-reader] getUser: не указан код');
    return null;
  }
  const data = await readNode(`users/${code}`);
  if (!data) {
    console.warn(`[firebase-reader] пользователь ${code} не найден в /users/`);
  }
  return data;
}

/**
 * Список подчинённых менеджера с их данными из последнего (или указанного) снимка.
 * Берёт /users/{code}/subordinates и по каждому подтягивает getAgent().
 *
 * @param {string} code — код менеджера
 * @param {string} [date] — 'YYYY-MM-DD'; если не указан, берётся последний снимок
 * @returns {Promise<Array<{code: string, data: object|null}>>}
 *   Элементы с data=null — подчинённые, которых нет в архиве (например, новички).
 *   Решение, как их отображать, оставлено вызывающему коду.
 */
export async function getSubordinates(code, date) {
  const user = await getUser(code);
  if (!user) return [];

  const subs = user.subordinates;
  if (!subs || typeof subs !== 'object') return [];

  const codes = Object.keys(subs);
  if (codes.length === 0) return [];

  const snapDate = date || await getLatestSnapshotDate();
  if (!snapDate) return codes.map(c => ({ code: c, data: null }));

  const agents = await Promise.all(codes.map(c => getAgent(c, snapDate)));
  return codes.map((c, i) => ({ code: c, data: agents[i] }));
}
