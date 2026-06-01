# CLAUDE.md — контекст проекта «Прогноз»

> Claude Code читает этот файл автоматически при запуске.
> Здесь — актуальное состояние проекта и правила работы. Читай целиком.
> Детальная история изменений и нюансы — в auto-memory
> (`memory/project_sprint2_state.md`), читай её для глубокого контекста.

---

## 1. Что это за проект

Система управления продажами «Прогноз» для агентства недвижимости «Этажи».
Веб-дашборд: показывает партнёрам (риелторам) и руководителям Индекс
Развития (ИР), воронки покупателя/продавца, прогноз дохода/вала, позицию в
светофоре, персональные рекомендации, задачи.

Автор/заказчик: **Бондарчук Егор** (код в системе **27890**, роль aup).
Общение — на русском, он не программист, объясняй просто.

Оркестрирует «**Коля**» (Claude в чате у Егора) — пишет ТЗ (файлы
`~/Downloads/TZ-*.md`). Я («**Коля-код**», этот Claude Code) реализую.
Архитектурные решения и формулы — через Колю/Егора, сам не выдумываю.

**Цель спринта:** демо на слёте РОПов/МОПов ~1-3 июня 2026, город Тюмень,
реальные данные.

**Стек:** статический фронт (HTML + ванильный JS, без сборки/фреймворков,
графики — самописный SVG, НЕ Chart.js), хостинг GitHub Pages; бэкенд —
Firebase Cloud Functions Gen2 (Node 22) + Realtime Database + Auth.

---

## 2. Ресурсы

- **Репозиторий фронта (этот):** `/Users/egor/prognoz-dashboard` →
  GitHub `evbondarchuk-png/prognoz-dashboard`, сайт **https://prognoz.info**
  (резерв `evbondarchuk-png.github.io/prognoz-dashboard`).
- **Репозиторий функций:** `/Users/egor/prognoz-functions` (НЕ в git фронта;
  деплой `firebase deploy --only functions:ИМЯ`).
- **Firebase:** проект `prognoz-archive`, регион `europe-west1`,
  RTDB `https://prognoz-archive-default-rtdb.europe-west1.firebasedatabase.app`.
- **Web config** (публичный, в коде): apiKey
  `AIzaSyCOSLUKCQMhV4HL5Rgle38e3NHeZis6wyU`, authDomain
  `prognoz-archive.firebaseapp.com`, projectId `prognoz-archive`,
  appId `1:47892435250:web:2efc1123c3191ce556472b`.
- **Экспорт боевой базы:** `~/Downloads/prognoz-archive-default-rtdb-export (1).json`
  (для локальных проверок формул).
- **Выгрузки n8n (CSV):** прогноз/комиссии/чеки/воронки 12 мес —
  `~/Downloads/n8n Космос Прогноз клиентский Тюмень - data*.csv`;
  светофор — `~/Downloads/20.Распределение риэлторов по зонам светофора*.csv`.
- **Макет-эталон:** `~/Downloads/prognoz-vertikal_39.html`.

CDN self-hosted: Firebase SDK 10.7.0 + либы в `libs/` + import map
(gstatic→/libs/) — корпсеть «Этажей» режет gstatic/Cloudflare.

---

## 3. Файлы фронта

| Файл | Кабинет | view getDashboard |
|---|---|---|
| `login.html` | Вход (Email OTP) | — |
| `auth-guard.js` | Защита, роли, canRead | — |
| `index.html` | **Партнёр** (realtor) | `partner` |
| `mop.html` | **Старший партнёр** (mop) | `group` |
| `rop.html` | **Управляющий партнёр** (rop) | `department` |
| `aup.html` | **АУП** (aup) | `company` |

`*.legacy.html`, `index.pre-tabs.html` — бэкапы (в .gitignore, не в репо).

