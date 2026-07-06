/**
 * calendar.js — TZ-A31 Фаза 1: календарь задач во вкладке «📋 Задачи»
 * во всех 4 кабинетах. Один модуль, импортируется через type:module.
 *
 *   import { mountCalendar } from './calendar.js';
 *   mountCalendar(rootEl, { db, ownerCode, mode });
 *
 * - ownerCode — код партнёра, чьи задачи показываем (обычно = CTX.target).
 * - mode — 'partner' | 'mop' | 'rop' | 'aup' (для будущих ограничений).
 *
 * Подписка на /tasks через orderByChild('assignee_code').equalTo(ownerCode).
 * Изменения (drag, resize, edit, complete, delete) пишутся в /tasks/{id}.
 *
 * Поведение полностью соответствует calendar-mockup.html: 4 вида,
 * drag-drop, resize, многодневные полосы, allday, модалки.
 */

import { ref, query, orderByChild, equalTo, onValue, update, set, push, remove, get } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

const TZ_OFFSET_HOURS = 5; // YekaterinburgUTC+5

/* ─── CSS ─── */
const CSS = `
.cal-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;color:#1a1f2e;font-size:14px;line-height:1.5}
.cal-root .gbar{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e6e8ee;border-radius:12px;padding:11px 14px;margin-bottom:12px}
.cal-root .gmark{width:28px;height:28px;border-radius:7px;flex-shrink:0;background:conic-gradient(from -45deg,#4285F4 0 25%,#34A853 0 50%,#FBBC05 0 75%,#EA4335 0);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
.cal-root .gbar .gtext{flex:1;min-width:0}.cal-root .gbar .gtext b{font-size:13px}.cal-root .gbar .gtext small{display:block;color:#7a8194;font-size:11px}
.cal-root .gdot{width:7px;height:7px;border-radius:50%;background:#16a34a;display:inline-block;margin-right:4px}
.cal-root .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.cal-root .views{display:flex;gap:4px;background:#f1f3f7;border:1px solid #e6e8ee;border-radius:10px;padding:4px}
.cal-root .vbtn{font-size:13px;font-weight:600;color:#7a8194;padding:7px 13px;border-radius:7px;border:none;background:transparent;cursor:pointer;font-family:inherit}
.cal-root .vbtn.on{background:#fff;color:#2b6cb0;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.cal-root .tlabel{font-weight:800;font-size:15px}
.cal-root .cnav{display:flex;gap:4px}
.cal-root .cnav button{width:30px;height:30px;border:1px solid #e6e8ee;background:#fff;border-radius:8px;cursor:pointer;color:#7a8194;font-size:15px}
.cal-root .spread{margin-left:auto;font-size:13px;font-weight:700;color:#fff;background:#2b6cb0;border:none;border-radius:999px;padding:9px 16px;cursor:pointer;font-family:inherit}
.cal-root .spread:hover{background:#1f5288}
.cal-root .hint{display:none;align-items:center;gap:10px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#9a3412;font-weight:600}
.cal-root .hint.on{display:flex}
.cal-root .hint .cancel{margin-left:auto;font-size:12px;font-weight:700;color:#9a3412;background:#fff;border:1px solid #fdba74;border-radius:999px;padding:5px 12px;cursor:pointer;font-family:inherit}
.cal-root .layout{display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start}
@media(max-width:900px){.cal-root .layout{grid-template-columns:1fr}}
.cal-root .cal{background:#fff;border:1px solid #e6e8ee;border-radius:12px;overflow:hidden;overflow-x:auto;box-shadow:0 1px 3px rgba(20,30,55,.06),0 6px 24px rgba(20,30,55,.05)}
.cal-root .cal-body{max-height:560px;overflow-y:auto}
.cal-root .cal-top{position:sticky;top:0;z-index:6;background:#fff}
@media(max-width:640px){.cal-root .cal-body{max-height:60vh}}
.cal-root .cal-head{display:flex;border-bottom:1px solid #e6e8ee}
.cal-root .corner{width:56px;flex-shrink:0;border-right:1px solid #e6e8ee}
.cal-root .day-h{flex:1;min-width:0;text-align:center;padding:9px 4px;border-right:1px solid #e6e8ee;font-size:12px}
.cal-root .day-h:last-child{border-right:none}
.cal-root .day-h .dow{color:#7a8194;text-transform:uppercase;font-weight:700;font-size:10px;letter-spacing:.03em}
.cal-root .day-h .dnum{font-size:17px;font-weight:800;margin-top:1px}
.cal-root .day-h.today .dnum{color:#fff;background:#2b6cb0;width:28px;height:28px;line-height:28px;border-radius:50%;display:inline-block;margin-top:2px}
.cal-root .day-h.today .dow{color:#2b6cb0}
.cal-root .allday{display:flex;border-bottom:1px solid #e6e8ee;min-height:34px;background:#f1f3f7}
.cal-root .allday .ad-lbl{width:56px;flex-shrink:0;border-right:1px solid #e6e8ee;font-size:10px;color:#7a8194;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.1}
.cal-root .ad-cell{flex:1;min-width:0;border-right:1px solid #e6e8ee;padding:3px;min-height:34px}
.cal-root .ad-cell:last-child{border-right:none}
.cal-root .tbody{display:flex}
.cal-root .tcol-time{width:56px;flex-shrink:0}
.cal-root .thour{height:42px;font-size:10px;color:#7a8194;text-align:right;padding:2px 6px 0 0;box-sizing:border-box;border-right:1px solid #e6e8ee}
.cal-root .tcol{flex:1;min-width:0;position:relative;border-right:1px solid #e6e8ee}
.cal-root .tcol:last-child{border-right:none}
.cal-root .hcell{height:42px;border-top:1px solid #e6e8ee;position:relative;display:flex;flex-direction:column}
.cal-root .tcol .hcell:first-child{border-top:none}
.cal-root .hcell.past{background:repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,.02) 5px,rgba(0,0,0,.02) 10px)}
/* Каждый час = 4 sub-slot по 15 мин. Тонкие полосы: 15/30/45 внутри часа. */
.cal-root .qcell{flex:1;position:relative;border-top:1px dashed rgba(0,0,0,.05);cursor:default}
.cal-root .qcell:first-child{border-top:none}
.cal-root .qcell.creatable{cursor:pointer}
.cal-root .qcell.creatable:hover{background:rgba(43,108,176,.06)}
.cal-root .qcell.ok{cursor:pointer;background:rgba(43,108,176,.10)}
.cal-root .qcell.ok:hover{background:rgba(43,108,176,.22);box-shadow:inset 0 0 0 1.5px #2b6cb0}
.cal-root .qcell.dragover{background:rgba(43,108,176,.28);box-shadow:inset 0 0 0 2px #2b6cb0}
/* List view — плоский реестр задач с фильтрами */
.cal-root .list-wrap{background:#fff;padding:14px}
.cal-root .list-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #e6e8ee}
.cal-root .lf-group{display:flex;gap:4px;background:#f1f3f7;border-radius:8px;padding:3px}
.cal-root .lf-btn{font-size:11px;font-weight:700;padding:5px 10px;border:none;background:transparent;color:#7a8194;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap}
.cal-root .lf-btn.on{background:#fff;color:#2b6cb0;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.cal-root .lf-sep{width:1px;background:#e6e8ee;margin:0 4px}
.cal-root .list-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f1f3f7;cursor:pointer;transition:background .1s}
.cal-root .list-row:hover{background:#f7f9fc}
.cal-root .list-row.done{opacity:.55}
.cal-root .list-row.done .lr-title{text-decoration:line-through}
.cal-root .list-row.overdue{background:rgba(220,38,38,.04)}
.cal-root .lr-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cal-root .lr-body{flex:1;min-width:0}
.cal-root .lr-title{font-size:13px;font-weight:600;color:#1a1f2e;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal-root .lr-meta{font-size:11px;color:#7a8194;margin-top:2px;display:flex;gap:8px;flex-wrap:wrap}
.cal-root .lr-when{font-weight:600}
.cal-root .lr-when.today{color:#dc2626}
.cal-root .lr-when.overdue{color:#dc2626;font-weight:800}
.cal-root .lr-when.week{color:#c2410c}
.cal-root .lr-actions{display:flex;gap:4px;flex-shrink:0}
.cal-root .lr-actions button{width:28px;height:28px;border:none;background:#f1f3f7;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:.1s}
.cal-root .lr-actions button:hover{background:#e6e8ee}
.cal-root .lr-actions .lr-done{background:#dcfce7;color:#16a34a}
.cal-root .lr-actions .lr-done:hover{background:#86efac}
.cal-root .list-group{margin-top:10px}
.cal-root .list-group-h{font-size:11px;color:#7a8194;text-transform:uppercase;letter-spacing:.05em;font-weight:800;padding:8px 12px;background:#f7f9fc;border-radius:6px}
.cal-root .list-empty{padding:30px 20px;text-align:center;color:#7a8194;font-size:13px}
.cal-root .ev{border-radius:6px;padding:0 8px;font-size:11px;cursor:grab;border-left:3px solid;position:relative;display:flex;align-items:center;overflow:hidden}
.cal-root .ev.timed{position:absolute;left:2px;right:2px;align-items:flex-start;padding-top:2px}
.cal-root .ev:active{cursor:grabbing}
.cal-root .ev .ev-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;min-width:0;padding-right:16px}
.cal-root .ev .x{position:absolute;top:2px;right:4px;font-size:11px;opacity:.45;cursor:pointer;line-height:1;z-index:2}
.cal-root .ev .x:hover{opacity:1}
.cal-root .ev .gsync{position:absolute;bottom:1px;right:4px;font-size:9px;opacity:.8}
.cal-root .ev-resize{position:absolute;left:0;right:0;bottom:0;height:8px;cursor:ns-resize;border-radius:0 0 5px 5px}
.cal-root .ev-resize:hover{background:rgba(0,0,0,.10)}
.cal-root .hcell.dragover,.cal-root .ad-cell.dragover{background:rgba(43,108,176,.22);box-shadow:inset 0 0 0 2px #2b6cb0}
.cal-root .ev-otkl{background:#eaf2fb;border-color:#2b6cb0;color:#1a4061}
.cal-root .ev-plan{background:#f3effe;border-color:#7c3aed;color:#4c1d95}
.cal-root .ev-srochno{background:#fdeaea;border-color:#dc2626;color:#dc2626}
.cal-root .ev-other{background:#f1f3f7;border-color:#a8aebd;color:#1a1f2e}
.cal-root .ev-mine{background:#e0f2f1;border-color:#0f766e;color:#115e59}
.cal-root .ev-manager{background:#eef2ff;border-color:#4f46e5;color:#3730a3}
.cal-root .ev.done{opacity:.6}
.cal-root .ev.done .ev-t{text-decoration:line-through}
.cal-root .month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));background:#fff}
.cal-root .m-dow{text-align:center;font-size:10px;font-weight:700;color:#7a8194;text-transform:uppercase;padding:8px 0;border-bottom:1px solid #e6e8ee;border-right:1px solid #e6e8ee;min-width:0}
.cal-root .m-week{position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.cal-root .m-cell{min-height:96px;min-width:0;overflow:hidden;border-bottom:1px solid #e6e8ee;border-right:1px solid #e6e8ee;padding:5px 6px}
.cal-root .m-cell.mcreatable{cursor:pointer}
.cal-root .m-cell.mcreatable:hover{background:#f1f3f7}
.cal-root .m-cell .md{font-size:12px;font-weight:700;color:#7a8194}
.cal-root .m-cell.today .md{color:#fff;background:#2b6cb0;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%}
.cal-root .m-cell.out{background:#f1f3f7}
.cal-root .m-pill{font-size:10px;border-radius:4px;padding:1px 5px;margin-top:3px;border-left:2px solid;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:grab}
.cal-root .m-pill.done,.cal-root .m-bar.done{opacity:.55}
.cal-root .m-pill.done .ev-t,.cal-root .m-pill.done,.cal-root .m-bar.done{text-decoration:line-through}
.cal-root .m-bars{position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none}
.cal-root .m-bar{position:absolute;height:17px;line-height:15px;border-radius:5px;border-left:3px solid;font-size:10px;font-weight:600;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:grab;box-sizing:border-box}
.cal-root .m-bar-resize{position:absolute;right:0;top:0;bottom:0;width:9px;cursor:ew-resize}
.cal-root .panel{background:#fff;border:1px solid #e6e8ee;border-radius:12px;box-shadow:0 1px 3px rgba(20,30,55,.06),0 6px 24px rgba(20,30,55,.05);padding:14px}
.cal-root .panel-h{font-size:13px;font-weight:800;display:flex;align-items:center;gap:7px;margin-bottom:4px}
.cal-root .panel-sub{font-size:11px;color:#7a8194;margin-bottom:12px}
.cal-root .icard{border:1px solid #e6e8ee;border-left-width:3px;border-radius:10px;padding:10px 11px;margin-bottom:9px;background:#fff}
.cal-root .icard .it{font-size:13px;font-weight:700;line-height:1.3}
.cal-root .icard .ibadges{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.cal-root .bdg{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px}
.cal-root .bdg-today{background:#fdeaea;color:#dc2626}
.cal-root .bdg-week{background:#eaf2fb;color:#2b6cb0}
.cal-root .bdg-src{background:#f1f3f7;color:#7a8194}
.cal-root .icard .iactions{display:flex;gap:6px;margin-top:9px}
.cal-root .btn-cal{flex:1;font-size:12px;font-weight:700;color:#fff;background:#2b6cb0;border:none;border-radius:999px;padding:7px;cursor:pointer;font-family:inherit}
.cal-root .btn-tool{font-size:12px;font-weight:700;color:#2b6cb0;background:#eaf2fb;border:none;border-radius:999px;padding:7px 11px;cursor:pointer;font-family:inherit}
.cal-root .empty{font-size:12px;color:#7a8194;text-align:center;padding:18px 6px}
.cal-modal-bg{display:none;position:fixed;inset:0;background:rgba(20,30,55,.45);z-index:200;align-items:center;justify-content:center;padding:16px}
.cal-modal-bg.on{display:flex}
.cal-modal{background:#fff;border-radius:14px;padding:18px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.cal-modal-h{font-size:16px;font-weight:800;margin-bottom:14px}
.cal-m-input{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;margin-bottom:12px;box-sizing:border-box}
.cal-m-input:focus{outline:none;border-color:#2b6cb0}
.cal-m-row{display:flex;gap:10px;margin-bottom:16px}
.cal-m-check{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;margin-bottom:14px;cursor:pointer}
.cal-m-check input{width:17px;height:17px;cursor:pointer}
.cal-m-lbl{font-size:11px;color:#7a8194;font-weight:600;display:block;margin-bottom:4px}
.cal-m-sel{width:100%;border:1px solid #d1d5db;border-radius:10px;padding:10px;font-size:13px;font-family:inherit;background:#fff;box-sizing:border-box}
.cal-modal-actions{display:flex;gap:10px}
.cal-dbtn{flex:1;font-size:13px;font-weight:700;border-radius:999px;padding:9px;cursor:pointer;font-family:inherit;border:1px solid #e6e8ee;background:#fff;color:#1a1f2e}
.cal-dbtn.done{background:#16a34a;color:#fff;border-color:#16a34a}
.cal-dbtn.primary{background:#2b6cb0;color:#fff;border-color:#2b6cb0}
.cal-dmodal{background:#fff;border-radius:16px;padding:6px 20px 18px;width:100%;max-width:460px;box-shadow:0 24px 70px rgba(0,0,0,.3);max-height:88vh;overflow-y:auto}
.cal-dm-tools{display:flex;justify-content:flex-end;gap:2px;padding:6px 0}
.cal-dm-ic{width:34px;height:34px;border:none;background:none;border-radius:50%;cursor:pointer;font-size:15px;color:#7a8194}
.cal-dm-ic:hover{background:#f1f3f7}
.cal-dm-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}
.cal-dm-dot{width:14px;height:14px;border-radius:4px;flex-shrink:0;margin-top:6px}
.cal-dm-title{font-size:20px;font-weight:700;line-height:1.25}
.cal-dm-sub{font-size:13px;color:#7a8194;margin-top:4px}
.cal-dm-row{display:flex;gap:16px;padding:9px 0;font-size:14px;align-items:flex-start}
.cal-dm-ricon{width:22px;text-align:center;flex-shrink:0;color:#7a8194;font-size:15px;margin-top:1px}
.cal-dm-row b{font-weight:600}
.cal-dm-step{display:flex;gap:8px;align-items:flex-start;margin-top:7px;font-size:13px}
.cal-dm-n{width:18px;height:18px;border-radius:50%;background:#eaf2fb;color:#2b6cb0;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.cal-dm-actions{display:flex;gap:10px;margin-top:14px;border-top:1px solid #e6e8ee;padding-top:14px}
.cal-muted{color:#7a8194}
@media(max-width:640px){
  .cal-root .toolbar{gap:8px}
  .cal-root .views{flex:1 1 100%;justify-content:space-between}
  .cal-root .spread{margin-left:0;width:100%;order:9}
  .cal-root .tlabel{font-size:14px}
  .cal-root .day-h .dnum{font-size:15px}
  .cal-root .ad-lbl,.cal-root .thour{font-size:9px}
}
`;

