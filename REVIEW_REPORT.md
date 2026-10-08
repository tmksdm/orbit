# Stage Review Report

## Stage

Stage 2 — Data Layer (порты репозиториев + Expo SQLite)

## Status

Реализован и проверен; **ожидает внешнего ревью**. Проверки зелёные
(lint / typecheck / tests). Stage 3 не начат.

## Summary

Реализован слой данных local-first: порты репозиториев объявлены в domain,
реализация — в `src/data` поверх `expo-sqlite`.

- `src/domain/ports.ts` — `ContactRepository` (`list`, `getById`, `save`-upsert) и
  `InteractionRepository` (`add`, `listByContact`) — чистый TypeScript, без
  импортов React / Expo / react-native / SQLite / UI.
- `src/data/sqlDatabase.ts` — минимальный драйверный интерфейс `SqlDatabase`
  (`exec`, `run`, `all`, `transaction`, `close`).
- `src/data/expoSqliteDriver.ts` — продовый драйвер поверх `expo-sqlite`.
- `src/data/migrations.ts` — упорядоченные миграции forward-only, версия схемы
  через `PRAGMA user_version`; раннер идемпотентен.
- `src/data/contactRepository.ts`, `src/data/interactionRepository.ts` —
  реализации портов.
- `src/data/interactionRecorder.ts` — data-level unit-of-work: атомарная запись
  `Interaction` + обновлённого `Contact`.
- `src/data/dataLayer.ts` — подготовка соединения (`PRAGMA foreign_keys = ON` +
  миграции) и сборка слоя; `src/data/index.ts` — `openOrbitDatabase` (продакшн).
- `src/data/testing/` — тестовый драйвер на встроенном `node:sqlite`.

Внесены **оба обязательных уточнения владельца** от 2026-10-08
(см. `docs/plans/stage-2-data.md`, раздел «Обязательные уточнения владельца»):

1. **Атомарная запись** Interaction + обновлённого Contact в одной SQLite-
   транзакции (`interactionRecorder.ts`); расчёт интервала — domain-функция
   `recordInteraction`, в data не дублируется. Есть тест rollback.
2. **Foreign keys включены**: при открытии БД выполняется `PRAGMA foreign_keys = ON`;
   поведение (отклонение нарушения FK, `ON DELETE CASCADE`) покрыто тестами.

## Requirements coverage (план `docs/plans/stage-2-data.md`)

| Требование | Статус |
|---|---|
| Порты в `src/domain/ports.ts`, без React / Expo / SQLite / UI | реализовано |
| Реализации в `src/data`, направление DATA → DOMAIN | реализовано |
| Схема `contacts` / `interactions` + индекс | реализовано (миграция v1) |
| Драйвер `SqlDatabase` + реализация поверх `expo-sqlite` | реализовано |
| Миграции forward-only через `PRAGMA user_version`, идемпотентны | реализовано + тесты |
| Async API портов (`Promise`) | реализовано |
| Создание/чтение контакта (все поля, `note` пуст и задан), upsert | реализовано + тесты |
| Добавление взаимодействия + история по контакту (порядок `occurredAt`) | реализовано + тесты |
| Изоляция истории по `contactId` | реализовано + тест |
| **Атомарная запись Interaction + Contact + тест rollback** | реализовано + тест |
| **`PRAGMA foreign_keys = ON` + проверка тестом** | реализовано + тесты |
| Сидирование дефолтов | не делалось — вне scope |
| UI / features / due-логика / Stage 3 | не начато — вне scope |

## Changed files

- `src/domain/ports.ts` — новый (порты репозиториев).
- `src/data/sqlDatabase.ts`, `expoSqliteDriver.ts`, `migrations.ts`,
  `contactRepository.ts`, `interactionRepository.ts`, `interactionRecorder.ts`,
  `dataLayer.ts`, `index.ts` — новые (слой данных).
- `src/data/testing/nodeSqliteDriver.ts`, `nodeSqlite.d.ts`,
  `openTestDataLayer.ts` — новые (тестовый драйвер и хелперы).
- `src/data/__tests__/migrations.test.ts`, `contactRepository.test.ts`,
  `interactionRepository.test.ts`, `interactionRecorder.test.ts`,
  `dataLayer.test.ts` — новые (16 интеграционных тестов).
- `docs/plans/stage-2-data.md` — план переведён в approved, внесены уточнения.
- `ARCHITECTURE.md` — раздел «Слой данных (Stage 2)».
- `docs/TESTING.md` — стратегия data-тестов (реальный SQL).
- `docs/PROJECT_STATE.md` — журнал и проверенные факты Stage 2.
- `package.json`, `package-lock.json`, `app.json` — зависимость `expo-sqlite`.

## Architecture

- Направление зависимостей `DATA → DOMAIN` соблюдено (ARCHITECTURE.md, правило 4):
  порты объявляет domain, реализует `src/data`.
- Domain остаётся чистым: `src/domain/ports.ts` импортирует только доменные типы.
- Прод и тесты исполняют один и тот же SQL: SQL — в `migrations.ts` и
  репозиториях, драйвер только исполняет. Продовый драйвер — `expo-sqlite`,
  тестовый — `node:sqlite` (те же запросы, реальная СУБД).

## Verification

### lint
Команда:
```
npm run lint
```
Результат: `eslint .` — 0 ошибок, exit code 0 (2026-10-08).

### typecheck
Команда:
```
npm run typecheck
```
Результат: `tsc --noEmit` — без ошибок, exit code 0 (2026-10-08).

