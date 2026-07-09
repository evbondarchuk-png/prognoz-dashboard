/**
 * Ассистент «Прогноша» — плавающая кнопка + чат-шторка + бриф.
 * Перенесён из Премиума (prognoz-premium/assistant.js, 09.07.2026), адаптирован
 * под дизайн-токены основного Прогноза (--brand вместо --petrol, --surface вместо
 * --card и т.д.). Бэкенд общий — askPrognosha (functions/prognosha.js) без изменений.
 * Работает с данными кабинета через переданный контекст (тот же getDashboard).
 */

import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';

let ctxData = null;
let opened = false;

const CSS = `
/* Прогноша — плавающая кнопка */
.prognosha-fab{
  position:fixed;bottom:20px;right:20px;z-index:100;
  width:60px;height:60px;border-radius:50%;
  background:linear-gradient(150deg,var(--brand),var(--brand-hover));
  border:none;color:#fff;cursor:pointer;font-size:26px;
  box-shadow:0 6px 20px rgba(43,108,176,.35);
  display:flex;align-items:center;justify-content:center;
  animation:pFabBob 2.4s ease-in-out infinite;
  transition:transform .18s;
}
.prognosha-fab:hover{transform:scale(1.08)}
.prognosha-fab .p-fox{width:44px;height:44px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.18))}
@keyframes pFabBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.prognosha-fab .dot{
  position:absolute;top:6px;right:6px;
  width:12px;height:12px;background:var(--gold);border-radius:50%;
  border:2px solid #fff;
}

/* Шторка */
.prognosha-sheet{
  position:fixed;bottom:0;right:0;z-index:110;
  width:min(420px,100vw);height:min(72vh,720px);
  background:var(--surface);border-radius:16px 16px 0 0;
  box-shadow:0 -8px 40px rgba(0,0,0,.14);
  display:flex;flex-direction:column;
  transform:translateY(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);
}
.prognosha-sheet.on{transform:translateY(0)}
@media(min-width:640px){
  .prognosha-sheet{margin:0 20px 20px 0;border-radius:16px;height:min(70vh,680px)}
}

.p-head{
  background:linear-gradient(150deg,var(--brand),var(--brand-hover));
  color:#fff;padding:14px 16px;
  border-radius:16px 16px 0 0;
  display:flex;align-items:center;gap:10px;
}
.p-head .p-face{width:36px;height:36px;background:#FFF7EE;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px;box-sizing:border-box}
.p-head .p-face svg{width:100%;height:100%}
.p-head .p-title{flex:1;font-weight:800;font-size:14px}
.p-head .p-sub{font-size:11px;opacity:.7;font-weight:600}
.p-close{background:rgba(255,255,255,.12);border:none;color:#fff;font-size:16px;width:32px;height:32px;border-radius:8px;cursor:pointer}

.p-body{flex:1;overflow-y:auto;padding:14px}
.p-brief{
  background:var(--brand-soft);
  border-radius:14px;padding:14px;
  font-size:13.5px;line-height:1.55;color:var(--ink);
  border:1px solid rgba(43,108,176,.12);
}
.p-brief b{color:var(--brand)}
.p-brief-h{font-size:11px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px}

.p-suggests{margin-top:12px;display:flex;flex-direction:column;gap:6px}
.p-suggest{background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;text-align:left;font-family:inherit;transition:.1s}
.p-suggest:hover{background:var(--brand-soft);border-color:var(--brand);color:var(--brand)}

.p-msg{margin-top:12px}
.p-msg.user{text-align:right}
.p-msg .p-bubble{display:inline-block;max-width:82%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5;text-align:left}
.p-msg.user .p-bubble{background:var(--brand);color:#fff;border-bottom-right-radius:5px}
.p-msg.bot .p-bubble{background:var(--surface-2);color:var(--ink);border-bottom-left-radius:5px;border:1px solid var(--line)}
.p-msg.bot .p-bubble b{color:var(--brand)}
.p-msg.bot .p-bubble em{font-style:normal;background:#fef3e0;color:var(--gold);padding:1px 6px;border-radius:6px;font-weight:800;font-size:12px}

.p-foot{border-top:1px solid var(--line);padding:12px;display:flex;gap:8px;align-items:center;background:var(--surface)}
.p-input{flex:1;border:1px solid var(--line);border-radius:22px;padding:9px 14px;font-family:inherit;font-size:13.5px;outline:none;transition:.15s;background:var(--surface-2)}
.p-input:focus{border-color:var(--brand);background:var(--surface)}
.p-send{background:var(--brand);color:#fff;border:none;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.p-send:disabled{opacity:.4;cursor:not-allowed}
.p-typing{font-size:12px;color:var(--muted);padding:4px 8px}

/* Рисованный маскот (картинка) — круглый аватар */
.fox-img{width:100%;height:100%;object-fit:cover;object-position:50% 28%;border-radius:50%;display:block}

/* Оживление лисы: дыхание, моргание, уши, игра бровью */
.fox-breathe{transform-box:fill-box;transform-origin:50% 88%;animation:foxBreathe 3.6s ease-in-out infinite}
@keyframes foxBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
.fox-ear{transform-box:fill-box;transform-origin:50% 100%;animation:foxEar 6s ease-in-out infinite}
.fox-ear-r{animation-delay:.45s}
@keyframes foxEar{0%,84%,100%{transform:rotate(0)}88%{transform:rotate(-8deg)}92%{transform:rotate(5deg)}96%{transform:rotate(-2deg)}}
.fox-eye{transform-box:fill-box;transform-origin:50% 50%;animation:foxBlink 4.6s ease-in-out infinite}
@keyframes foxBlink{0%,92%,100%{transform:scaleY(1)}95%,97%{transform:scaleY(.1)}}
.fox-brow-l{transform-box:fill-box;transform-origin:50% 100%;animation:foxBrow 5.2s ease-in-out infinite}
@keyframes foxBrow{0%,68%,100%{transform:translateY(0)}76%{transform:translateY(-2px)}88%{transform:translateY(0)}}
.fox-spark{transform-box:fill-box;transform-origin:50% 50%;animation:foxSpark 2.2s ease-in-out infinite}
@keyframes foxSpark{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
.fox-sweat{transform-box:fill-box;transform-origin:50% 0%;animation:foxSweat 2.6s ease-in-out infinite}
@keyframes foxSweat{0%,55%{transform:translateY(0);opacity:.95}82%{transform:translateY(7px);opacity:.15}83%,100%{opacity:0}}
@media(prefers-reduced-motion:reduce){.fox-breathe,.fox-ear,.fox-eye,.fox-brow-l,.fox-spark,.fox-sweat,.prognosha-fab{animation:none}}
`;

