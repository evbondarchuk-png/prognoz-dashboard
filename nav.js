/**
 * nav.js — навигационный слой для всех кабинетов.
 * Breadcrumbs в лого + глобальный поиск.
 * Данные: CTX (role, me, target, data).
 */

import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';

let injected = false;
let navCtx = null;
let searchOpen = false;
let searchTimer = null;

const LEVEL_LABEL = { realtor:'Партнёр', mop:'Группа', rop:'Отдел', aup:'Компания', admin:'Компания' };

const CSS = `
/* --- Breadcrumbs (внутри .logo) --- */
.nav-crumbs{display:inline;align-items:center;gap:4px;font-size:var(--fs-12);font-weight:var(--fw-m);color:var(--muted)}
.nav-crumbs a{color:var(--brand);text-decoration:none;cursor:pointer}
.nav-crumbs a:hover{text-decoration:underline}
.nav-sep{color:var(--muted-2);margin:0 2px;font-weight:var(--fw-r)}
.nav-current{color:var(--ink);font-weight:var(--fw-sb)}

/* --- Поиск (в .app-header-right) --- */
.nav-tools{display:flex;align-items:center;gap:6px}
.nav-search-trigger{position:relative}
.nav-search-btn{font-size:var(--fs-12);color:var(--muted);background:transparent;padding:5px 8px;border-radius:20px;border:1px solid var(--line);cursor:pointer;font-family:inherit}
.nav-search-box{
  position:absolute;top:calc(100% + 6px);right:0;
  width:280px;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--r-lg);box-shadow:0 8px 30px rgba(20,30,55,.12);
  opacity:0;transform:translateY(-6px);pointer-events:none;
  transition:opacity .15s ease,transform .15s ease;z-index:200;
  padding:8px;
}
.nav-search-box.on{opacity:1;transform:translateY(0);pointer-events:auto}
.nav-search-input{
  width:100%;padding:6px 10px;border:1px solid var(--line);
  border-radius:var(--r-sm);font-size:var(--fs-12);font-family:inherit;
  outline:none;box-sizing:border-box;
}
.nav-search-input:focus{border-color:var(--brand)}
.nav-search-results{max-height:240px;overflow-y:auto;margin-top:4px}
.nav-search-empty{padding:8px;font-size:var(--fs-12);color:var(--muted);text-align:center}
.nav-search-item{
  display:flex;align-items:center;gap:8px;
  padding:6px 8px;cursor:pointer;border-radius:var(--r-xs);
  font-size:var(--fs-12);text-decoration:none;color:var(--ink);
}
.nav-search-item:hover{background:var(--surface-2)}

/* --- Бургер (мобильное меню хедера) --- */
.nav-burger{display:none;font-size:var(--fs-13);color:var(--muted);background:transparent;padding:6px 10px;border-radius:20px;border:1px solid var(--line);cursor:pointer;font-family:inherit;line-height:1}
.nav-burger-menu{
  display:none;position:absolute;top:100%;left:0;right:0;
  flex-direction:column;align-items:stretch;gap:8px;
  background:var(--surface);border-bottom:1px solid var(--line);
  padding:12px 16px;box-shadow:0 8px 30px rgba(20,30,55,.12);z-index:200;
}
.nav-burger-menu.on{display:flex}
.nav-burger-menu .btn,.nav-burger-menu .nav-search-btn{width:100%;justify-content:flex-start}

@media(max-width:560px){
  /* Бургер видим */
  .nav-burger{display:inline-flex;align-items:center}
  /* Хедер — многострочный: breadcrumbs переносятся, правая группа — второй строкой */
  .app-header{height:auto;min-height:56px;flex-wrap:wrap;padding:8px 12px;gap:6px;align-items:center}
  .logo{flex:1 1 100%;min-width:0}
  .app-header-right{flex:1 1 100%;justify-content:space-between;gap:8px}
  /* Breadcrumbs — перенос строк (не многоточие) */
  .nav-crumbs{white-space:normal;max-width:none}
  /* Порядок в хедере на мобильном: Дата, Назад, Прогноша(aup), бургер ☰ */
  .app-header-right .date-badge{order:0}
  .app-header-right #backBtn{order:1}
  .app-header-right #prognozaBtn{order:2}
  .app-header-right #navBurger{order:3}
  /* Табы — не прилипают (высота хедера варьируется) */
  .rtab-bar{position:static}
}

@media(max-width:480px){
  .nav-crumbs{font-size:11px}
  .nav-search-box{right:-12px;width:min(240px,calc(100vw - 32px))}
}
`;

