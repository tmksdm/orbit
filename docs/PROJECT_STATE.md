# PROJECT_STATE.md — журнал состояния проекта

Правило: сюда пишем только ПРОВЕРЕННЫЕ факты (что реально работает, что зелёное),
каждая запись датирована. Агент читает этот файл первым и обновляет после каждого
законченного этапа (см. `AGENTS.md`).

Агенту в новом чате: этот файл — точка входа. «Текущее состояние» и последняя
запись журнала = что делаем и куда дальше; затем `AGENTS.md` (правила) и
`docs/SYNC.md` (обмен файлами, раздел «Новый чат с агентом»).

## Текущее состояние (2026-10-08)

- **Stage 1 (Domain Model & Scheduling Algorithm):** accepted внешним ревью (2026-10-08, коммит `714e0686`) и **approved в актуализированном виде** (коммит `37fb8070`): механика MVP утверждена — `INITIAL_INTERVAL_DAYS = 2`, `no_reply` ×2.0, накопительно (`2 → 4 → 8 → 16 → 32 → 64`); остальные правила Stage 1 без изменений.
- **Stage 2 (Data Layer):** **APPROVED** внешним ревью (2026-10-08, коммит `03ba38db8bbfeabb1d60e5507e31cdaa93f4c5a7`): BLOCKER-01 (изоляция SQLite-транзакций через `withExclusiveTransactionAsync` + `tx`), MINOR-01 (README) и MINOR-02 (REVIEW_REPORT) закрыты, ошибка `TS2322` устранена; GitHub Actions (lint/typecheck/tests) — SUCCESS. Ограничение: работа нативного `expo-sqlite` на Android пока не проверена — включена в Stage 3.
- **Текущий Stage:** Stage 3 — первый UI на Android. Статус: план `docs/plans/stage-3-ui.md` — **DRAFT v2** (учтены утверждённые решения владельца и замечания ревью REVIEW-01/02/03), ожидает **повторного внешнего ревью и утверждения**; реализация не начата.
- **Следующий шаг:** повторное внешнее ревью обновлённого DRAFT-плана, затем утверждение владельцем; далее UI/UX-фаза (OpenDesign) и реализация.
- **Утверждённые решения Stage 3 (2026-10-08):** (1) due = `referenceDate + recommendedIntervalDays`, reference = последнее взаимодействие или `createdAt`, новое поле `createdAt` + миграция схемы v2; (2) порядок: due сверху, остальные ниже; (3) стратегия выбирается пользователем явно (без дефолта); (4) `occurredAt` = сейчас (ISO 8601); (5) редактирование/удаление вне scope; (6) UI — русский, идентификаторы — английские.
- **Открытые вопросы:** блокирующих нет; стартовый интервал закрыт (= 2 дня). Открытые вопросы Stage 3 — в `docs/plans/stage-3-ui.md`.

## Дорожная карта

1. **Stage 2 — Data Layer:** порты репозиториев + Expo SQLite + миграции — **APPROVED** внешним ревью 2026-10-08 (коммит `03ba38db`); план: `docs/plans/stage-2-data.md`.
2. **Stage 3 — Первый UI на Android:** добавление контактов, фиксация взаимодействий и экран «с кем пора связаться»; UI/UX-фаза с OpenDesign (инструмент дизайна, не runtime-зависимость). План `docs/plans/stage-3-ui.md` — **DRAFT, ожидает утверждения**. Отдельного инфраструктурного этапа между Stage 2 и Stage 3 нет. Не начат.

## Что готово (Stage 0)

- Каркас Expo + React Native + TypeScript (Expo SDK 57, expo-router): один
  placeholder-экран `src/app/index.tsx` («Orbit», Stage 0) и `src/app/_layout.tsx`.
- TypeScript strict + `noUncheckedIndexedAccess`.
- Тулинг: ESLint (`eslint-config-expo` + `eslint-config-prettier`), Prettier;
  команды `npm run lint`, `npm run typecheck`, `npm test` — проверены, зелёные.