// Маскот «Прогноша» — детальная лиса (по референсу Егора). Разложена на «базу» (уши,
// голова, грудь, щёки, усы, нос — общее для всех) + «лицо» по эмоции (глаза/брови/рот/
// детали). Самописный SVG. Анимации: дыхание, моргание, уши, бровь, искры, капелька.
const FOX_BASE = `
    <g class="fox-ear fox-ear-l">
      <path d="M27 45 L14 7 L47 31 Z" fill="#D9611A"/>
      <path d="M14 7 L17.9 18.4 L23.9 14.2 Z" fill="#241C15"/>
      <path d="M26 42 L18 14 L42 30 Z" fill="#FBF3E7"/>
    </g>
    <g class="fox-ear fox-ear-r">
      <path d="M73 45 L86 7 L53 31 Z" fill="#D9611A"/>
      <path d="M86 7 L82.1 18.4 L76.1 14.2 Z" fill="#241C15"/>
      <path d="M74 42 L82 14 L58 30 Z" fill="#FBF3E7"/>
    </g>
    <path d="M24 42 C22 29 33 23 50 23 C67 23 78 29 76 42 C74 60 65 76 50 84 C35 76 26 60 24 42 Z" fill="#EE7B2E"/>
    <path d="M24 42 C25 54 29 66 37 76 C33 66 30 54 30 44 Z" fill="#D9611A" opacity=".4"/>
    <path d="M76 42 C75 54 71 66 63 76 C67 66 70 54 70 44 Z" fill="#D9611A" opacity=".4"/>
    <path d="M30 80 C26 88 24 96 26 100 L74 100 C76 96 74 88 70 80 C62 86 38 86 30 80 Z" fill="#EE7B2E"/>
    <path d="M50 82 C44 89 42 96 43 100 L57 100 C58 96 56 89 50 82 Z" fill="#FBF3E7"/>
    <path d="M50 45 C39 45 31 49 28 58 C31 72 41 81 50 84 C59 81 69 72 72 58 C69 49 61 45 50 45 Z" fill="#FBF3E7"/>
    <path d="M30 55 L16 60 L28 63 Z" fill="#FBF3E7"/>
    <path d="M29 62 L18 71 L30 69 Z" fill="#FBF3E7"/>
    <path d="M70 55 L84 60 L72 63 Z" fill="#FBF3E7"/>
    <path d="M71 62 L82 71 L70 69 Z" fill="#FBF3E7"/>
    <g stroke="#E4CFB2" stroke-width="1" stroke-linecap="round">
      <path d="M31 59 L17 57"/><path d="M31 61.5 L18 62"/><path d="M31 64 L19 67"/>
      <path d="M69 59 L83 57"/><path d="M69 61.5 L82 62"/><path d="M69 64 L81 67"/>
    </g>
    <path d="M50 64 C46 64 43.5 61.5 43.5 59.5 C43.5 57.5 46.5 57 50 57 C53.5 57 56.5 57.5 56.5 59.5 C56.5 61.5 54 64 50 64 Z" fill="#241C15"/>
    <ellipse cx="47.8" cy="58.6" rx="1.5" ry="1" fill="#fff" opacity=".45"/>`;

