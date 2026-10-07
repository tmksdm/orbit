# План Stage 1 — Domain model и scheduling algorithm

Статус: **approved (2026-10-08), выполняется.** Решения владельца зафиксированы
в `docs/DOMAIN.md`; этот план — рабочая постановка Stage 1.

## Goal

Реализовать доменный слой: типы Contact / Interaction и scheduling algorithm —
чистые TypeScript-функции пересчёта рекомендуемого интервала, покрытые
unit-тестами.

## Scope

- `src/domain/types.ts` — `ContactStrategy`, `Initiator`, `Outcome`, `Interaction`, `Contact`.
- `src/domain/scheduling.ts` — таблица утверждённых множителей и чистая функция
  пересчёта `computeNextIntervalDays`.
- `src/domain/contact.ts` — фабрика контакта и `recordInteraction` (иммутабельное
  применение взаимодействия).
- Unit-тесты `src/domain/__tests__/` — все обязательные кейсы (см. Required tests).
- Обновление `docs/DOMAIN.md`, `docs/PRODUCT.md`, `REVIEW_REPORT.md`,
  `docs/PROJECT_STATE.md`.

## Out of scope

UI; SQLite; repositories; notifications; backend; authentication; cloud sync; AI;
продуктовые экраны. Domain — чистый TypeScript без React, Expo, SQLite и UI.

## Technical approach

- База пересчёта — текущий рекомендуемый интервал контакта (не фактический
  промежуток между взаимодействиями).
- Множители — по утверждённой таблице (`docs/DOMAIN.md`); производные ячейки:
  `maintain + mutual` как them (×1.0), `grow + mutual + short` ×1.0,
  `no_reply` ×2.2 при любом initiator.
- Каждый новый `no_reply` умножает текущий интервал ещё раз (накопление).
- `maxIntervalDays` НЕ реализуется — рост без потолка (решение владельца).
- Результат не ниже `minIntervalDays` (по умолчанию 2).
- Дробные дни — `Math.round` до целых.
- Стартовый интервал контакта без истории — `INITIAL_INTERVAL_DAYS = 7`.
- Функции детерминированы: без часов, случайности и I/O.

## Acceptance criteria

- Все обязательные тест-кейсы зелёные (`npm test`).
- `npm run lint`, `npm run typecheck` — чисто.
- В `src/domain` нет импортов react / expo / react-native / sqlite / UI.
- Документация соответствует коду (множители, min, отсутствие max).

## Required tests

- maintain + me + good / short / no_reply;
- maintain + them + good / short;
- grow + me + good / short / no_reply;
- grow + them + good / short;
- grow + mutual + good;
- повторные no_reply (накопление: 10 → 22 → 48 → 106);
- отсутствие maxIntervalDays (рост выше 45 и дальше);
- очень большие интервалы;
- minIntervalDays (дефолт и кастомная граница);
- первое взаимодействие (база — стартовый интервал, не фактический промежуток);
- отсутствие истории (детерминированный дефолт);
- детерминированность расчёта.

## Manual verification

- Греп-проверка `src/domain` на запрещённые импорты.
- Прогон полного набора `npm run lint && npm run typecheck && npm test`.
- Сверка таблицы множителей кода с `docs/DOMAIN.md`.

## Risks

- Стартовый интервал 7 дней — дефолт реализации, не утверждён владельцем
  (открытый вопрос отчёта).
- Производные ячейки (mutual) выведены из утверждённых правил — помечены в
  `docs/DOMAIN.md`, проверить на ревью.

## Completion report

По завершении — `REVIEW_REPORT.md` в корне (структура отчёта Stage), остановка,
ожидание внешнего ревью. Stage 2 самостоятельно не начинается.
