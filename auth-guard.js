/**
 * auth-guard.js — защита страниц дашборда «Прогноз»
 *
 * Подключение в каждой защищённой странице ПЕРЕД остальными скриптами:
 *   <script type="module">
 *     import { requireAuth, getCurrentUser, logout, requireRole } from './auth-guard.js';
 *     const user = await requireAuth();  // редиректнет на login.html, если не авторизован
 *     // user = { code, role, name, seesAll }
 *   </script>
 *
 * Доп. опции:
 *   await requireAuth({ allowedRoles: ['mop', 'rop', 'aup', 'admin'] });
 *   // если роль не в списке — редирект на index.html
 */

import { initializeApp, getApps }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

// КОНФИГ — должен совпадать с login.html
const firebaseConfig = {
  databaseURL: 'https://prognoz-archive-default-rtdb.europe-west1.firebasedatabase.app',
  apiKey: 'AIzaSyCOSLUKCQMhV4HL5Rgle38e3NHeZis6wyU',
  authDomain: 'prognoz-archive.firebaseapp.com',
  projectId: 'prognoz-archive',
  appId: '1:47892435250:web:2efc1123c3191ce556472b',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

const LOGIN_URL = 'login.html';

/**
 * Возвращает promise с данными авторизованного пользователя.
 * Если пользователь не вошёл — редиректит на login.html и promise никогда не резолвится.
 *
 * @param {object} opts
 * @param {string[]} [opts.allowedRoles] — если задан, проверяет, что роль входит в список
 * @returns {Promise<{code, role, name, seesAll}>}
 */
export function requireAuth(opts = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        const back = encodeURIComponent(location.pathname + location.search);
        location.href = `${LOGIN_URL}?back=${back}`;
        return;
      }
      // ID Token → claims → роль
      const idToken = await firebaseUser.getIdTokenResult();
      const claims = idToken.claims || {};
      const userInfo = {
        code: firebaseUser.uid,
        role: claims.role || 'realtor',
        name: claims.name || '',
        seesAll: !!claims.seesAll,
      };

      if (opts.allowedRoles && !opts.allowedRoles.includes(userInfo.role)) {
        // Не та роль — кидаем на главную риелтора
        alert('У вас нет доступа к этой странице.');
        location.href = 'index.html';
        return;
      }
      // Авто-роутинг по роли (если зашёл на index.html без явного ?agent=).
      // Сессия Firebase сохранена локально, поэтому при возврате на сайт
      // пользователь часто попадает на index.html — а МОП/РОП/АУП должны
      // открываться на своих кабинетах. Свой кабинет риелтора руководители
      // всё равно могут открыть явно: index.html?agent=<свой_код>.
      const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      const hasAgentParam = new URLSearchParams(location.search).has('agent');
      const homeByRole = { mop: 'mop.html', rop: 'rop.html', aup: 'aup.html', admin: 'aup.html' };
      const home = homeByRole[userInfo.role];
      if (home && path === 'index.html' && !hasAgentParam) {
        location.href = home;
        return;
      }
      resolve(userInfo);
    });
  });
}

/**
 * Текущий пользователь (синхронно). Возвращает null, если ещё не загрузился.
 * Удобно использовать ПОСЛЕ requireAuth().
 */
export function getCurrentUser() {
  const u = auth.currentUser;
  if (!u) return null;
  return { code: u.uid };
}

/** Выход — кидает на /login.html */
export async function logout() {
  await signOut(auth);
  location.href = LOGIN_URL;
}

/**
 * Проверка прав на чтение конкретного агента.
 * Локальная проверка (для UI), боевая защита — в Firebase Rules.
 *
 * @param {object} user — результат requireAuth()
 * @param {string} agentCode — код агента, к которому проверяем доступ
 * @param {object} userData — содержимое /users/{user.code}, если уже загружено
 * @returns {boolean}
 */
export function canRead(user, agentCode, userData) {
  if (!user) return false;
  if (user.code === agentCode) return true;
  if (user.seesAll) return true;
  if (user.role === 'admin') return true;
  if (userData?.subordinates?.[agentCode]) return true;
  return false;
}