const _eyeOpen = (cx) => `<ellipse class="fox-eye" cx="${cx}" cy="47" rx="4.6" ry="4.3" fill="#93AE42"/><ellipse cx="${cx}" cy="47.4" rx="2" ry="2.7" fill="#241C15"/><circle cx="${cx + 1.4}" cy="45.4" r="1.1" fill="#fff"/>`;

const FOX_FACE = {
  // Скепсис: прищур + вздёрнутая бровь + ухмылка
  stern: `
    <ellipse class="fox-eye" cx="41" cy="47" rx="5" ry="3.8" fill="#93AE42"/>
    <ellipse class="fox-eye" cx="59" cy="47" rx="5" ry="3.8" fill="#93AE42"/>
    <ellipse cx="41" cy="47.6" rx="2" ry="2.9" fill="#241C15"/>
    <ellipse cx="59" cy="47.6" rx="2" ry="2.9" fill="#241C15"/>
    <circle cx="42.4" cy="45.6" r="1" fill="#fff"/><circle cx="60.4" cy="45.6" r="1" fill="#fff"/>
    <path d="M36 45.6 C38.5 43.4 43.5 43.4 46 45.6 C43.5 44.8 38.5 44.8 36 45.6 Z" fill="#241C15" opacity=".85"/>
    <path d="M54 45.6 C56.5 43.4 61.5 43.4 64 45.6 C61.5 44.8 56.5 44.8 54 45.6 Z" fill="#241C15" opacity=".85"/>
    <path class="fox-brow-l" d="M34 40 Q40.5 34 47 38.5" stroke="#3A2A1C" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M53.5 40 L66 41.8" stroke="#3A2A1C" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M50 64 L50 67.5" stroke="#6B4A2E" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M50 67.5 C46 69 43 68.5 41 67" stroke="#6B4A2E" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M50 67.5 C55 70.5 60.5 69.5 63.5 66" stroke="#6B4A2E" stroke-width="1.6" stroke-linecap="round" fill="none"/>`,
  // Гордая: большие глаза, брови вверх, широкая улыбка, искорки
  proud: `
    ${_eyeOpen(41)}${_eyeOpen(59)}
    <path class="fox-brow-l" d="M34 38 Q40.5 33 47 37" stroke="#3A2A1C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M53 37 Q59.5 33 66 38" stroke="#3A2A1C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M41 65 Q50 77 59 65 Q50 71 41 65 Z" fill="#6B4A2E"/>
    <path d="M43 66.5 Q50 71 57 66.5" stroke="#fff" stroke-width="1" fill="none" opacity=".45"/>
    <g fill="#F0B32E" class="fox-spark">
      <path d="M21 24 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 z"/>
      <path d="M78 27 l.8 2.4 l2.4 .8 l-2.4 .8 l-.8 2.4 l-.8 -2.4 l-2.4 -.8 l2.4 -.8 z"/>
    </g>`,
  // Довольная: спокойный взгляд, мягкая улыбка
  happy: `
    ${_eyeOpen(41)}${_eyeOpen(59)}
    <path d="M35 39 Q40.5 36 46 38" stroke="#3A2A1C" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M54 38 Q59.5 36 65 39" stroke="#3A2A1C" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M43 65.5 Q50 72 57 65.5" stroke="#6B4A2E" stroke-width="1.8" stroke-linecap="round" fill="none"/>`,
  // Подбадривает: подмигивает + открытая улыбка
  cheer: `
    <path d="M36 47.5 Q41 43 46 47.5" stroke="#241C15" stroke-width="2.3" stroke-linecap="round" fill="none"/>
    ${_eyeOpen(59)}
    <path class="fox-brow-l" d="M34 39 Q40.5 34 47 38" stroke="#3A2A1C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M54 39 L65 40" stroke="#3A2A1C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M42 65 Q50 76 58 65 Q50 71 42 65 Z" fill="#6B4A2E"/>`,
  // Тревога: широкие глаза, брови-домиком (беспокойство), «ох», капелька пота
  alarm: `
    <ellipse class="fox-eye" cx="41" cy="47" rx="4.4" ry="4.7" fill="#93AE42"/>
    <ellipse class="fox-eye" cx="59" cy="47" rx="4.4" ry="4.7" fill="#93AE42"/>
    <ellipse cx="41" cy="47.4" rx="1.6" ry="2.1" fill="#241C15"/>
    <ellipse cx="59" cy="47.4" rx="1.6" ry="2.1" fill="#241C15"/>
    <circle cx="42.4" cy="45.4" r="1.1" fill="#fff"/><circle cx="60.4" cy="45.4" r="1.1" fill="#fff"/>
    <path d="M35 37 L46 34.5" stroke="#3A2A1C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M54 34.5 L65 37" stroke="#3A2A1C" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <ellipse cx="50" cy="68" rx="3.1" ry="2.4" fill="#5A3A22"/>
    <path class="fox-sweat" d="M31 35 C28.5 38.5 28.5 41 31 41 C33.5 41 33.5 38.5 31 35 Z" fill="#6FB7E0"/>
    <ellipse cx="30.2" cy="38.5" rx=".7" ry="1" fill="#fff" opacity=".6"/>`,
};