let TOOLS = {};
let cssInjected = false;

function injectCss() {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  cssInjected = true;
}
// Инжектим CSS сразу при импорте модуля — чтобы стили .list-row работали
// на «Главной», где рендерятся плашки задач в новом стиле без открытия календаря.
injectCss();

/* ─── утилиты дат ─── */
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MON_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MON_RU_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function todayYMD() { const d = new Date(); return ymd(d); }
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function dowIdx(date) { return (date.getDay() + 6) % 7; }  // Пн=0
function dowOfYMD(s) { return DOW[dowIdx(parseYMD(s))]; }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function mondayOf(date) { return addDays(date, -dowIdx(date)); }
function diffDays(a, b) { return Math.round((parseYMD(b) - parseYMD(a)) / 86400000); }
function lessYMD(a, b) { return a < b; }
function eqYMD(a, b) { return a === b; }

/* ─── публичный API ─── */
/**
 * Открыть модалку детали задачи БЕЗ полного календаря.
 * Используется на «Главной» и в других местах, где нужен быстрый просмотр/редактирование.
 *   openTaskDetail({ db, ownerCode, taskId });
 * Модалка создаётся в document.body один раз и переиспользуется.
 */
export async function openTaskDetail({ db, ownerCode, taskId }) {
  injectCss();
  // Разово подгружаем tools при первом вызове.
  if (!TOOLS || Object.keys(TOOLS).length === 0) {
    try { const s = await get(ref(db, '/config/tools')); TOOLS = s.val() || {}; } catch (e) {}
  }
  // Ищем или создаём глобальный портал.
  let portal = document.getElementById('task-detail-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'task-detail-portal';
    portal.className = 'cal-root';
    portal.innerHTML = `<div class="cal-mount"><div class="cal-modal-bg" data-modal="detail"><div class="cal-dmodal" data-detail-card></div></div>
      <div class="cal-modal-bg" data-modal="create"><div class="cal-modal">
        <div class="cal-modal-h" data-mh>➕ Новая задача</div>
        <input class="cal-m-input" data-nt-title placeholder="Что нужно сделать?" maxlength="60">
        <label class="cal-m-check"><input type="checkbox" data-nt-allday> Весь день</label>
        <div class="cal-m-row"><div style="flex:1"><label class="cal-m-lbl">День</label><select class="cal-m-sel" data-nt-day></select></div></div>
        <div class="cal-m-row" data-nt-timerow><div style="flex:1"><label class="cal-m-lbl">С</label><select class="cal-m-sel" data-nt-start></select></div><div style="flex:1"><label class="cal-m-lbl">До</label><select class="cal-m-sel" data-nt-end></select></div></div>
        <div class="cal-modal-actions"><button class="cal-dbtn" data-nt-cancel>Отмена</button><button class="cal-dbtn primary" data-nt-save>Создать</button></div>
      </div></div></div>`;
    document.body.appendChild(portal);
    // clicks на бэкдропе закрывают модалку
    portal.querySelectorAll('.cal-modal-bg').forEach((bg) => {
      bg.onclick = (e) => { if (e.target === bg) bg.classList.remove('on'); };
    });
  }
  // Читаем задачу из RTDB (не подписка — просто снимок).
  let taskData = null;
  try {
    const s = await get(ref(db, `/tasks/${taskId}`));
    taskData = s.val();
  } catch (e) {}
  if (!taskData) { alert('Задача не найдена'); return; }
  // Мини-state (openDetail рассчитывает на state.tasks[id] и state.db).
  const state = {
    view: 'list',
    tasks: { [taskId]: adaptTaskFromRtdb(taskId, taskData) },
    ownerCode,
    db,
    today: todayYMD(),
    listFilters: { when: 'all', author: 'all' },
    weekStart: ymd(mondayOf(new Date())),
    monthStart: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    placing: null,
    dragId: null,
    bodyScroll: 0,
    nowMin: new Date().getHours() * 60 + new Date().getMinutes(),
  };
  const mount = portal.querySelector('.cal-mount');
  openDetail(state, mount, taskId);
  // Подставляем cancel-handler для create-модалки (нужен на edit).
  const cancelBtn = mount.querySelector('[data-nt-cancel]');
  if (cancelBtn) cancelBtn.onclick = () => closeCreateModal(mount);
  const saveBtn = mount.querySelector('[data-nt-save]');
  if (saveBtn) saveBtn.onclick = () => saveNewTask(state, mount);
  const alldayCb = mount.querySelector('[data-nt-allday]');
  if (alldayCb) alldayCb.onchange = (e) => { mount.querySelector('[data-nt-timerow]').style.display = e.target.checked ? 'none' : 'flex'; };
}

