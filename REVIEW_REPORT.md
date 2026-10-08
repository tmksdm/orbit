# Stage Review Report

## Stage

Stage 2 — Data Layer (порты репозиториев + Expo SQLite)

## Status

Исправления по внешнему ревью внесены; **ожидает повторного внешнего ревью**.
Проверки зелёные (lint / typecheck / tests). Stage 2 **не** объявлен approved,
Stage 3 не начат.

## Review baseline

Внешнее ревью Stage 2 проведено на коммите `d1f29a7736c1b5b2604b8880ca2eafc0720a2e35`
(Stage 2, закоммиченный владельцем), вердикт — **CHANGES REQUESTED**
(BLOCKER-01 + MINOR-01/02). Исправления внесены поверх этого состояния.
В среде агента изменения лежат в рабочем дереве (агент не делает commit/push по
контракту `AGENTS.md`); снимок HEAD в песочнице — `7e4a978`, что соответствует
истории до коммита `d1f29a7` на ноутбуке. Патч применяется поверх `d1f29a7`.

## Fixes

### BLOCKER-01 — изоляция SQLite-транзакций (исправлено)

Проблема: `expoSqliteDriver.ts` использовал `withTransactionAsync`, который не
гарантирует эксклюзивность — параллельные запросы могли вмешаться в активную
транзакцию, а запросы внутри callback выполнялись не в транзакционном контексте.

Что сделано:

- `src/data/expoSqliteDriver.ts` — переход на `withExclusiveTransactionAsync`;
  callback получает транзакционный `txn`, из которого строится отдельный
  `SqlDatabase` (`createExpoSqliteDriver(txn)`). Запросы выполняются ТОЛЬКО через
  этот `tx`, а не через исходный `db`.
- `SqlDatabase.transaction` теперь принимает `work: (tx: SqlDatabase) => Promise<T>`
  и передаёт транзакционный контекст. Тестовый драйвер `node:sqlite` передаёт
  собственный (единственное соединение) контекст.
- `src/data/interactionRecorder.ts` — репозитории для атомарной операции строятся
  поверх `tx` (`createContactRepository(tx)` / `createInteractionRepository(tx)`),
  поэтому чтение, вставка события и сохранение контакта действительно идут внутри
  одной изолированной транзакции.
- `src/data/migrations.ts` — применение миграции и `PRAGMA user_version` выполняются
  через `tx` одной транзакции.
- Порты domain (`src/domain/ports.ts`) и бизнес-логика Stage 1 не изменены;
  новых абстракций не добавлено (переиспользованы существующие фабрики репозиториев).

Новые тесты:

- `interactionRecorder.test.ts`:
  - **rollback на реальном SQLite**: триггер `BEFORE UPDATE ON contacts` роняет
    именно второй шаг (сохранение Contact) — Interaction откатывается, интервал
    не меняется; частичных данных нет;
  - **контекст транзакции**: подменный драйвер фиксирует, что ВСЕ запросы операции
    выполнены в транзакционном контексте (`scope === "tx"`), ни одного вне его.
- `sqlDatabase.test.ts` (новый):
  - commit при успехе, rollback с пробросом ошибки;
  - **параллельные операции**: два соединения к одному файлу — незакоммиченная
    запись не видна второму соединению, после COMMIT — видна.

### MINOR-01 — README (исправлено)

`README.md` переведён на Stage 2: Data Layer реализован, Stage 1 принят, Stage 3
не начат; в структуре `src/data` отмечен как реализованный.

### MINOR-02 — REVIEW_REPORT (исправлено)

Сведения о HEAD/коммитах/состоянии Stage 2 актуализированы; устаревшее
утверждение «изменения не закоммичены» убрано (см. «Review baseline»).

## Summary (реализация Stage 2)

- `src/domain/ports.ts` — `ContactRepository`, `InteractionRepository` (чистый TS).
- `src/data`: `sqlDatabase.ts` (драйвер + транзакционный контекст),
  `expoSqliteDriver.ts` (expo-sqlite, эксклюзивная транзакция),
  `migrations.ts` (forward-only, `PRAGMA user_version`),
  `contactRepository.ts`, `interactionRepository.ts`,
  `interactionRecorder.ts` (unit-of-work атомарной фиксации),
  `dataLayer.ts` (`prepareDatabase` + сборка), `index.ts` (`openOrbitDatabase`).
- `src/data/testing/` — тестовый драйвер на `node:sqlite` и ambient-типы node-модулей.
- Обязательные уточнения владельца: (1) атомарная запись Interaction + Contact;
  (2) `PRAGMA foreign_keys = ON` при открытии БД — оба реализованы и покрыты тестами.

## Requirements coverage

| Требование | Статус |
|---|---|
| Порты в `src/domain/ports.ts`, без React / Expo / SQLite / UI | реализовано |
| Реализации в `src/data`, направление DATA → DOMAIN | реализовано |
| Схема `contacts` / `interactions` + индекс | реализовано (миграция v1) |
| Драйвер `SqlDatabase` + реализация поверх `expo-sqlite` | реализовано |
| Миграции forward-only `PRAGMA user_version`, идемпотентны | реализовано + тесты |
| Async API портов (`Promise`) | реализовано |
| Создание/чтение контакта (все поля, `note` пуст/задан), upsert | реализовано + тесты |
| История по контакту (порядок `occurredAt`), изоляция по `contactId` | реализовано + тесты |
| Атомарная запись Interaction + Contact + rollback-тест | реализовано + тест |
| `PRAGMA foreign_keys = ON` + проверка | реализовано + тесты |
| **Изоляция транзакции от параллельных запросов (BLOCKER-01)** | реализовано + тесты |
| Сидирование дефолтов | вне scope |
| UI / features / due-логика / Stage 3 | не начато |