- Jest + jest-expo + React Native Testing Library; smoke-тест placeholder-экрана
  (`__tests__/index.test.tsx`).
- Структура слоёв: `src/{domain,data,services,features,ui}`; `domain` заполнен
  на Stage 1, остальные — пустые каталоги с `.gitkeep`.
- Документация: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `docs/PRODUCT.md`,
  `docs/DOMAIN.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/SYNC.md`,
  ADR `docs/decisions/001-local-first.md`, `docs/plans/TEMPLATE.md`,
  `docs/plans/stage-1-domain.md` (draft, не выполняется).
- Синхронизация: `tools/sync/make_patch.sh`, протокол — `docs/SYNC.md`.
- CI: `.github/workflows/ci.yml` — lint/typecheck/test на PR в `main` и push в `main`.
- Git: `main` (коммит каркаса) + ветка `chore/project-foundation` (все изменения
  Stage 0). Push не выполнялся — у среды нет доступов.

## Что готово (Stage 1 — принят внешним ревью 2026-10-08)

- Доменный слой `src/domain/{types,scheduling,contact}.ts`: чистый TypeScript без
  React / Expo / SQLite / UI; иммутабельный `Contact`
  (`id, name, note?, strategy, minIntervalDays, recommendedIntervalDays`);
  детерминированный пересчёт `computeNextIntervalDays`; таблица утверждённых
  множителей `INTERVAL_MULTIPLIERS`.
- `Interaction` — отдельная domain-сущность; `recordInteraction` пересчитывает
  `recommendedIntervalDays` и не хранит событие в Contact (историю будет хранить
  слой данных на Stage 2).
- Тесты: 30 domain-тестов (`src/domain/__tests__/scheduling.test.ts`) + 1 smoke
  Stage 0 = 31 total, 2 suites.
- Утверждённые scheduling-правила: множители `1.4 / 1.7 / 1.0 / 0.8`, `min = 2`,
  отсутствие `maxIntervalDays`. По approved product decision 2026-10-08:
  стартовый интервал нового контакта = 2 дня; `no_reply` = ×2.0 (приоритет,
  накопительно — `2 → 4 → 8 → 16 → 32 → 64`).

## Что готово (Stage 2 — APPROVED внешним ревью 2026-10-08, коммит `03ba38db`)

- Порты репозиториев `src/domain/ports.ts` (`ContactRepository`,
  `InteractionRepository`) — чистый TypeScript, без импортов React / Expo /
  react-native / SQLite / UI.
- `src/data`: минимальный драйвер `SqlDatabase` (`sqlDatabase.ts`; `transaction`
  передаёт транзакционный контекст `tx`), продовый драйвер `expoSqliteDriver.ts`
  поверх `expo-sqlite` с **эксклюзивной транзакцией**
  (`withExclusiveTransactionAsync`, запросы идут через `txn`), миграции
  (`migrations.ts`, forward-only, `PRAGMA user_version`), репозитории
  (`contactRepository.ts`, `interactionRepository.ts`), сборка слоя
  (`dataLayer.ts`) и точка входа `index.ts` (`openOrbitDatabase`).
- Обязательные уточнения владельца: (1) фиксация взаимодействия — unit-of-work
  `interactionRecorder.ts` — пишет `Interaction` и обновлённый `Contact`
  атомарно в одной **эксклюзивной** транзакции (запросы через `tx`); (2) при
  открытии БД выполняется `PRAGMA foreign_keys = ON`.
- Тесты: 20 интеграционных тестов Stage 2 (`src/data/__tests__/*.test.ts`) на
  реальном `node:sqlite` через тестовый драйвер `src/data/testing/`
  (репозитории, миграции/идемпотентность, rollback, foreign keys, commit/rollback
  и изоляция параллельного соединения). Полный `npm test` — 51 тест (8 suites).