export async function mountCalendar(rootEl, opts) {
  injectCss();
  const { db, ownerCode, mode = 'partner' } = opts;
  if (!db || !ownerCode) { rootEl.innerHTML = '<div class="empty">Календарь не сконфигурирован</div>'; return; }

  // загружаем справочник инструментов один раз
  try {
    const s = await get(ref(db, '/config/tools'));
    TOOLS = s.val() || {};
  } catch (e) { /* пустой справочник — не критично */ }

  rootEl.innerHTML = '<div class="cal-root"><div class="cal-mount">Загрузка задач…</div></div>';
  const mount = rootEl.querySelector('.cal-mount');
  console.log('[calendar] mountCalendar called', { ownerCode, mode });

  const state = {
    view: localStorage.getItem('cal_view') || 'list',
    listFilters: { when: 'all', author: 'all' },
    weekStart: ymd(mondayOf(new Date())),  // YYYY-MM-DD
    monthStart: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    placing: null,
    dragId: null,
    bodyScroll: 8 * 42,
    tasks: {},  // id → task (адаптировано)
    ownerCode,
    mode,
    db,
    rootEl,
    today: todayYMD(),
    nowMin: new Date().getHours() * 60 + new Date().getMinutes(),
  };

  // подписка на /tasks
  const tref = query(ref(db, '/tasks'), orderByChild('assignee_code'), equalTo(ownerCode));
  console.log('[calendar] subscribing to /tasks where assignee_code=' + ownerCode);
  onValue(tref, (snap) => {
    const v = snap.val() || {};
    state.tasks = {};
    for (const id of Object.keys(v)) state.tasks[id] = adaptTaskFromRtdb(id, v[id]);
    console.log('[calendar] tasks loaded:', Object.keys(state.tasks).length);
    try {
      render(state, mount);
    } catch (e) {
      console.error('[calendar] render failed', e);
      mount.innerHTML = '<div style="padding:20px;color:#dc2626">Ошибка рендера: ' + escHtml(e.message || String(e)) + '</div>';
    }
  }, (err) => {
    console.error('[calendar] onValue error', err);
    mount.innerHTML = '<div style="padding:20px;color:#dc2626">Не удалось загрузить задачи: <code>' + escHtml(err.message || String(err)) + '</code><br><small>Возможно RTDB rules не разрешают чтение /tasks с фильтром. Проверь правила базы.</small></div>';
  });
}

/* ─── адаптеры ─── */
function clsFor(t) {
  if (t.type === 'event') return 'other';
  if (t.source === 'срочное') return 'srochno';
  if (t.source === 'отклонение') return 'otkl';
  if (t.source === 'план') return 'plan';
  if (t.author_kind === 'manager') return 'manager';
  if (t.source === 'моя задача' || t.author_kind === 'self') return 'mine';
  return 'otkl';  // default — это задача-отклонение от ИИ
}
function adaptTaskFromRtdb(id, t) {
  if (!t) return null;
  const day = t.due_date || null;
  let startMin = null;
  if (t.due_at) {
    const d = new Date(t.due_at);
    startMin = d.getHours() * 60 + d.getMinutes();
    // если 23:59 → считаем allday
    if (startMin >= 23 * 60 + 50) startMin = null;
  }
  const title = String(t.title || '').trim();
  return {
    id,
    title,
    short: title.length > 22 ? title.slice(0, 21) + '…' : title,
    horizon: t.horizon || 'week',
    src: t.source || 'моя задача',
    srcLabel: t.coach_bit ? `${t.coach_bit.side === 'buyer' ? 'покупатель' : 'продавец'}: ${t.coach_bit.bit_key}` : (t.description || ''),
    description: t.description || '',
    tool: t.tool || null,
    cls: clsFor(t),
    day,
    start: startMin,
    dur: t.duration_min || 30,
    span: t.span || 1,
    allday: !!day && startMin == null,
    done: t.status === 'done',
    doneComment: t.done_comment || t.doneComment || '',
    event: t.type === 'event',
    group: t.group === true,
    recur: t.recur || null,
    synced: t.calendar_synced === true,
    status: t.status || 'active',
    author_kind: t.author_kind || null,
    author_label: t.author_label || null,
    lever: t.lever || null,
    coach_bit: t.coach_bit || null,
  };
}

