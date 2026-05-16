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
 * Все запросы идут через Firebase SDK — токен текущего пользователя
 * подкладывается автоматически, Firebase Rules применяются как обычно.
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
 * Найти последнюю дату снимка в /archive/.
 * Алгоритм: зондируем /archive/{ym}/{date}/meta с сегодня назад по дням.
 * Узел meta содержит { agentsCount, date, timestamp, version, yearMonth }
 * и открыт на чтение любому авторизованному пользователю (Firebase Rules).
 * В normal case — 1-2 запроса (сегодня → вчера, в зависимости от времени
 * запуска архиватора). Лимит 30 дней покрывает любой реалистичный простой.
 *
 * @returns {Promise<string|null>} 'YYYY-MM-DD' или null, если ничего не найдено
 */
export async function getLatestSnapshotDate() {
  if (_cachedLatestDate) return _cachedLatestDate;

  const MAX_DAYS_BACK = 30;
  const today = new Date();

  for (let i = 0; i < MAX_DAYS_BACK; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const date = `${ym}-${String(d.getDate()).padStart(2, '0')}`;

    const meta = await readNode(`archive/${ym}/${date}/meta`);
    if (meta) {
      _cachedLatestDate = date;
      return _cachedLatestDate;
    }
  }

  console.warn(`[firebase-reader] последний снимок не найден за ${MAX_DAYS_BACK} дней`);
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
