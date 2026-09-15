/**
 * tutorial.js — ❓ Справка «Прогноз» (v2, Егор 15.09)
 *
 * Ролевая справка с логикой от дохода, поиском и ИИ.
 * Один хаб: темы по роли + поиск + чат + эскалация к руководителю.
 * Не конкурирует с Прогношей — единый центр справки.
 */

// ── Темы по ролям: логика от дохода ──
const TOPICS = {
  realtor: [
    {
      id: 'money',
      icon: '💰',
      title: 'Сколько я заработаю в этом месяце?',
      text: `Твоя цель — доход в рублях. Из неё система строит план: сколько заявок, объектов, задатков и сделок нужно делать каждый день.

Например: цель 150 000 ₽ → нужно ~30 заявок, ~15 объектов, ~4 задатка, ~2 сделки в месяц.

Открой таб «Прогноз» — там видно:
• Вал (оборота уже есть)
• Прогноз к концу месяца (сколько будет, если продолжишь в том же темпе)
• ≈ ЗП — твоя примерная зарплата (48% от вала)

ИИ-разбор в этом же табе покажет, где ты теряешь деньги и что делать.`,
    },
    {
      id: 'ir',
      icon: '📊',
      title: 'ИР — как я выполняю план?',
      text: `ИР (Индекс Развития) — это % выполнения плана месяца. Считается из 4 блоков:

📊 Поток и объекты — заявки от покупателей + объекты от продавцов
🔥 Горячие — клиенты, с которыми работаешь прямо сейчас
🤝 Задатки — клиенты, которые уже внесли задаток
💰 Вал — деньги, которые ты уже заработал

ИР накапливается весь месяц:
• К 7-му числу → ~25% (зелёный)
• К 14-му → ~50%
• К 21-му → ~75%
• К концу месяца → 100%

В начале месяца низкий ИР — это НОРМА. Неделя только началась.

Цвет: 🟢 ты в темпе, 🟡 чуть отстаёшь, 🔴 нужно подтянуть.`,
    },
    {
      id: 'funnel',
      icon: '🎯',
      title: 'Воронка — мои клиенты и объекты',
      text: `На Главной — две воронки:

🛒 ПОКУПАТЕЛЬ: Поток → Горячие → Задатки → Сделки → Вал
🏠 ПРОДАВЕЦ: Объекты в работе → Горячие → Задатки → Сделки → Вал

Зелёная полоса = сколько уже сделал. Оранжевая = прогноз. Серая = план.

Нажми на этап — раскроется по сегментам (вторичка, загородка, новостройки и т.д.). Увидишь, какой сегмент проседает.`,
    },
    {
      id: 'tasks',
      icon: '📋',
      title: 'Задачи — что делать на этой неделе',
      text: `Каждую неделю система смотрит твои данные и формирует задачи. Руководитель их редактирует и отправляет тебе.

Задачи появляются в табе «Задачи и календарь». Они конкретные: не «работай лучше», а «позвони 5 клиентам по вторичке».

Выполнил → нажми «Проведено». Если система увидит результат (заявки пришли, задаток получен) — задача закроется сама.`,
    },
    {
      id: 'svetofor',
      icon: '🚦',
      title: 'Светофор — моё место в компании',
      text: `Светофор показывает твоё место среди всех риелторов по среднему доходу за 12 месяцев.

24 зоны — от «Самых лучших» (топ-5) до «Низкоэффективных».

График показывает: поднимаешься или опускаешься за последние 6 месяцев.

Новички (стаж < 3 мес) — в отдельном светофоре новичков, конкуренция честная.

Место обновляется 1-го числа каждого месяца.`,
    },
    {
      id: 'week',
      icon: '📈',
      title: 'Прирост за неделю — почему 0% это нормально',
      text: `«ИР прирост за нед» показывает, на сколько пунктов ИР вырос за текущую неделю.

Пример: на 7-м чис­ле ИР 23%, на 14-м — 40%. Прирост = 17%.

В первые 2 дня недели прирост 0% — ЗЕЛЁНЫЙ. Неделя только началась, ты ещё не успел ничего сделать. Это не отставание.

К 3-му дню 0% становится жёлтым — пора двигаться.

Цвет сравнивает тебя с коллегами: ≥ медианы группы = зелёный.`,
    },
    {
      id: 'strikes',
      icon: '⚠️',
      title: 'Страйки Н — что это и как снять',
      text: `Если на границе недели (7/14/21/конец месяца) твой месячный ИР ниже порога — неделя «плохая».

Пороги: 7-е < 15%, 14-е < 30%, 21-е < 45%, конец < 60%.

Н1 = 1 плохая неделя, Н2 = 2 подряд, Н3 = 3, Н4 = 4+.

Одна хорошая неделя — счётчик обнуляется. Это не наказание, а сигнал: «обрати внимание, темп просел».

Смена дохода (новый план) — страйк обнуляется, «чистый лист».`,
    },
    {
      id: 'prognosha',
      icon: '🦊',
      title: 'Прогноша — твой ИИ-помощник',
      text: `Прогноша (лисёнок в углу экрана) отвечает на вопросы о ТВОИХ данных:

«Какой у меня ИР?»
«Что с задатками по вторичке?»
«Сколько мне нужно ещё сделать до конца месяца?»

Умеет ставить встречи в Google Calendar.

Подключи MAX-бот — Прогноша будет писать тебе брифы по утрам с планом на день.`,
    },
  ],
  mop: [
    {
      id: 'group',
      icon: '👥',
      title: 'Как работает моя группа',
      text: `ИР группы = прирост месячного ИР группы за неделю. Не среднее — прирост.

Если на 7-м группа была 30%, на 14-м 45% → прирост 15%.

Смотри цвет по медиане групп отдела: ≥ медианы = зелёный.

Воронка группы — сумма по всем риелторам. Нажми на этап — раскроется по сегментам.`,
    },
    {
      id: 'pkg',
      icon: '📦',
      title: 'Пакет задач недели — как акцептовать',
      text: `Каждую неделю (1, 8, 15, 22 числа) система формирует задачи для твоей группы.

Открой таб «Задачи и календарь» → сверху фиолетовая карточка «📦 Задачи недели».

Для каждой задачи:
✏️ Редактировать — поправить текст
✅ Назначить — отправить риелтору прямо сейчас
✕ Убрать — исключить из пакета
➕ Своя задача — написать свою для конкретного риелтора

Кнопка «Назначить все» — отправляет все выбранные задачи разом.

Если игнорируешь пакет — при следующей генерации непринятые задачи удаляются автоматически.`,
    },
    {
      id: 'plan',
      icon: '🎯',
      title: 'Планирование — как корректировать план риелтору',
      text: `Таб «Планирование» → выбери риелтора.

У покупателя правишь поток и горячие ПО СЕГМЕНТАМ (вторичка, новостройки и т.д.).
У продавца — НАБОР объектов (сколько новых объектов взять в работу).

Система пересчитывает остатки и ИР автоматически.

⚠️ Смена дохода риелтора = новый план. Ручная правка план НЕ меняет — корректирует внутри рампы.`,
    },
    {
      id: 'risk',
      icon: '⚠️',
      title: 'Кто проседает и что делать',
      text: `В табе «Команда» → подтаб «В риске (месяц)» — риелторы с страйками Н1-Н4.

Н1-Н2 → разбери с риелтором, что мешает
Н3-Н4 → подключай РОПа, нужен план реабилитации

Светофор команды (в табе «Светофор») — видишь место каждого в компании, динамику за 6 мес.

⭐ Звёзды — кто в топе по задаткам и сделкам за день/неделю/месяц.`,
    },
    {
      id: 'val',
      icon: '💰',
      title: 'Вал группы и амбициозный план',
      text: `Вал группы = сумма фактических комиссий всех риелторов.

Прогноз = сколько будет к концу месяца, если темп сохранится.

Если РОП задал амбициозный план — на Главной появится карточка «Амбициозный план» с полосой факт/прогноз/план.

Открывай «Ход цикла» в табе Прогноз — виден каждый месяц с раскрытой воронкой.`,
    },
  ],
  rop: [
    {
      id: 'dept',
      icon: '🏢',
      title: 'Мой отдел — группы и менеджеры',
      text: `ИР отдела = прирост месячного ИР отдела за неделю.

Карточки менеджеров: ИР прирост, план вала, факт, прогноз, статус группы.

Двойной клик по группе → открывается кабинет МОПа (drill-down).

Светофор группы — в табе «Светофор»: кто на каком месте в компании.`,
    },
    {
      id: 'ambitious',
      icon: '🎯',
      title: 'Амбициозные планы по валу',
      text: `Таб «Планирование» → таблица по менеджерам: план вала на каждый месяц года (в тыс ₽).

Видно: средний вал группы, средний на 1 риелтора, стаж по группам (0-3/4-6/6+ мес).

План задаётся по каждому месяцу — скролл горизонтальный, текущий месяц подсвечен.

Если РОП задал план → МОП видит карточку на Главной + блок в брифах.`,
    },
    {
      id: 'minimums',
      icon: '⚙️',
      title: 'Минимумы отдела — как работают',
      text: `Минимум отдела — «пол» для планов риелторов. Если формула дала план ниже минимума — берётся минимум.

У покупателя: минимум по потоку и горячим (по сегментам).
У продавца: минимум по НАБОРУ объектов (общая цифра, не по сегментам).

Минимум работает прямо в расчёте плана — это не проверка, а часть формулы.

НОВИЧКИ 0-3 мес: потолок набора = минимум РОПа (или 10, если не задан).`,
    },
    {
      id: 'compare',
      icon: '📊',
      title: 'Сравнение групп — кто лучше',
      text: `В табе «Команда» — все группы с ИР, планом/фактом, статусом.

Подтаб «В риске» — группы с Н1+.

Прогноз отдела — в табе «Прогноз»: сумма по группам.

⭐ Звёзды отдела — топ-8 по задаткам/сделкам.`,
    },
  ],
  aup: [
    {
      id: 'company',
      icon: '🏛',
      title: 'Вся компания — обзор',
      text: `Карточки РОПов: ИР прирост, план вала отдела, факт, прогноз, статус.

Двойной клик → кабинет РОПа (drill-down).

Светофор: все отделы, сравнение, динамика.

Аналитика (кнопка 📊): активные пользователи, события, страницы, действия.`,
    },
    {
      id: 'analytics',
      icon: '📊',
      title: 'Аналитика — кто и как использует систему',
      text: `Кнопка «📊 Аналитика» в шапке.

Показывает: активные пользователи по дням, топ событий, популярные страницы, действия (клики по этапам воронки, смена целей).

Данные за период 7-365 дней.`,
    },
    {
      id: 'flags',
      icon: '⚙️',
      title: 'Управление системой',
      text: `Кнопка «🛠 Админ» — пульт управления.

Тумблеры: утренние брифы, месячные брифы, ИИ-задачи.

Состояние ночной цепочки: здоровье данных, готовность, ошибки.`,
    },
  ],
};