/* ─── режим/период/тип ─── */
function visibleDays(state) {
  if (state.view === 'day') return [state.today];
  if (state.view === '3') return [0, 1, 2].map((i) => ymd(addDays(parseYMD(state.today), i)));
  // week — от weekStart, 7 дней
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ymd(addDays(parseYMD(state.weekStart), i)));
}
function isPast(state, dayYMD) {
  if (dayYMD < state.today) return true;
  return false;
}
function typeIcon(t) {
  if (t.event) return '📅';
  if (t.cls === 'mine') return '👤';
  if (t.cls === 'manager') return '👔';
  return '🤖';
}
function isLocked(t) { return !!(t && (t.event || t.cls === 'manager')); }
function dotColor(cls) {
  return cls === 'srochno' ? '#dc2626' : cls === 'plan' ? '#7c3aed' : cls === 'mine' ? '#0f766e' : cls === 'manager' ? '#4f46e5' : cls === 'other' ? '#a8aebd' : '#2b6cb0';
}
function authorOf(t) {
  if (t.author_label) return t.author_label;
  if (t.cls === 'mine') return 'Вы';
  if (t.cls === 'manager') return 'Менеджер';
  return 'ИИ-система';
}
function fmtRange(startM, dur) {
  const e = startM + (dur || 30);
  const f = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  return f(startM) + '–' + f(e);
}
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ─── разделение задач: inbox vs scheduled ─── */
function partitionTasks(state) {
  const all = Object.values(state.tasks).filter(Boolean);
  // Активные (не done) без day → inbox
  const inbox = all.filter((t) => !t.done && !t.day);
  // С day → scheduled (включая done — они остаются с зачёркиванием)
  const scheduled = all.filter((t) => t.day);
  return { inbox, scheduled };
}

/* ─── рендер ─── */
const ROW = 42;
function render(state, mount) {
  const { inbox, scheduled } = partitionTasks(state);
  const periodLbl = labelForPeriod(state);

  mount.innerHTML = `
    <div class="toolbar">
      <div class="views">
        <button class="vbtn ${state.view==='list'?'on':''}" data-v="list">📋 Список</button>
        <button class="vbtn ${state.view==='day'?'on':''}" data-v="day">День</button>
        <button class="vbtn ${state.view==='3'?'on':''}" data-v="3">3 дня</button>
        <button class="vbtn ${state.view==='week'?'on':''}" data-v="week">Неделя</button>
        <button class="vbtn ${state.view==='month'?'on':''}" data-v="month">Месяц</button>
      </div>
      <div class="cnav" ${state.view==='list'?'style="visibility:hidden"':''}><button data-nav="prev">‹</button><button data-nav="today">⊙</button><button data-nav="next">›</button></div>
      <div class="tlabel">${escHtml(periodLbl)}</div>
      <button class="spread" data-spread>✨ Разложить на неделю</button>
    </div>
    <div class="hint"><span class="hint-text"></span><button class="cancel">Отмена</button></div>
    <div class="layout">
      <div class="cal"></div>
      <div class="panel"></div>
    </div>
    <div class="cal-modal-bg" data-modal="create">
      <div class="cal-modal">
        <div class="cal-modal-h" data-mh>➕ Новая задача</div>
        <input class="cal-m-input" data-nt-title placeholder="Что нужно сделать?" maxlength="60">
        <label class="cal-m-check"><input type="checkbox" data-nt-allday> Весь день</label>
        <div class="cal-m-row"><div style="flex:1"><label class="cal-m-lbl">День</label><select class="cal-m-sel" data-nt-day></select></div></div>
        <div class="cal-m-row" data-nt-timerow><div style="flex:1"><label class="cal-m-lbl">С</label><select class="cal-m-sel" data-nt-start></select></div><div style="flex:1"><label class="cal-m-lbl">До</label><select class="cal-m-sel" data-nt-end></select></div></div>
        <div class="cal-modal-actions"><button class="cal-dbtn" data-nt-cancel>Отмена</button><button class="cal-dbtn primary" data-nt-save>Создать</button></div>
      </div>
    </div>
    <div class="cal-modal-bg" data-modal="detail"><div class="cal-dmodal" data-detail-card></div></div>
  `;

  // tabs
  mount.querySelectorAll('.vbtn').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === state.view);
    b.onclick = () => {
      state.view = b.dataset.v;
      state.placing = null;
      try { localStorage.setItem('cal_view', state.view); } catch (e) {}
      render(state, mount);
    };
  });
  mount.querySelector('[data-nav="prev"]').onclick = () => navigate(state, mount, -1);
  mount.querySelector('[data-nav="next"]').onclick = () => navigate(state, mount, +1);
  mount.querySelector('[data-nav="today"]').onclick = () => navigate(state, mount, 0);
  mount.querySelector('[data-spread]').onclick = () => spreadWeek(state, mount, inbox);
  mount.querySelector('.hint .cancel').onclick = () => { state.placing = null; render(state, mount); };

  // body
  if (state.view === 'list') renderList(state, mount.querySelector('.cal'), inbox, scheduled);
  else if (state.view === 'month') renderMonth(state, mount.querySelector('.cal'), scheduled);
  else renderTimeGrid(state, mount.querySelector('.cal'), scheduled);
  renderPanel(state, mount.querySelector('.panel'), inbox);
  renderHint(state, mount);

  // create modal handlers
  mount.querySelector('[data-nt-allday]').onchange = (e) => {
    mount.querySelector('[data-nt-timerow]').style.display = e.target.checked ? 'none' : 'flex';
  };
  mount.querySelector('[data-nt-cancel]').onclick = () => closeCreateModal(mount);
  mount.querySelector('[data-nt-save]').onclick = () => saveNewTask(state, mount);
  // close on backdrop click
  mount.querySelectorAll('.cal-modal-bg').forEach((bg) => {
    bg.onclick = (e) => { if (e.target === bg) bg.classList.remove('on'); };
  });
}

function labelForPeriod(state) {
  if (state.view === 'list') return 'Все задачи';
  if (state.view === 'month') { const d = parseYMD(state.monthStart); return `${MON_RU_FULL[d.getMonth()]} ${d.getFullYear()}`; }
  if (state.view === 'day') { const d = parseYMD(state.today); return `${dowOfYMD(state.today)}, ${d.getDate()} ${MON_RU[d.getMonth()]}`; }
  if (state.view === '3') { const a = parseYMD(state.today); const b = addDays(a, 2); return `${a.getDate()}–${b.getDate()} ${MON_RU[a.getMonth()]} ${a.getFullYear()}`; }
  // week
  const a = parseYMD(state.weekStart); const b = addDays(a, 6);
  return `${a.getDate()}–${b.getDate()} ${MON_RU[a.getMonth()]} ${a.getFullYear()}`;
}
function navigate(state, mount, dir) {
  if (dir === 0) {
    state.today = todayYMD();
    state.weekStart = ymd(mondayOf(new Date()));
    state.monthStart = ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  } else if (state.view === 'month') {
    const d = parseYMD(state.monthStart);
    d.setMonth(d.getMonth() + dir);
    state.monthStart = ymd(d);
  } else if (state.view === 'day') {
    state.today = ymd(addDays(parseYMD(state.today), dir));
  } else if (state.view === '3') {
    state.today = ymd(addDays(parseYMD(state.today), dir * 3));
  } else {
    state.weekStart = ymd(addDays(parseYMD(state.weekStart), dir * 7));
  }
  state.placing = null;
  render(state, mount);
}

