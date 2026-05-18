# Структура проекта «Прогноз»

Справочник по схеме Firebase RTDB и файлам репозитория. Дополняет `CLAUDE.md` (там — формула ИР, рабочие принципы, открытые вопросы).

---

## Firebase RTDB

- **URL:** `https://prognoz-archive-default-rtdb.europe-west1.firebasedatabase.app`
- **Проект:** `prognoz-archive`, регион `europe-west1`

### `/users/{код}` — пользователи (залито, 3127 записей)

| Поле | Тип | Описание |
|---|---|---|
| `name` | string | ФИО |
| `email` | string | Корпоративный email (для OTP) |
| `role` | string | `realtor` / `mop` / `rop` / `aup` / `admin` |
| `mopCode` | string \| null | Код МОПа (только у `realtor`) |
| `ropCode` | string \| null | Код РОПа (у `realtor` и `mop`) |
| `subordinates` | `{код: true, ...}` | Подчинённые (у `mop` и `rop`) |
| `seesAll` | bool | `true` только у `aup` |
| `createdAt` | timestamp | Создание записи |
| `lastLoginAt` | timestamp | Последний вход (ставится при логине) |

Доп. индекс: `/users/.indexOn = ["email"]`.

### `/archive/{YYYY-MM}/{YYYY-MM-DD}/` — ежедневный снимок

Пишется ночью Google Apps Script-архиватором (живёт вне этого репо).

#### `meta`
Открыт на чтение любому авторизованному (используется для зонда даты последнего снимка):
- `agentsCount`, `date`, `timestamp`, `version` (= `"3.0"`), `yearMonth`

#### `agents/{код}/` — данные риелтора в этот день

**Шапка:**
- `name` (ФИО), `mop`, `rop` — **ФИО-строки** (НЕ коды!)
- `position` (число позиции в светофоре)
- `stazh` (стаж в месяцах)
- `income` (доход за месяц)
- `adCost` (расходы на рекламу)
- `avgCheck` (средний чек)
- `prod` (продуктивность — **считает только покупательскую сторону**, равен `b.all.deals`)
- `division` (строка зоны: `"401-500"`, `"ТОП 1-5"`, `"без светофора"`, …)

**`comm/`** — комиссии: `bNew`, `bSec`, `bOut`, `bComm`, `bGar`, `sSec`, `sOut`, `sComm`, `sGar`.

**`b/{сегмент}/`** — покупатель, результирующие за 12 месяцев (11 метрик):
- `flow` (вх. поток), `flowPct` (доля сегмента в потоке)
- `hot` (горячие), `dep` (задатки), `deals` (сделки), `mortgage` (ипотека)
- `convHot`, `convDep`, `convFS`, `convHS`, `convDS` — конверсии

**`bL/{сегмент}/`** — покупатель, опережающие (6 метрик):
- `flowAct`, `hotAct`, `depCur`, `fcstCur`, `fcstNext`, `closedCur`

**`s/{сегмент}/`** — продавец, результирующие (12 метрик):
- `actON` (активных ОН в базе), `growON` (прирост/мес)
- `hotPer` (горячих ОН), `hotCur`, `hotPct`, `dep`, `deals`
- `convHot`, `convDep`, `convDSA`, `convDSH`, `convDSD`

**`sL/{сегмент}/`** — продавец, опережающие (6 метрик):
- `actONCur`, `hotONCur`, `depCur`, `fcstCur`, `fcstNext`, `closedCur`

**Сегменты:** `all`, `new` (только покупатель), `sec`, `out`, `com`, `gar`.

### `/data_division/{зона}/{вид}/{сегмент}/{метрика}` — нормативы

⚠️ **Ещё НЕ залит.** Сейчас нормативы в `ir.js` как заглушка `STUB_NORMATIVES`, точка замены — `getNormatives(zone)`.

Когда зальют: `{вид}` = `b`|`s`, `{зона}` — нормализованный ключ (`ТОП 1-5` → `TOP_1-5`, пробелы/точки → `_`), плюс `GOROD`.

Чтение разрешено любому авторизованному.

### `/otp` и `/rate_limit` — служебные, закрыты полностью

---

## Firebase Rules (упрощённо)

- `/users/{$код}` — read если `auth.uid == $код` ИЛИ `admin`/`aup` ИЛИ `$код in subordinates` читающего. Write — только `admin`.
- `/archive/.../agents/{$код}` — read по той же логике.
- `/archive/.../meta` — read любой авторизованный.
- `/data_division/*` — read любой авторизованный. Write — только `admin`.
- `/otp`, `/rate_limit` — закрыты полностью.

⚠️ Текущее ограничение: РОП имеет в `subordinates` только МОПов. Риелторы под МОПами недоступны → для `rop.html` потребуется расширение Rules (двухуровневая проверка).

---

## Файлы репозитория

Репо: `evbondarchuk-png/prognoz-dashboard`. Хостинг: GitHub Pages (домен `prognoz.info`), главная ветка `main`.

| Файл | Назначение | Статус |
|---|---|---|
| `CLAUDE.md` | Контекст проекта для Claude (читается автоматически) | актуальный |
| `STRUCTURE.md` | Этот файл — справочник по RTDB и файлам репо | — |
| `CNAME` | Привязка домена `prognoz.info` | — |
| `login.html` | Страница входа (Email OTP) | работает |
| `auth-guard.js` | ES-модуль защиты страниц: `requireAuth({allowedRoles})`, `getCurrentUser`, `logout`, `canRead(user, agentCode, userData)`. Объект юзера: `{code, role, name, seesAll}` | работает, **не трогать** |
| `firebase-reader.js` | ES-модуль чтения архива: `getLatestSnapshotDate`, `getAgent(code, date?)`, `getUser(code)`, `getSubordinates(code, date?)` | работает |
| `ir.js` | ES-модуль расчёта ИР: `calculateIR(agent, normatives)`, `getNormatives(zone)`. Включает `STUB_NORMATIVES` | работает |
| `index.html` | Дашборд риелтора. Принимает `?agent=КОД` с проверкой `canRead`. Кнопка «← Назад к команде» | работает на реальных данных |
| `mop.html` | Дашборд менеджера. Сводка группы, таблица команды (МОП в ней первой строкой с пометкой «вы»), donut по светофору. Клик по строке → `index.html?agent=КОД` | работает на реальных данных |
| `firebase-test.html` | Служебный отладочный инструмент | вспомогательный |

---

## Что использует проект, но НЕ хранится в этом репо

- **Cloud Functions** (`requestOtp`, `verifyOtp`, `cleanupExpiredOtps`) — задеплоены в Firebase Functions, кодовая база у Егора отдельно. **Не трогать.**
- **Архиватор** — Google Apps Script, который каждую ночь пишет снимок в `/archive/`. Тоже отдельно от репо.
- **Скрипт миграции `/users/`** — был одноразовый, в репо его нет. Работал по неполному источнику — отсюда блокер с пропущенными риелторами (см. `CLAUDE.md §9`).