function injectCss(){
  if(injected) return;
  const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  injected=true;
}

/* --- Breadcrumbs --- */

/**
 * Строим полную цепочку иерархии.
 * rop_code/mop_code берём из ctx.data.user, имена — из rop_name/mop_name
 * или дочитываем из Firebase если их нет.
 *
 * Цепочка по уровням target.role:
 *   realtor: Компания > РОП > МОП > Партнёр  (если rop_code и mop_code есть)
 *   mop:     Компания > РОП > МОП             (если rop_code есть)
 *   rop:     Компания > РОП                    (нет rop_code/mop_code)
 *   aup:     Компания > АУП                    (нет rop_code/mop_code)
 */
async function resolveChain(ctx){
  const db=getDatabase(getApp());
  const LEVEL={
    aup :{label:'Компания',file:'aup.html',param:'aup'},
    rop :{label:'РОП',      file:'rop.html', param:'rop'},
    mop :{label:'МОП',      file:'mop.html', param:'mop'},
    realtor:{label:'Партнёр',file:'index.html',param:'agent'},
  };

  const target=ctx.data?.user;
  if(!target) return [];

  const targetCode=String(ctx.target);
  const ropCode=target.rop_code?String(target.rop_code):null;
  const mopCode=target.mop_code?String(target.mop_code):null;

  // Определяем имена: сначала из ctx.data.user, иначе — чтение из Firebase
  let ropName=target.rop_name||null;
  let mopName=target.mop_name||null;

  const needRop=ropCode&&ropCode!==targetCode&&!ropName;
  const needMop=mopCode&&mopCode!==targetCode&&!mopName;

  if(needRop||needMop){
    try{
      const pRop=needRop?get(ref(db,'users/'+ropCode)):Promise.resolve(null);
      const pMop=needMop?get(ref(db,'users/'+mopCode)):Promise.resolve(null);
      const [ropSnap,mopSnap]=await Promise.all([pRop,pMop]);
      if(needRop&&ropSnap&&ropSnap.exists()) ropName=ropSnap.val().name||null;
      if(needMop&&mopSnap&&mopSnap.exists()) mopName=mopSnap.val().name||null;
    }catch(e){console.warn('[nav] resolveChain: Firebase ошибка',e);}
  }

  const chain=[];
  if(ropCode&&ropCode!==targetCode&&ropName&&ropName!==target.name){
    chain.push({...LEVEL.rop,name:shorten(ropName),code:ropCode});
  }
  if(mopCode&&mopCode!==targetCode&&mopName&&mopName!==target.name){
    chain.push({...LEVEL.mop,name:shorten(mopName),code:mopCode});
  }
  chain.push({
    ...LEVEL[target.role]||LEVEL.realtor,
    name:shorten(target.name),
    code:targetCode,
  });

  return chain;
}

/**
 * Строим HTML breadcrumbs из контекста и (опционально) цепочки.
 * Если chain передан — используем его, иначе fallback на старую логику.
 */