function foxSvg(emotion) {
  const face = FOX_FACE[emotion] || FOX_FACE.happy;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;overflow:visible"><g class="fox-breathe">${FOX_BASE}${face}</g></svg>`;
}
const FOX_SVG = foxSvg('stern');

// Фолбэк: пока картинок mascot/*.webp нет — показываем векторную лису.
if (typeof window !== 'undefined') window.__foxFallback = FOX_SVG;

// Эмоция лисы по состоянию работы (данные getDashboard: партнёр).
// proud (гордая) · happy (норма) · cheer (подбодрить) · stern (риск Н1-Н2) · alarm (Н3-Н4).
function pickFoxEmotion(d) {
  if (!d) return 'happy';
  const n = (x) => Number(x) || 0;
  const week = d.ir_v2 && d.ir_v2.week;
  const pct = week && week.ir_total != null ? n(week.ir_total) : n(d.ir_v2_week_total);
  const nr = d.n_risk || {};
  const streak = n(nr.streak);
  const good = n(nr.good_streak);
  if (streak >= 3) return 'alarm';
  if (streak >= 1) return 'stern';
  if (good >= 2 || pct >= 90) return 'proud';
  if (pct >= 70) return 'happy';
  return 'cheer';
}

// HTML маскота. Пока — единый детальный SVG (выражения по эмоциям добавим следующим шагом).
// Если положить mascot/fox-<emotion>.webp — раскомментируй img-ветку, картинка перекроет SVG.
function foxHTML(emotion) {
  return foxSvg(emotion);
  // Растровый вариант (когда будут картинки):
  // return `<img class="fox-img" src="mascot/fox-${emotion}.webp" alt="Прогноша" onerror="this.outerHTML=window.__foxFallback||''">`;
}