Все 4 кабинета — единый стиль макета (холодная сине-серая палитра, верхние
табы-пилюли, адаптив до 1080px → 2 колонки). Drill-down:
aup → `rop.html?rop=` → `mop.html?mop=` → `index.html?agent=`.
Просмотр чужого через `?agent=/?mop=/?rop=` (canRead в auth-guard).

**Роли (UI):** realtor=«Партнёр», mop=«Старший партнёр»,
rop=«Управляющий партнёр», aup=«АУП». Все роли лично продают → у каждого
есть личный план/воронка (руководитель виден в своей группе «справочно»).

---

## 4. Бэкенд — Cloud Functions (на проде, europe-west1)

В `/Users/egor/prognoz-functions/functions/`. Чистая логика — в `lib/`
(plan, ir, funnels, forecast, stretch, zones, coach, aggregate, archive,
activity, autocele, labels, dates) — гоняется локально, сверяется тестами.

- **Auth:** requestOtp, verifyOtp, cleanupExpiredOtps (НЕ трогать).
- **Кабинет:** `getDashboard` (единый эндпоинт, view partner/group/department/company).
- **План/цели:** calculatePlan, recomputePlansAdmin, setGoal, assignAutoGoals(+Admin).
- **Ночной/ИР/прогноз:** nightlySnapshot(+Admin) → /funnels, /snapshots, /forecast, /system/totals.
- **Агрегаты:** recomputeIRGroups, recomputeIRDepartments, recomputeAggregatesAdmin.
- **Диагностика:** runCoach(+Admin), auditCoachCodes.
- **Задачи:** createTask, updateTaskStatus, updateTaskProgress, expireTasks,
  markNotificationsRead, backfillTaskAuthors.
- **Сценарии:** runScenariosDaily(+Admin), cleanupScenarioTasksAdmin.
- **ИИ-тренер (YandexGPT / OpenRouter):** `generateAiCoachBatch` (onCall admin/aup,
  ручной запуск), `aiCoachStatus` (диагностика). Авто-прогон `generateAiCoachNightly`
  **УДАЛЁН 2026-06-01** (код закомментирован в `aiCoach.js`, легко вернуть).
  Провайдеры: openrouter (deepseek-v4-pro дефолт) / yandex / synthetic.
  Секреты `YANDEX_API_KEY`/`YANDEX_FOLDER_ID`/`OPENROUTER_API_KEY`.
- **Архив (разовые):** `zeroizeArchiveCurAdmin`, `restoreArchivePartialAdmin` —
  обнуление/восстановление cur-полей в архиве конкретной даты. **Не использовать
  на 1-м числе месяца** (см. §10 — мы наступили на эти грабли).
- **Разовые/демо:** backfillHistoryAdmin, recomputeSvetoforZonesAdmin.

Все `*Admin` — onCall, `cors:true`, только admin/aup, вызываются из консоли
браузера на prognoz.info. **Правило admin-функций:** cors:true + НЕ читать
большие ветки целиком (OOM/503 на авторизованном пути), прогресс — лёгкими маркерами.

---

## 5. Ключевые структуры RTDB

- `/users/{код}` — name, email, role, mopCode/ropCode, subordinates,
  position_in_company, svetofor_zone_id, **svetofor_pool** (newbie/experienced),
  stazh_months, city_id, is_active.
- `/archive/{YYYY-MM}/{дата}/agents/{код}/` — ночной снимок n8n:
  `b/`,`s/` (результирующие 12 мес — для воронки «Тренер»), `bL/`,`sL/`
  (опережающие: closedCur, fcstCur, fcstNext, actONCur — остаток ОН…),
  `comm/` (личные чеки), `commAvg/` (чеки 12 мес), `commFact/` (реальные
  комиссии тек.мес до рубля), income. Свежая дата: `/index/latest/date`.
  ✅ С 2026-05-28 архив наполняется **автоматически каждую ночь** (Apps Script
  `archiveToday`, 03:30 МСK) — см. раздел 7. Ручные заливки CSV больше не нужны.