function buildBreadcrumbs(ctx,chain){
  if(!ctx) return '';
  const level=LEVEL_LABEL[ctx.role]||'Кабинет';
  const viewingSelf=!ctx.target||String(ctx.me)===String(ctx.target);
  if(viewingSelf){
    return `<span class="nav-current">${level}</span>`;
  }
  const home={realtor:'index.html',mop:'mop.html',rop:'rop.html',aup:'aup.html',admin:'aup.html'};
  const myHome=home[ctx.role]||'index.html';
  const crumbs=[`<a href="${myHome}">${level}</a>`];

  if(chain&&chain.length){
    chain.forEach((item,i)=>{
      const isLast=i===chain.length-1;
      const href=`${item.file}?${item.param}=${encodeURIComponent(item.code)}`;
      const label=item.name?`${item.label} ${esc(item.name)}`:item.label;
      if(isLast){
        crumbs.push(`<a href="${href}" class="nav-current">${label}</a>`);
      }else{
        crumbs.push(`<a href="${href}">${label}</a>`);
      }
    });
  }else{
    // Fallback — старая логика (если resolveChain не сработал)
    const viewedUser=ctx.data?.user;
    const viewedName=shorten(viewedUser?.name||'');
    const params=new URLSearchParams(location.search);
    if(ctx.role==='aup'){
      if(params.has('rop')) crumbs.push(`<a href="rop.html?rop=${params.get('rop')}">РОП ${esc(viewedName)}</a>`);
      else if(params.has('mop')) crumbs.push(`<a href="mop.html?mop=${params.get('mop')}">МОП ${esc(viewedName)}</a>`);
      else if(params.has('agent')) crumbs.push(`<span class="nav-current">${esc(viewedName)}</span>`);
    }else if(ctx.role==='rop'){
      if(params.has('mop')) crumbs.push(`<a href="mop.html?mop=${params.get('mop')}">МОП ${esc(viewedName)}</a>`);
      else if(params.has('agent')) crumbs.push(`<span class="nav-current">${esc(viewedName)}</span>`);
    }else if(ctx.role==='mop'){
      if(params.has('agent')) crumbs.push(`<span class="nav-current">${esc(viewedName)}</span>`);
    }
  }
  return crumbs.join('<span class="nav-sep">›</span>');
}

/**
 * Async-обёртка: резолвим цепочку, потом обновляем DOM.
 * Вызывается из initNav() после render().
 */
async function renderBreadcrumbsAsync(ctx){
  if(!ctx) return;
  const viewingSelf=!ctx.target||String(ctx.me)===String(ctx.target);
  let chain=null;
  if(!viewingSelf&&ctx.target){
    try{
      chain=await resolveChain(ctx);
    }catch(e){console.error('[nav] renderBreadcrumbsAsync: resolveChain failed',e);}
  }
  const crumbsSpan=document.querySelector('.logo .nav-crumbs');
  if(crumbsSpan){
    crumbsSpan.innerHTML=buildBreadcrumbs(ctx,chain);
  }
}

/* --- Поиск --- */
function buildSearch(ctx){
  if(!ctx||ctx.role==='realtor') return '';
  return `<div class="nav-search-trigger">
    <button class="nav-search-btn" onclick="window.__navSearchToggle()" >🔍 Найти сотрудника</button>
    <div class="nav-search-box" id="navSearchBox">
      <input class="nav-search-input" id="navSearchInput" placeholder="Имя или код..." autocomplete="off">
      <div class="nav-search-results" id="navSearchResults"></div>
    </div>
  </div>`;
}