/* ─── time grid (день / 3 / неделя) ─── */
function renderTimeGrid(state, calEl, scheduled) {
  const days = visibleDays(state);
  const HOURS = Array.from({ length: 24 }, (_, h) => h);

  let head = '<div class="cal-head"><div class="corner"></div>';
  days.forEach((d) => {
    const isToday = d === state.today;
    const pd = parseYMD(d);
    head += `<div class="day-h ${isToday ? 'today' : ''}"><div class="dow">${DOW[dowIdx(pd)]}</div><div class="dnum">${pd.getDate()}</div></div>`;
  });
  head += '</div>';

  let ad = '<div class="allday"><div class="ad-lbl">весь<br>день</div>';
  days.forEach((d) => {
    const evs = scheduled.filter((t) => t.allday && t.day && t.day <= d && d <= ymd(addDays(parseYMD(t.day), (t.span || 1) - 1)));
    const ok = state.placing && placeAllowed(state, d);
    ad += `<div class="ad-cell ${ok ? 'ok' : ''}" data-day="${d}" data-allday="1">${evs.map((t) => evHtml(t)).join('')}</div>`;
  });
  ad += '</div>';

  let timeCol = '<div class="tcol-time">' + HOURS.map((h) => `<div class="thour">${h}:00</div>`).join('') + '</div>';
  let cols = days.map((d) => {
    const past = isPast(state, d);
    const cells = HOURS.map((h) => {
      // Внутри часа — 4 подслота по 15 мин. Каждый — отдельный target для click/drop.
      const quads = [0, 15, 30, 45].map((mm) => {
        const ok = state.placing && !past && placeAllowed(state, d) ? 'ok' : '';
        const cr = (!state.placing && !past) ? 'creatable' : '';
        return `<div class="qcell ${ok} ${cr}" data-day="${d}" data-hour="${h}" data-min="${mm}"></div>`;
      }).join('');
      return `<div class="hcell ${past ? 'past' : ''}">${quads}</div>`;
    }).join('');
    const evs = scheduled.filter((t) => t.day === d && !t.allday && (t.span || 1) === 1).map(evHtml).join('');
    return `<div class="tcol" data-day="${d}">${cells}${evs}</div>`;
  }).join('');

  calEl.innerHTML = `<div style="min-width:${56 + days.length * 92}px">
    <div class="cal-body" data-body>
      <div class="cal-top">${head}${ad}</div>
      <div class="tbody">${timeCol}${cols}</div>
    </div></div>`;
  const cb = calEl.querySelector('[data-body]');
  if (cb) { cb.scrollTop = state.bodyScroll; cb.addEventListener('scroll', () => { state.bodyScroll = cb.scrollTop; }); }

  // обработчики ячеек: клик и drop. qcell — 15-мин слоты внутри hcell, ad-cell — allday.
  calEl.querySelectorAll('.qcell, .ad-cell').forEach((cell) => {
    const day = cell.dataset.day;
    const hour = cell.dataset.hour ? +cell.dataset.hour : null;
    const min = cell.dataset.min != null ? +cell.dataset.min : 0;
    const allday = cell.dataset.allday === '1';
    const startMin = allday ? null : (hour * 60 + min);
    cell.addEventListener('click', (e) => {
      if (state.placing) {
        if (placeAllowed(state, day)) placeAt(state, calEl.closest('.cal-root').querySelector('.cal-mount') || calEl.parentElement.parentElement, day, startMin, allday);
      } else if (!isPast(state, day)) {
        openCreateModal(state, calEl.closest('.cal-root').parentElement.querySelector('.cal-mount') || cell.closest('.cal-mount') || cell.closest('.cal-root'), day, startMin);
      }
    });
    cell.addEventListener('dragover', (e) => { if (state.dragId && allowedFor(state, state.dragId, day)) { e.preventDefault(); cell.classList.add('dragover'); } });
    cell.addEventListener('dragleave', () => cell.classList.remove('dragover'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault(); cell.classList.remove('dragover');
      if (!state.dragId) return;
      const t = state.tasks[state.dragId];
      if (!t || isLocked(t) || !allowedFor(state, state.dragId, day)) { state.dragId = null; return; }
      moveTaskToDay(state, state.dragId, day, allday ? null : startMin, allday);
      state.dragId = null;
    });
  });
  // обработчики событий: открытие/drag/resize/удаление
  calEl.querySelectorAll('.ev').forEach((evEl) => {
    const id = evEl.dataset.id;
    evEl.addEventListener('click', (e) => { e.stopPropagation(); openDetail(state, evEl.closest('.cal-mount') || evEl.closest('.cal-root'), id); });
    evEl.addEventListener('dragstart', (e) => { state.dragId = id; });
    evEl.addEventListener('dragend', () => { state.dragId = null; });
    const x = evEl.querySelector('.x');
    if (x) x.addEventListener('click', (e) => { e.stopPropagation(); unschedule(state, id); });
    const rz = evEl.querySelector('.ev-resize');
    if (rz) rz.addEventListener('mousedown', (e) => startResize(state, e, id, evEl));
  });
}

function evHtml(t) {
  const dn = t.done ? ' done' : '';
  const chk = t.done ? '✓ ' : '';
  const x = isLocked(t) || t.done ? '' : `<span class="x">✕</span>`;
  const g = `<span class="gsync">${typeIcon(t)}</span>`;
  if (t.allday) {
    return `<div class="ev ev-${t.cls}${dn}" data-id="${t.id}" style="height:30px" draggable="${isLocked(t) || t.done ? 'false' : 'true'}">${x}<div class="ev-t">${chk}${escHtml(t.short || t.title)}</div>${g}</div>`;
  }
  const dur = t.dur || 30;
  const start = t.start != null ? t.start : 9 * 60;
  const top = start / 60 * ROW;
  const h = Math.max(16, dur / 60 * ROW - 2);
  const resize = isLocked(t) || t.done ? '' : `<span class="ev-resize"></span>`;
  return `<div class="ev timed ev-${t.cls}${dn}" data-id="${t.id}" draggable="${isLocked(t) || t.done ? 'false' : 'true'}" style="top:${top}px;height:${h}px">${x}<div class="ev-t">${chk}${escHtml(t.short || t.title)}</div>${g}${resize}</div>`;
}