- `/plans/{код}/{plan_id}` — months[1..6] (norms+income), target_zone_id,
  plan_formula_version (`a8v6_buyermult1` — с 2026-05-31), stretch{}.
- `/goals/{код}/active` — target_revenue_month, is_auto.
- `/forecast/{код}/current` — current_month/next_month/two_mo + seg_* + cycle_progress.
- `/snapshots/{код}/{дата}` — ir_*, funnels-мин, position, svetofor_pool;
  месячные точки `{YYYY-MM-01}` = история светофора (seeded:false=реальная).
- `/aggregates/{group|department}/{код}/{дата}` — ir_*, breakdown, forecast.
- `/coach/{код}/current` — buyer/seller {code, bits, variant_data из справочника}.
- `/ai_coach/{код}/current` — {coach_text, motivator_text,
  coach_brief_for_manager, mode, generated_at, model}; `/prev` — предыдущая
  версия. Пишет generateAiCoachBatch.
- `/config/ai_coach/enabled` — kill-switch для будущего автопрогона (сейчас
  `false`, крон удалён 2026-06-01). Если когда-нибудь вернём `generateAiCoachNightly`,
  этот флаг + `pilot_rop` / `scope` / `provider` / `model` управляют им без передеплоя.
- `/tasks/{id}` (author_label!), `/notifications/{код}/items` + `/meta`.
- `/data_division/cities/tyumen/` — zones (24, с range_start/end + конверсии +
  доход), avg_commission_by_segment, benchmark_conversions.
- `/vocabularies/voc_1_pokupatel|voc_2_prodavec/variants/{код}` — тексты по coach-коду.
- `/system/totals/tyumen` — пулы светофора (experienced/newbie/total).

---

## 6. Бизнес-логика (как считаем)

- **ИР:** 4 этапа/сторону, 3 вида метрик — `act` (поток/горячие покупателя,
  ÷план×2), `snapshot` (объекты/горячие продавца = **ОСТАТОК** в работе,
  ÷план), `cur` (задатки/доход, ÷план×дни/всего).
- **План (a8v6, с 2026-05-31):** дельта (B−A)×коэф+A. Покупатель ×1 (как у
  продавца — раньше было ×10/3, решение Егора «не раздувать»). Объекты продавца
  = целевой ОСТАТОК. Округление целое (0.5→1). Задатки ≥ сделок в показе.
  Версия в `calculatePlan.js`: `PLAN_VERSION = 'a8v6_buyermult1'`.
- **Вал/доход:** факт-вал = реальные комиссии (`commFact`); прогноз =
  прогнозные сделки × чек. **Чек личный** (commAvg), городской если
  отклонение >30% или нет данных (План А). **Доход = вал × 0.48.**
  Партнёру показываем вал + «≈ ЗП»; руководителям — только вал.
  **Единый источник факта-вала ВЕЗДЕ** (риелтор, ИР, агрегаты МОП/РОП) —
  `commFact`. `lib/funnels.js` собирает revenue ТОЛЬКО из commFact, без
  расчёта сделки×чек, иначе шапка и карточки разъезжаются.
- **Автоцель:** max(доход+50к, пол mid_401_500, **доход следующей зоны**
  светофора) — застрявших лидеров своей зоны тянем в следующую.
  `assignAutoGoalsAdmin({reassign:true})` — переназначить существующие.
- **Стретч-план (TZ-A18):** если цель выше текущей зоны — рост через
  подтяжку конверсии к эталону (benchmark_conversions), остаток потоком.
  UI-блок рычагов убран; данные `plan.stretch` — для ИИ-тренера.
- **Светофор:** 2 независимых пула — новички (~300) и опытные (~900),
  место внутри пула. Опытные — 24 зоны из data_division. График движения
  6 мес (SVG, цвет по пулу, переход помечен).
- **Тренер:** диагностика по текущей зоне (coach) + 2-й блок по целевой
  зоне (coach_target на лету) + воронка 12 мес (стиль работы).
