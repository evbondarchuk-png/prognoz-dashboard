/**
 * connect.js — компактный блок «Подключения» в шапке кабинета.
 * Один триггер-попап: Google Calendar (OAuth) + MAX бот (ссылка).
 * Статус привязки ВСЕГДА проверяется по авторизованному пользователю (auth.uid),
 * а не по просматриваемому кабинету.
 */

import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';

let injected = false;
let popOpen = false;
let integData = {};
let authCode = null;
let onChangeCb = null; // колбэк при обновлении данных (для синхронизации с панелью в табе)

const CSS = `
/* --- Подключения: триггер-кнопка в шапке --- */
.integ-trigger{position:relative;display:inline-flex;align-items:center;gap:5px}
.integ-dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--warn);flex-shrink:0;
  transition:background .3s;
}
/* --- Попап --- */
.integ-pop{
  position:absolute;top:calc(100% + 8px);right:0;
  width:310px;z-index:200;
  background:var(--surface);border:1px solid var(--line);
  border-radius:var(--r-lg);box-shadow:0 8px 30px rgba(20,30,55,.12);
  opacity:0;transform:translateY(-6px);
  pointer-events:none;overflow:hidden;
  transition:opacity .18s ease, transform .18s ease;
}
.integ-pop.on{opacity:1;transform:translateY(0);pointer-events:auto}
.integ-pop-h{
  padding:10px 14px;font-size:11px;font-weight:800;
  text-transform:uppercase;letter-spacing:.05em;
  color:var(--muted);border-bottom:1px solid var(--line);
}
.integ-row{
  display:flex;align-items:center;gap:10px;
  padding:10px 14px;
  border-bottom:1px solid var(--line);
}
.integ-row:last-child{border-bottom:none}
.integ-icon{
  width:34px;height:34px;border-radius:var(--r-sm);
  display:flex;align-items:center;justify-content:center;
  font-size:17px;flex-shrink:0;
}
.integ-icon.gcal{background:#e8f5e9;color:#2e7d32}
.integ-icon.max{background:#ede7f6;color:#5e35b1}
.integ-info{flex:1;min-width:0}
.integ-name{font-size:13px;font-weight:700;color:var(--ink)}
.integ-status{font-size:11px;margin-top:2px}
.integ-status.ok{color:var(--ok)}
.integ-status.off{color:var(--muted)}
.integ-act{
  padding:5px 12px;border-radius:999px;border:none;
  font-size:11px;font-weight:700;font-family:inherit;
  cursor:pointer;transition:background .15s;
  white-space:nowrap;
}
.integ-act.primary{background:var(--brand);color:#fff}
.integ-act.primary:hover{background:var(--brand-hover)}
.integ-act.ghost{background:var(--surface-2);color:var(--ink-soft);border:1px solid var(--line)}
.integ-act.ghost:hover{background:var(--surface-3)}
@media(max-width:480px){
  .integ-pop{left:0;right:auto;width:min(310px,calc(100vw - 32px))}
}
`;

function injectCss(){
  if(injected) return;
  const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  injected=true;
}

/* --- Рендер попапа по текущему состоянию integData --- */
function renderPop(){
  const mb=integData.max_bot||{};
  const gc=integData.google_calendar||{};
  const maxUrl=mb.link_url||'https://max.ru/id450130862328_bot';
  const allOk=!!(mb.linked&&gc.linked);
  return `
  <button class="btn integ-trigger" onclick="window.__integToggle()" title="Подключения">
    🔗 <span class="integ-dot" id="integDot" style="background:var(--${allOk?'ok':'warn'})"></span> <span style="font-size:var(--fs-12)">Подключения</span>
  </button>
  <div class="integ-pop" id="integPop">
    <div class="integ-pop-h">Подключения</div>
    <div class="integ-row">
      <div class="integ-icon gcal">📅</div>
      <div class="integ-info">
        <div class="integ-name">Google Календарь</div>
        <div class="integ-status" id="integGcStatus" style="color:var(--${gc.linked?'ok':'muted'})">${gc.linked?'Подключён':'Не подключён'}</div>
      </div>
      <button class="integ-act ${gc.linked?'ghost':'primary'}" id="integGcBtn"
        onclick="${gc.linked?'window.__integOpenTasks()':'window.__integGCal()'}">
        ${gc.linked?'Открыть':'Подключить'}
      </button>
    </div>
    <div class="integ-row">
      <div class="integ-icon max">🤖</div>
      <div class="integ-info">
        <div class="integ-name">MAX Бот</div>
        <div class="integ-status" id="integMaxStatus" style="color:var(--${mb.linked?'ok':'muted'})">${mb.linked?'Подключён':'Не подключён'}</div>
      </div>
      <a class="integ-act ${mb.linked?'ghost':'primary'}" id="integMaxBtn"
         href="${esc(maxUrl)}" target="_blank" rel="noopener"
         style="text-decoration:none;display:inline-block">
        ${mb.linked?'Открыть':'Подключить'}
      </a>
    </div>
  </div>`;
}