/* ─── month view ─── */
function renderMonth(state, calEl, scheduled) {
  const mDate = parseYMD(state.monthStart);
  const monthIdx = mDate.getMonth();
  const year = mDate.getFullYear();
  const firstDow = dowIdx(mDate);
  const start = addDays(mDate, -firstDow);  // Пн первой недели
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const wStart = addDays(start, w * 7);
    weeks.push(ymd(wStart));
  }

  let html = '<div class="month-grid">';
  DOW.forEach((d) => html += `<div class="m-dow">${d}</div>`);
  html += '</div><div>';
  weeks.forEach((wsYMD) => {
    const ws = parseYMD(wsYMD);
    const wsEnd = addDays(ws, 6);
    const bars = scheduled.filter((t) => (t.span || 1) > 1 && t.day && parseYMD(t.day) <= wsEnd && addDays(parseYMD(t.day), t.span - 1) >= ws);
    const barPad = bars.length * 19;
    html += '<div class="m-week">';
    for (let c = 0; c < 7; c++) {
      const cellDate = addDays(ws, c);
      const cellYMD = ymd(cellDate);
      const inMonth = cellDate.getMonth() === monthIdx;
      const isToday = cellYMD === state.today;
      const past = isPast(state, cellYMD);
      const pills = scheduled.filter((t) => t.day === cellYMD && (t.span || 1) === 1).map(mPill).join('');
      const cls = `m-cell ${inMonth ? '' : 'out'} ${isToday ? 'today' : ''} ${(inMonth && !past) ? 'mcreatable' : ''}`;
      const spacer = barPad ? `<div style="height:${barPad}px"></div>` : '';
      html += `<div class="${cls}" data-mday="${cellYMD}"><div class="md">${cellDate.getDate()}</div>${spacer}${pills}</div>`;
    }
    let barsHtml = '';
    bars.forEach((t, bi) => {
      const a = lessYMD(t.day, wsYMD) ? wsYMD : t.day;
      const tEnd = ymd(addDays(parseYMD(t.day), (t.span || 1) - 1));
      const b = lessYMD(ymd(wsEnd), tEnd) ? ymd(wsEnd) : tEnd;
      const aIdx = diffDays(wsYMD, a);
      const bIdx = diffDays(wsYMD, b);
      const left = aIdx / 7 * 100;
      const width = (bIdx - aIdx + 1) / 7 * 100;
      const resize = isLocked(t) ? '' : `<span class="m-bar-resize"></span>`;
      barsHtml += `<div class="m-bar ev-${t.cls} ${t.done ? 'done' : ''}" data-id="${t.id}" draggable="${isLocked(t) ? 'false' : 'true'}" style="left:${left}%;width:${width}%;top:${24 + bi * 19}px">${t.done ? '✓ ' : ''}${escHtml(t.short || t.title)}${resize}</div>`;
    });
    html += `<div class="m-bars">${barsHtml}</div></div>`;
  });
  html += '</div>';
  calEl.innerHTML = html;

  // обработчики
  calEl.querySelectorAll('.m-cell').forEach((cell) => {
    const day = cell.dataset.mday;
    cell.addEventListener('click', () => {
      if (cell.classList.contains('mcreatable')) openCreateModal(state, cell.closest('.cal-mount') || cell.closest('.cal-root'), day, null);
    });
    cell.addEventListener('dragover', (e) => { if (state.dragId) e.preventDefault(); });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!state.dragId) return;
      const t = state.tasks[state.dragId]; if (!t || isLocked(t)) { state.dragId = null; return; }
      moveTaskToDay(state, state.dragId, day, t.start != null ? t.start : null, t.allday);
      state.dragId = null;
    });
  });
  calEl.querySelectorAll('.m-pill, .m-bar').forEach((el) => {
    const id = el.dataset.id;
    el.addEventListener('click', (e) => { e.stopPropagation(); openDetail(state, el.closest('.cal-mount') || el.closest('.cal-root'), id); });
    el.addEventListener('dragstart', (e) => { state.dragId = id; });
    el.addEventListener('dragend', () => { state.dragId = null; });
  });
}
/* ─── list view: плоский реестр всех задач с фильтрами ─── */
function renderList(state, calEl, inbox, scheduled) {
  const all = [...inbox, ...scheduled];
  // Фильтры (state.listFilters — {when, author})
  state.listFilters = state.listFilters || { when: 'all', author: 'all' };
  const { when, author } = state.listFilters;

  const now = state.today;
  const nextWeek = ymd(addDays(parseYMD(now), 7));
  const isOverdue = (t) => !t.done && t.day && t.day < now;
  const isToday = (t) => t.day === now && !t.done;
  const isWeek = (t) => t.day && t.day > now && t.day <= nextWeek && !t.done;
  const isLater = (t) => t.day && t.day > nextWeek && !t.done;
  const isNoDate = (t) => !t.day && !t.done;
  const isDone = (t) => t.done;

  let filtered = all;
  if (when === 'overdue') filtered = all.filter(isOverdue);
  else if (when === 'today') filtered = all.filter(isToday);
  else if (when === 'week') filtered = all.filter(isWeek);
  else if (when === 'later') filtered = all.filter(isLater);
  else if (when === 'nodate') filtered = all.filter(isNoDate);
  else if (when === 'done') filtered = all.filter(isDone);
  else filtered = all.filter(t => !t.done);  // 'all' — активные, выполненные видны только во вкладке «Выполнено»

  if (author === 'self') filtered = filtered.filter(t => t.cls === 'mine' || t.author_kind === 'self');
  else if (author === 'manager') filtered = filtered.filter(t => t.cls === 'manager' || t.author_kind === 'manager');
  else if (author === 'ai') filtered = filtered.filter(t => t.author_kind === 'system' || t.cls === 'otkl' || t.cls === 'plan' || t.cls === 'srochno');

  // Сортировка: просрочка → сегодня → на неделе → позже → без даты → выполнено
  const orderKey = (t) => {
    if (t.done) return 6;
    if (isOverdue(t)) return 0;
    if (isToday(t)) return 1;
    if (isWeek(t)) return 2;
    if (isLater(t)) return 3;
    if (isNoDate(t)) return 4;
    return 5;
  };
  filtered.sort((a, b) => {
    const oa = orderKey(a), ob = orderKey(b);
    if (oa !== ob) return oa - ob;
    // внутри группы — по дате+времени
    const da = (a.day || 'zzzz') + ' ' + (a.start != null ? String(a.start).padStart(4,'0') : '9999');
    const db = (b.day || 'zzzz') + ' ' + (b.start != null ? String(b.start).padStart(4,'0') : '9999');
    return da.localeCompare(db);
  });

  const cntBy = (fn) => all.filter(fn).length;
  const cnts = {
    all: all.filter(t => !t.done).length,
    overdue: cntBy(isOverdue),
    today: cntBy(isToday),
    week: cntBy(isWeek),
    later: cntBy(isLater),
    nodate: cntBy(isNoDate),
    done: cntBy(isDone),
  };

  const filterBtn = (val, label, count, kind) => `<button class="lf-btn ${state.listFilters[kind]===val?'on':''}" data-lf-${kind}="${val}">${label}${count!=null?` <span style="opacity:.7">${count}</span>`:''}</button>`;
  const whenGroup = `<div class="lf-group">
    ${filterBtn('all', 'Все', cnts.all, 'when')}
    ${cnts.overdue ? filterBtn('overdue', '⚠ Просрочено', cnts.overdue, 'when') : ''}
    ${filterBtn('today', 'Сегодня', cnts.today, 'when')}
    ${filterBtn('week', 'Неделя', cnts.week, 'when')}
    ${cnts.later ? filterBtn('later', 'Позже', cnts.later, 'when') : ''}
    ${cnts.nodate ? filterBtn('nodate', 'Без срока', cnts.nodate, 'when') : ''}
    ${filterBtn('done', 'Выполнено', cnts.done, 'when')}
  </div>`;
  const authorGroup = `<div class="lf-group">
    ${filterBtn('all', 'Кто угодно', null, 'author')}
    ${filterBtn('self', '👤 Я', null, 'author')}
    ${filterBtn('manager', '👔 Менеджер', null, 'author')}
    ${filterBtn('ai', '🤖 ИИ', null, 'author')}
  </div>`;

  const monRu = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const dowRu = ['вс','пн','вт','ср','чт','пт','сб'];
  const whenLabel = (t) => {
    if (!t.day) return 'без срока';
    const d = parseYMD(t.day);
    const time = t.start != null && !t.allday ? ` ${String(Math.floor(t.start/60)).padStart(2,'0')}:${String(t.start%60).padStart(2,'0')}` : '';
    if (t.day === now) return `сегодня${time}`;
    if (t.day < now) {
      const diff = diffDays(t.day, now);
      return `${diff} ${diff === 1 ? 'день' : diff < 5 ? 'дня' : 'дней'} назад${time}`;
    }
    return `${dowRu[d.getDay()]} ${d.getDate()} ${monRu[d.getMonth()]}${time}`;
  };
  const whenCls = (t) => {
    if (t.done) return '';
    if (isOverdue(t)) return 'overdue';
    if (isToday(t)) return 'today';
    if (isWeek(t)) return 'week';
    return '';
  };

  const rows = filtered.map((t) => {
    const cls = whenCls(t);
    const done = t.done ? 'done' : '';
    const overdueRow = isOverdue(t) ? 'overdue' : '';
    const actions = t.done
      ? `<button data-act="reopen" data-id="${t.id}" title="Вернуть в работу">↺</button>`
      : `<button class="lr-done" data-act="done" data-id="${t.id}" title="Выполнено">✓</button>`;
    return `<div class="list-row ${done} ${overdueRow}" data-open="${t.id}">
      <span class="lr-dot" style="background:${dotColor(t.cls)}"></span>
      <div class="lr-body">
        <div class="lr-title">${typeIcon(t)} ${escHtml(t.title)}</div>
        <div class="lr-meta">
          <span class="lr-when ${cls}">${whenLabel(t)}</span>
          ${t.dur && !t.allday && t.start != null ? `<span>· ${t.dur} мин</span>` : ''}
          <span>· ${escHtml(authorOf(t))}</span>
          ${isLocked(t) ? '<span>· 🔒 закреплено</span>' : ''}
        </div>
      </div>
      <div class="lr-actions">${actions}</div>
    </div>`;
  }).join('');

  const empty = filtered.length === 0 ? '<div class="list-empty">Задач по этому фильтру нет 🎉</div>' : '';

  calEl.innerHTML = `<div class="list-wrap">
    <div class="list-filters">${whenGroup}<div class="lf-sep"></div>${authorGroup}</div>
    <div>${rows}${empty}</div>
  </div>`;

  // Обработчики фильтров
  calEl.querySelectorAll('[data-lf-when]').forEach((b) => {
    b.onclick = () => { state.listFilters.when = b.dataset.lfWhen; render(state, calEl.closest('.cal-mount') || calEl.closest('.cal-root')); };
  });
  calEl.querySelectorAll('[data-lf-author]').forEach((b) => {
    b.onclick = () => { state.listFilters.author = b.dataset.lfAuthor; render(state, calEl.closest('.cal-mount') || calEl.closest('.cal-root')); };
  });
  // Клик по строке → детали
  calEl.querySelectorAll('[data-open]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-act]')) return;  // клик по кнопке — не открывать
      openDetail(state, row.closest('.cal-mount') || row.closest('.cal-root'), row.dataset.open);
    });
  });
  // Быстрое ✓ / ↺
  calEl.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.dataset.id;
      const act = b.dataset.act;
      if (act === 'done') await update(ref(state.db, `/tasks/${id}`), { status: 'done', done_at: Date.now() });
      else if (act === 'reopen') await update(ref(state.db, `/tasks/${id}`), { status: 'active', done_at: null, done_comment: null });
    };
  });
}

function mPill(t) {
  const time = !t.allday && t.start != null ? `${String(Math.floor(t.start / 60)).padStart(2, '0')}:${String(t.start % 60).padStart(2, '0')} ` : '';
  return `<div class="m-pill ev-${t.cls} ${t.done ? 'done' : ''}" data-id="${t.id}" draggable="${isLocked(t) ? 'false' : 'true'}">${typeIcon(t)} ${time}${escHtml(t.short || t.title)}</div>`;
}

/* ─── панель Inbox ─── */
function renderPanel(state, panelEl, inbox) {
  // Сортировка: today → week → mine
  const sorted = [...inbox].sort((a, b) => {
    const oa = a.horizon === 'today' ? 0 : 1; const ob = b.horizon === 'today' ? 0 : 1;
    return oa - ob;
  });
  const cards = sorted.map((t) => {
    const hb = t.horizon === 'today' ? '<span class="bdg bdg-today">сегодня</span>' : '<span class="bdg bdg-week">эта неделя</span>';
    const srcLabel = t.srcLabel || t.src || '';
    const borderColor = dotColor(t.cls);
    return `<div class="icard" data-id="${t.id}" draggable="true" style="border-left-color:${borderColor}">
      <div class="it">${escHtml(t.title)}</div>
      <div class="ibadges">${hb}<span class="bdg bdg-src">${escHtml(srcLabel)}</span></div>
      <div class="iactions">
        <button class="btn-cal" data-act="place">📅 На календарь</button>
        <button class="btn-tool" data-act="detail">${t.tool ? 'Как сделать' : 'Подробно'}</button>
      </div></div>`;
  }).join('');
  panelEl.innerHTML = `<div class="panel-h">🗂 Входящие задачи <span class="cal-muted">· ${sorted.length}</span></div>
    <div class="panel-sub">Жми «На календарь» и выбери время. Срочные — только на сегодня, недельные — на любой день.</div>
    <div class="panel-sub" style="margin-top:-6px">Значок в углу плашки: 🤖 система · 👔 МОП/РОП · 👤 своя · 📅 мероприятие</div>
    <button class="btn-cal" style="width:100%;margin-bottom:12px;background:#f1f3f7;color:#2b6cb0" data-create>➕ Создать свою задачу</button>
    ${sorted.length ? cards : '<div class="empty">Все задачи распределены 🎉</div>'}`;

  panelEl.querySelector('[data-create]').onclick = () => openCreateModal(state, panelEl.closest('.cal-mount') || panelEl.closest('.cal-root'), state.today, 9 * 60);
  panelEl.querySelectorAll('.icard').forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('[data-act="place"]').onclick = (e) => { e.stopPropagation(); state.placing = id; render(state, card.closest('.cal-mount')); window.scrollTo({ top: 120, behavior: 'smooth' }); };
    card.querySelector('[data-act="detail"]').onclick = (e) => { e.stopPropagation(); openDetail(state, card.closest('.cal-mount') || card.closest('.cal-root'), id); };
    card.addEventListener('dragstart', () => { state.dragId = id; });
    card.addEventListener('dragend', () => { state.dragId = null; });
  });
}