let cssInjected = false;
function injectCss() {
  if (cssInjected) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

export function initAssistant(data) {
  injectCss();
  ctxData = data;
  if (document.getElementById('prognosha-fab')) { renderBrief(); return; }
  // ?fox=stern — принудительно показать эмоцию (для проверки картинок).
  const forced = new URLSearchParams(location.search).get('fox');
  const emo = forced || pickFoxEmotion(data);

  const fab = document.createElement('button');
  fab.id = 'prognosha-fab';
  fab.className = 'prognosha-fab';
  fab.dataset.emo = emo;
  fab.innerHTML = `<span class="p-fox">${foxHTML(emo)}</span><span class="dot"></span>`;
  fab.title = 'Прогноша · твой ассистент';
  fab.onclick = () => toggleSheet();
  document.body.appendChild(fab);

  const sheet = document.createElement('div');
  sheet.id = 'prognosha-sheet';
  sheet.className = 'prognosha-sheet';
  sheet.innerHTML = `
    <div class="p-head">
      <div class="p-face">${foxHTML(emo)}</div>
      <div style="flex:1">
        <div class="p-title">Прогноша</div>
        <div class="p-sub">твой ассистент по продажам</div>
      </div>
      <button class="p-close" onclick="window.__pClose()">✕</button>
    </div>
    <div class="p-body" id="p-body"></div>
    <div class="p-foot">
      <input class="p-input" id="p-input" placeholder="Спроси Прогношу…" onkeydown="if(event.key==='Enter')window.__pSend()">
      <button class="p-send" id="p-send" onclick="window.__pSend()">↑</button>
    </div>
  `;
  document.body.appendChild(sheet);

  renderBrief();
}

function toggleSheet(open) {
  const sheet = document.getElementById('prognosha-sheet');
  const shouldOpen = open != null ? open : !opened;
  opened = shouldOpen;
  sheet.classList.toggle('on', shouldOpen);
  if (shouldOpen) setTimeout(() => document.getElementById('p-input').focus(), 300);
}
window.__pClose = () => toggleSheet(false);

function renderBrief() {
  const d = ctxData;
  if (!d) return;
  const ir = (d.ir_v2 && d.ir_v2.week && d.ir_v2.week.ir_total) || 0;
  const fc = d.forecast || {};
  const cm = fc.current_month || {};
  const factRev = cm.fact_revenue || 0;
  const forecastRev = cm.forecast_revenue || 0;
  const tasksCounts = (d.tasks && d.tasks.counts) || {};

  // Бриф-шаблон (без LLM). Собирается из данных.
  let title = '';
  let body = '';
  if (ir >= 70 && (tasksCounts.expired || 0) === 0) {
    title = 'Отличный темп!';
    body = `ИР недели <em>${ir}%</em>. Просроченных задач нет. Продолжай в том же духе — до конца месяца по прогнозу заработаешь <b>${fmt(cm.revenue_total || (factRev+forecastRev))} ₽</b> вала.`;
  } else if ((tasksCounts.expired || 0) > 0) {
    title = 'Есть просрочки';
    body = `У тебя <b>${tasksCounts.expired}</b> просроченных задач. Разбери их сначала — это быстро закроет пробелы. ИР недели <em>${ir}%</em>.`;
  } else if (ir < 50) {
    title = 'Нужно поднажать';
    body = `ИР недели <em>${ir}%</em> — ниже нормы. Посмотри вкладку «Тренер» — там подсказки где именно проседает воронка.`;
  } else {
    title = 'Идёшь ровно';
    body = `ИР <em>${ir}%</em>. Сегодня задач на день: <b>${tasksCounts.today || 0}</b>, на неделю: <b>${tasksCounts.week || 0}</b>. Открой «Задачи» — начни с самой срочной.`;
  }

  const html = `
    <div class="p-brief">
      <div class="p-brief-h">☀️ ${title}</div>
      ${body}
    </div>
    <div class="p-suggests">
      <button class="p-suggest" onclick="window.__pAsk('Что сделать сегодня?')">📋 Что сделать сегодня?</button>
      <button class="p-suggest" onclick="window.__pAsk('Почему ИР такой?')">🎓 Почему ИР такой?</button>
      <button class="p-suggest" onclick="window.__pAsk('Про доход и вал')">💰 Про доход и вал</button>
      <button class="p-suggest" onclick="window.__pAsk('Как поднять доход?')">🎯 Как поднять доход?</button>
    </div>`;
  document.getElementById('p-body').innerHTML = html;
}

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n/1e6).toFixed(1).replace('.',',') + ' млн';
  if (n >= 1e3) return Math.round(n/1e3) + 'к';
  return String(Math.round(n));
}
function esc(s) { return String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function addMsg(role, html) {
  const body = document.getElementById('p-body');
  const wrap = document.createElement('div');
  wrap.className = 'p-msg ' + role;
  wrap.innerHTML = `<div class="p-bubble">${html}</div>`;
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}

let _askFn = null;
function callPrognosha(question) {
  if (!_askFn) _askFn = httpsCallable(getFunctions(getApp(), 'europe-west1'), 'askPrognosha', { timeout: 45000 });
  return _askFn({ question }).then((r) => r.data);
}
function fmtAnswer(t) { return esc(t).replace(/\n/g, '<br>'); }
function showTyping() {
  const body = document.getElementById('p-body');
  const w = document.createElement('div');
  w.className = 'p-msg bot';
  w.innerHTML = `<div class="p-bubble" style="color:var(--muted)">Прогноша печатает…</div>`;
  body.appendChild(w);
  body.scrollTop = body.scrollHeight;
  return w;
}

// Вопрос → бэкенд askPrognosha (YandexGPT). Если ИИ недоступен — откат на шаблон.
window.__pAsk = async (q) => {
  addMsg('user', esc(q));
  const typing = showTyping();
  try {
    const res = await callPrognosha(q);
    typing.remove();
    addMsg('bot', res && res.answer ? fmtAnswer(res.answer) : generateAnswer(q));
  } catch (e) {
    typing.remove();
    addMsg('bot', generateAnswer(q));
    console.warn('[prognosha] ИИ недоступен, показал шаблон:', e && e.message);
  }
};

window.__pSend = () => {
  const input = document.getElementById('p-input');
  const q = (input.value || '').trim();
  if (!q) return;
  input.value = '';
  window.__pAsk(q);
};

/**
 * Шаблонная генерация ответов — откат, если ИИ недоступен.
 * По ключевым словам вопроса → выбираем шаблон и подставляем данные пользователя.
 * НЕ ПРИДУМЫВАЕМ ЧИСЛА — если нет данных, честно говорим.
 */
function generateAnswer(q) {
  const d = ctxData;
  if (!d) return 'Данных пока нет — попробуй перезагрузить кабинет.';
  const ql = q.toLowerCase();
  const u = d.user || {};
  const ir = (d.ir_v2 && d.ir_v2.week);
  const fc = d.forecast || {};
  const cm = fc.current_month || {};
  const goal = d.goal || {};
  const tasks = d.tasks || {};
  const counts = tasks.counts || {};

  // Что сделать сегодня
  if (/сегодня|день|срочн|задач/.test(ql)) {
    const todayCount = counts.today || 0;
    const expiredCount = counts.expired || 0;
    if (expiredCount > 0) {
      return `Сначала разбери <b>${expiredCount}</b> просроченных — там уже пропущенные дедлайны. Потом ${todayCount} задач на сегодня. Открой вкладку <b>«Задачи»</b>, фильтр «⚠ Просрочено».`;
    }
    if (todayCount > 0) {
      return `На сегодня <b>${todayCount}</b> задач. Открой вкладку <b>«Задачи»</b> — там список с приоритетами.`;
    }
    return `На сегодня задач нет. Может, есть время подтянуть слабое место? Посмотри вкладку <b>«Тренер»</b>.`;
  }

  // ИР
  if (/ир|индекс|развит/.test(ql)) {
    if (!ir) return 'Индекс развития ещё не рассчитан на этой неделе.';
    const b = ir.breakdown || {};
    const c1 = (b.c1 && b.c1.total) ?? 0;
    const c2 = (b.c2 && b.c2.total) ?? 0;
    const c3 = (b.c3 && b.c3.total) ?? 0;
    const c4 = (b.c4 && b.c4.total) ?? 0;
    const parts = [
      { name: 'поток', v: c1 },
      { name: 'горячие', v: c2 },
      { name: 'задатки', v: c3 },
      { name: 'вал', v: c4 },
    ];
    const weakest = parts.sort((a, b) => a.v - b.v)[0];
    return `Твой ИР недели — <em>${ir.ir_total}%</em>. Он состоит из 4 частей поровну: поток <b>${c1}%</b> · горячие <b>${c2}%</b> · задатки <b>${c3}%</b> · вал <b>${c4}%</b>.<br><br>Самое слабое — <b>${weakest.name}</b> (${weakest.v}%). Открой вкладку <b>«Тренер»</b> — там подсказки как поднять именно это.`;
  }

  // Доход и вал
  if (/доход|вал|деньг|зп|заработ/.test(ql)) {
    const factRev = cm.fact_revenue || 0;
    const forecastRev = cm.forecast_revenue || 0;
    const totalRev = cm.revenue_total || (factRev + forecastRev);
    const income = cm.fact_income || 0;
    return `<b>Вал</b> — это оборот твоих сделок (комиссия агентства). По нему считаются план и ИР.<br><br><b>Доход</b> — твоя ЗП. Это ≈ <em>48%</em> от вала.<br><br>За текущий месяц: вал факт <b>${fmt(factRev)} ₽</b>${forecastRev > 0 ? `, прогноз-остаток <b>+${fmt(forecastRev)}</b> → итого <b>${fmt(totalRev)} ₽</b>` : ''}. Доход факт: <b>${fmt(income)} ₽</b>.`;
  }

  // Как поднять доход / что делать
  if (/поднять|подним|улучш|как расти|что делать|расти/.test(ql)) {
    if (!ir) return 'Смотри вкладку «Прогноз» — там график цикла и путь к цели. Дальше «Тренер» — конкретные слабые места.';
    const b = ir.breakdown || {};
    const parts = [
      { name: 'потока (входящих клиентов)', v: (b.c1 && b.c1.total) ?? 0, action: 'Проверь, что все лиды принимаются в течение часа. Триггер «холодный клиент» разбирай тем же днём.' },
      { name: 'горячих клиентов', v: (b.c2 && b.c2.total) ?? 0, action: 'Из тёплых клиентов должны появляться горячие. Смотри касания раз в 3 дня минимум.' },
      { name: 'задатков', v: (b.c3 && b.c3.total) ?? 0, action: 'Готовь клиента к внесению задатка заранее — показывай ЖК, обсуждай ипотеку, снимай страхи.' },
      { name: 'вала (закрытых сделок)', v: (b.c4 && b.c4.total) ?? 0, action: 'Задатки должны доходить до сделки. Проверь, что нет клиентов зависших на этапе задатка > 1 мес.' },
    ];
    const weakest = parts.sort((a, b) => a.v - b.v)[0];
    return `Самое слабое место — <b>${weakest.name}</b> (${weakest.v}%). <br><br>${weakest.action}<br><br>Подробнее — во вкладке <b>«Тренер»</b>, там разбор по каждому этапу.`;
  }

  // Цель
  if (/цель|target|план/.test(ql)) {
    if (!goal || !goal.target_revenue_month) return 'Цель пока не установлена. Открой вкладку «Прогноз» — там можно поставить.';
    const inc = u.income_month || 0;
    const tgt = goal.target_revenue_month || 0;
    const pct = tgt > 0 ? Math.round(inc/tgt*100) : 0;
    return `Твоя текущая цель по доходу — <b>${fmt(tgt)} ₽</b> в месяц. Средний за 12 мес: <em>${fmt(inc)} ₽</em> (${pct}% цели).<br><br>${pct >= 90 ? 'Отлично идёшь!' : pct >= 60 ? 'Держишь темп. Ещё чуть-чуть.' : 'Нужно подтянуть — открой «Прогноз» → «Как я иду к цели», там видно куда движешься.'}`;
  }

  // Дефолт
  return `Я пока только учусь отвечать. Могу рассказать про <b>ИР</b>, <b>доход и вал</b>, <b>задачи</b>, <b>цель</b>.<br><br>А пока попробуй одну из подсказок выше.`;
}