/* --- Рендер --- */
function render(ctx){
  // Breadcrumbs — в .logo
  const logo=document.querySelector('.logo');
  if(logo){
    const existing=logo.querySelector('.nav-crumbs');
    if(existing) existing.remove();
    const sep=logo.querySelector('.nav-sep');
    if(sep) sep.remove();
    const innerSpan=logo.querySelector('span');
    if(innerSpan&&!innerSpan.classList.contains('nav-sep')&&!innerSpan.classList.contains('nav-crumbs')){
      innerSpan.style.display='none';
    }
    const crumbsDiv=document.createElement('span');
    crumbsDiv.className='nav-sep';
    crumbsDiv.textContent='·';
    logo.appendChild(crumbsDiv);
    const crumbsSpan=document.createElement('span');
    crumbsSpan.className='nav-crumbs';
    crumbsSpan.innerHTML=buildBreadcrumbs(ctx);
    logo.appendChild(crumbsSpan);
  }
  // Инструменты — в .app-header-right (перед кнопкой выхода)
  const headerRight=document.querySelector('.app-header-right');
  if(headerRight&&!document.getElementById('navTools')){
    const toolsDiv=document.createElement('div');
    toolsDiv.id='navTools';
    toolsDiv.className='nav-tools';
    toolsDiv.innerHTML=buildSearch(ctx);
    const logoutBtn=document.getElementById('logoutBtn');
    if(logoutBtn){
      headerRight.insertBefore(toolsDiv,logoutBtn);
      // «← Назад» — между «Найти сотрудника» и «Выход» (только расположение,
      // логику history.back() не трогаем). В aup.html backBtn нет — пропуск.
      const backBtn=document.getElementById('backBtn');
      if(backBtn) headerRight.insertBefore(backBtn,logoutBtn);
    } else {
      headerRight.appendChild(toolsDiv);
    }
    // Бургер для мобильного меню (виден на ≤560px). Добавляем последним в .app-header-right.
    if(!document.getElementById('navBurger')){
      const burger=document.createElement('button');
      burger.id='navBurger';
      burger.className='nav-burger';
      burger.type='button';
      burger.textContent='☰';
      burger.setAttribute('aria-label','Меню');
      burger.addEventListener('click',()=>window.__navBurgerToggle&&window.__navBurgerToggle());
      headerRight.appendChild(burger);
    }
  }
  // Выпадающее бургер-меню (внутри .app-header — top:100% считается от хедера).
  // Бургерные кнопки (Подключения, Найти, Выход, Прогноша) переезжают сюда на мобильном.
  const appHeader=document.querySelector('.app-header');
  if(appHeader&&!document.getElementById('navBurgerMenu')){
    const menu=document.createElement('div');
    menu.id='navBurgerMenu';
    menu.className='nav-burger-menu';
    appHeader.appendChild(menu);
  }
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

/** Сокращаем ФИО до «Фамилия И.О.» — только для breadcrumbs */
function shorten(name){
  if(!name) return '';
  const p=name.trim().split(/\s+/);
  if(p.length<=1) return name;
  return p[0]+' '+p.slice(1).map(w=>w[0]+'.').join('');
}

/* --- Публичный API --- */
export function initNav(ctx){
  injectCss();
  navCtx=ctx;
  render(ctx);
  renderBreadcrumbsAsync(ctx); // асинхронно подтягиваем полную цепочку
  layoutBurger(); // на мобильном — переложить бургерные кнопки в #navBurgerMenu
  // Обработчики для поиска
  const input=document.getElementById('navSearchInput');
  if(input){
    input.addEventListener('input',()=>{
      clearTimeout(searchTimer);
      const q=input.value.trim();
      if(q.length<2){
        document.getElementById('navSearchResults').innerHTML='';
        return;
      }
      searchTimer=setTimeout(()=>doSearch(q),300);
    });
  }
}

/* --- Поиск по сотрудникам --- */
async function doSearch(q){
  const resultsEl=document.getElementById('navSearchResults');
  if(!resultsEl) return;
  resultsEl.innerHTML='<div class="nav-search-empty">Ищу…</div>';

  const qq=String(q||'').trim();
  if(qq.length<2){resultsEl.innerHTML='';return;}
  const qLow=qq.toLowerCase();

  // Источник — onCall searchUsers (бэкенд ищет по всем доступным по иерархии,
  // регистронезависимо, посимвольно). При ошибке — fallback на team_cards (прямые подчинённые).
  let results=[];
  try{
    const fn=httpsCallable(getFunctions(getApp(),'europe-west1'),'searchUsers',{timeout:30000});
    const res=await fn({q:qq});
    results=((res.data&&res.data.results)||[]).map(r=>({code:r.code,name:r.name||'',role:r.role||''}));
  }catch(e){
    const members=navCtx?.data?.team_cards?.members||[];
    members.forEach(m=>{
      if(m.is_self) return;
      const name=(m.short_name||m.name||'').toLowerCase();
      if(name.includes(qLow)||String(m.code||'').includes(qLow)){
        results.push({code:m.code,name:m.short_name||m.name||'',role:m.role||''});
      }
    });
    if(!results.length){
      resultsEl.innerHTML='<div class="nav-search-empty">Поиск недоступен, попробуйте позже</div>';
      return;
    }
  }

  if(!results.length){
    resultsEl.innerHTML='<div class="nav-search-empty">Ничего не найдено</div>';
    return;
  }

  // Маппинг по РОЛИ НАЙДЕННОГО → его собственный кабинет:
  // realtor→index?agent, mop→mop?mop, rop→rop?rop, aup/admin→aup.html
  // (раньше было криво: mop→index?agent, rop→mop?mop, aup→rop?rop — открывалось в чужом ЛК)
  // Если роль неизвестна (fallback team_cards) — ссылка по роли смотрящего.
  const byRoleFile={realtor:'index.html',mop:'mop.html',rop:'rop.html',aup:'aup.html',admin:'aup.html'};
  const byRoleParam={realtor:'agent',mop:'mop',rop:'rop',aup:'aup',admin:'aup'};
  const fallbackParam={mop:'agent',rop:'mop',aup:'rop',admin:'rop'}[navCtx?.role]||'agent';
  const fallbackFile={mop:'index.html',rop:'mop.html',aup:'rop.html',admin:'rop.html'}[navCtx?.role]||'index.html';
  const roleLabel={realtor:'Партнёр',mop:'МОП',rop:'РОП',aup:'АУП',admin:'АУП'};

  resultsEl.innerHTML=results.slice(0,10).map(r=>{
    const hasRole=r.role&&byRoleFile[r.role];
    const file=hasRole?byRoleFile[r.role]:fallbackFile;
    const param=hasRole?byRoleParam[r.role]:fallbackParam;
    const href=`${file}?${param}=${encodeURIComponent(r.code)}`;
    const lbl=roleLabel[r.role]||'';
    return `<a class="nav-search-item" href="${href}">
      <span>${esc(r.name||'')}</span>
      ${lbl?`<span style="color:var(--muted);font-size:10px">${lbl} ${esc(String(r.code))}</span>`:''}
    </a>`;
  }).join('');
}

/* --- Обработчики --- */
window.__navSearchToggle=()=>{
  const box=document.getElementById('navSearchBox');
  if(!box) return;
  searchOpen=!searchOpen;
  box.classList.toggle('on',searchOpen);
  if(searchOpen){
    setTimeout(()=>{const inp=document.getElementById('navSearchInput');if(inp)inp.focus();},100);
  }
};

// Бургерные элементы хедера: Подключения, Найти сотрудника, Прогноша (только aup), Выход.
// На мобильном (≤560px) переезжают в #navBurgerMenu; на десктопе остаются в .app-header-right.
// При перемещении сохраняем исходные позиции (nextSibling) — возврат восстанавливает desktop-порядок.
let burgerSaved=[];
function getBurgerEls(){
  const els=[];
  const integTrigger=document.querySelector('.app-header-right .integ-trigger');
  if(integTrigger) els.push(integTrigger.parentElement); // обёртка Подключений (display:contents)
  const navTools=document.getElementById('navTools');
  if(navTools) els.push(navTools);
  // Прогноша (только aup) остаётся ВНЕ бургера — в хедере между «Назад» и ☰.
  const logout=document.getElementById('logoutBtn');
  if(logout) els.push(logout);
  return els;
}
function layoutBurger(){
  const menu=document.getElementById('navBurgerMenu');
  if(!menu) return;
  const mobile=window.matchMedia('(max-width:560px)').matches;
  const hr=document.querySelector('.app-header-right');
  if(mobile){
    if(!burgerSaved.length){
      getBurgerEls().forEach(el=>{ if(el) burgerSaved.push({el,next:el.nextSibling}); });
    }
    burgerSaved.forEach(({el})=>{ if(el.parentElement!==menu) menu.appendChild(el); });
  }else{
    if(hr){
      burgerSaved.forEach(({el,next})=>{ if(el.parentElement!==hr||el.nextSibling!==next) hr.insertBefore(el,next); });
    }
    burgerSaved=[];
    menu.classList.remove('on');
  }
}
// Бургер: открыть/закрыть мобильное меню хедера (≤560px)
window.__navBurgerToggle=()=>{
  const menu=document.getElementById('navBurgerMenu');
  if(!menu) return;
  if(!menu.classList.contains('on')) layoutBurger(); // элементы уже в меню
  menu.classList.toggle('on');
};

// Закрытие при клике вне
document.addEventListener('click',e=>{
  if(searchOpen&&!e.target.closest('.nav-search-trigger')){
    searchOpen=false;
    const b=document.getElementById('navSearchBox');
    if(b) b.classList.remove('on');
  }
  // Закрыть бургер-меню при клике вне хедера
  const menu=document.getElementById('navBurgerMenu');
  if(menu&&menu.classList.contains('on')&&!e.target.closest('.app-header')){
    menu.classList.remove('on');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(searchOpen){searchOpen=false;const b=document.getElementById('navSearchBox');if(b)b.classList.remove('on');}
    const menu=document.getElementById('navBurgerMenu');
    if(menu&&menu.classList.contains('on')) menu.classList.remove('on');
  }
});

// При переходе через брейкпоинт 560px — переложить элементы и закрыть меню
let _resizeT=null;
window.addEventListener('resize',()=>{
  if(_resizeT) clearTimeout(_resizeT);
  _resizeT=setTimeout(layoutBurger,120);
});