// Общие темы (для всех ролей — все лично продают)
const COMMON = [
  TOPICS.realtor.find(t => t.id === 'money'),
  TOPICS.realtor.find(t => t.id === 'ir'),
  TOPICS.realtor.find(t => t.id === 'funnel'),
  TOPICS.realtor.find(t => t.id === 'svetofor'),
];

// ── Поиск ──
function searchTopics(q, role) {
  const ql = q.toLowerCase();
  const pool = [...(TOPICS[role] || []), ...COMMON.filter(c => c && !(TOPICS[role] || []).find(t => t.id === c.id))];
  return pool.filter(t => {
    if (!t) return false;
    return t.title.toLowerCase().includes(ql) || t.text.toLowerCase().includes(ql);
  });
}

// ── Роль из контекста ──
function detectRole() {
  const path = location.pathname;
  if (path.includes('aup')) return 'aup';
  if (path.includes('rop')) return 'rop';
  if (path.includes('mop')) return 'mop';
  return 'realtor';
}

const ROLE_LABEL = { realtor: 'Партнёру', mop: 'Старшему партнёру', rop: 'Управляющему партнёру', aup: 'АУП' };

// ── Модалка ──
let tutOpen = false;

function tutRender() {
  const role = detectRole();
  const roleTopics = TOPICS[role] || [];
  const commonFiltered = COMMON.filter(c => c && !roleTopics.find(t => t.id === c.id));
  const all = [...roleTopics, ...commonFiltered].filter(Boolean);

  return `
  <div style="display:flex;gap:0;height:100%;overflow:hidden">
    <!-- Левая панель: поиск + темы -->
    <div style="width:280px;flex-shrink:0;border-right:1px solid var(--line);display:flex;flex-direction:column">
      <div style="padding:12px 14px 8px">
        <input id="tutSearch" placeholder="Поиск: «воронка», «страйк», «сколько заработаю»…" style="width:100%;font-family:inherit;font-size:13px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;outline:none;box-sizing:border-box" oninput="window.__tutSearch(this.value)">
      </div>
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:4px 16px 6px">Для ${ROLE_LABEL[role]}</div>
      <div id="tutTopics" style="flex:1;overflow-y:auto;padding:0 8px 8px">
        ${all.map(t => `<button class="tut-topic" data-id="${t.id}" onclick="window.__tutShow('${t.id}')">
          <span style="font-size:18px;margin-right:8px">${t.icon}</span>
          <span>${t.title}</span>
        </button>`).join('')}
      </div>
    </div>
    <!-- Правая панель: ответ -->
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
      <div id="tutAnswer" style="flex:1;overflow-y:auto;padding:16px 20px;font-size:14px;line-height:1.65">
        <div style="color:var(--muted);text-align:center;padding:60px 24px;font-size:13px">
          <div style="font-size:44px;margin-bottom:12px;opacity:.5">❓</div>
          Выбери тему слева<br>или напиши вопрос ниже
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line);background:var(--surface-2,#f8f9fb)">
        <input id="tutInput" placeholder="Спроси ИИ: «почему у меня ИР жёлтый?»" style="flex:1;font-family:inherit;font-size:13px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;outline:none" onkeydown="if(event.key==='Enter')window.__tutAsk()">
        <button onclick="window.__tutAsk()" style="font-size:13px;font-weight:700;padding:10px 16px;border-radius:10px;border:1px solid var(--brand);background:var(--brand);color:#fff;cursor:pointer;font-family:inherit">Спросить</button>
      </div>
    </div>
  </div>`;
}