/* --- Обновить только статусы и индикатор (без пересоздания DOM) --- */
function refreshUI(){
  const mb=integData.max_bot||{};
  const gc=integData.google_calendar||{};
  const maxUrl=mb.link_url||'https://max.ru/id450130862328_bot';
  const allOk=!!(mb.linked&&gc.linked);

  const dot=document.getElementById('integDot');
  if(dot) dot.style.background=allOk?'var(--ok)':'var(--warn)';

  const gcSt=document.getElementById('integGcStatus');
  if(gcSt){ gcSt.textContent=gc.linked?'Подключён':'Не подключён'; gcSt.style.color=gc.linked?'var(--ok)':'var(--muted)'; }
  const gcBtn=document.getElementById('integGcBtn');
  if(gcBtn){
    gcBtn.className='integ-act '+(gc.linked?'ghost':'primary');
    gcBtn.textContent=gc.linked?'Открыть':'Подключить';
    gcBtn.onclick=gc.linked?window.__integOpenTasks:window.__integGCal;
  }

  const maxSt=document.getElementById('integMaxStatus');
  if(maxSt){ maxSt.textContent=mb.linked?'Подключён':'Не подключён'; maxSt.style.color=mb.linked?'var(--ok)':'var(--muted)'; }
  const maxBtn=document.getElementById('integMaxBtn');
  if(maxBtn){
    maxBtn.className='integ-act '+(mb.linked?'ghost':'primary');
    maxBtn.textContent=mb.linked?'Открыть':'Подключить';
    maxBtn.href=maxUrl;
  }
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

/* --- Загрузить статус привязок для авторизованного пользователя --- */
async function fetchIntegrations(){
  if(!authCode) return;
  try{
    const fns=getFunctions(getApp(),'europe-west1');
    // Без view — getDashboard авто-резолвит по роли пользователя.
    // Бэкенд отдаёт integrations для ЛЮБОГО view (fix: убран isPartner-гейт).
    const r=await httpsCallable(fns,'getDashboard',{timeout:30000})({user_code:String(authCode)});
    const d=r.data||{};
    integData=d.integrations||{};
    refreshUI();
    if(onChangeCb) try{ onChangeCb(integData); }catch(e){}
  }catch(e){
    console.error('[connect] fetchIntegrations failed',e);
  }
}

/* --- Публичный API --- */
export function initConnect(authUserCode, initialData){
  injectCss();
  authCode=authUserCode;
  integData=(initialData&&initialData.max_bot!=null)?initialData:{};
  const headerRight=document.querySelector('.app-header-right');
  if(!headerRight||document.getElementById('integPop')) return;
  headerRight.style.position='relative';
  const wrap=document.createElement('div');
  wrap.style.display='contents';
  wrap.innerHTML=renderPop();
  headerRight.insertBefore(wrap,headerRight.firstChild);
  fetchIntegrations();
}

/* --- Обновить статус (вызвать после OAuth-колбэка / возврата на вкладку) --- */
export function refreshConnect(){
  fetchIntegrations();
}

/* --- Получить текущие данные интеграций авторизованного пользователя --- */
export function getIntegrations(){
  return integData;
}

/* --- Подписаться на обновление данных интеграций --- */
export function onIntegrationsChange(cb){
  onChangeCb=cb;
  // Если данные уже загружены — сразу вызываем
  if(integData&&(integData.max_bot||integData.google_calendar)) try{ cb(integData); }catch(e){}
}

/* --- Google Calendar OAuth --- */
async function connectGoogleCalendar(){
  const ok=confirm(
    'Сейчас откроется вход в Google.\n\n'+
    'Google может показать экран «Приложение не проверено» — это нормально.\n\n'+
    'Нажми внизу «Дополнительные настройки» → «Перейти на страницу…», потом разреши доступ.\n\n'+
    'Продолжить?'
  );
  if(!ok) return;
  try{
    const fns=getFunctions(getApp(),'europe-west1');
    const r=await httpsCallable(fns,'googleCalendarAuthStart')({});
    if(r.data?.url) window.open(r.data.url,'_blank','noopener');
  }catch(e){alert('Не удалось подключить: '+(e.message||e));}
}

/* --- Обработчики (глобальные для onclick) --- */
window.__integToggle=()=>{
  const pop=document.getElementById('integPop');
  if(!pop) return;
  popOpen=!popOpen;
  pop.classList.toggle('on',popOpen);
};
window.__integGCal=()=>connectGoogleCalendar();
window.__integOpenTasks=()=>{
  popOpen=false;
  const pop=document.getElementById('integPop');
  if(pop) pop.classList.remove('on');
  // Если уже в своём кабинете — просто переключаем таб.
  // Иначе — переходим на index.html (auth-guard автоматически направит
  // на mop/rop/aup по роли; в ?agent= укажем authCode для гарантии).
  if(typeof window.CTX==='object'&&String(window.CTX.me)===String(window.CTX.target)){
    if(typeof window.goTab==='function') window.goTab('tasks');
  } else {
    location.href='index.html?agent='+encodeURIComponent(authCode);
  }
};

/* --- Авто-обновление при возврате на вкладку (после OAuth в другой вкладке) --- */
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&authCode) fetchIntegrations();
});

/* --- Закрытие попапа --- */
document.addEventListener('click',e=>{
  if(!popOpen) return;
  const pop=document.getElementById('integPop');
  if(pop&&!pop.contains(e.target)&&!e.target.closest('.integ-trigger')){
    popOpen=false;pop.classList.remove('on');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&popOpen){
    popOpen=false;
    const pop=document.getElementById('integPop');
    if(pop) pop.classList.remove('on');
  }
});
