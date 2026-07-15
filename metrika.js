/*
 * metrika.js — Яндекс.Метрика для «Прогноза» (подключается во все кабинеты + login).
 *
 * Режим: ТОЛЬКО статистика, БЕЗ Вебвизора (webvisor:false) и без записи форм —
 * на страницах видны ФИО и доходы сотрудников, их нельзя отправлять на серверы
 * Яндекса записью сессий (решение Егора 15.07.2026, ПД сотрудников).
 * Считаем: посещения, страницы, устройства, гео, активность по времени.
 *
 * Номер счётчика — в YM_COUNTER_ID ниже (создаётся в metrika.yandex.ru на prognoz.info).
 */

(function () {
  var YM_COUNTER_ID = 110753499; // счётчик prognoz.info (создан 15.07.2026)
  if (!YM_COUNTER_ID || typeof YM_COUNTER_ID !== 'number') return; // пока номер не задан — не грузим

  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) { return; } }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  ym(YM_COUNTER_ID, 'init', {
    clickmap: true,          // карта кликов
    trackLinks: true,        // клики по внешним ссылкам
    accurateTrackBounce: true,
    webvisor: false,         // ЗАПИСЬ СЕССИЙ ВЫКЛЮЧЕНА (ПД сотрудников)
    trackHash: true,         // учитывать переходы между табами (#hash), если появятся
  });

  // Какой это кабинет — по имени HTML-файла (у каждого кабинета свой файл).
  function cabName() {
    var p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return ({
      'index.html': 'partner', '': 'partner',
      'mop.html': 'mop', 'rop.html': 'rop', 'aup.html': 'aup', 'login.html': 'login',
    })[p] || 'other';
  }
  function cabLabel(cab) {
    return ({ partner: 'Партнёр', mop: 'Старший партнёр', rop: 'Управляющий партнёр', aup: 'АУП', login: 'Вход' })[cab] || cab;
  }
  var CAB = cabName();

  // Отчёт «по кабинетам» — параметр визита. В Метрике: Отчёты → Посетители →
  // Параметры визитов → «Кабинет».
  try { if (window.ym) ym(YM_COUNTER_ID, 'params', { 'Кабинет': cabLabel(CAB) }); } catch (e) {}

  var TAB_LABEL = {
    main: 'Главная', prognoz: 'Прогноз', coach: 'Тренер', clients: 'Клиенты',
    tasks: 'Задачи и календарь', svetofor: 'Светофор',
    team: 'Команда', groups: 'Старшие партнёры', depts: 'Отделы',
  };

  // Кабинеты — SPA с табами внутри одной страницы (URL не меняется). Шлём
  // виртуальный «просмотр» при переключении таба, чтобы Метрика строила дерево
  // /cab/{кабинет}/{таб} (Отчёты → Содержание → Популярное). Безопасно: если
  // Метрика не загрузилась — молча ничего не делает.
  window.ymTab = function (tabId) {
    var t = tabId || 'main';
    var url = location.origin + '/cab/' + CAB + '/' + t;
    try { if (window.ym) ym(YM_COUNTER_ID, 'hit', url, { title: cabLabel(CAB) + ' — ' + (TAB_LABEL[t] || t) }); } catch (e) {}
  };

  // Общий хелпер (произвольный виртуальный просмотр), на будущее.
  window.ymHit = function (url) {
    try { if (window.ym) ym(YM_COUNTER_ID, 'hit', url || location.href); } catch (e) {}
  };
})();
