/**
 * analytics.js — трекер активности пользователей (TZ-ANALYTICS §3).
 * Используется во всех кабинетах: index/mop/rop/aup.
 *
 * Собирает события в буфер и отправляет батчем каждые 30с
 * через window.__call (httpsCallable).
 *
 * data-track атрибуты на HTML-элементах:
 *   <button data-track="tab_switch" data-track-target="prognoz">Прогноз</button>
 *   <div data-track="funnel_expand" data-track-target="objects">...</div>
 *   data-track-target — обязательный, data-track-action — опционально
 *   data-track-meta — JSON-строка с дополнительными данными
 */

(function () {
  // Только если есть Firebase callable
  if (!window.__call) {
    // тихо ждём, может подключиться позже
    const check = setInterval(() => {
      if (window.__call) { clearInterval(check); init(); }
    }, 1000);
    setTimeout(() => clearInterval(check), 10000);
    return;
  }
  init();

  function init() {
    // Session ID
    let sessionId = localStorage.getItem('analytics_sid');
    if (!sessionId) {
      sessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('analytics_sid', sessionId);
    }

    // Буфер
    const buffer = [];
    let timer = null;
    const MAX_BEFORE_FLUSH = 30;

    function track(event, opts) {
      if (!event) return;
      opts = opts || {};
      buffer.push({
        event: event,
        page: opts.page || window._analyticsPage || location.pathname.replace(/\.html$/, '') || '/',
        action: opts.action || '',
        target: opts.target || '',
        metadata: opts.metadata || {},
        session_id: sessionId,
        ua: navigator.userAgent || '',
      });
      if (buffer.length >= MAX_BEFORE_FLUSH) flush();
      else scheduleFlush();
    }

    function scheduleFlush() {
      if (timer) return;
      timer = setTimeout(flush, 30000);
    }

    async function flush() {
      timer = null;
      const batch = buffer.splice(0);
      if (!batch.length) return;
      try {
        await window.__call('logEvent', { events: batch });
      } catch (e) {
        // тихо — не ломаем UX
      }
    }

    // Экспорт в window
    window.__analytics = { track, flush, sessionId };

    // ---- Автоматические события ----

    // 1. Page view при загрузке
    if (document.readyState === 'complete') {
      track('page_view');
    } else {
      window.addEventListener('load', () => track('page_view'));
    }

    // 2. Session start (1 раз за сессию)
    if (!sessionStorage.getItem('analytics_session_started')) {
      sessionStorage.setItem('analytics_session_started', '1');
      track('session_start');
    }

    // 3. Heartbeat раз в 5 минут (чтобы понимать, что пользователь не ушёл)
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        track('session_heartbeat');
      }
    }, 300000);

    // 4. Ошибки
    window.addEventListener('error', (e) => {
      track('error', { metadata: { msg: (e.message || '').slice(0, 100) } });
    });

    // 5. data-track click handler
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-track]');
      if (!el) return;
      const ev = el.getAttribute('data-track');
      const target = el.getAttribute('data-track-target') || '';
      const action = el.getAttribute('data-track-action') || 'click';
      let meta = {};
      const metaStr = el.getAttribute('data-track-meta');
      if (metaStr) try { meta = JSON.parse(metaStr); } catch (x) { /* ignore */ }
      track(ev, { target, action, metadata: meta });
    });

    // 6. Tab switch tracking (для встроенных табов)
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab && tab.getAttribute('data-tab')) {
        // Проверим, что это не data-track уже обработано
        if (!tab.hasAttribute('data-track')) {
          track('tab_switch', { target: tab.getAttribute('data-tab') });
        }
      }
    });

    // 7. beforeunload — сбросить буфер
    window.addEventListener('beforeunload', () => {
      const batch = buffer.splice(0);
      if (!batch.length) return;
      // sendBeacon не блокирует уход со страницы
      try {
        const data = JSON.stringify({ events: batch });
        navigator.sendBeacon(
          'https://europe-west1-prognoz-archive.cloudfunctions.net/logEvent-analytics',
          data
        );
      } catch (e) { /* ignore */ }
    });

    console.log('[analytics] трекер запущен, сессия', sessionId.slice(0, 16) + '…');
  }
})();