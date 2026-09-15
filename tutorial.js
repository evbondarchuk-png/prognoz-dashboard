/**
 * tutorial.js — ❓ ИИ-туториал «Прогноза»: всегда доступная справка по всем
 * функциям системы (Егор 15.09). Кнопка «?» в шапке любого кабинета →
 * модалка с чатом: пользователь спрашивает, ИИ отвечает с учётом роли.
 *
 * НЕ трогает данные — только читает базу знаний (ниже) и YandexGPT.
 * Подключён во всех 4 кабинетах + session-report.
 */

// ── База знаний (без LLM — мгновенный ответ на частые вопросы) ──
const KB = {
  'ир': {
    title: 'ИР — Индекс Развития',
    text: 'ИР показывает, насколько ты выполняешь план месяца. Считается из 4 блоков по 25%:\n\n• C1 — Поток покупателей и набор объектов продавцу\n• C2 — Горячие клиенты\n• C3 — Задатки\n• C4 — Валовая выручка (деньги)\n\nИР месяца накапливается: к 7-му числу нужно ~25%, к 14-му ~50%, к 21-му ~75%, к концу месяца 100%.\n\nЦвет: 🟢 ≥ нормы темпа, 🟡 80–99% нормы, 🔴 < 80%. В начале месяца низкий ИР — это нормально, неделя только началась.',
  },
  'прирост': {
    title: 'ИР прирост за нед',
    text: 'Показывает, на сколько пунктов ИР вырос за текущую неделю (от границы 7/14/21 числа).\n\nПример: на 7-м чис­ле ИР был 23%, на 14-м — 40%. Прирост за неделю = 17%.\n\nВ первые 2 дня недели прирост 0% — норма (зелёный). К 3-му дню 0% — жёлтый: пора двигаться.\n\nЦвет сравнивает тебя с коллегами: ≥ медианы группы = зелёный.',
  },
  'неделя': {
    title: 'Недельный ИР и страйки Н',
    text: 'Недельный план: 1-я неделя = 25% месячного ИР, 2-я = 50%, 3-я = 75%, 4-я = 100%.\n\nЕсли на границе недели (7/14/21/конец) месячный ИР ниже порога (15/30/45/60%) — неделя «плохая».\n\nСтрайки: Н1 = 1 плохая неделя, Н2 = 2 подряд, Н3 = 3, Н4 = 4+. Одна хорошая неделя — счётчик обнуляется.\n\n⚠️ Страйки считаются от МЕСЯЧНОГО ИР, не от недельного.',
  },
  'воронка': {
    title: 'Воронка покупателя и продавца',
    text: '🛒 Покупатель: Поток (заявки) → Горячие → Задатки → Сделки → Вал\n🏠 Продавец: Объекты в работе → Горячие → Задатки → Сделки → Вал\n\nКликни на этап — раскроется по сегментам (вторичка, загородка, новостройки, коммерция, гаражи).\n\nПлан каждого этапа — из твоего личного плана (рампа 6 месяцев). Зелёная полоса = факт, оранжевая = прогноз.',
  },
  'план': {
    title: 'План и цель по доходу',
    text: 'Твоя цель — доход в рублях в месяц. Из неё строится план: сколько заявок, объектов, задатков и сделок нужно делать.\n\nПлан на 6 месяцев — «рампа»: каждый месяц чуть сложнее предыдущего, чтобы к концу выйти на цель.\n\nИзменить цель: таб «Прогноз» → «Изменить доход» (или через руководителя).\n\n⚠️ Смена цели = новый план с текущего месяца. Страйк обнуляется.',
  },
  'задачи': {
    title: 'Задачи недели',
    text: 'Каждую неделю (1, 8, 15, 22 числа) система формирует задачи для твоей группы.\n\nРуководитель видит пакет, редактирует и акцептует. После акцепта задачи появляются у тебя в табе «Задачи и календарь».\n\nЗадачи основаны на твоих данных: если просел поток — задача по потоку, если нет задатков — по задаткам.\n\nВыполнил задачу → нажми «Проведено». Задача закроется автоматически, если система увидит результат.',
  },
  'светофор': {
    title: 'Светофор',
    text: 'Твоё место в компании по среднему доходу за 12 месяцев.\n\n24 зоны: от «Самых лучших» (топ-5) до «Низкоэффективных».\n\nГрафик показывает движение за 6 месяцев — поднимаешься или опускаешься.\n\nНовички (стаж < 3 мес) — в отдельном светофоре новичков.\n\nМесто меняется 1-го числа каждого месяца.',
  },
  'прогноз': {
    title: 'Таб «Прогноз»',
    text: 'Здесь видно:\n• Вал и доход за текущий месяц (факт + прогноз)\n• График «Цикл по месяцам» — план vs факт\n• «Ход цикла» — каждый месяц с раскрытой воронкой\n• ИИ-разбор: где теряешь деньги и что делать\n• Цель по доходу\n\nПрогноз — это оценка к концу месяца: сколько вала будет, если продолжишь в том же темпе.',
  },
  'премиум': {
    title: 'Прогноша (ИИ-ассистент)',
    text: 'Прогноша — лисёнок в правом нижнем углу. Отвечает на вопросы о твоих данных: «Какой у меня ИР?», «Что с задатками?», «Как я иду к цели?»\n\nУмеет ставить встречи в Google Calendar.\n\nПодключи MAX-бот — Прогноша будет писать тебе брифы по утрам.',
  },
  'награды': {
    title: 'Награды и медали',
    text: 'Медали за достижения: звания вала, первые сделки, серии недель в плане, лучший рост в группе.\n\nЗал славы: сравни себя с коллегами (фильтры группа/отдел/компания).\n\n⭐ Звёзды: топ-8 по задаткам/сделкам за день/неделю/месяц.',
  },
  'сессия': {
    title: 'Отчёт-сессия (session-report)',
    text: 'Подробный разбор твоей работы: ИР по блокам, воронка по дням, рейтинг в группе, риск-страйки, тренд.\n\nОткрывается по ссылке от руководителя или из кабинета.',
  },
  'кабинет': {
    title: 'Роли и кабинеты',
    text: '• Партнёр (риелтор) — index.html: воронка, ИР, план, задачи, светофор\n• Старший партнёр (МОП) — mop.html: группа, команды, планирование\n• Управляющий партнёр (РОП) — rop.html: отдел, группы, амбициозные планы\n• АУП — aup.html: компания, все отделы\n\nРуководитель может открыть кабинет любого подчинённого (?agent=, ?mop=, ?rop=).',
  },
};

