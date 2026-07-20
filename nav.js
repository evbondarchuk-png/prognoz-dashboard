/**
 * nav.js — навигационный слой для всех кабинетов.
 * Breadcrumbs в лого + глобальный поиск.
 * Данные: CTX (role, me, target, data).
 */

import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

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

@media(max-width:560px){
  /* Бургер видим, остальные правые кнопки скрыты (пока меню закрыто) */
  .nav-burger{display:inline-flex;align-items:center}
  .app-header-right > :not(#navBurger){display:none}
  /* Открытое меню — выпадайка full-width под хедером, кнопки в столбик */
  .app-header-right.nav-burger-open{
    position:absolute;top:var(--app-header-h,56px);left:0;right:0;
    flex-direction:column;align-items:stretch;gap:8px;
    background:var(--surface);border-bottom:1px solid var(--line);
    padding:12px 16px;box-shadow:0 8px 30px rgba(20,30,55,.12);z-index:200;
  }
  .app-header-right.nav-burger-open > :not(#navBurger){display:flex;width:100%;justify-content:flex-start}
  .app-header-right.nav-burger-open > #navBurger{display:none}
  /* Внутри открытого бургер-меню поиск — инпут во весь Width, без отдельного попапа */
  .app-header-right.nav-burger-open .nav-search-box{position:static;width:100%;right:auto;transform:none;opacity:1;pointer-events:auto;border:1px solid var(--line);box-shadow:none}
  .app-header-right.nav-burger-open .nav-search-btn{display:none}
  /* Breadcrumbs — усечение многоточием, не выталкивает кнопки */
  .nav-crumbs{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100vw - 140px);display:inline-block;vertical-align:middle}
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

  const qLow=q.toLowerCase().trim();
  if(!qLow){resultsEl.innerHTML='';return;}

  // Режим A: ищем по уже загруженным team_cards.members (мгновенно, 0 запросов)
  const members=navCtx?.data?.team_cards?.members||[];
  const results=[];
  members.forEach(m=>{
    if(m.is_self) return;
    const name=(m.short_name||m.name||'').toLowerCase();
    const code=String(m.code||'');
    if(name.includes(qLow)||code.includes(qLow)) results.push({code:m.code,name:m.short_name||m.name||''});
  });

  // Режим B: если введён числовой код — прямое чтение /users/{code}
  // (для АУП/admin найдёт любого; для МОП/РОП — только если в subordinates)
  if(/^\d+$/.test(q)){
    try{
      const db=getDatabase(getApp());
      const s=await get(ref(db,'users/'+q));
      if(s.exists()&&!results.find(r=>String(r.code)===q)){
        const u=s.val();
        results.push({code:q,name:u.name||'',role:u.role||''});
      }
    }catch(e){}
  }

  if(!results.length){
    resultsEl.innerHTML='<div class="nav-search-empty">Ничего не найдено</div>';
    return;
  }

  // Маппинг ссылок по РОЛИ НАЙДЕННОГО пользователя:
  // realtor/mop → index.html?agent=, rop → mop.html?mop=, aup → rop.html?rop=
  // Если роль неизвестна (team_cards) — fallback по роли смотрящего
  const byRoleFile={realtor:'index.html',mop:'index.html',rop:'mop.html',aup:'rop.html'};
  const byRoleParam={realtor:'agent',mop:'agent',rop:'mop',aup:'rop'};
  const fallbackParam={mop:'agent',rop:'mop',aup:'rop',admin:'rop'}[navCtx?.role]||'agent';
  const fallbackFile={mop:'index.html',rop:'mop.html',aup:'rop.html',admin:'rop.html'}[navCtx?.role]||'index.html';

  resultsEl.innerHTML=results.slice(0,10).map(r=>{
    const href=r.role
      ?`${byRoleFile[r.role]||'index.html'}?${byRoleParam[r.role]||'agent'}=${encodeURIComponent(r.code)}`
      :`${fallbackFile}?${fallbackParam}=${encodeURIComponent(r.code)}`;
    const roleLabel=r.role?({realtor:'Партнёр',mop:'МОП',rop:'РОП',aup:'АУП'}[r.role]||''):'';
    return `<a class="nav-search-item" href="${href}">
      <span>${esc(r.name||'')}</span>
      ${roleLabel?`<span style="color:var(--muted);font-size:10px">${roleLabel} ${esc(String(r.code))}</span>`:''}
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

// Бургер: открыть/закрыть мобильное меню хедера (≤560px)
window.__navBurgerToggle=()=>{
  const hr=document.querySelector('.app-header-right');
  if(!hr) return;
  hr.classList.toggle('nav-burger-open');
  if(hr.classList.contains('nav-burger-open')){
    const inp=document.getElementById('navSearchInput');
    if(inp) setTimeout(()=>inp.focus(),100);
  }
};

// Закрытие при клике вне
document.addEventListener('click',e=>{
  if(searchOpen&&!e.target.closest('.nav-search-trigger')){
    searchOpen=false;
    const b=document.getElementById('navSearchBox');
    if(b) b.classList.remove('on');
  }
  // Закрыть бургер при клике вне .app-header-right (и вне самого бургера)
  const hr=document.querySelector('.app-header-right');
  if(hr&&hr.classList.contains('nav-burger-open')&&!e.target.closest('.app-header-right')){
    hr.classList.remove('nav-burger-open');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(searchOpen){searchOpen=false;const b=document.getElementById('navSearchBox');if(b)b.classList.remove('on');}
    const hr=document.querySelector('.app-header-right');
    if(hr&&hr.classList.contains('nav-burger-open')) hr.classList.remove('nav-burger-open');
  }
});
