# PROJECT_STATE.md — журнал состояния проекта

Правило: сюда пишем только ПРОВЕРЕННЫЕ факты (что реально работает, что зелёное),
каждая запись датирована. Агент читает этот файл первым и обновляет после каждого
законченного этапа (см. `AGENTS.md`).

Агенту в новом чате: этот файл — точка входа. «Текущее состояние» и последняя
запись журнала = что делаем и куда дальше; затем `AGENTS.md` (правила) и
`docs/SYNC.md` (обмен файлами, раздел «Новый чат с агентом»).

## Текущее состояние (2026-10-07)

- **Текущий Stage:** Stage 1 — Domain Model & Scheduling Algorithm. Статус: выполнен, ожидает ревью.
- **Следующий шаг:** внешнее ревью и approval Stage 1; затем — Stage 2 (не начинать без одобрения).

## Что готово (Stage 0)

- Каркас Expo + React Native + TypeScript (Expo SDK 57, expo-router): один
  placeholder-экран `src/app/index.tsx` («Orbit», Stage 0) и `src/app/_layout.tsx`.
- TypeScript strict + `noUncheckedIndexedAccess`.
- Тулинг: ESLint (`eslint-config-expo` + `eslint-config-prettier`), Prettier;
  команды `npm run lint`, `npm run typecheck`, `npm test` — проверены, зелёные.
- Jest + jest-expo + React Native Testing Library; smoke-тест placeholder-экрана
  (`__tests__/index.test.tsx`).
- Структура слоёв: `src/{domain,data,services,features,ui}` — пустые каталоги с
  `.gitkeep`, продуктовой логики нет.
- Документация: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `docs/PRODUCT.md`,
  `docs/DOMAIN.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/SYNC.md`,
  ADR `docs/decisions/001-local-first.md`, `docs/plans/TEMPLATE.md`,
  `docs/plans/stage-1-domain.md` (draft, не выполняется).
- Синхронизация: `tools/sync/make_patch.sh`, протокол — `docs/SYNC.md`.
- CI: `.github/workflows/ci.yml` — lint/typecheck/test на PR в `main` и push в `main`.
- Git: `main` (коммит каркаса) + ветка `chore/project-foundation` (все изменения
  Stage 0). Push не выполнялся — у среды нет доступов.

## Проверенные факты

- Окружение: Node.js 22, npm 10; зависимости установлены из registry.npmjs.org.
- Стек: Expo SDK 57 (react-native 0.86, react 19.2, typescript ~6.0), expo-router,
  роуты в `src/app`.
- `npm run lint`, `npm run typecheck`, `npm test` выполняются успешно (2026-10-07).
- Продуктовая логика (UI контактов, scheduling, схема БД, уведомления, auth, backend,
  AI, cloud sync) в репозитории отсутствует — только фундамент.

## Журнал

### 2026-10-08 — Stage 1 (Domain Model & Scheduling) — агент

Stage 0 approved владельцем (2026-10-08). Утверждённые правила (финальные
множители, накопление no_reply, отказ от maxIntervalDays, база = текущий
рекомендуемый интервал, min=2) зафиксированы в DOMAIN/PRODUCT/плане Stage 1.
Реализован доменный слой: `src/domain/{types,scheduling,contact}.ts` — чистый
TS, иммутабельный Contact, детерминированный пересчёт; 31 unit-тест.
Проверки (2026-10-08): lint/typecheck чисто, тесты 31/31 (2 suites).
Ветка `feat/stage-1-domain`, коммиты 80df9b9 / dffc56f / 2d0abec + отчёт.
Открытые вопросы: стартовый интервал (сейчас 7 дней), стадия для data layer.
Следующий шаг — внешнее ревью Stage 1. Stage 2 не начинался.

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