// ── Быстрый ответ (без LLM) ──
function quickAnswer(q) {
  const ql = q.toLowerCase();
  // Прямое совпадение по ключевым словам
  const keys = [
    ['ир', 'индекс'], ['прирост', 'нед'], ['неделя', 'страйк', 'н1', 'н2', 'н3', 'н4'],
    ['воронк', 'поток', 'горяч', 'задатк', 'сделк'],
    ['план', 'цель', 'доход', 'рамп'],
    ['задач', 'пакет', 'недел'],
    ['светофор', 'зона', 'место'],
    ['прогноз', 'вал', 'цикл'],
    ['прогнош', 'ассистент', 'лис', 'бот', 'макс'],
    ['наград', 'медал', 'звезд', 'звёзды', 'зал'],
    ['сессия', 'отчёт', 'отчет', 'report'],
    ['кабинет', 'роль', 'моп', 'роп', 'ауп', 'партнёр', 'партнер'],
  ];
  const kbKeys = ['ир', 'прирост', 'неделя', 'воронка', 'план', 'задачи', 'светофор', 'прогноз', 'премиум', 'награды', 'сессия', 'кабинет'];
  for (let i = 0; i < keys.length; i++) {
    for (const kw of keys[i]) {
      if (ql.includes(kw)) return KB[kbKeys[i]];
    }
  }
  return null;
}

// ── Модалка туториала ──
let tutOpen = false;

