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
  ⚠️ Архиватор обновляет нерегулярно (последняя ~2026-05-15); данные n8n
  (прогноз/чеки/доход/остаток ОН) я заливал в архив из CSV вручную.
- `/plans/{код}/{plan_id}` — months[1..6] (norms+income), target_zone_id,
  plan_formula_version (`a8v5_stretch`), stretch{}.
- `/goals/{код}/active` — target_revenue_month, is_auto.
- `/forecast/{код}/current` — current_month/next_month/two_mo + seg_* + cycle_progress.
- `/snapshots/{код}/{дата}` — ir_*, funnels-мин, position, svetofor_pool;
  месячные точки `{YYYY-MM-01}` = история светофора (seeded:false=реальная).
- `/aggregates/{group|department}/{код}/{дата}` — ir_*, breakdown, forecast.
- `/coach/{код}/current` — buyer/seller {code, bits, variant_data из справочника}.
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
- **План (a8v5):** дельта (B−A)×коэф+A. Покупатель ×10/3 (план=норма зоны).
  Объекты продавца = целевой ОСТАТОК. Округление целое (0.5→1).
  Задатки ≥ сделок в показе.
- **Вал/доход:** факт-вал = реальные комиссии (`commFact`); прогноз =
  прогнозные сделки × чек. **Чек личный** (commAvg), городской если
  отклонение >30% или нет данных (План А). **Доход = вал × 0.48.**
  Партнёру показываем вал + «≈ ЗП»; руководителям — только вал.
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

## 9. Открытые задачи / на потом

- **YandexGPT (ТЗ-6):** ИИ-тренер поверх справочника, прогон на отделе
  Колмогоровой (~150₽). Нужен `YANDEX_API_KEY` в Secret + generateAiCoachBatch.
  Промпты пишет Коля.
- **Тестовые задачи** (`related_scenario_id: test_seed`) — убрать перед демо
  (висят у всех для проверки отображения; чистка — отдельной командой).
- **Сценарии задач** (ir_dropped_2w/objects_below_norm/no_deals_30d) —
  развёрнуты, заработают по мере накопления дневных снапшотов (нужна история d7/d14/d30).
- **Прогноз на 2 месяца** — виджет убран (формула не готова).
- **Клиенты/CRM** — анонс-заглушка (запуск 01.07.2026).
- В источнике n8n/таблице починить поле `conv_flow_to_hot` зон.
