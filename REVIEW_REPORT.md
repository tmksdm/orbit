# Stage Review Report

## Stage

Stage 1 — Domain Model & Scheduling Algorithm

## Status

Approved (2026-10-08) и **актуализирован approved product decision** того же дня
(стартовый интервал = 2 дня; множитель `no_reply` ×2.0). Проверки зелёные.
Stage 2 не начат.

## Summary

Доменный слой Stage 1 — чистый TypeScript без React / Expo / SQLite / UI:

- `src/domain/types.ts` — `ContactStrategy`, `Initiator`, `Outcome`,
  `Interaction`, `Contact` (с необязательным `note?`);
- `src/domain/scheduling.ts` — таблица утверждённых множителей
  `INTERVAL_MULTIPLIERS` и чистая детерминированная функция
  `computeNextIntervalDays` (min-clamp, Math.round, без верхней границы);
- `src/domain/contact.ts` — фабрика `createContact` и иммутабельное
  `recordInteraction`;
- `src/domain/__tests__/scheduling.test.ts` — 30 domain-тестов, покрывающих все
  обязательные кейсы плана Stage 1.

Внешнее ревью вернуло CHANGES REQUESTED (4 замечания); замечания закрыты, и
Stage 1 был принят (коммит `714e0686`). Затем владелец принял продуктовое
уточнение для MVP (см. ниже) — Stage 1 актуализирован.

## Product decision (approved 2026-10-08)

Упрощение механики для MVP, решения владельца:

| Что | Было | Стало |
|---|---|---|
| Стартовый интервал нового контакта `INITIAL_INTERVAL_DAYS` | 7 (временный default, открытое решение) | **2 — approved product rule** |
| Множитель `no_reply` | ×2.2 | **×2.0** (при любом initiator и обеих стратегиях; накопительно — применяется к текущему recommended interval) |

Ожидаемая последовательность: `2 → 4 → 8 → 16 → 32 → 64 → …`.

Смысл: если пользователь инициирует, а в ответ тишина, Orbit постепенно и
прозрачно увеличивает дистанцию. Для MVP приоритет — простота и объяснимость.
Остальные утверждённые правила Stage 1 (множители 1.4 / 1.7 / 1.0 / 0.8,
`minIntervalDays = 2`, отсутствие `maxIntervalDays`) не менялись.

## Requirements coverage

| Требование | Статус |
|---|---|
| Domain types: Contact / Interaction / ContactStrategy / Initiator / Outcome | implemented (`src/domain/types.ts`) |
| Scheduling algorithm (чистые функции) | implemented (`src/domain/scheduling.ts`, `contact.ts`) |
| Утверждённые множители (11 ячеек) | implemented (таблица в коде = таблица в `DOMAIN.md`) |
| `no_reply` ×2.0, приоритет и накопление (2→4→8→16→32→64) | implemented + тест |
| Верхней границы нет (без maxIntervalDays) | implemented + тесты (рост 10→320 за 5 no_reply) |
| minIntervalDays = 2 (и кастомная граница) | implemented + тесты |
| База множителя — current recommended interval | implemented + тест (база ≠ фактический промежуток) |
| Стартовый интервал = 2 (approved) | implemented + тесты |
| Детерминированность | implemented + тесты (и иммутабельность) |
| Unit tests — обязательный список плана | implemented (30 domain-тестов) |
| Обновление domain-документации | implemented (`DOMAIN.md`, план Stage 1) |
| UI / SQLite / repositories / notifications / backend | not implemented — вне scope Stage 1 |

## Changed files (правки этого уточнения)

- `src/domain/scheduling.ts` — `INITIAL_INTERVAL_DAYS = 2`; `no_reply` ×2.0 (6 ячеек); обновлён docstring.
- `src/domain/__tests__/scheduling.test.ts` — тесты под ×2.0 и старт = 2; накопление `2→4→8→16→32→64`.
- `docs/DOMAIN.md` — таблица `no_reply` ×2.0; раздел «Повторный no_reply»; стартовый интервал = 2 (approved); удалён раздел «Незакрытые решения».
- `docs/plans/stage-1-domain.md` — статус approved; ×2.0; старт = 2; обязательный тест накопления; Risks.
- `docs/plans/stage-2-data.md` — синхронизирована ссылка на утверждённый стартовый интервал (статус плана остаётся Draft).
- `REVIEW_REPORT.md` — этот отчёт (актуализирован).
- `docs/PROJECT_STATE.md` — журнал (product decision; проверенные факты).

## Architecture

- Слои и направление зависимостей — без изменений (`ARCHITECTURE.md`):
  `app → features → {ui, services, data} → domain`. Domain — основание стека.
- Domain независим от React / Expo / SQLite: продуктовая математика — чистые
  функции, тестируемые unit-тестами (30 domain-тестов).
- Contact иммутабелен; таблица множителей — экспортируемая константа
  (прозрачность рекомендаций — принцип `PRODUCT.md`).
- Interaction — отдельная domain-сущность; её историю будет хранить repository
  на этапе data (Stage 2+). Contact хранит только состояние связи.

## Domain specification