- Документация: `README.md` (Stage 2), `ARCHITECTURE.md` (раздел «Слой данных»),
  `docs/TESTING.md`, план `docs/plans/stage-2-data.md` (approved), этот файл.
- Непроверенное: поведение нативного `expo-sqlite` на устройстве (в песочнице
  нет Android/iOS) — ручной прогон на Stage 3.

## Проверенные факты

- Окружение: Node.js 22, npm 10; зависимости установлены из registry.npmjs.org.
- Стек: Expo SDK 57 (react-native 0.86, react 19.2, typescript ~6.0), expo-router,
  роуты в `src/app`.
- `npm run lint`, `npm run typecheck`, `npm test` выполняются успешно (2026-10-08).
- Слой данных (Stage 2): схема `contacts` / `interactions`, миграции forward-only
  (`PRAGMA user_version`), foreign keys включены при открытии, фиксация
  взаимодействия атомарна; зависимость `expo-sqlite ~57.0.4`.
- Stage 2 approved внешним ревью 2026-10-08 (коммит `03ba38db`); GitHub Actions
  (lint/typecheck/tests) на этом коммите — SUCCESS.
- UI контактов, уведомления, auth, backend, AI, cloud sync в репозитории
  отсутствуют (вне Stage 2).

## Журнал

### 2026-10-08 — Stage 3: DRAFT-план доработан по ревью и решениям владельца — агент

Владелец утвердил продуктовые решения Stage 3 и передал замечания ревью. Обновлён
`docs/plans/stage-3-ui.md` (**DRAFT v2**): зафиксированы решения владельца — (1) правило
due `nextDueDate = referenceDate + recommendedIntervalDays` (reference = последнее
взаимодействие или `createdAt`; поле `createdAt` + forward-only миграция v2), (2) порядок
списка (due сверху, внутри групп по `nextDueDate`, затем имя/`id`), (3) обязательный
явный выбор стратегии, (4) `occurredAt` = сейчас (ISO 8601) с тестируемым источником
времени, (5) без редактирования/удаления, (6) русский UI и английские идентификаторы.
Исправлены замечания ревью: **REVIEW-01** — корректный сценарий проверки сокращения
интервала (через последовательность взаимодействий, а не упор в минимум) + отдельный
тест нижней границы; **REVIEW-02** — проверка нативного `expo-sqlite` на Android
обязательна для приёмки, отсутствие Android у агента не даёт объявить проверку
выполненной; **REVIEW-03** — убран автоматический выбор `maintain`, стратегия
обязательна и проверяется тестом формы. В `docs/DOMAIN.md` добавлен отдельный раздел
«Правило «пора связаться» (due) — Stage 3» (правила Stage 1 не изменены). Код,
SQL-миграции, зависимости и тесты НЕ изменялись; миграция v2 только проектируется.
Проверки (2026-10-08): lint/typecheck чисто, тесты 51/51. Статус: план ожидает
повторного внешнего ревью; Stage 3 не начат.

### 2026-10-08 — Stage 2 APPROVED; подготовлен DRAFT-план Stage 3 — агент

Внешнее ревью подтвердило Stage 2 (коммит `03ba38db8bbfeabb1d60e5507e31cdaa93f4c5a7`):
BLOCKER-01, MINOR-01/02 закрыты, `TS2322` устранён, GitHub Actions (lint/typecheck/tests)
— SUCCESS; правила Stage 1 сохранены, Stage 3 не начинался. Stage 2 считается
завершённым (зафиксировано в этом файле и `REVIEW_REPORT.md`). Подготовлен
**DRAFT-план Stage 3** — `docs/plans/stage-3-ui.md` (первый UI на Android: список
«с кем пора связаться», добавление контакта, фиксация взаимодействия,
персистентность, проверка нативного `expo-sqlite`; UI/UX-фаза с OpenDesign как
инструментом дизайна, не runtime-зависимостью). Код Stage 2 не изменялся.
Реализация Stage 3 не начата; план и открытые вопросы ожидают утверждения
владельца. Проверки (2026-10-08): lint/typecheck чисто, тесты 51/51.