- **ИИ-тренер (YandexGPT Pro):** 1 вызов → 3 текста: `coach_text` (партнёру),
  `motivator_text` (живая поддержка с эмоциями), `coach_brief_for_manager`
  (200 симв «он/она + что делать руководителю»). Режим по силе:
  top/mid/lagging/newbie — топу про целевую зону, отстающему 1-2 фокуса.
  Жёсткий гард: модель НЕ выдумывает числа, только из входных. Рельсы =
  variant_data из /vocabularies (пересказ, не искажение).
- **Карточки команды (МОП/РОП, A20):** `team_cards.members[]` с аватаром,
  риск-бейджем (🐆/🐇/🐢), выжимкой тренера, 6 метриками. `coach_short`
  всегда непустой: ИИ-brief → recommendation_for_realtor → autoBrief.

---

## 6.1. Авто-роутинг логина (auth-guard.js)

Firebase сохраняет сессию локально → большинство входов идут НЕ через OTP.
При возврате на `prognoz.info` пользователь попадает на `index.html`. Если
роль `mop/rop/aup/admin` и нет явного `?agent=...`, `requireAuth`
автоматически кидает на `mop.html`/`rop.html`/`aup.html`. Свой риелторский
кабинет руководители открывают через `index.html?agent=<свой_код>`.

---

## 7. Как раскатывать (Егор, консоль prognoz.info под АУП)

Импорт firebase-app/functions, `getFunctions(getApp(),'europe-west1')`,
`httpsCallable(fns,'ИМЯ',{timeout:540000})({})`. Порядок при правках расчётов:
**recomputePlansAdmin → nightlySnapshotAdmin → recomputeAggregatesAdmin**.
nightly идемпотентен (если браузер оборвёт соединение — функция дорабатывает
на сервере, повтори). Данные я могу заливать сам через firebase CLI
(`database:get` / `database:update -f`, чанками, retry при временных ошибках).

**Консоль Егора:** длинные однострочники с русским текстом рвутся при
копировании (перенос → SyntaxError). Давай короткие строки без переносов
внутри строковых литералов.

**Ночное автообновление данных (с 2026-05-28).** Лист n8n «data» (Google-таблица,
проект Apps Script `prognoz-archive`, файл `archive.gs` v3.1) заливается в архив
сам: триггер `archiveToday` в **03:30 МСК** (n8n заканчивает к 03:00 МСК, ночные
функции стартуют в 05:00 МСК — окно безопасно). Пишет все столбцы 0–220:
`b/ s/` (12 мес), `bL/ sL/` (опереж.), `commAvg` (=столбцы 11–19), `commFact`
(=212–220), income; `sL.actONCur` = ОСТАТОК ОН из 12-мес блока (столбцы 86…),
`growCur` = набранные за месяц. Авторизация записи — через `DD_getToken_`/`DD_put_`
из файла `data_division.gs` того же проекта (прямой PUT без токена → 401, из-за
чего старый v3 по триггеру не отрабатывал). Менять время: цифра `atHour()` в
`setupNightlyTrigger` → перезапустить функцию. Детали — auto-memory
`reference_archiver_apps_script.md` и `project_nightly_data_cycle.md`.
Дальше досчитывают ночные кроны: nightlySnapshot 05:00 МСК → recomputeIRGroups/
Departments. **Планы a8v5 ночью НЕ трогаем** — пересчёт ручной (recomputePlansAdmin);
но `setGoal` пересчитывает план конкретного партнёра сразу при смене ЗП.

---

## 8. Принципы работы

- **Язык — русский**, объясняй просто.
- **Шаг за шагом**, показывай результат, коммить осмысленно.
- **Не ломать работающее** (авторизация/OTP — не трогать).
- **Не «чинить» дефекты данных в коде** — сообщать Егору/Коле. (Пример:
  поле `conv_flow_to_hot` в зоне битое → конверсию поток→горячие считаем
  сами как hot/flow.)