Источник — `docs/DOMAIN.md`, решения владельца от 2026-10-08:

- **maintain** — не терять контакт, не навязываться; инициатива пользователя →
  интервал растёт; инициатива другого — интервал можно сохранить; никогда не
  сокращает ради сближения.
- **grow** — сближаться только вслед за взаимностью; `grow + me` сам по себе
  интервал не сокращает.
- **initiator** — `me` / `them` / `mutual`; **outcome** — `good` / `short` / `no_reply`.
- **adaptive interval** — текущий рекомендуемый интервал; база каждого пересчёта.
- **min interval** — 2 дня (по умолчанию); **max — удалён**, рост без потолка.
- **Стартовый интервал** нового контакта — 2 дня (approved).
- **Модель Contact** — `id, name, note?, strategy, minIntervalDays,
  recommendedIntervalDays`; история Interaction — отдельная коллекция, не поле Contact.

Подтверждения:

- `grow + them + good` сокращает интервал (× 0.8; 10 → 8).
- `grow + me` сам по себе не сокращает интервал (good → × 1.4).
- `no_reply` удваивает текущий интервал (× 2.0, независимо от стратегии;
  2 → 4 → 8 → 16 → 32 → 64).

## Verification

### lint
Команда:
npm run lint

Результат:
`eslint .` — 0 ошибок, 0 предупреждений (exit code 0), 2026-10-08.

### typecheck
Команда:
npm run typecheck

Результат:
`tsc --noEmit` — без ошибок (exit code 0), 2026-10-08.

### tests
Команда:
npm test

Результат:
```text
Test Suites: 2 passed, 2 total
Tests:       31 passed, 31 total
```
`scheduling.test.ts` — 30 domain-тестов Stage 1; `__tests__/index.test.tsx` —
1 smoke-тест placeholder-экрана Stage 0. Итого 31.

## Manual verification

- Греп-проверка `src/` — в `src/domain` нет импортов react / expo /
  react-native / sqlite / UI; продуктовых экранов и хранилища не появилось.
- Сверка таблицы множителей в коде с утверждённой таблицей `docs/DOMAIN.md` —
  совпадает построчно (`no_reply` ×2.0 в обеих); производные ячейки помечены.
- Сверка модели Contact: `types.ts` совпадает с описанием в `DOMAIN.md`.
- Секретов нет, build-артефактов нет.

## Dependencies

Новые зависимости — **отсутствуют**: домен и тесты написаны на уже установленных
`typescript`, `jest`, `jest-expo`, `@types/jest`.

## Deviations

- Стартовый интервал: 7 (временный default) → 2 (approved product rule) —
  изменение утверждено владельцем 2026-10-08.
- Множитель `no_reply`: ×2.2 → ×2.0 — утверждено владельцем 2026-10-08.
- Для теста «первое взаимодействие» выбран `grow + me + good` (×1.4),
  т.к. при старте = 2 множитель `grow + them + good` (×0.8) упирается в
  `minIntervalDays` и не показателен.
- Производные ячейки (maintain+mutual, grow+mutual+short, no_reply при mutual)
  выведены из утверждённых правил; зафиксированы в `DOMAIN.md` и тестах.

## Open questions

1. Схема БД / `src/data` (порты репозиториев, миграции) — вынесено в план
   `docs/plans/stage-2-data.md` (Draft, ожидает утверждения решений владельцем).

## Risks / Review focus

- Таблица множителей в `src/domain/scheduling.ts` — сверена построчно с
  `docs/DOMAIN.md` (11 ячеек; `no_reply` ×2.0).
- Стартовый интервал = 2 совпадает с `minIntervalDays` по умолчанию — новый
  контакт стартует с минимума; проверить, что это ожидаемый UX.
- Накопление `no_reply` при ×2.0 растёт медленнее, чем при ×2.2 (10 → 320 против
  513 за 5 no_reply) — ожидаемое следствие упрощения.
- 30 domain-тестов — первые доменные тесты: оценить стиль/полноту как эталон.

## Stage boundary

- Stage 2 implementation has NOT started.
- No UI / SQLite / repositories / notifications / backend code has been added.
- Domain layer remains pure TypeScript (no React / Expo / SQLite / UI imports).

## Suggested Git commit

Текущая ветка — `main`, HEAD `c1dcc89`. Изменения этого уточнения в рабочем
дереве и НЕ закоммичены — владелец коммитит их после применения патча.

Commit message:

```text
feat(domain): start interval 2 and no_reply x2.0 (approved mvp decision)
```

Команды на ноутбуке после применения патча:

```bash
git add src/domain/scheduling.ts src/domain/__tests__/scheduling.test.ts \
        docs/DOMAIN.md docs/plans/stage-1-domain.md docs/plans/stage-2-data.md \
        REVIEW_REPORT.md docs/PROJECT_STATE.md
git commit -m "feat(domain): start interval 2 and no_reply x2.0 (approved mvp decision)"
git push
```

## Review handoff

Stage 1 approved and actualized by the approved product decision (2026-10-08).
Stage 2 not started — plan `docs/plans/stage-2-data.md` remains Draft, awaiting
owner approval of its decisions.