### tests
Команда:
```
npm test
```
Результат:
```text
Test Suites: 7 passed, 7 total
Tests:       47 passed, 47 total
```
Новые (Stage 2): 16 тестов в 5 suites —
`migrations` (2), `contactRepository` (5), `interactionRepository` (4),
`interactionRecorder` (3), `dataLayer` (2). Прежние 31 (Stage 0/1) не менялись.

Ключевые проверки Stage 2:
- миграции «с нуля» + повторный запуск идемпотентны, версия = `SCHEMA_VERSION`;
- CRUD контакта, `note` отсутствует/задан, upsert интервала;
- история по `occurredAt` (порядок), изоляция по `contactId`;
- **rollback**: ошибка при сохранении Contact откатывает и запись Interaction;
- **foreign keys**: `PRAGMA foreign_keys` = 1; вставка с несуществующим
  `contactId` отклоняется; `ON DELETE CASCADE` удаляет историю.

## Manual verification

- Прогон на устройстве/эмуляторе в среде агента недоступен (нет Android/iOS
  рантайма) — проверка ограничена интеграционными тестами на реальном
  `node:sqlite`; это честно зафиксировано (допустимо п. «Manual verification» плана).
- Греп-проверка: `src/domain` не импортирует react / expo / react-native / sqlite;
  нативный `expo-sqlite` импортируется только в `expoSqliteDriver.ts` и `index.ts`.
- Секретов и build-артефактов нет.

## Dependencies

- Новая runtime-зависимость: `expo-sqlite ~57.0.4` (поставлена `npx expo install`,
  совместимая с SDK 57; `app.json` получил config plugin `expo-sqlite`).
- Прочие новые зависимости отсутствуют: тестовый драйвер использует встроенный
  `node:sqlite` (Node 22, без новой зависимости); для него добавлены минимальные
  ambient-типы `src/data/testing/nodeSqlite.d.ts` (проект не тянет `@types/node`
  в прод и ограничивает набор типов `types: ["jest"]`).

## Deviations

- План предлагал тестовый драйвер «in-memory»; выбран приоритетный вариант —
  реальный `node:sqlite` (Node 22), как и допускал раздел «Подход к тестам».
- Тестовый драйвер вынесен в `src/data/testing/` (а не в `__tests__/`), чтобы jest
  не считал его тест-сьютом; сами тесты — в `src/data/__tests__/`.
- `expoSqliteDriver.transaction` оборачивает `withTransactionAsync` вручную:
  метод `expo-sqlite` не generic, а порт `SqlDatabase.transaction` — generic
  (обнаружено на typecheck и исправлено).
- `ContactRepository.list()` сортирует по `name` (NOCASE), затем `id` — для
  детерминированного порядка вывода (план порядок не задавал).

## Open questions

1. Создание контакта из UI, генерация `id`, due-логика «кому пора связаться» —
   Stage 3 (вне scope Stage 2).

## Risks / Review focus

- Транзакционность на двух драйверах: `node:sqlite` — ручной `BEGIN/COMMIT/ROLLBACK`,
  `expo-sqlite` — `withTransactionAsync`. Оба пути покрыты проверками (rollback-тест
  гоняется на `node:sqlite`); поведение нативного драйвера на устройстве стоит
  подтвердить при первом запуске на телефоне (Stage 3).
- `PRAGMA foreign_keys` — per-connection; включается в `prepareDatabase`, вызываемом
  при открытии БД и в тестах. Если где-то откроют соединение в обход
  `openOrbitDatabase`, гарантии не будет — сейчас других точек открытия нет.
- Типы строк (`strategy` / `initiator` / `outcome`) читаются как `string` и
  приводятся к доменным union; корректность гарантируется тем, что запись идёт
  только через репозитории/domain. При появлении внешних источников понадобится
  валидация.
- `list()` без пагинации — приемлемо для MVP-объёма.

## Stage boundary

- Stage 2 implementation is complete and covered by integration tests.
- No UI / features / due-logic / notifications / backend code has been added.
- Domain layer remains pure TypeScript; scheduling rules from Stage 1 unchanged.
- Stage 3 NOT started.

## Suggested Git commit

Текущая ветка — `main`, HEAD `7e4a978`. Изменения Stage 2 — в рабочем дереве и
НЕ закоммичены.

Commit message:

```text
feat(data): implement stage 2 data layer (ports, expo-sqlite, migrations)

- domain ports: ContactRepository, InteractionRepository
- data layer over expo-sqlite: SqlDatabase driver, forward-only migrations
- repositories + atomic interaction+contact save (unit-of-work) with rollback test
- enable and test SQLite foreign keys
```

Команды на ноутбуке после применения патча:

```bash
git add app.json package.json package-lock.json \
        src/domain/ports.ts \
        src/data/sqlDatabase.ts src/data/expoSqliteDriver.ts \
        src/data/migrations.ts src/data/contactRepository.ts \
        src/data/interactionRepository.ts src/data/interactionRecorder.ts \
        src/data/dataLayer.ts src/data/index.ts \
        src/data/testing src/data/__tests__ \
        docs/plans/stage-2-data.md docs/TESTING.md docs/PROJECT_STATE.md \
        ARCHITECTURE.md REVIEW_REPORT.md
git commit -m "feat(data): implement stage 2 data layer (ports, expo-sqlite, migrations)"
git push
```

## Review handoff

Stage 2 (Data Layer) реализован, проверки зелёные, оба обязательных уточнения
владельца внесены. Требуется внешнее ревью перед Stage 3. Stage 3 не начат.