### 2026-10-08 — Stage 2: фикс CI (промах упаковки патча 20261008-02) — агент

После применения патча `20261008-02` CI упал: `src/data/testing/nodeSqliteDriver.ts(40,11):
error TS2322`. Причина — упаковочная: патч изменил контракт
`SqlDatabase.transaction(work: (tx) => …)`, но не содержал переписанный тестовый
драйвер `nodeSqliteDriver.ts` (в рабочем дереве агента он уже был исправлен).
На чистой сборке драйвер остался со старой сигнатурой → `TS2322`. Драйвер добавлен
в патч `20261008-03`; он передаёт в callback тот же (единственный) соединение-контекст
и обеспечивает реальную транзакционность (`BEGIN`/`COMMIT`/`ROLLBACK`, вложенность
без повторного `BEGIN`). Проверены все реализации `SqlDatabase.transaction` (прод,
тест, подменный в тесте) и места вызова. Правила Stage 1 и порты domain не
менялись; тесты не ослаблялись. Проверки (2026-10-08): lint/typecheck чисто,
тесты 51/51 (8 suites). Stage 2 не approved; Stage 3 не начат.

### 2026-10-08 — Stage 2: исправления по внешнему ревью (CHANGES REQUESTED) — агент

Внешнее ревью Stage 2 (коммит `d1f29a7`) вернуло CHANGES REQUESTED. Исправлено:
**BLOCKER-01** — изоляция SQLite-транзакций: `expoSqliteDriver.ts` переведён с
`withTransactionAsync` на `withExclusiveTransactionAsync`; `SqlDatabase.transaction`
передаёт транзакционный контекст `tx`, а unit-of-work фиксации взаимодействия
строит репозитории поверх `tx`, поэтому все запросы атомарной операции идут
внутри одной изолированной транзакции. Добавлены тесты: rollback на реальном
SQLite (сбой второго шага через триггер), проверка контекста транзакции, изоляция
незакоммиченной записи от параллельного соединения (файловая БД, два соединения).
**MINOR-01** — README переведён на Stage 2. **MINOR-02** — REVIEW_REPORT
актуализирован (HEAD/коммиты/состояние, убрано устаревшее «не закоммичено»).
Порты domain и правила Stage 1 не менялись. Проверки (2026-10-08): lint/typecheck
чисто, тесты 51/51 (8 suites). Stage 2 не approved; Stage 3 не начат.

### 2026-10-08 — Stage 2 (Data Layer) реализован — агент

Владелец утвердил план Stage 2 одним сообщением с двумя обязательными
уточнениями: (1) атомарная запись `Interaction` + обновлённого `Contact` в одной
SQLite-транзакции (+ тест rollback) и (2) явное `PRAGMA foreign_keys = ON` при
открытии БД (+ проверка). Уточнения внесены в план (approved) и реализованы.
Сделано: domain-порты `src/domain/ports.ts`; слой `src/data` — драйвер
`SqlDatabase` + `expo-sqlite`, миграции (`PRAGMA user_version`, forward-only),
репозитории, data-layer и unit-of-work фиксации взаимодействия; зависимость
`expo-sqlite ~57.0.4`. Тесты: 16 интеграционных на реальном `node:sqlite`
(репозитории, миграции/идемпотентность, rollback, foreign keys); полный
`npm test` — 47/47 (7 suites). Проверки (2026-10-08): lint/typecheck чисто.
Stage 2 ожидает внешнего ревью; Stage 3 не начат.

### 2026-10-08 — Stage 1 actualized APPROVED; план Stage 2 финализирован — агент