function renderHint(state, mount) {
  const h = mount.querySelector('.hint');
  if (!state.placing) { h.classList.remove('on'); return; }
  const t = state.tasks[state.placing];
  if (!t) return;
  h.querySelector('.hint-text').innerHTML = `📌 Выберите время для «<b>${escHtml(t.title)}</b>» — кликните по подсвеченному слоту` + (t.horizon === 'today' ? ' (только сегодня)' : ' (любой день недели)');
  h.classList.add('on');
}

/* ─── размещение/разрешения ─── */
function allowedFor(state, id, dayYMD) {
  const t = state.tasks[id]; if (!t) return false;
  if (lessYMD(dayYMD, state.today)) return false;
  if (t.horizon === 'today') return eqYMD(dayYMD, state.today);
  return true;
}
function placeAllowed(state, dayYMD) { return state.placing ? allowedFor(state, state.placing, dayYMD) : false; }

async function placeAt(state, mount, dayYMD, startMin, allday) {
  const id = state.placing; if (!id) return;
  await moveTaskToDay(state, id, dayYMD, allday ? null : startMin, allday);
  state.placing = null;
  // render будет вызван автоматически через onValue listener
}
// startMin — минуты от полуночи (например 12:15 = 735). null → без времени/allday.
async function moveTaskToDay(state, id, dayYMD, startMin, allday) {
  const t = state.tasks[id]; if (!t) return;
  const upd = { due_date: dayYMD };
  if (allday) {
    upd.due_at = new Date(`${dayYMD}T23:59:59+0${TZ_OFFSET_HOURS}:00`).getTime();
  } else if (startMin != null) {
    const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
    const mm = String(startMin % 60).padStart(2, '0');
    upd.due_at = new Date(`${dayYMD}T${hh}:${mm}:00+0${TZ_OFFSET_HOURS}:00`).getTime();
    upd.duration_min = t.dur || 30;
  }
  await update(ref(state.db, `/tasks/${id}`), upd);
}
async function unschedule(state, id) {
  const t = state.tasks[id]; if (!t || isLocked(t)) return;
  await update(ref(state.db, `/tasks/${id}`), { due_date: null, due_at: null });
}

/* ─── resize длительности ─── */
function startResize(state, e, id, evEl) {
  e.preventDefault(); e.stopPropagation();
  const t = state.tasks[id]; if (!t || isLocked(t)) return;
  const startY = e.clientY; const startDur = t.dur || 30;
  let curDur = startDur;
  const move = (ev) => {
    const dmin = Math.round((ev.clientY - startY) / (ROW / 60) / 15) * 15;
    curDur = Math.max(15, Math.min(8 * 60, startDur + dmin));
    evEl.style.height = Math.max(16, curDur / 60 * ROW - 2) + 'px';
  };
  const up = async () => {
    document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
    if (curDur !== startDur) await update(ref(state.db, `/tasks/${id}`), { duration_min: curDur });
  };
  document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
}

/* ─── модалка создания ─── */
// startMin — минуты от полуночи (например 12:15=735). Если null — предзаполняем 9:00.
function openCreateModal(state, mount, day, startMin) {
  const m = mount.querySelector('[data-modal="create"]'); if (!m) return;
  m.querySelector('[data-mh]').textContent = '➕ Новая задача';
  m.querySelector('[data-nt-title]').value = '';
  m.querySelector('[data-nt-allday]').checked = false;
  m.querySelector('[data-nt-timerow]').style.display = 'flex';

  // дни — от сегодня на 60 вперёд
  const dsel = m.querySelector('[data-nt-day]');
  const startD = parseYMD(state.today);
  let opts = '';
  for (let i = 0; i < 60; i++) {
    const dd = addDays(startD, i);
    const dy = ymd(dd);
    opts += `<option value="${dy}" ${day === dy ? 'selected' : ''}>${DOW[dowIdx(dd)]} ${dd.getDate()} ${MON_RU[dd.getMonth()]}</option>`;
  }
  dsel.innerHTML = opts;
  const sMin = (typeof startMin === 'number' ? startMin : 9 * 60);
  m.querySelector('[data-nt-start]').innerHTML = timeOptions(sMin);
  m.querySelector('[data-nt-end]').innerHTML = timeOptions(sMin + 30);
  m.dataset.editing = '';
  m.classList.add('on');
  setTimeout(() => m.querySelector('[data-nt-title]').focus(), 50);
}
function closeCreateModal(mount) {
  const m = mount.querySelector('[data-modal="create"]'); if (m) m.classList.remove('on');
}
function timeOptions(sel) {
  // Шаг 15 минут — стандарт для календарей (Google/Outlook). Позволяет 12:15/13:45.
  let o = '';
  for (let m = 0; m < 24 * 60; m += 15) {
    o += `<option value="${m}" ${m === sel ? 'selected' : ''}>${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</option>`;
  }
  return o;
}
async function saveNewTask(state, mount) {
  const m = mount.querySelector('[data-modal="create"]');
  const title = m.querySelector('[data-nt-title]').value.trim(); if (!title) return;
  const day = m.querySelector('[data-nt-day]').value;
  const allday = m.querySelector('[data-nt-allday]').checked;
  const editingId = m.dataset.editing || null;
  const upd = {
    title,
    due_date: day,
    duration_min: 30,
  };
  if (allday) {
    upd.due_at = new Date(`${day}T23:59:59+0${TZ_OFFSET_HOURS}:00`).getTime();
  } else {
    const s = +m.querySelector('[data-nt-start]').value;
    let e = +m.querySelector('[data-nt-end]').value; if (e <= s) e = s + 30;
    upd.due_at = new Date(`${day}T${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:00+0${TZ_OFFSET_HOURS}:00`).getTime();
    upd.duration_min = e - s;
  }
  if (editingId) {
    await update(ref(state.db, `/tasks/${editingId}`), upd);
  } else {
    const taskId = 'task_' + push(ref(state.db, '/tasks')).key;
    const fullTask = {
      ...upd,
      assignee_code: state.ownerCode,
      assignee_role: 'realtor',
      author_code: state.ownerCode,
      author_kind: 'self',
      author_label: 'Вы',
      priority: 'normal',
      type: 'free',
      status: 'active',
      progress_done: 0,
      progress_total: 1,
      created_at: Date.now(),
      source: 'моя задача',
      horizon: 'week',
      ui_group: 'week',
    };
    await set(ref(state.db, `/tasks/${taskId}`), fullTask);
  }
  closeCreateModal(mount);
}

