/**
 * hof.js — «Награды коллег» (витрина Зала славы), общий для всех кабинетов.
 * Открывается кнопкой «👥 Коллеги» в шапке Зала славы (патчит window.openHof).
 * Фильтры: моя группа / мой отдел / компания; поиск по ФИО; рейтинг по XP;
 * клик по человеку → все его медали с датами получения.
 * Данные: callable hofDirectory (список из /hof, детали из /rewards).
 */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var ROLE = { realtor: 'Партнёр', mop: 'Старший партнёр', rop: 'Управляющий партнёр', aup: 'АУП' };
  var TL = { common: 'обычная', rare: 'редкая', epic: 'эпическая', legend: 'легендарная' };
  var CACHE = null, VIEWER = {}, SCOPE = 'company', Q = '';

  function dt(ts) { try { return ts ? new Date(ts).toLocaleDateString('ru-RU') : '—'; } catch (e) { return '—'; } }

  function rows() {
    var arr = (CACHE || []).slice();
    if (SCOPE === 'group' && VIEWER.mop) arr = arr.filter(function (x) { return String(x.mop) === String(VIEWER.mop); });
    if (SCOPE === 'dept' && VIEWER.rop) arr = arr.filter(function (x) { return String(x.rop) === String(VIEWER.rop); });
    if (Q) { var q = Q.toLowerCase(); arr = arr.filter(function (x) { return (x.name || '').toLowerCase().indexOf(q) >= 0; }); }
    return arr;
  }

  function renderList() {
    var arr = rows(); var shown = arr.slice(0, 150);
    var chips = '';
    if (VIEWER.mop) chips += '<button class="hd-chip' + (SCOPE === 'group' ? ' on' : '') + '" onclick="__hofScope(\'group\')">Моя группа</button>';
    if (VIEWER.rop) chips += '<button class="hd-chip' + (SCOPE === 'dept' ? ' on' : '') + '" onclick="__hofScope(\'dept\')">Мой отдел</button>';
    chips += '<button class="hd-chip' + (SCOPE === 'company' ? ' on' : '') + '" onclick="__hofScope(\'company\')">Компания</button>';
    var list = shown.map(function (x) {
      var em = (x.emojis || []).map(function (e) { return '<span>' + esc(e) + '</span>'; }).join('');
      var more = x.count > (x.emojis || []).length ? '<span class="hd-more">+' + (x.count - (x.emojis || []).length) + '</span>' : '';
      return '<div class="hd-row" onclick="__hofOpen(\'' + esc(x.code) + '\')">' +
        '<div class="hd-place' + (x.place <= 3 ? ' top' : '') + '">' + x.place + '</div>' +
        '<div class="hd-main"><div class="hd-name">' + esc(x.name) + (VIEWER.code === String(x.code) ? ' <span class="hd-me">(это вы)</span>' : '') + '</div>' +
        '<div class="hd-sub">' + esc(ROLE[x.role] || x.role || '') + (x.mop_name ? ' · ' + esc(x.mop_name) : '') + '</div></div>' +
        '<div class="hd-med">' + em + more + '</div>' +
        '<div class="hd-xp"><b>Ур.' + x.level + '</b><span>' + x.xp + ' XP · ' + x.count + ' 🎖</span></div></div>';
    }).join('');
    document.getElementById('hdBody').innerHTML =
      '<div class="hd-bar"><div class="hd-chips">' + chips + '</div>' +
      '<input id="hdQ" class="hd-q" placeholder="🔍 Поиск по фамилии…" value="' + esc(Q) + '" oninput="__hofQ(this.value)"></div>' +
      '<div class="hd-meta">' + (arr.length ? esc(String(arr.length)) + ' ' + plural(arr.length) + ' · рейтинг по XP · место в компании — слева' : '') + '</div>' +
      '<div class="hd-list">' + (list || '<div class="hd-empty">Никого не найдено</div>') + '</div>' +
      (arr.length > shown.length ? '<div class="hd-meta" style="text-align:center">показаны первые 150 — уточните поиск</div>' : '');
    var el = document.getElementById('hdQ');
    if (el && Q) { el.focus(); try { el.setSelectionRange(Q.length, Q.length); } catch (e) {} }
  }

  function plural(n) { var m = n % 10, h = n % 100; if (m === 1 && h !== 11) return 'человек'; if (m >= 2 && m <= 4 && (h < 10 || h >= 20)) return 'человека'; return 'человек'; }

  window.__hofScope = function (k) { SCOPE = k; renderList(); };
  window.__hofQ = function (v) { Q = v; renderList(); };
  window.__hofOpen = function (code) {
    var x = (CACHE || []).filter(function (i) { return String(i.code) === String(code); })[0];
    var b = document.getElementById('hdBody');
    b.innerHTML = '<div class="hd-empty">Загружаю награды…</div>';
    window.__call('hofDirectory', { code: code }).then(function (r) {
      var badges = (r && r.badges) || [];
      var bl = badges.map(function (bd) {
        return '<div class="hd-b r-' + esc(bd.tier) + '"><span class="hd-b-e">' + esc(bd.emoji) + '</span>' +
          '<div class="hd-b-m"><div class="hd-b-t">' + esc(bd.title) + '</div>' +
          '<div class="hd-b-s">' + esc(TL[bd.tier] || bd.tier || '') + ' · получена ' + dt(bd.earned_at) + '</div>' +
          (bd.crit ? '<div class="hd-b-c">' + esc(bd.crit) + '</div>' : '') + '</div></div>';
      }).join('');
      b.innerHTML = '<button class="hd-back" onclick="__hofBack()">← К списку</button>' +
        '<div class="hd-head"><div class="hd-hp">' + (x ? '#' + x.place + ' в компании' : '') + '</div>' +
        '<div class="hd-hn">' + (x ? esc(x.name) : esc(code)) + '</div>' +
        '<div class="hd-hs">' + (x ? esc(ROLE[x.role] || '') + ' · Ур.' + x.level + ' «' + esc(x.level_name) + '» · ' + x.xp + ' XP · ' + x.count + ' наград' : '') + '</div></div>' +
        '<div class="hd-badges">' + (bl || '<div class="hd-empty">Пока без наград</div>') + '</div>';
    }).catch(function (e) { b.innerHTML = '<div class="hd-empty">Не удалось загрузить: ' + esc(e.message || e) + '</div>'; });
  };
  window.__hofBack = function () { renderList(); };

  function ensureStyles() {
    if (document.getElementById('hofDirStyles')) return;
    var st = document.createElement('style'); st.id = 'hofDirStyles'; st.textContent =
      '#modalHofDir{position:fixed;inset:0;background:rgba(15,20,35,.55);display:none;align-items:center;justify-content:center;z-index:1200;padding:16px}' +
      '#modalHofDir.on{display:flex}' +
      '#modalHofDir .hd-card{background:var(--surface,#fff);border-radius:14px;max-width:760px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(20,30,55,.25);overflow:hidden}' +
      '#modalHofDir .hd-top{display:flex;justify-content:space-between;align-items:center;padding:16px 20px 10px;border-bottom:1px solid var(--line,#e6e8ee)}' +
      '#modalHofDir .hd-title{font-size:17px;font-weight:800;color:var(--ink,#1a1f2e)}' +
      '#modalHofDir .hd-x{background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted,#7a8194)}' +
      '#modalHofDir #hdBody{overflow-y:auto;padding:12px 20px 20px}' +
      '#modalHofDir .hd-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:8px}' +
      '#modalHofDir .hd-chips{display:flex;gap:6px;flex-wrap:wrap}' +
      '#modalHofDir .hd-chip{border:1px solid var(--line,#e6e8ee);background:transparent;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;color:var(--ink-soft,#3b4358)}' +
      '#modalHofDir .hd-chip.on{background:var(--brand,#2b6cb0);border-color:var(--brand,#2b6cb0);color:#fff}' +
      '#modalHofDir .hd-q{border:2px solid var(--line,#e6e8ee);border-radius:8px;padding:7px 12px;font-size:13px;outline:none;min-width:200px;font-family:inherit}' +
      '#modalHofDir .hd-meta{font-size:11.5px;color:var(--muted,#7a8194);margin:2px 0 8px}' +
      '#modalHofDir .hd-list{display:flex;flex-direction:column;gap:6px}' +
      '#modalHofDir .hd-row{display:flex;align-items:center;gap:12px;padding:9px 12px;border:1px solid var(--line,#e6e8ee);border-radius:10px;cursor:pointer;transition:.15s}' +
      '#modalHofDir .hd-row:hover{border-color:var(--brand,#2b6cb0);background:var(--brand-soft,#eaf2fb)}' +
      '#modalHofDir .hd-place{font-weight:800;font-size:15px;color:var(--muted,#7a8194);width:34px;text-align:right;flex:none}' +
      '#modalHofDir .hd-place.top{color:#d97706}' +
      '#modalHofDir .hd-main{flex:1;min-width:0}' +
      '#modalHofDir .hd-name{font-weight:700;font-size:13.5px;color:var(--ink,#1a1f2e);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#modalHofDir .hd-me{color:var(--brand,#2b6cb0);font-size:11px}' +
      '#modalHofDir .hd-sub{font-size:11px;color:var(--muted,#7a8194);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#modalHofDir .hd-med{display:flex;gap:2px;font-size:15px;flex-wrap:wrap;max-width:220px;justify-content:flex-end}' +
      '#modalHofDir .hd-more{font-size:10px;color:var(--muted,#7a8194);align-self:center}' +
      '#modalHofDir .hd-xp{text-align:right;flex:none;font-size:11px;color:var(--muted,#7a8194)}' +
      '#modalHofDir .hd-xp b{display:block;font-size:13px;color:var(--ink,#1a1f2e)}' +
      '#modalHofDir .hd-empty{color:var(--muted,#7a8194);padding:24px;text-align:center;font-size:13px}' +
      '#modalHofDir .hd-back{background:none;border:none;color:var(--brand,#2b6cb0);cursor:pointer;font-size:13px;font-weight:600;padding:2px 0 8px}' +
      '#modalHofDir .hd-head{padding:4px 0 12px;border-bottom:1px solid var(--line,#e6e8ee);margin-bottom:10px}' +
      '#modalHofDir .hd-hp{font-size:11px;color:#d97706;font-weight:700}' +
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
      '.hd-open-btn{margin-left:10px;border:1px solid var(--line,#e6e8ee);background:var(--brand-soft,#eaf2fb);color:var(--brand,#2b6cb0);border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:700;cursor:pointer;vertical-align:middle;font-family:inherit}';
    document.head.appendChild(st);
  }

  function ensureModal() {
    ensureStyles();
    if (document.getElementById('modalHofDir')) return;
    var m = document.createElement('div'); m.id = 'modalHofDir';
    m.innerHTML = '<div class="hd-card"><div class="hd-top"><div class="hd-title">👥 Награды коллег</div>' +
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
      if (!VIEWER.mop && VIEWER.rop) SCOPE = 'dept'; else if (VIEWER.mop) SCOPE = 'group'; else SCOPE = 'company';
      renderList();
    }).catch(function (e) { document.getElementById('hdBody').innerHTML = '<div class="hd-empty">Не удалось загрузить: ' + esc(e.message || e) + '</div>'; });
  };

  // Точки входа «👥 Коллеги»: чип рядом со ссылкой «🏆 Зал славы» + кнопка в шапке модалки.
  // MutationObserver — НЕ зависит от порядка определения window.openHof (модули с await,
  // чужие обёртки и т.п.): вклиниваемся в момент фактической отрисовки DOM.
  function injectEntry() {
    var hall = document.querySelector('.rw-hall');
    if (hall && hall.parentNode && !hall.parentNode.querySelector('.hd-open-btn')) {
      ensureStyles();
      var c = document.createElement('span'); c.className = 'hd-open-btn'; c.textContent = "👥 Сравни себя с коллегами";
      c.onclick = function (ev) { ev.stopPropagation(); window.openHofDir(); };
      hall.parentNode.appendChild(c);
    }
    var mb = document.getElementById('modalHofBody');
    if (mb && mb.innerHTML && !mb.querySelector('.hd-open-btn')) {
      var h = mb.querySelector('.modal-title') || mb.querySelector('div > div');
      if (h) {
        ensureStyles();
        var s = document.createElement('button'); s.className = 'hd-open-btn'; s.textContent = "👥 Сравни себя с коллегами";
        s.onclick = function () { if (window.closeModal) window.closeModal('modalHof'); window.openHofDir(); };
        h.appendChild(s);
      }
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