- **Перед деплоем:** `node --check` + smoke (`test/smoke-*.js`,
  `verify-patch.js` — 24 эталонных числа должны оставаться зелёными).
- Стиль — ванильный JS, без усложнений, как в существующих файлах.
- НЕ параллелить много мутаций одного файла + perl-замены (каскадные отмены) —
  Edit последовательно.
- `git add` конкретными файлами (не `-A` — затягивает .DS_Store/бэкапы).

---

## 8.2. Трёхчастная воронка (TZ-A26 — ВНЕДРЕНА 2026-05-31)

Единый визуал «факт / прогноз / план» во всех 4 кабинетах + раскрытие
сегментов с компактной полосой. Файл-эталон макета:
`~/Downloads/MOCKUP-design-v53_1.html`.

Правила:
- **Прогноз — только для денег.** Этапы Сделки + Валовая выручка
  трёхчастные (fact+forecast+plan). Поток/Горячие/Задатки/Объекты —
  двухчастные (fact+plan).
- **Прогноз = ПРИРАЩЕНИЕ остатка месяца** («+X к», 2026-06-01), не итог.
  Если `forecast > fact` — в подписи «прогноз +86к», в оранжевой полосе
  «+30%». Если `forecast == fact` (всё закрыто) или null — показываем
  только «факт / план» без прогноза. Полный вал всё равно виден по полосе.
- **Цвет скобки этапа = статус выполнения:** `s-done` (зелёная,
  fact≥100%), `s-forecast` (оранжевая, fact<100% но fact+forecast≥100%),
  `s-pending` (серая, иначе). Старая логика «синий покупатель / зелёный
  продавец / золотой доход» удалена.
- **Полоса** = зелёная (fact, подпись «N%») + оранжевая (forecast-fact,
  подпись «+N%») + серый остаток. Проценты внутри зон, при узких (<12%)
  выносятся справа.
- **План — полный месячный** (не пропорциональный к дате). Старая
  пропорция к дате осталась в `progress_pct` для совместимости с ИР.
- **Tooltip:** зелёная — «факт N — N% от плана M»; оранжевая —
  «прогноз X — +D% к плану M (итого K%)».
- **Парная сетка покуп ↔ прод** (2026-06-01): этапы рендерятся через
  `funnel-grid-paired` (2 кол. × N рядов), каждый i-й этап покупателя
  выровнен с i-м этапом продавца через `align-items:stretch`.
  `renderFunnelsPaired` (партнёр) / `renderAggFunnelsPaired` (МОП/РОП/АУП).

Где живёт логика:
- CSS `.funnel-stage`/`.fp-bar`/`.hero-stat-fpf-*` — во всех 4 файлах.
- JS-утилиты `calcStatus`, `calcBarPercents`, `renderFpBar`, `renderStage`
  — во всех 4 файлах.
- Бэк `buildIncomeStage` (партнёр) и `lib/aggregate.js.buildIncomeStage`
  (агрегаты) отдают `forecast`/`forecast_label` для income stage.
- `stageCard`/`aggStageCard` стали wrapper'ами над `renderStage`,
  раскрытие сегментов сохраняется (для income — список сделок).
- Hero «Валовая выручка» у МОП/РОП/АУП — компактная `fp-bar.sm`
  через `heroRevenueBar(a)`. Партнёрский Hero пока на старой структуре.

---

## 8.1. Дизайн-система (TZ-A22 — ВНЕДРЕНА 2026-05-30)

Единая палитра + шкалы (`:root` одинаков в 5 файлах + login.html).
Токены: `--ok/warn/bad`, `--r-xs..xl/--r-pill`, `--sp-1..7`, `--fs-11..28`,
`--fw-r/m/sb/b/eb`. Старые `--st-green/--st-yellow/--st-red/--surface2`
больше не использовать — переименованы.