/* ─── модалка детали ─── */
function openDetail(state, mount, id) {
  const t = state.tasks[id]; if (!t) return;
  const m = mount.querySelector('[data-modal="detail"]'); if (!m) return;
  const card = m.querySelector('[data-detail-card]');
  const tool = t.tool ? TOOLS[t.tool] : null;
  const span = t.span || 1;
  const dateLbl = t.day ? (span > 1
    ? `${dowOfYMD(t.day)} ${parseYMD(t.day).getDate()}–${parseYMD(ymd(addDays(parseYMD(t.day), span - 1))).getDate()} ${MON_RU[parseYMD(t.day).getMonth()]}`
    : `${dowOfYMD(t.day)}, ${parseYMD(t.day).getDate()} ${MON_RU[parseYMD(t.day).getMonth()]}`)
    : '';
  const when = t.day
    ? (t.allday ? `${dateLbl} · ${span > 1 ? 'многодневная' : 'весь день'}` : `${dateLbl} · ${fmtRange(t.start, t.dur)}`)
    : (t.horizon === 'today' ? 'Срочно · сегодня · не на календаре' : 'Эта неделя · не на календаре');

  let tools = '';
  if (t.cls === 'mine') tools += `<button class="cal-dm-ic" data-act="edit" title="Редактировать">✏️</button><button class="cal-dm-ic" data-act="del" title="Удалить">🗑</button>`;
  else if (!isLocked(t) && t.day) tools += `<button class="cal-dm-ic" data-act="unschedule" title="Убрать с календаря">🗑</button>`;
  tools += `<button class="cal-dm-ic" data-act="close">✕</button>`;

  let rows = '';
  // Inline редактор даты/времени — только для НЕ-locked и НЕ-done задач.
  // Позволяет прямо в модалке перенести задачу без открытия формы «Редактировать».
  if (!isLocked(t) && !t.done) {
    const startD = parseYMD(state.today);
    let dayOpts = '<option value="">без даты</option>';
    for (let i = 0; i < 60; i++) {
      const dd = addDays(startD, i);
      const dy = ymd(dd);
      dayOpts += `<option value="${dy}" ${t.day === dy ? 'selected' : ''}>${DOW[dowIdx(dd)]} ${dd.getDate()} ${MON_RU[dd.getMonth()]}</option>`;
    }
    const curStart = (t.day && !t.allday && t.start != null) ? t.start : 9 * 60;
    const alldayChecked = t.day && t.allday ? 'checked' : '';
    const timeDisplay = (t.day && t.allday) ? 'none' : 'flex';
    rows += `<div class="cal-dm-row" style="align-items:center;gap:10px;background:#f7f9fc;border-radius:8px;padding:10px 12px;margin:6px 0">
      <div class="cal-dm-ricon">📅</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select class="cal-m-sel" data-edit-day style="flex:1;min-width:150px">${dayOpts}</select>
          <label class="cal-m-check" style="margin:0;font-size:12px"><input type="checkbox" data-edit-allday ${alldayChecked}> Весь день</label>
        </div>
        <div data-edit-timerow style="display:${timeDisplay};gap:8px;align-items:center">
          <span style="font-size:12px;color:#7a8194">Время:</span>
          <select class="cal-m-sel" data-edit-start style="flex:1;min-width:100px">${timeOptions(curStart)}</select>
          <span style="font-size:12px;color:#7a8194">длительность</span>
          <select class="cal-m-sel" data-edit-dur style="width:90px">
            ${[15,30,45,60,90,120,180,240].map(d=>`<option value="${d}" ${d===(t.dur||30)?'selected':''}>${d} мин</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  }
  if (t.event) rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">📌</div><div><b>Мероприятие</b><br><span class="cal-muted">${escHtml(t.recur || 'разовое')}</span></div></div>`;
  else rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">⚠️</div><div><b>Почему задача</b><br><span class="cal-muted">${escHtml(t.src || '')} · ${escHtml(t.srcLabel || '')}</span></div></div>`;
  if (t.group) rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">👥</div><div><b>Массовая</b><br><span class="cal-muted">для всей группы</span></div></div>`;
  if (isLocked(t)) rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">🔒</div><div>Перенести может только ${t.event ? 'организатор' : 'менеджер / РОП'} — вы не можете двигать</div></div>`;
  if (tool && !t.event) {
    rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">📋</div><div style="flex:1"><b>${escHtml(tool.type || '')}: ${escHtml(tool.title || '')}</b>${(tool.steps || []).map((s, i) => `<div class="cal-dm-step"><span class="cal-dm-n">${i + 1}</span><span>${escHtml(s)}</span></div>`).join('')}</div></div>`;
  }
  if (t.description && !tool) rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">📝</div><div>${escHtml(t.description)}</div></div>`;
  rows += `<div class="cal-dm-row"><div class="cal-dm-ricon">👤</div><div>${escHtml(authorOf(t))}</div></div>`;

  const verb = t.event ? 'Проведено' : 'Выполнено';
  let actions = ''; let comment = '';
  if (t.done) {
    rows += `<div class="cal-dm-row" style="color:#16a34a"><div class="cal-dm-ricon">✅</div><div><b>${verb}</b>${t.doneComment ? `<br><span class="cal-muted">«${escHtml(t.doneComment)}»</span>` : ''}</div></div>`;
    actions = `<button class="cal-dbtn" data-act="reopen">Вернуть в работу</button><button class="cal-dbtn" data-act="close">Закрыть</button>`;
  } else {
    comment = `<textarea class="cal-m-input" data-comment rows="2" placeholder="Комментарий к выполнению (необязательно)…" style="margin:14px 0 0;resize:vertical"></textarea>`;
    if (!t.day) actions += `<button class="cal-dbtn primary" data-act="place">📅 На календарь</button>`;
    actions += `<button class="cal-dbtn done" data-act="done">✓ ${verb}</button>`;
    actions += `<button class="cal-dbtn" data-act="close">Закрыть</button>`;
  }

  card.innerHTML = `
    <div class="cal-dm-tools">${tools}</div>
    <div class="cal-dm-head">
      <span class="cal-dm-dot" style="background:${dotColor(t.cls)}"></span>
      <div><div class="cal-dm-title" style="${t.done ? 'text-decoration:line-through;opacity:.7' : ''}">${escHtml(t.title)}</div><div class="cal-dm-sub">${escHtml(when)}</div></div>
    </div>
    ${rows}
    ${comment}
    <div class="cal-dm-actions">${actions}</div>`;

  // Обработчики inline-редактора даты/времени
  const editDay = card.querySelector('[data-edit-day]');
  const editAllday = card.querySelector('[data-edit-allday]');
  const editTimerow = card.querySelector('[data-edit-timerow]');
  const editStart = card.querySelector('[data-edit-start]');
  const editDur = card.querySelector('[data-edit-dur]');
  const saveEdits = async () => {
    if (!editDay) return;
    const day = editDay.value || null;
    if (!day) { await unschedule(state, id); return; }
    const allday = editAllday.checked;
    const upd = { due_date: day };
    if (allday) {
      upd.due_at = new Date(`${day}T23:59:59+0${TZ_OFFSET_HOURS}:00`).getTime();
      upd.duration_min = null;
    } else {
      const s = +editStart.value;
      const hh = String(Math.floor(s / 60)).padStart(2, '0');
      const mm = String(s % 60).padStart(2, '0');
      upd.due_at = new Date(`${day}T${hh}:${mm}:00+0${TZ_OFFSET_HOURS}:00`).getTime();
      upd.duration_min = +editDur.value;
    }
    await update(ref(state.db, `/tasks/${id}`), upd);
  };
  if (editDay) editDay.onchange = saveEdits;
  if (editAllday) editAllday.onchange = () => {
    editTimerow.style.display = editAllday.checked ? 'none' : 'flex';
    saveEdits();
  };
  if (editStart) editStart.onchange = saveEdits;
  if (editDur) editDur.onchange = saveEdits;

  card.querySelectorAll('[data-act]').forEach((b) => {
    const act = b.dataset.act;
    b.onclick = async () => {
      if (act === 'close') m.classList.remove('on');
      else if (act === 'done') {
        const c = card.querySelector('[data-comment]');
        await update(ref(state.db, `/tasks/${id}`), { status: 'done', done_at: Date.now(), done_comment: c ? c.value.trim() : '' });
        m.classList.remove('on');
        // На главной блок задач — снапшот из getDashboard, а не listener.
        // После смены статуса перезагружаем страницу чтобы задача исчезла.
        if (!document.querySelector('.cal-body')) setTimeout(() => location.reload(), 200);
      } else if (act === 'reopen') {
        await update(ref(state.db, `/tasks/${id}`), { status: 'active', done_at: null, done_comment: null });
        m.classList.remove('on');
        if (!document.querySelector('.cal-body')) setTimeout(() => location.reload(), 200);
      } else if (act === 'unschedule') { await unschedule(state, id); m.classList.remove('on'); }
      else if (act === 'del') {
        await remove(ref(state.db, `/tasks/${id}`));
        m.classList.remove('on');
        if (!document.querySelector('.cal-body')) setTimeout(() => location.reload(), 200);
      }
      else if (act === 'edit') {
        m.classList.remove('on');
        const cm = mount.querySelector('[data-modal="create"]');
        cm.querySelector('[data-mh]').textContent = '✏️ Редактировать задачу';
        cm.querySelector('[data-nt-title]').value = t.title;
        cm.dataset.editing = id;
        // set day/time
        openCreateModal(state, mount, t.day || state.today, t.start != null ? t.start : 9 * 60);
      } else if (act === 'place') { state.placing = id; m.classList.remove('on'); render(state, mount); }
    };
  });

  m.classList.add('on');
}

/* ─── авто-раскладка inbox по неделе ─── */
async function spreadWeek(state, mount, inbox) {
  const weekly = inbox.filter((t) => t.horizon === 'week');
  let cursor = parseYMD(state.today);
  const perDay = {};
  const updates = {};
  for (const t of weekly) {
    while ((perDay[ymd(cursor)] || 0) >= 2) cursor = addDays(cursor, 1);
    const day = ymd(cursor);
    perDay[day] = (perDay[day] || 0) + 1;
    const hour = 10 + (perDay[day] - 1) * 4;  // 10:00 и 14:00
    updates[`/tasks/${t.id}/due_date`] = day;
    updates[`/tasks/${t.id}/due_at`] = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+0${TZ_OFFSET_HOURS}:00`).getTime();
    updates[`/tasks/${t.id}/duration_min`] = t.dur || 30;
  }
  if (Object.keys(updates).length) await update(ref(state.db), updates);
}
