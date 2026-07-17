/**
 * nav.js — навигационный слой для всех кабинетов.
 * Breadcrumbs в лого + меню «Моя команда» + глобальный поиск.
 * Данные: CTX (role, me, target, data).
 */

import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, orderByChild, startAt, endAt, get, query } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

let injected = false;
let navCtx = null;
let teamDropOpen = false;
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

/* --- Меню команд + поиск (в .app-header-right) --- */
.nav-tools{display:flex;align-items:center;gap:6px}
.nav-team-trigger{position:relative}
.nav-team-btn{font-size:var(--fs-12);color:var(--muted);background:transparent;padding:5px 10px;border-radius:20px;border:1px solid var(--line);cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit}
.nav-team-btn:hover{background:var(--surface-2)}
.nav-team-drop{
  position:absolute;top:calc(100% + 6px);right:0;
  width:260px;max-height:320px;overflow-y:auto;
  background:var(--surface);border:1px solid var(--line);
  border-radius:var(--r-lg);box-shadow:0 8px 30px rgba(20,30,55,.12);
  opacity:0;transform:translateY(-6px);pointer-events:none;
  transition:opacity .15s ease,transform .15s ease;z-index:200;
}
.nav-team-drop.on{opacity:1;transform:translateY(0);pointer-events:auto}
.nav-team-item{
  display:flex;align-items:center;gap:8px;
  padding:8px 12px;cursor:pointer;
  font-size:var(--fs-12);color:var(--ink);
  border-bottom:1px solid var(--line);
  text-decoration:none;
}
.nav-team-item:last-child{border-bottom:none}
.nav-team-item:hover{background:var(--surface-2)}
.nav-team-avatar{
  width:28px;height:28px;border-radius:50%;
  background:var(--brand-soft);color:var(--brand);
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:var(--fw-b);flex-shrink:0;
}
.nav-team-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-team-role{font-size:10px;color:var(--muted)}

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