// Стили
const TUT_CSS = `
.tut-topic{display:flex;align-items:flex-start;gap:4px;width:100%;text-align:left;font-family:inherit;font-size:13px;font-weight:500;color:var(--ink);background:none;border:none;border-radius:10px;padding:10px 12px;margin-bottom:2px;cursor:pointer;line-height:1.4;transition:background .12s}
.tut-topic:hover{background:var(--surface-2,#f1f3f7)}
.tut-topic.on{background:#ede7f6;color:#5e35b1;font-weight:600}
`;

window.__tutShow = function(id) {
  const role = detectRole();
  const all = [...(TOPICS[role] || []), ...COMMON].filter(Boolean);
  const t = all.find(x => x.id === id);
  if (!t) return;
  const el = document.getElementById('tutAnswer');
  if (el) el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span style="font-size:24px">${t.icon}</span>
      <div style="font-weight:800;font-size:17px;color:var(--brand)">${t.title}</div>
    </div>
    <div style="white-space:pre-line">${t.text}</div>`;
  document.querySelectorAll('.tut-topic').forEach(b => b.classList.toggle('on', b.dataset.id === id));
};

window.__tutSearch = function(q) {
  if (!q.trim()) {
    // Показать все темы
    window.__tutToggle(); window.__tutToggle();
    return;
  }
  const role = detectRole();
  const results = searchTopics(q, role);
  const wrap = document.getElementById('tutTopics');
  if (!wrap) return;
  if (!results.length) {
    wrap.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--muted)">Ничего не найдено. Попробуй другой запрос или спроси ИИ ниже.</div>`;
  } else {
    wrap.innerHTML = results.map(t => `<button class="tut-topic" data-id="${t.id}" onclick="window.__tutShow('${t.id}')"><span style="font-size:18px;margin-right:8px">${t.icon}</span><span>${t.title}</span></button>`).join('');
  }
};