function tutHTML() {
  const topics = Object.values(KB).map(k => `<button class="tut-topic" onclick="window.__tutTopic('${k.title}')">${k.title}</button>`).join('');
  return `
  <div style="display:flex;gap:16px;height:100%">
    <div style="width:220px;flex-shrink:0;border-right:1px solid var(--line);padding-right:14px;overflow-y:auto">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:10px;padding:0 4px">Темы</div>
      ${topics}
      <div style="margin-top:14px;padding:10px;border-radius:10px;background:var(--surface-2,#f1f3f7);font-size:11px;color:var(--muted);line-height:1.5">
        💡 Или задай свой вопрос — ИИ ответит с учётом твоих данных
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">
      <div id="tutAnswer" style="flex:1;overflow-y:auto;padding:4px 0;font-size:14px;line-height:1.6">
        <div style="color:var(--muted);text-align:center;padding:40px 20px;font-size:13px">
          <div style="font-size:36px;margin-bottom:10px">❓</div>
          Выбери тему слева или напиши вопрос ниже
        </div>
      </div>
      <div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--line)">
        <input id="tutInput" placeholder="Напиши вопрос: «что такое ИР?», «как работает светофор?»…" style="flex:1;font-family:inherit;font-size:13px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;outline:none" onkeydown="if(event.key==='Enter')window.__tutAsk()">
        <button onclick="window.__tutAsk()" style="font-size:13px;font-weight:700;padding:10px 16px;border-radius:10px;border:1px solid var(--brand);background:var(--brand);color:#fff;cursor:pointer;font-family:inherit">Спросить</button>
      </div>
    </div>
  </div>`;
}

window.__tutTopic = function(title) {
  const el = document.getElementById('tutAnswer');
  if (!el) return;
  const entry = Object.values(KB).find(k => k.title === title);
  if (entry) {
    el.innerHTML = `<div style="font-weight:800;font-size:16px;margin-bottom:10px;color:var(--brand)">${entry.title}</div><div style="white-space:pre-line">${entry.text}</div>`;
  }
};

window.__tutAsk = async function() {
  const inp = document.getElementById('tutInput');
  const el = document.getElementById('tutAnswer');
  if (!inp || !el || !inp.value.trim()) return;
  const q = inp.value.trim();
  inp.value = '';
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px">⏳ Ищу ответ…</div>';

  // Быстрый ответ из базы знаний
  const quick = quickAnswer(q);
  if (quick) {
    el.innerHTML = `<div style="font-weight:800;font-size:16px;margin-bottom:10px;color:var(--brand)">${quick.title}</div><div style="white-space:pre-line">${quick.text}</div>`;
    return;
  }

  // ИИ-ответ
  try {
    const r = await window.__call('askPrognosha', { question: q, tutorial_mode: true });
    const text = r && r.answer || r && r.text || '';
    if (text) {
      el.innerHTML = `<div style="white-space:pre-line">${text}</div>`;
    } else {
      el.innerHTML = '<div style="color:var(--muted);padding:20px">Не нашёл ответ. Попробуй переформулировать или выбери тему слева.</div>';
    }
  } catch (e) {
    // Fallback: показать список тем
    el.innerHTML = `<div style="color:var(--muted);padding:16px;font-size:13px">ИИ временно недоступен. Вот основные темы:</div>${Object.values(KB).map(k => `<div style="padding:6px 0"><b onclick="window.__tutTopic('${k.title}')" style="color:var(--brand);cursor:pointer">${k.title}</b></div>`).join('')}`;
  }
};

window.__tutToggle = function() {
  tutOpen = !tutOpen;
  let modal = document.getElementById('tutModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tutModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,55,.5);display:none;align-items:center;justify-content:center;z-index:300;padding:20px';
    modal.innerHTML = `<div style="background:#fff;border-radius:18px;max-width:760px;width:100%;max-height:80vh;overflow:hidden;padding:20px;box-shadow:0 16px 50px rgba(20,30,55,.25);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="font-size:18px;font-weight:800">❓ Как работает Прогноз</div>
        <span style="font-size:11px;color:var(--muted);margin-left:auto">всегда доступно</span>
        <button onclick="window.__tutToggle()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:0 4px">✕</button>
      </div>
      <div style="flex:1;overflow:hidden;min-height:400px">${tutHTML()}</div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display = tutOpen ? 'flex' : 'none';
};

// ── Инициализация: кнопка «?» в шапке ──
export function initTutorial() {
  const header = document.querySelector('.app-header-right') || document.querySelector('header');
  if (!header) return;
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.innerHTML = '❓';
  btn.title = 'Как работает Прогноз — справка по всем функциям';
  btn.style.cssText = 'font-size:16px;padding:6px 10px;margin-left:6px';
  btn.onclick = () => window.__tutToggle();
  header.appendChild(btn);
}
