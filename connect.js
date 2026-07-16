/**
 * connect.js — компактный блок «Подключения» в шапке кабинета.
 * Один триггер-попап: Google Calendar (OAuth) + MAX бот (ссылка).
 * Данные: d.integrations из getDashboard.
 */

import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';

let injected = false;
let popOpen = false;
let integData = {};

const CSS = `
/* --- Подключения: триггер-кнопка в шапке --- */
.integ-trigger{position:relative}
.integ-dot{
  position:absolute;top:4px;right:4px;
  width:7px;height:7px;border-radius:50%;
  background:var(--warn);pointer-events:none;
  box-shadow:0 0 0 2px var(--surface);
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

function renderPop(){
  const mb=integData.max_bot||{};
  const gc=integData.google_calendar||{};
  const maxUrl=mb.link_url||'https://max.ru/id450130862328_bot';
  const allOk=mb.linked&&gc.linked;
  return `
  <button class="btn integ-trigger" onclick="window.__integToggle()" title="Подключения">
    🔗<span class="integ-dot" style="background:var(--${allOk?'ok':'warn'})"></span>
  </button>
  <div class="integ-pop" id="integPop">
    <div class="integ-pop-h">Подключения</div>
    <div class="integ-row">
      <div class="integ-icon gcal">📅</div>
      <div class="integ-info">
        <div class="integ-name">Google Календарь</div>
        <div class="integ-status ${gc.linked?'ok':'off'}">${gc.linked?'Подключён':'Не подключён'}</div>
      </div>
      <button class="integ-act ${gc.linked?'ghost':'primary'}" onclick="${gc.linked?'window.__integOpenTasks()':'window.__integGCal()'}">
        ${gc.linked?'Открыть':'Подключить'}
      </button>
    </div>
    <div class="integ-row">
      <div class="integ-icon max">🤖</div>
      <div class="integ-info">
        <div class="integ-name">MAX Бот</div>
        <div class="integ-status ${mb.linked?'ok':'off'}">${mb.linked?'Подключён':'Не подключён'}</div>
      </div>
      <a class="integ-act ${mb.linked?'ghost':'primary'}"
         href="${esc(maxUrl)}" target="_blank" rel="noopener"
         style="text-decoration:none;display:inline-block">
        ${mb.linked?'Открыть':'Подключить'}
      </a>
    </div>
  </div>`;
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

/* --- Публичный API --- */
export function initConnect(integ){
  injectCss();
  integData=integ||{};
  const headerRight=document.querySelector('.app-header-right');
  if(!headerRight||document.getElementById('integPop')) return;
  headerRight.style.position='relative';
  const wrap=document.createElement('div');
  wrap.style.display='contents';
  wrap.innerHTML=renderPop();
  headerRight.insertBefore(wrap,headerRight.firstChild);
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
  if(typeof window.goTab==='function') window.goTab('tasks');
};

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
