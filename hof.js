/**
 * hof.js v11 — витрина «⭐ Звёзды» (общая для всех кабинетов).
 *
 * Переделка по решению Егора 01.09.2026: витрина «Награды коллег» убрана —
 * теперь только Звёзды с ТАБАМИ-МЕТРИКАМИ: Задатки · Сделки · Валовка ·
 * Набор объектов · Набор покупателей. Периоды: день / неделя (пн–вс) / месяц.
 * Срезы по роли смотрящего: Моя группа / Мой отдел / Компания.
 * Клик по карточке → все медали человека (hofDirectory, без списка-рейтинга).
 * Данные: callable starsData (/stars, крон 04:40 UTC; метрики из архива
 * накопительно: месяц = последний день, день/неделя = дельты срезов).
 * Медали star_* и /stars/top считаются по задаткам+сделкам — не менялись.
 */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var ROLE = { realtor: 'Партнёр', mop: 'Старший партнёр', rop: 'Управляющий партнёр', aup: 'АУП' };
  var TL = { common: 'обычная', rare: 'редкая', epic: 'эпическая', legend: 'легендарная' };
  var CACHE = null, VIEWER = {};

  var STARS = null;         // {entries, viewer, date, week_start}
  var PERIOD = 'day';       // 'day' | 'week' | 'month'
  var SS = 'group';         // срез: group | dept | company
  var PAGE = 1;             // страница (по 8 карточек)
  var METRIC = 'dep';       // выбранная метрика (ключ в entries[i][period])
  var RU_M = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var RU_M_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var MEDAL = ['🥇', '🥈', '🥉'];

  // Табы-метрики (решение Егора 01.09). pair — вторичная метрика карточки
  // (для задатков показываем сделки рядом и наоборот), sort2 — tiebreaker.
  var METRICS = [
    { k: 'dep',    label: '🤝 Задатки',            icon: '🤝', pair: 'closed', fmt: 'int', unit: 'dep' },
    { k: 'closed', label: '🏠 Сделки',             icon: '🏠', pair: 'dep',    fmt: 'int', unit: 'deal' },
    { k: 'rev',    label: '💰 Валовка',            icon: '💰', fmt: 'rub' },
    { k: 'sflow',  label: '🗝 Набор объектов',     icon: '🗝', fmt: 'int', unit: 'obj' },
    { k: 'bflow',  label: '📥 Набор покупателей',  icon: '📥', fmt: 'int', unit: 'man' }
  ];
  function metricDef() { for (var i = 0; i < METRICS.length; i++) { if (METRICS[i].k === METRIC) return METRICS[i]; } return METRICS[0]; }

  function dt(ts) { try { return ts ? new Date(ts).toLocaleDateString('ru-RU') : '—'; } catch (e) { return '—'; } }
  function dtHuman(d) { if (!d || d.length < 10) return ''; return +d.slice(8, 10) + ' ' + (RU_M[+d.slice(5, 7) - 1] || ''); }
  function plural(n, forms) { var m = n % 10, h = n % 100; if (m === 1 && h !== 11) return forms[0]; if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return forms[1]; return forms[2]; }
  function unitWord(kind, n) {
    if (kind === 'dep') return plural(n, ['задаток', 'задатка', 'задатков']);
    if (kind === 'deal') return plural(n, ['сделка', 'сделки', 'сделок']);
    if (kind === 'obj') return plural(n, ['объект', 'объекта', 'объектов']);
    if (kind === 'man') return plural(n, ['заявка', 'заявки', 'заявок']);
    return '';
  }
  function fmtRub(n) { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' млн ₽'; if (n >= 1e3) return Math.round(n / 1e3) + 'к ₽'; return Math.round(n) + ' ₽'; }

  function metricBar() {
    return '<div class="hd-tabs">' + METRICS.map(function (m) {
      return '<button class="hd-tab' + (METRIC === m.k ? ' on' : '') + '" onclick="__starsMetric(\'' + m.k + '\')">' + m.label + '</button>';
    }).join('') + '</div>';
  }

  // ── строки по выбранной метрике (нули по метрике не показываем) ──
  function starRows() {
    var arr = (STARS && STARS.entries ? STARS.entries.slice() : []);
    var v = STARS && STARS.viewer || {};
    if (SS === 'group' && v.mop) arr = arr.filter(function (x) { return String(x.mop) === String(v.mop); });
    if (SS === 'dept' && v.rop) arr = arr.filter(function (x) { return String(x.rop) === String(v.rop); });
    var def = metricDef();
    arr = arr.filter(function (x) { var m = x[PERIOD] || {}; return (m[def.k] || 0) > 0; });
    arr.sort(function (a, b) {
      var pa = (a[PERIOD] || {}), pb = (b[PERIOD] || {});
      var d = (pb[def.k] || 0) - (pa[def.k] || 0);
      if (d) return d;
      if (def.k === 'dep') d = (pb.closed || 0) - (pa.closed || 0);       // звезда = задатки, при равенстве сделки
      else if (def.k === 'closed') d = (pb.dep || 0) - (pa.dep || 0);
      if (d) return d;
      return a.name < b.name ? -1 : 1;
    });
    return arr;
  }

  function ini(name) { var p = String(name || '?').trim().split(/\s+/); return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || ''); }
  function shortName(name) { var p = String(name || '').trim().split(/\s+/); return esc((p[0] || '') + ' ' + ((p[1] || ''))); }

  function metricHtml(m, def) {
    var v = m[def.k] || 0;
    if (def.fmt === 'rub') return '<b>' + fmtRub(v) + '</b>';
    return '<b>' + def.icon + ' ' + v + '</b> ' + unitWord(def.unit, v);
  }
  function starCard(x, place) {
    var m = x[PERIOD] || {};
    var me = STARS && STARS.viewer && String(STARS.viewer.code) === String(x.code);
    var photo = x.photo
      ? '<img class="st-photo" src="' + esc(x.photo) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.querySelector(\'.st-ini\').style.display=\'flex\'"><div class="st-ini" style="display:none">' + esc(ini(x.name)) + '</div>'
      : '<div class="st-ini">' + esc(ini(x.name)) + '</div>';
    var def = metricDef();
    var metrics = [metricHtml(m, def)];
    if (def.pair && (m[def.pair] || 0) > 0) {
      var pd = def.pair === 'closed'
        ? { k: 'closed', icon: '🏠', fmt: 'int', unit: 'deal' }
        : { k: 'dep', icon: '🤝', fmt: 'int', unit: 'dep' };
      metrics.push('<span class="st-sec">' + metricHtml(m, pd) + '</span>');
    }
    return '<div class="st-card' + (place < 3 ? ' top t' + place : '') + (me ? ' me' : '') + '" onclick="__hofOpen(\'' + esc(x.code) + '\')">' +
      '<div class="st-rank">' + (place < 3 ? MEDAL[place] : (place + 1)) + '</div>' +
      '<div class="st-av">' + photo + '</div>' +
      '<div class="st-name">' + shortName(x.name) + (me ? '<span class="st-me">⭐ это вы</span>' : '') + '</div>' +
      '<div class="st-metrics">' + metrics.join(' · ') + '</div></div>';
  }

  function renderStars() {
    var body = document.getElementById('hdBody');
    if (!STARS) {
      body.innerHTML = metricBar() + '<div class="hd-empty">Считаю звёзды…</div>';
      window.__call('starsData', {}).then(function (r) {
        STARS = { entries: (r && r.entries) || [], viewer: (r && r.viewer) || {}, date: (r && r.date) || null, week_start: (r && r.week_start) || null };
        renderStars();
      }).catch(function (e) {
        body.innerHTML = metricBar() + '<div class="hd-empty">Не удалось загрузить: ' + esc(e.message || e) + '</div>';
      });
      return;
    }
    var arr = starRows();
    var v = STARS.viewer || {};
    var myIdx = -1;
    for (var i = 0; i < arr.length; i++) { if (String(arr[i].code) === String(v.code)) { myIdx = i; break; } }
    var def = metricDef();
    var myM = myIdx >= 0 ? (arr[myIdx][PERIOD] || {}) : null;

    var PER = 8;
    var totalPages = Math.max(1, Math.ceil(arr.length / PER));
    if (PAGE > totalPages) PAGE = totalPages;
    if (PAGE < 1) PAGE = 1;
    var from = (PAGE - 1) * PER;
    var page = arr.slice(from, from + PER);

    var pchips = [['day', 'За день'], ['week', 'За неделю'], ['month', 'За месяц']].map(function (p) {
      return '<button class="hd-chip' + (PERIOD === p[0] ? ' on' : '') + '" onclick="__starsPeriod(\'' + p[0] + '\')">' + p[1] + '</button>';
    }).join('');
    var schips = '';
    if (v.mop) schips += '<button class="hd-chip' + (SS === 'group' ? ' on' : '') + '" onclick="__starsScope(\'group\')">Моя группа</button>';
    if (v.rop) schips += '<button class="hd-chip' + (SS === 'dept' ? ' on' : '') + '" onclick="__starsScope(\'dept\')">Мой отдел</button>';
    schips += '<button class="hd-chip' + (SS === 'company' ? ' on' : '') + '" onclick="__starsScope(\'company\')">Компания</button>';

    var when = PERIOD === 'day' ? 'за ' + dtHuman(STARS.date)
      : PERIOD === 'week' ? ('с ' + dtHuman(STARS.week_start) + ' по ' + dtHuman(STARS.date))
      : 'за ' + (STARS.date ? RU_M_NOM[+STARS.date.slice(5, 7) - 1] : '');
    var meLine = myIdx >= 0
      ? (myIdx < PER
        ? '<div class="st-meline">⭐ Вы — звезда этого списка!</div>'
        : '<div class="st-meline">⭐ Вы в списке: ' + metricHtml(myM, def) + ' — ' + (myIdx + 1) + '-е место</div>')
      : '';

    var pager = totalPages > 1
      ? '<div class="st-pager">' +
        '<button class="st-pg" ' + (PAGE <= 1 ? 'disabled' : '') + ' onclick="__starsPage(-1)">←</button>' +
        '<span>' + PAGE + ' / ' + totalPages + '</span>' +
        '<button class="st-pg" ' + (PAGE >= totalPages ? 'disabled' : '') + ' onclick="__starsPage(1)">→</button>' +
        '<span class="hd-meta" style="margin:0 0 0 6px">' + (from + 1) + '–' + Math.min(from + PER, arr.length) + ' из ' + arr.length + '</span></div>'
      : '';

    body.innerHTML = metricBar() +
      '<div class="hd-bar"><div class="hd-chips">' + pchips + '</div><div class="hd-chips">' + schips + '</div></div>' +
      '<div class="hd-meta">' + esc(when) + '</div>' +
      meLine +
      '<div class="st-grid">' + (page.map(function (x, i) { return starCard(x, from + i); }).join('') || '<div class="hd-empty">Пока пусто — данные приходят к утру</div>') + '</div>' +
      pager;
  }

  window.__starsMetric = function (k) { METRIC = k; PAGE = 1; renderStars(); };
  window.__starsPeriod = function (p) { PERIOD = p; PAGE = 1; renderStars(); };
  window.__starsScope = function (s) { SS = s; PAGE = 1; renderStars(); };
  window.__starsPage = function (d) { PAGE += d; renderStars(); };
  window.__openStars = function () { window.openHofDir(); };

  // детали человека: все его медали (клик по карточке звезды)
  window.__hofOpen = function (code) {
    var x = (STARS && STARS.entries ? STARS.entries : []).filter(function (i) { return String(i.code) === String(code); })[0];
    var hc = (CACHE || []).filter(function (i) { return String(i.code) === String(code); })[0];
    var b = document.getElementById('hdBody');
    b.innerHTML = '<div class="hd-empty">Загружаю…</div>';
    window.__call('hofDirectory', { code: code }).then(function (r) {
      var badges = (r && r.badges) || [];
      var bl = badges.map(function (bd) {
        return '<div class="hd-b r-' + esc(bd.tier) + '"><span class="hd-b-e">' + esc(bd.emoji) + '</span>' +
          '<div class="hd-b-m"><div class="hd-b-t">' + esc(bd.title) + '</div>' +
          '<div class="hd-b-s">' + esc(TL[bd.tier] || bd.tier || '') + ' · получена ' + dt(bd.earned_at) +
          (bd.hits ? ' · попаданий в топ-8: ' + bd.hits : '') + '</div>' +
          (bd.crit ? '<div class="hd-b-c">' + esc(bd.crit) + '</div>' : '') + '</div></div>';
      }).join('');
      b.innerHTML = '<button class="hd-back" onclick="__hofBack()">← К звёздам</button>' +
        '<div class="hd-head"><div class="hd-hn">' + (x ? esc(x.name) : (hc ? esc(hc.name) : esc(code))) + '</div>' +
        '<div class="hd-hs">' + (hc ? esc(ROLE[hc.role] || '') + ' · Ур.' + hc.level + ' · ' + hc.xp + ' XP' : '') + '</div></div>' +
        '<div class="hd-badges">' + (bl || '<div class="hd-empty">Пока без наград</div>') + '</div>';
    }).catch(function (e) { b.innerHTML = '<div class="hd-empty">Не удалось загрузить: ' + esc(e.message || e) + '</div>'; });
  };
  window.__hofBack = function () { renderStars(); };

  function ensureStyles() {
    if (document.getElementById('hofDirStyles')) return;
    var st = document.createElement('style'); st.id = 'hofDirStyles'; st.textContent =
      '#modalHofDir{position:fixed;inset:0;background:rgba(15,20,35,.55);display:none;align-items:center;justify-content:center;z-index:1200;padding:16px}' +
      '#modalHofDir.on{display:flex}' +
      '#modalHofDir .hd-card{background:var(--surface,#fff);border-radius:14px;max-width:760px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(20,30,55,.25);overflow:hidden}' +
      '#modalHofDir .hd-top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 6px}' +
      '#modalHofDir .hd-title{font-size:17px;font-weight:800;color:var(--ink,#1a1f2e)}' +
      '#modalHofDir .hd-x{background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted,#7a8194)}' +
      '#modalHofDir #hdBody{padding:0 18px 18px;overflow-y:auto}' +
      '#modalHofDir .hd-tabs{display:flex;gap:6px;margin:2px 0 10px;border-bottom:2px solid var(--line,#e6e8ee);flex-wrap:wrap}' +
      '#modalHofDir .hd-tab{background:none;border:none;padding:8px 10px;font-size:13px;font-weight:700;color:var(--muted,#7a8194);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;font-family:inherit;white-space:nowrap}' +
      '#modalHofDir .hd-tab.on{color:var(--brand,#2b6cb0);border-bottom-color:var(--brand,#2b6cb0)}' +
      '#modalHofDir .hd-bar{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}' +
      '#modalHofDir .hd-chips{display:flex;gap:6px;flex-wrap:wrap}' +
      '#modalHofDir .hd-chip{border:1px solid var(--line,#e6e8ee);background:var(--surface,#fff);border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;color:var(--muted,#7a8194);cursor:pointer;font-family:inherit}' +
      '#modalHofDir .hd-chip.on{background:var(--brand,#2b6cb0);border-color:var(--brand,#2b6cb0);color:#fff}' +
      '#modalHofDir .hd-meta{font-size:11.5px;color:var(--muted,#7a8194);margin:2px 0 8px}' +
      '#modalHofDir .hd-empty{padding:26px 10px;text-align:center;color:var(--muted,#7a8194);font-size:13px}' +
      '#modalHofDir .hd-back{background:none;border:none;color:var(--brand,#2b6cb0);cursor:pointer;font-size:13px;font-weight:600;padding:2px 0 8px;font-family:inherit}' +
      '#modalHofDir .hd-head{padding:4px 0 12px;border-bottom:1px solid var(--line,#e6e8ee);margin-bottom:10px}' +
      '#modalHofDir .hd-hn{font-size:18px;font-weight:800;color:var(--ink,#1a1f2e)}' +
      '#modalHofDir .hd-hs{font-size:12px;color:var(--muted,#7a8194);margin-top:2px}' +
      '#modalHofDir .hd-badges{display:flex;flex-direction:column;gap:6px}' +
      '#modalHofDir .hd-b{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border:1px solid var(--line,#e6e8ee);border-radius:10px}' +
      '#modalHofDir .hd-b.r-legend{border-color:#f59e0b;background:rgba(245,158,11,.06)}' +
      '#modalHofDir .hd-b.r-epic{border-color:#7c3aed;background:rgba(124,58,237,.05)}' +
      '#modalHofDir .hd-b.r-rare{border-color:#2b6cb0}' +
      '#modalHofDir .hd-b-e{font-size:22px;line-height:1}' +
      '#modalHofDir .hd-b-t{font-weight:700;font-size:13px;color:var(--ink,#1a1f2e)}' +
      '#modalHofDir .hd-b-s{font-size:11px;color:var(--muted,#7a8194);margin-top:1px}' +
      '#modalHofDir .hd-b-c{font-size:11px;color:var(--muted,#7a8194);margin-top:3px;font-style:italic}' +
      '#modalHofDir .st-meline{margin:0 0 10px;padding:8px 12px;border-radius:10px;background:linear-gradient(90deg,rgba(245,158,11,.14),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.45);color:#92400e;font-size:12.5px;font-weight:700}' +
      '#modalHofDir .st-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}' +
      '#modalHofDir .st-card{position:relative;border:1px solid var(--line,#e6e8ee);border-radius:14px;padding:16px 10px 12px;text-align:center;background:linear-gradient(180deg,#fff, var(--brand-soft,#f4f7fb));transition:.15s;cursor:pointer}' +
      '#modalHofDir .st-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(20,30,55,.10)}' +
      '#modalHofDir .st-card.t0{border-color:#f59e0b;background:linear-gradient(180deg,#fffbeb,#fef3c7)}' +
      '#modalHofDir .st-card.t1{border-color:#94a3b8;background:linear-gradient(180deg,#fff,#f1f5f9)}' +
      '#modalHofDir .st-card.t2{border-color:#d97706;background:linear-gradient(180deg,#fffaf0,#fef3c7)}' +
      '#modalHofDir .st-card.me{outline:2px solid #f59e0b;outline-offset:2px}' +
      '#modalHofDir .st-rank{position:absolute;top:8px;left:10px;font-size:15px;font-weight:800;color:var(--muted,#7a8194)}' +
      '#modalHofDir .st-av{width:64px;height:64px;margin:0 auto 8px;position:relative}' +
      '#modalHofDir .st-photo{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #f59e0b;box-shadow:0 3px 10px rgba(245,158,11,.25)}' +
      '#modalHofDir .st-ini{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;color:#fff;background:linear-gradient(135deg,var(--brand,#2b6cb0),#7c3aed);border:3px solid rgba(255,255,255,.7)}' +
      '#modalHofDir .st-name{font-weight:700;font-size:12.5px;color:var(--ink,#1a1f2e);line-height:1.25;min-height:32px}' +
      '#modalHofDir .st-me{display:block;color:#b45309;font-size:10.5px;font-weight:700;margin-top:2px}' +
      '#modalHofDir .st-metrics{font-size:11px;color:var(--muted,#7a8194);margin-top:4px}' +
      '#modalHofDir .st-metrics b{color:var(--ink,#1a1f2e)}' +
      '#modalHofDir .st-metrics .st-sec{opacity:.85}' +
      '#modalHofDir .st-pager{display:flex;align-items:center;justify-content:center;gap:10px;margin:12px 0 4px;font-size:12.5px;font-weight:700;color:var(--muted,#7a8194)}' +
      '#modalHofDir .st-pg{border:1px solid var(--line,#e6e8ee);background:var(--surface,#fff);border-radius:8px;width:32px;height:28px;font-size:14px;font-weight:800;cursor:pointer;color:var(--ink,#1a1f2e);font-family:inherit}' +
      '#modalHofDir .st-pg:hover:not(:disabled){border-color:var(--brand,#2b6cb0);color:var(--brand,#2b6cb0)}' +
      '#modalHofDir .st-pg:disabled{opacity:.35;cursor:default}' +
      '.hd-open-btn{margin-left:10px;border:1px solid var(--line,#e6e8ee);background:var(--brand-soft,#eaf2fb);color:var(--brand,#2b6cb0);border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:700;cursor:pointer;vertical-align:middle;font-family:inherit}';
    document.head.appendChild(st);
  }

  function ensureModal() {
    ensureStyles();
    if (document.getElementById('modalHofDir')) return;
    var m = document.createElement('div'); m.id = 'modalHofDir';
    m.innerHTML = '<div class="hd-card"><div class="hd-top"><div class="hd-title">⭐ Звёзды</div>' +
      '<button class="hd-x" title="Закрыть">✕</button></div><div id="hdBody"></div></div>';
    m.addEventListener('click', function (e) { if (e.target === m) window.closeHofDir(); });
    m.querySelector('.hd-x').onclick = function () { window.closeHofDir(); };
    document.body.appendChild(m);
  }

  window.closeHofDir = function () { var m = document.getElementById('modalHofDir'); if (m) m.classList.remove('on'); };
  window.openHofDir = function () {
    ensureModal();
    document.getElementById('modalHofDir').classList.add('on');
    document.getElementById('hdBody').innerHTML = '<div class="hd-empty">Загружаю…</div>';
    var p;
    if (CACHE) p = Promise.resolve();
    else p = window.__call('hofDirectory', {}).then(function (r) { CACHE = (r && r.items) || []; VIEWER = (r && r.viewer) || {}; });
    p.then(function () {
      var sv = (STARS && STARS.viewer) || {};
      if (sv.mop) SS = 'group'; else if (sv.rop) SS = 'dept'; else SS = 'company';
      renderStars();
    }).catch(function (e) { document.getElementById('hdBody').innerHTML = '<div class="hd-empty">Не удалось загрузить: ' + esc(e.message || e) + '</div>'; });
  };

  // Точки входа «⭐ Звёзды» во всех кабинетах (решение Егора 01.09):
  //  - партнёр: иконка ⭐ в hero-iconbar шапки + чип у Зала славы;
  //  - МОП/РОП: чип у ссылки «Зал славы»;
  //  - АУП: кнопка в шапке рядом с «📊 Аналитика».
  // MutationObserver — не зависит от порядка отрисовки DOM.
  function injectEntry() {
    var ib = document.querySelector('.hero-iconbar');
    if (ib && !ib.querySelector('.hd-star-ico')) {
      ensureStyles();
      var ic = document.createElement('div');
      ic.className = 'hib hd-star-ico'; ic.textContent = '⭐';
      ic.title = 'Звёзды — кто лучший по задаткам, сделкам, валовой, набору объектов и покупателей';
      ic.style.cursor = 'pointer';
      ic.onclick = function () { window.openHofDir(); };
      ib.appendChild(ic);
    }
    var hall = document.querySelector('.rw-hall');
    if (hall && hall.parentNode && !hall.parentNode.querySelector('.hd-open-btn')) {
      ensureStyles();
      var c = document.createElement('span'); c.className = 'hd-open-btn'; c.textContent = '⭐ Звёзды';
      c.onclick = function (ev) { ev.stopPropagation(); window.openHofDir(); };
      hall.parentNode.appendChild(c);
    }
    var mb = document.getElementById('modalHofBody');
    if (mb && mb.innerHTML && !mb.querySelector('.hd-open-btn')) {
      var h = mb.querySelector('.modal-title') || mb.querySelector('div > div');
      if (h) {
        ensureStyles();
        var s = document.createElement('button'); s.className = 'hd-open-btn'; s.textContent = '⭐ Звёзды';
        s.onclick = function () { if (window.closeModal) window.closeModal('modalHof'); window.openHofDir(); };
        h.appendChild(s);
      }
    }
    // кабинет АУП: нет Зала славы — кнопка в шапке рядом с «📊 Аналитика»
    var ab = document.getElementById('analyticsBtn');
    if (ab && !ab.parentNode.querySelector('.hd-open-btn')) {
      ensureStyles();
      var b = document.createElement('button'); b.className = 'hd-open-btn'; b.textContent = '⭐ Звёзды';
      b.onclick = function () { window.openHofDir(); };
      ab.parentNode.insertBefore(b, ab.nextSibling);
    }
  }
  var __moT = null;
  function scheduleInject() { if (__moT) return; __moT = setTimeout(function () { __moT = null; injectEntry(); }, 60); }
  try {
    var mo = new MutationObserver(scheduleInject);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { setInterval(injectEntry, 2000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectEntry);
  else injectEntry();
})();