## Verification

### lint
Команда:
```
npm run lint
```
Результат: `eslint .` — 0 ошибок, 0 предупреждений, exit code 0 (2026-10-08).

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
Test Suites: 8 passed, 8 total
Tests:       51 passed, 51 total
```
Новые/обновлённые (Stage 2): 20 тестов в 6 suites —
`migrations` (2), `contactRepository` (5), `interactionRepository` (4),
`interactionRecorder` (4: атомарность, rollback, unknown-contact, tx-контекст),
`dataLayer` (2), `sqlDatabase` (3: commit, rollback, изоляция двух соединений).
Прежние 31 (Stage 0/1) не менялись и не ослаблялись.

## Manual verification

- Прогон на устройстве/эмуляторе в среде агента недоступен (нет Android/iOS
  рантайма). Интеграционные тесты идут на реальном `node:sqlite`; это **не**
  исполнение нативного драйвера `expo-sqlite`.
- **Явно непроверенное:** поведение `withExclusiveTransactionAsync` и изоляция
  транзакции в нативном `expo-sqlite` на телефоне тестами в песочнице НЕ
  покрыты — `node:sqlite` проверяет изоляцию как свойство SQLite-транзакций, но не
  конкретную реализацию Expo. Полная проверка — ручной прогон на устройстве
  (Stage 3). Тесты `node:sqlite` не выдаются за проверку Expo.
- Греп-проверка: `src/domain` без импортов react / expo / react-native / sqlite;
  нативный `expo-sqlite` импортируется только в `expoSqliteDriver.ts` и `index.ts`.
- Секретов и build-артефактов нет.

## Dependencies

- Новая runtime-зависимость: `expo-sqlite ~57.0.4` (поставлена `npx expo install`,
  совместима с SDK 57; `app.json` получил config plugin `expo-sqlite`).
- Иных новых зависимостей нет. Тестовый драйвер использует встроенный
  `node:sqlite` (Node 22); для используемых node-модулей добавлены минимальные
  ambient-типы `src/data/testing/nodeModules.d.ts` (типовая среда приложения
  остаётся ограниченной `types: ["jest"]`, `@types/node` не подключается).

## Deviations

- Транзакционный контекст: `SqlDatabase.transaction(work: (tx) => …)` — сигнатура
  изменена по требованию BLOCKER-01 (запросы выполняются в контексте транзакции).
- Тестовый драйвер вынесен в `src/data/testing/` (не в `__tests__/`), чтобы jest
  не считал его тест-сьютом.
- `ContactRepository.list()` сортирует по `name` (NOCASE), затем `id` — для
  детерминированного порядка (план порядок не задавал).
- Rollback-тест вынуждает падение второго шага триггером на реальном SQLite,
  а не подменой репозитория: теперь recorder сам строит репозитории поверх `tx`.

## Open questions

1. Проверка нативного `expo-sqlite` на устройстве (открытие БД, изоляция
   транзакций) — при первом запуске на телефоне (Stage 3).
2. Создание контакта из UI, генерация `id`, due-логика — Stage 3.

## Risks / Review focus

- `withExclusiveTransactionAsync` и передача `txn` — исправление BLOCKER-01;
  корректность на нативе стоит подтвердить ручным прогоном (см. непроверенное выше).
- Открытие БД: `PRAGMA foreign_keys` — per-connection, ставится в `prepareDatabase`
  (единственная точка открытия — `openOrbitDatabase`).
- Типы строк приводятся к доменным union; корректность обеспечивается записью
  только через репозитории/domain.
- `list()` без пагинации — приемлемо для MVP.

## Stage boundary

- Stage 2 fixes complete; covered by integration tests (node:sqlite).
- No UI / features / due-logic / notifications / backend code added.
- Domain layer remains pure TypeScript; Stage 1 rules unchanged.
- Stage 2 NOT declared approved; Stage 3 NOT started.

## Suggested Git commit

Review baseline — commit `d1f29a7` (Stage 2 на ноутбуке). Исправления поверх него
в рабочем дереве; агент commit/push не выполняет.

Commit message:

```text
fix(data): isolate atomic save in exclusive transaction; update docs

- use withExclusiveTransactionAsync and run all operation queries via txn context
- SqlDatabase.transaction passes a transaction-scoped executor
- recorder builds repositories over tx; add rollback and concurrent-isolation tests
- README: stage 2; REVIEW_REPORT actualized
```

Команды на ноутбуке после применения патча:

```bash
git add README.md REVIEW_REPORT.md docs/PROJECT_STATE.md docs/plans/stage-2-data.md \
        src/data/sqlDatabase.ts src/data/expoSqliteDriver.ts \
        src/data/migrations.ts src/data/interactionRecorder.ts src/data/dataLayer.ts \
        src/data/testing/nodeModules.d.ts \
        src/data/__tests__/interactionRecorder.test.ts src/data/__tests__/sqlDatabase.test.ts
git rm --cached src/data/testing/nodeSqlite.d.ts 2>/dev/null || true
git commit -m "fix(data): isolate atomic save in exclusive transaction; update docs"
git push
```

## Review handoff

BLOCKER-01 и MINOR-01/02 исправлены, проверки зелёные. Требуется повторное
внешнее ревью Stage 2. Stage 2 не approved, Stage 3 не начат.