Единые компоненты: `.member-row` (карточка команды у МОП/РОП/АУП —
тот же шаблон везде через `teamCardHTML`), `.ai-card` (тёмный, на Главной),
`.member-coach` (светло-фиолетовый, инлайн в карточке), `.btn-primary/
secondary/danger/icon`, `.badge + .badge-ok/warn/bad/nd/info`, `.hero +
.hero-stats` (алиасы `.card`+`.stat-grid`).

Словарь эмодзи (1 эмодзи = 1 смысл): табы 🏠📈🎓👥📋🚦, статусы 🟢🟡🔴,
лидер 🐆, средний 🐇, отстающий 🐢, ИИ ✨, тренер 🎓, помощь 💬,
календарь 📅. Запрещены 🟠🥇🥈🚀🔥🤖🆘 и др.

Числа: единый `fmtNumber()` — запятая вместо точки, шкала `тыс/к/млн`,
проценты слитно, валюта только `₽` (см. файл функции в каждом из 5 HTML).

---

## 9. Открытые задачи / на потом

- **ИИ-тренер (TZ-6.2/6.3):** ✅ развёрнут. **Только ручной запуск** через
  `generateAiCoachBatch({mop_code|rop_code|user_codes, provider?, dryRun?})`
  из консоли под АУП. Авто-прогон `generateAiCoachNightly` **удалён 2026-06-01**.
  ⚠️ dryRun ТОЖЕ тратит токены у LLM-провайдеров; провайдер `synthetic` бесплатный.
  Статус OpenRouter-ключа на 2026-06-01: **исчерпан** (`Key limit exceeded`),
  обновляем 03.06 перед слётом. Подробнее — auto-memory
  `reference_yandexgpt_ai_coach.md` и `project_ai_tokens_status.md`.
- **Тестовые задачи** (`related_scenario_id: test_seed`) — убрать перед демо
  (висят у всех для проверки отображения; чистка — отдельной командой).
- **Сценарии задач** (ir_dropped_2w/objects_below_norm/no_deals_30d) —
  развёрнуты, заработают по мере накопления дневных снапшотов (нужна история d7/d14/d30).
- **Прогноз на 2 месяца** — виджет убран (формула не готова).
- **Клиенты/CRM** — анонс-заглушка (запуск 01.07.2026).
- В источнике n8n/таблице починить поле `conv_flow_to_hot` зон.

---

## 10. Месячный переход — НЕ лечить архив руками

**Проблема (2026-06-01):** на 1-е число месяца n8n не обнуляет `cur`-поля в листе
`data` — архиватор записывает в `/archive/2026-06-01/` те же майские значения.
Кабинет показывает май целиком под подписью «за июнь».

**Что я попробовал и почему НЕ повторять:** обнулил все `cur`-поля через
`zeroizeArchiveCurAdmin`. Поломалось:
- «Мой средний доход» = 0 (UI читает `income`, обнулили).
- Прогноз на след.месяц (июль) = `—` (обнулили `bL/sL.fcstNext`).
- Темп потока 2 мес обнулился (обнулили `flowAct`).
Откатили через `restoreArchivePartialAdmin({to_date,from_date})`.

**Причина:** в `bL/sL` смешаны поля разной семантики:
- «Сделки месяца» (`closedCur, depCur, growCur, commFact, income`) — обнулять
  на 1-м числе семантически ОК.
- «Снимки / прогнозы / темп» (`fcstCur, fcstNext, flowAct, hotAct, hotONCur,
  actONCur`) — НЕ обнулять.

**Правильная стратегия:** на 1-м числе **ничего не делать**. Кабинет покажет
«как на конец предыдущего» — это нормально. Ночью n8n обновит, утром 2-го
числа всё станет правильным. Если UX-критично — переименовать UI-лейблы.

Функции `zeroizeArchiveCurAdmin` / `restoreArchivePartialAdmin` остаются
развёрнутыми как kill-switch (`functions/zeroizeArchive.js`).