Владелец принял изменение Stage 1 (коммит `37fb8070`) и утвердил механику MVP:
`INITIAL_INTERVAL_DAYS = 2`, `no_reply` ×2.0, накопительно (`2 → 4 → 8 → 16 → 32 → 64`),
остальные правила Stage 1 — без изменений. Stage 1 в актуализированном виде approved.
План `docs/plans/stage-2-data.md` переведён в финальную версию: зафиксированы форма
портов (`ContactRepository`, `InteractionRepository` в `src/domain/ports.ts`), async
API, схема БД (`contacts`, `interactions`), миграции (`PRAGMA user_version`,
forward-only) и подход к тестам (тестовый драйвер `SqlDatabase`; приоритет —
встроенный `node:sqlite`, иначе in-memory). Реализация Stage 2 не начата — ожидает
отдельного approval. Дорожная карта: после Stage 2 идёт Stage 3 — первый реально
используемый UI на телефоне (вертикальный сценарий), без промежуточного
инфраструктурного этапа.

### 2026-10-08 — Stage 1 (Domain Model & Scheduling) — агент

Stage 0 approved владельцем (2026-10-08). Утверждённые правила (финальные
множители, накопление no_reply, отказ от maxIntervalDays, база = текущий
рекомендуемый интервал, min=2) зафиксированы в DOMAIN/PRODUCT/плане Stage 1.
Реализован доменный слой: `src/domain/{types,scheduling,contact}.ts` — чистый
TS, иммутабельный Contact, детерминированный пересчёт; 30 domain-тестов
(`scheduling.test.ts`), полный `npm test` — 31 тест (2 suites, + Stage-0 smoke).
Проверки (2026-10-08): lint/typecheck чисто, тесты 31/31 (2 suites).
Ветка `feat/stage-1-domain`, коммиты 80df9b9 / dffc56f / 2d0abec + отчёт.
Открытые вопросы: стартовый интервал (сейчас 7 дней), стадия для data layer.
Следующий шаг — внешнее ревью Stage 1. Stage 2 не начинался.

### 2026-10-08 — Product decision: стартовый интервал = 2, no_reply ×2.0 — агент

Approved product decision владельца (2026-10-08): стартовый интервал нового
контакта без истории — `INITIAL_INTERVAL_DAYS = 2` (теперь approved product rule,
а не временный default); множитель `no_reply` изменён с `×2.2` на `×2.0` (при
любом initiator и обеих стратегиях; накопительно — применяется к текущему
recommended interval). Последовательность: `2 → 4 → 8 → 16 → 32 → 64`.
Остальные утверждённые правила Stage 1 не менялись. Обновлены `docs/DOMAIN.md`,
`docs/plans/stage-1-domain.md`, `src/domain/scheduling.ts`, тесты,
`REVIEW_REPORT.md`; план Stage 2 остаётся draft (ссылка на стартовый интервал
синхронизирована). Проверки (2026-10-08): lint/typecheck чисто, тесты 31/31
(30 domain + 1 smoke). Stage 1 актуализирован этим решением; Stage 2 не начат.

### 2026-10-08 — Stage 1 APPROVED — агент

Внешнее ревью подтвердило Stage 1 (коммит `714e06867462cb7c96542aac67d7b5849c7a9006`):
все замечания предыдущего ревью закрыты, утверждённые scheduling-правила
(множители, `min = 2`, отсутствие `maxIntervalDays`, накопительный `no_reply`)
сохранены. Stage 1 считается принятым. Зафиксирован approval владельца; стартовый
интервал нового контакта (7 дней) остаётся открытым — это временный implementation
default, а не approved product rule. Подготовлен план Stage 2 — слой данных
(`docs/plans/stage-2-data.md`, draft). Реализация Stage 2 не начиналась: сначала
владелец утверждает решения из плана. В `AGENTS.md` уточнена формулировка про
упоминание Stage в документах. Проверки не изменялись (правки документационные).

### 2026-10-08 — Stage 1: правки по внешнему ревью — агент