window.__tutAsk = async function() {
  const inp = document.getElementById('tutInput');
  const el = document.getElementById('tutAnswer');
  if (!inp || !el || !inp.value.trim()) return;
  const q = inp.value.trim();
  inp.value = '';

  // 1) Сначала — база знаний (мгновенно, без ИИ)
  const role = detectRole();
  const pool = [...(TOPICS[role] || []), ...COMMON].filter(Boolean);
  const ql = q.toLowerCase();

  // Поиск по заголовку и тексту
  let best = null;
  let bestScore = 0;
  for (const t of pool) {
    const titleL = t.title.toLowerCase();
    const textL = t.text.toLowerCase();
    let score = 0;
    // Слова из вопроса
    const words = ql.split(/[\s,?!]+/).filter(w => w.length > 2);
    for (const w of words) {
      if (titleL.includes(w)) score += 3;
      if (textL.includes(w)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  if (best && bestScore >= 3) {
    window.__tutShow(best.id);
    return;
  }

  // 2) ИИ через Прогношу (отвечает о ДАННЫХ пользователя)
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px">⏳ Думаю…</div>';
  try {
    const r = await window.__call('askPrognosha', { question: q });
    const text = r && (r.answer || r.text) || '';
    if (text && text.length > 5) {
      el.innerHTML = `<div style="white-space:pre-line">${text}</div>`;
      return;
    }
    throw new Error('empty');
  } catch (e) {
    // 3) ИИ не ответил — показать ближайшие темы из KB
    const related = pool.slice(0, 4).map(t =>
      `<div style="padding:6px 0"><b onclick="window.__tutShow('${t.id}')" style="color:var(--brand);cursor:pointer">${t.icon} ${t.title}</b></div>`
    ).join('');
    el.innerHTML = `
      <div style="padding:16px">
        <div style="font-size:14px;color:var(--ink);margin-bottom:6px">🤔 ИИ не нашёл ответ на этот вопрос</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Возможно, ты имел(а) в виду:</div>
        ${related}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
          <button style="font-size:12px;font-weight:700;padding:8px 16px;border-radius:8px;border:1px solid #fecaca;background:#fff;color:#dc2626;cursor:pointer;font-family:inherit" onclick="window.__tutEscalate('${encodeURIComponent(q)}')">📩 Спросить руководителя</button>
          <span style="font-size:11px;color:var(--muted);margin-left:8px">Передадим твой вопрос — ответ придёт в чат-бот</span>
        </div>
      </div>`;
  }
};

window.__tutEscalate = async function(q) {
  const question = decodeURIComponent(q);
  alert('Передал твой вопрос руководителю. Ответ придёт в чат-бот.');
  // TODO: отправить задачу руководителю через createTask
};

window.__tutToggle = function() {
  tutOpen = !tutOpen;
  let modal = document.getElementById('tutModal');
  if (!modal) {
    // Инжект стилей
    const st = document.createElement('style');
    st.textContent = TUT_CSS;
    document.head.appendChild(st);

    modal = document.createElement('div');
    modal.id = 'tutModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,55,.5);display:none;align-items:center;justify-content:center;z-index:300;padding:20px';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:18px;max-width:820px;width:100%;height:600px;max-height:85vh;overflow:hidden;box-shadow:0 16px 50px rgba(20,30,55,.25);display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)">
          <span style="font-size:20px">❓</span>
          <div style="font-weight:800;font-size:16px">Как работает Прогноз</div>
          <span style="font-size:11px;color:var(--muted);background:var(--surface-2,#f1f3f7);padding:2px 10px;border-radius:999px">${ROLE_LABEL[detectRole()]}</span>
          <button onclick="window.__tutToggle()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);margin-left:auto;padding:0 4px">✕</button>
        </div>
        <div style="flex:1;overflow:hidden">${tutRender()}</div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = tutOpen ? 'flex' : 'none';
};

export function initTutorial() {
  const header = document.querySelector('.app-header-right') || document.querySelector('header .right') || document.querySelector('header');
  if (!header) return;
  if (document.getElementById('tutBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'tutBtn';
  btn.className = 'btn';
  btn.innerHTML = '❓';
  btn.title = 'Как работает Прогноз — справка по всем функциям';
  btn.style.cssText = 'font-size:16px;padding:6px 10px;margin-left:6px';
  btn.onclick = () => window.__tutToggle();
  header.appendChild(btn);
}