@media(max-width:480px){
  .nav-crumbs{font-size:11px}
  .nav-team-drop{right:-40px;width:220px}
  .nav-search-box{right:-20px;width:240px}
}
`;

function injectCss(){
  if(injected) return;
  const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);
  injected=true;
}

/* --- Breadcrumbs --- */

/**
 * Резолвим полную цепочку иерархии для просматриваемого пользователя.
 * Читает /users/{targetCode} и, при наличии mopCode/ropCode, их профили.
 * Возвращает массив [{label, name, code, file, param}, ...] от корня к листу.
 */
async function resolveChain(targetCode){
  const db=getDatabase(getApp());
  const LEVEL={
    aup :{label:'Компания',file:'aup.html',param:'aup'},
    rop :{label:'РОП',      file:'rop.html', param:'rop'},
    mop :{label:'МОП',      file:'mop.html', param:'mop'},
    realtor:{label:'Партнёр',file:'index.html',param:'agent'},
  };

  // 1. Читаем целевого пользователя
  let target;
  try{const s=await get(ref(db,'users/'+targetCode));target=s.exists()?s.val():null;}catch(e){target=null;}
  if(!target) return [];

  const chain=[];
  const ropCode=target.ropCode||null;
  const mopCode=target.mopCode||null;

  // 2. РОП (если есть ropCode и это не он сам)
  if(ropCode&&String(ropCode)!==String(targetCode)){
    try{
      const s=await get(ref(db,'users/'+ropCode));
      if(s.exists()){
        const u=s.val();
        chain.push({...LEVEL.rop,name:u.short_name||u.name||'',code:String(ropCode)});
      }
    }catch(e){}
  }

  // 3. МОП (если есть mopCode и это не он сам)
  if(mopCode&&String(mopCode)!==String(targetCode)){
    try{
      const s=await get(ref(db,'users/'+mopCode));
      if(s.exists()){
        const u=s.val();
        chain.push({...LEVEL.mop,name:u.short_name||u.name||'',code:String(mopCode)});
      }
    }catch(e){}
  }

  // 4. Сам просматриваемый
  chain.push({
    ...LEVEL[target.role]||LEVEL.realtor,
    name:target.short_name||target.name||'',
    code:String(targetCode),
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
    const viewedName=viewedUser?.short_name||viewedUser?.name||'';
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
    chain=await resolveChain(ctx.target);
  }
  const crumbsSpan=document.querySelector('.logo .nav-crumbs');
  if(crumbsSpan){
    crumbsSpan.innerHTML=buildBreadcrumbs(ctx,chain);
  }
}

/* --- Меню команд --- */
function buildTeamMenu(ctx){
  if(!ctx||ctx.role==='realtor') return '';
  const members=ctx.data?.team_cards?.members||[];
  if(!members.length) return '';
  // Фильтруем: МОП видит партнёров, РОП видит МОПов, АУП видит РОПов
  const drillParam={mop:'agent',rop:'mop',aup:'rop',admin:'rop'}[ctx.role]||'agent';
  const drillFile={mop:'index.html',rop:'mop.html',aup:'rop.html',admin:'rop.html'}[ctx.role]||'index.html';
  const items=members.filter(m=>!m.is_self).map(m=>{
    const initials=(m.short_name||m.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2);
    return `<a class="nav-team-item" href="${drillFile}?${drillParam}=${encodeURIComponent(m.code)}">
      <div class="nav-team-avatar">${esc(initials)}</div>
      <div class="nav-team-name">${esc(m.short_name||m.name||'')}</div>
    </a>`;
  }).join('');
  if(!items) return '';
  return `<div class="nav-team-trigger">
    <button class="nav-team-btn" onclick="window.__navTeamToggle()" >👥 Моя команда ▾</button>
    <div class="nav-team-drop" id="navTeamDrop">${items}</div>
  </div>`;
}

/* --- Поиск --- */
function buildSearch(){
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
    // Удаляем старый span «· кабинет» и вставляем breadcrumbs
    const existing=logo.querySelector('.nav-crumbs');
    if(existing) existing.remove();
    const sep=logo.querySelector('.nav-sep');
    if(sep) sep.remove();
    // Ищем span внутри logo (текст «· кабинет»)
    const innerSpan=logo.querySelector('span');
    if(innerSpan&&!innerSpan.classList.contains('nav-sep')&&!innerSpan.classList.contains('nav-crumbs')){
      innerSpan.style.display='none'; // скрываем «· кабинет»
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
    toolsDiv.innerHTML=buildTeamMenu(ctx)+buildSearch();
    // Вставляем перед logoutBtn (или первым элементом)
    const logoutBtn=document.getElementById('logoutBtn');
    if(logoutBtn){
      headerRight.insertBefore(toolsDiv,logoutBtn);
    } else {
      headerRight.appendChild(toolsDiv);
    }
  }
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

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

/* --- Поиск по /users --- */
async function doSearch(q){
  const resultsEl=document.getElementById('navSearchResults');
  if(!resultsEl) return;
  resultsEl.innerHTML='<div class="nav-search-empty">Ищу…</div>';
  try{
    const db=getDatabase(getApp());
    // Ищем по name (префиксный) и по code (точный)
    const nameQ=query(ref(db,'users'),orderByChild('name'),startAt(q),endAt(q+''));
    const snap=await get(nameQ);
    const results=[];
    snap.forEach(child=>{
      const u=child.val();
      results.push({code:child.key,name:u.name||'',role:u.role||''});
    });
    // Если введён код — добавляем точное совпадение
    if(/^\d+$/.test(q)){
      try{
        const codeSnap=await get(ref(db,'users/'+q));
        if(codeSnap.exists()&&!results.find(r=>r.code===q)){
          const u=codeSnap.val();
          results.push({code:q,name:u.name||'',role:u.role||''});
        }
      }catch(e){}
    }
    if(!results.length){
      resultsEl.innerHTML='<div class="nav-search-empty">Ничего не найдено</div>';
      return;
    }
    resultsEl.innerHTML=results.slice(0,10).map(r=>{
      const roleLabel={realtor:'Партнёр',mop:'МОП',rop:'РОП',aup:'АУП'}[r.role]||'';
      const file={realtor:'index.html',mop:'index.html',rop:'mop.html',aup:'rop.html'}[r.role]||'index.html';
      const param={realtor:'agent',mop:'agent',rop:'mop',aup:'rop'}[r.role]||'agent';
      return `<a class="nav-search-item" href="${file}?${param}=${encodeURIComponent(r.code)}">
        <span>${esc(r.name)}</span>
        <span style="color:var(--muted);font-size:10px">${roleLabel} ${esc(r.code)}</span>
      </a>`;
    }).join('');
  }catch(e){
    resultsEl.innerHTML='<div class="nav-search-empty">Ошибка поиска</div>';
    console.error('[nav] search failed',e);
  }
}

/* --- Обработчики --- */
window.__navTeamToggle=()=>{
  const drop=document.getElementById('navTeamDrop');
  if(!drop) return;
  teamDropOpen=!teamDropOpen;
  drop.classList.toggle('on',teamDropOpen);
};
window.__navSearchToggle=()=>{
  const box=document.getElementById('navSearchBox');
  if(!box) return;
  searchOpen=!searchOpen;
  box.classList.toggle('on',searchOpen);
  if(searchOpen){
    setTimeout(()=>{const inp=document.getElementById('navSearchInput');if(inp)inp.focus();},100);
  }
};

// Закрытие при клике вне
document.addEventListener('click',e=>{
  if(teamDropOpen&&!e.target.closest('.nav-team-trigger')){
    teamDropOpen=false;
    const d=document.getElementById('navTeamDrop');
    if(d) d.classList.remove('on');
  }
  if(searchOpen&&!e.target.closest('.nav-search-trigger')){
    searchOpen=false;
    const b=document.getElementById('navSearchBox');
    if(b) b.classList.remove('on');
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(teamDropOpen){teamDropOpen=false;const d=document.getElementById('navTeamDrop');if(d)d.classList.remove('on');}
    if(searchOpen){searchOpen=false;const b=document.getElementById('navSearchBox');if(b)b.classList.remove('on');}
  }
});