Внешнее ревью Stage 1 вернуло CHANGES REQUESTED (4 замечания). Закрыты:
(1) `INITIAL_INTERVAL_DAYS = 7` переформулирован как временный implementation
default / открытое решение владельца, а не approved product rule — в DOMAIN
(раздел «Незакрытые решения»), плане Stage 1, отчёте и этом файле; (2) модель
Contact и `docs/DOMAIN.md` согласованы: Contact = `id, name, note?, strategy,
minIntervalDays, recommendedIntervalDays`, история Interaction — отдельная
domain-сущность (не поле Contact), `occurredAt` принадлежит событию;
(3) `README.md` переведён на Stage 1; (4) в `REVIEW_REPORT.md` исправлено число
тестов: `scheduling.test.ts` — 30 domain-тестов, полный `npm test` — 31 (2 suites).
Дополнительно для консистентности убран lint-warning (`array-type`) в тесте и
уточнено правило 1 в `AGENTS.md` (больше не хардкодит устаревшую стадию).
Утверждённые множители, `min=2`, отсутствие `maxIntervalDays` и накопительный
`no_reply` НЕ менялись. Проверки (2026-10-08): lint/typecheck чисто, тесты 31/31.
Stage 2 не начинался; ожидается повторное внешнее ревью.

### 2026-10-07 — Фикс make_patch.sh: неотслеживаемые файлы — агент

Дефолтный список файлов патча брал `git ls-files` (только закоммиченное) — новый
REVIEW_REPORT.md не попал в патч 20261007-04. Исправлено: теперь берутся
`git ls-files --cached --others --exclude-standard` (всё по правилам .gitignore).
Патч 20261007-05 повторяет Stage 0 + REVIEW_REPORT.md.

### 2026-10-07 — Подготовка Stage 0 к внешнему ревью — агент

Повторно проверены требования Stage 0: все обязательные файлы на месте, strict TS
(+`noUncheckedIndexedAccess`), тулинг зелёный, продуктовой логики в `src/` нет,
секретов нет, дерево чистое. Domain-правила maintain/grow сверены с уточнением —
документация совпадает. Создан `REVIEW_REPORT.md` (Ready for external review),
в `AGENTS.md` добавлен постоянный «Ритуал завершения Stage». Проверки:
lint/typecheck чисто, тесты 1/1. Stage 1 не начинался — ожидается ревью.

### 2026-10-07 — Привязка синхронизатора к аккаунту Genspark — агент

`make_patch.sh` пишет в `PATCH_INFO.txt` поле `account:` (email из `gsk me`);
`docs/SYNC.md` описывает привязку проекта к аккаунту. Синхронизатор на стороне
ноутбука (orbit-sync.ps1/sh) показывает текущий аккаунт в меню и в `status`,
хранит привязку проекта в `account.txt`, блокирует push/pull под чужим входом
(перепривязка: пункт 7 меню / команда account). Код приложения не менялся,
проверки не затронуты.

### 2026-10-07 — Уточнение domain-правил maintain/grow — агент

По уточнению продукта (`stage-0-domain-clarification`) в `docs/DOMAIN.md`
зафиксированы правила изменения интервала: типы `ContactStrategy` / `Initiator`
(`me|them|mutual`) / `Outcome` (`good|short|no_reply`), шесть правил с
предварительными множителями (в т.ч. `grow + them + good → × 0.8`, `no_reply →
× 2.2` с приоритетом над `grow`), границы `min=2` / `max=45` дней, ключевой
инвариант, предварительная таблица поведения и открытые вопросы (`mutual` и
недостающие множители — TBD до Stage 1). Определения `maintain` / `grow`
синхронизированы в `docs/PRODUCT.md`. Правила задокументированы, в коде НЕ
реализованы. Проверки перезапущены — зелёные.

### 2026-10-07 — Stage 0 (Project Foundation) — агент

Выполнен Stage 0: каркас приложения, strict TypeScript, ESLint/Prettier, Jest/RNTL
со smoke-тестом, структура слоёв, документация, ADR-001, шаблон планов, draft-план
Stage 1, CI workflow, синхронизатор и `docs/SYNC.md`. Следующий шаг — ревью Stage 0.
