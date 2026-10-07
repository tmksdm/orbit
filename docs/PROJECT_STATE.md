# PROJECT_STATE.md — журнал состояния проекта

Правило: сюда пишем только ПРОВЕРЕННЫЕ факты (что реально работает, что зелёное),
каждая запись датирована. Агент читает этот файл первым и обновляет после каждого
законченного этапа (см. `AGENTS.md`).

Агенту в новом чате: этот файл — точка входа. «Текущее состояние» и последняя
запись журнала = что делаем и куда дальше; затем `AGENTS.md` (правила) и
`docs/SYNC.md` (обмен файлами, раздел «Новый чат с агентом»).

## Текущее состояние (2026-10-08)

- **Stage 1 (Domain Model & Scheduling Algorithm):** принят внешним ревью 2026-10-08 (коммит `714e0686`); актуализирован approved product decision 2026-10-08 (стартовый интервал = 2 дня; `no_reply` ×2.0). Статус: approved.
- **Текущий Stage:** Stage 2 — Data Layer (порты репозиториев + Expo SQLite). Статус: план подготовлен (`docs/plans/stage-2-data.md`, draft), ожидает утверждения решений владельцем; реализация НЕ начата.
- **Следующий шаг:** утвердить решения по плану Stage 2 (раздел «Решения к утверждению»), затем реализация. Следующий Stage не начинать без одобрения.
- **Открытые вопросы:** стартовый интервал закрыт (approved = 2 дня); стадия для слоя данных (`src/data`) — см. план Stage 2.

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

## Проверенные факты

- Окружение: Node.js 22, npm 10; зависимости установлены из registry.npmjs.org.
- Стек: Expo SDK 57 (react-native 0.86, react 19.2, typescript ~6.0), expo-router,
  роуты в `src/app`.
- `npm run lint`, `npm run typecheck`, `npm test` выполняются успешно (2026-10-08).
- Продуктовой логики, кроме домена Stage 1 (scheduling), нет: UI контактов, схема
  БД, уведомления, auth, backend, AI, cloud sync в репозитории отсутствуют.

## Журнал

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
