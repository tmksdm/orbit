# Stage Review Report

## Stage

Stage 1 — Domain Model & Scheduling Algorithm

## Status

Правки по замечаниям внешнего ревью внесены; Stage 1 возвращён на внешнее ревью
(2026-10-08). Stage 2 не начат.

## Summary

Stage 0 approved владельцем 2026-10-08. Затем реализован доменный слой Stage 1 —
чистый TypeScript без React / Expo / SQLite / UI:

- `src/domain/types.ts` — `ContactStrategy`, `Initiator`, `Outcome`,
  `Interaction`, `Contact` (с необязательным `note?`);
- `src/domain/scheduling.ts` — таблица утверждённых множителей
  `INTERVAL_MULTIPLIERS` и чистая детерминированная функция
  `computeNextIntervalDays` (min-clamp, Math.round, без верхней границы);
- `src/domain/contact.ts` — фабрика `createContact` и иммутабельное
  `recordInteraction`;
- `src/domain/__tests__/scheduling.test.ts` — 30 domain-тестов, покрывающих все
  обязательные кейсы плана Stage 1.

Внешнее ревью вернуло **CHANGES REQUESTED** (4 замечания) — все закрыты, см.
«Правки по внешнему ревью». Утверждённые множители, `min = 2`, отсутствие
`maxIntervalDays` и накопительный `no_reply` не менялись.

## Правки по внешнему ревью (2026-10-08)

| № | Замечание | Что сделано | Файлы |
|---|---|---|---|
| 1 | `INITIAL_INTERVAL_DAYS = 7` выдавался за approved Stage 1 | 7 переформулирован как временный implementation default / открытое решение владельца (не approved product rule); добавлен раздел «Незакрытые решения»; план, отчёт и `PROJECT_STATE.md` согласованы | `docs/DOMAIN.md`, `docs/plans/stage-1-domain.md`, `docs/PROJECT_STATE.md`, `REVIEW_REPORT.md` |
| 2 | Модель Contact и `DOMAIN.md` расходились (`note`, история) | Contact = `id, name, note?, strategy, minIntervalDays, recommendedIntervalDays`; история Interaction — отдельная domain-сущность (не поле Contact); `DOMAIN.md` и JSDoc согласованы; `recordInteraction` не хранит событие, и это объяснено (`occurredAt` принадлежит Interaction) | `src/domain/types.ts`, `src/domain/contact.ts`, `docs/DOMAIN.md` |
| 3 | `README.md` — устаревший «Stage 0» и «продуктовые функции ещё не реализованы» | README переведён на Stage 1 (статус и описание слоя `domain`) | `README.md` |
| 4 | Неверное число тестов | Исправлено: `scheduling.test.ts` — **30** domain-тестов; полный `npm test` — **31** тест (30 domain + 1 Stage-0 smoke) | `REVIEW_REPORT.md` |

Дополнительно (консистентность, продуктовых правил не меняет): убран lint-warning
`@typescript-eslint/array-type` в тесте (`T[]` вместо `Array<T>`); в `AGENTS.md`
правило 1 больше не хардкодит устаревшую стадию, а ссылается на
`docs/PROJECT_STATE.md`.

## Requirements coverage

| Требование | Статус |
|---|---|
| Domain types: Contact / Interaction / ContactStrategy / Initiator / Outcome | implemented (`src/domain/types.ts`) |
| Scheduling algorithm (чистые функции) | implemented (`src/domain/scheduling.ts`, `contact.ts`) |
| Финальные множители (11 утверждённых ячеек) | implemented (таблица в коде = таблица в `DOMAIN.md`) |
| Повторный no_reply — накопление (10→22→48→106) | implemented + тест |
| Верхней границы нет (без maxIntervalDays) | implemented + тесты (рост 10→513 за 5 no_reply) |
| minIntervalDays = 2 (и кастомная граница) | implemented + тесты |
| База множителя — current recommended interval | implemented + тест («человек написал через 2 дня» ≠ база) |
| Первое взаимодействие / отсутствие истории | implemented (стартовый интервал 7 — временный default) + тесты |
| Детерминированность | implemented + тесты (и иммутабельность) |
| Unit tests — обязательный список плана | implemented (30 domain-тестов) |
| Обновление domain-документации | implemented (`DOMAIN.md`, `PRODUCT.md`, план Stage 1) |
| UI / SQLite / repositories / notifications / backend | not implemented — вне scope Stage 1 |

## Changed files (правки по внешнему ревью)

- `README.md` — статус Stage 1 (был Stage 0); уточнён слой `domain`.
- `AGENTS.md` — правило 1 ссылается на `docs/PROJECT_STATE.md` вместо хардкода стадии.
- `docs/DOMAIN.md` — модель Contact и история Interaction; раздел «Незакрытые решения» (стартовый интервал); правила множителей — без изменений.
- `docs/plans/stage-1-domain.md` — статус (выполнен, на ревью); стартовый интервал — временный default; модель Contact/история.
- `src/domain/types.ts` — Contact с `note?`; JSDoc про Interaction и историю.
- `src/domain/contact.ts` — `ContactInput.note?`; JSDoc `recordInteraction` (событие не хранится в Contact).
- `src/domain/__tests__/scheduling.test.ts` — исправлен lint-warning (`T[]`); число тестов не менялось (30).
- `REVIEW_REPORT.md` — этот отчёт (обновлён после ревью).
- `docs/PROJECT_STATE.md` — журнал (правки по ревью; исправлено число тестов).

## Architecture

- Слои и направление зависимостей — без изменений (`ARCHITECTURE.md`):
  `app → features → {ui, services, data} → domain`. Domain — основание стека.
- Domain остаётся независимым от React / Expo / SQLite: продуктовая математика —
  чистые функции, тестируемые unit-тестами без эмуляторов (30 domain-тестов).
- Contact иммутабелен; таблица множителей — экспортируемая константа
  (прозрачность рекомендаций — принцип `PRODUCT.md`).
- Interaction — отдельная domain-сущность; её историю будет хранить repository
  на этапе data (Stage 2+). Contact хранит только состояние связи.

## Domain specification

Текущее понимание (источник — `docs/DOMAIN.md`, решения владельца от 2026-10-08):

- **maintain** — не терять контакт, не навязываться: инициатива в основном от
  пользователя → интервал постепенно растёт; инициатива другого — интервал можно
  сохранить; никогда не сокращает ради сближения.
- **grow** — сближаться только вслед за взаимностью; желание пользователя само
  по себе интервал не сокращает.
- **initiator** — `me` / `them` / `mutual`; **outcome** — `good` / `short` / `no_reply`.
- **adaptive interval** — текущий рекомендуемый интервал; база каждого пересчёта.
- **min interval** — 2 дня (по умолчанию); **max — удалён**, рост без потолка.
- **Модель Contact** — `id, name, note?, strategy, minIntervalDays,
  recommendedIntervalDays`; история Interaction — отдельная коллекция, не поле
  Contact.

Подтверждения:

- `grow + them + good` позволяет сокращать интервал (× 0.8; 10 → 8).
- `grow + me` сам по себе не позволяет сокращать интервал (good → × 1.4).
- `no_reply` приводит к увеличению интервала (× 2.2, независимо от стратегии;
  каждый новый no_reply умножает текущий интервал ещё раз: 10 → 22 → 48 → 106).

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
  совпадает построчно; производные ячейки помечены в обоих местах.
- Сверка модели Contact: `types.ts` (`id, name, note?, strategy, min,
  recommended`) совпадает с описанием в `DOMAIN.md`; история — отдельная сущность.
- Секретов нет, build-артефактов нет.

## Dependencies

Новые зависимости — **отсутствуют**: домен и тесты написаны на уже установленных
`typescript`, `jest`, `jest-expo`, `@types/jest`. Лишних зависимостей не добавлено.

## Deviations

- В Contact добавлено необязательное поле `note?` — чтобы модель совпала с
  описанным в `DOMAIN.md` атрибутом «заметка». Поле не используется алгоритмом
  (данные, не логика), поэтому новых тестов не потребовалось; число domain-тестов
  осталось 30 (как указано в замечании 4).
- История взаимодействий вынесена из Contact в отдельную domain-сущность
  `Interaction` (замечание 2, вариант «отдельная коллекция, хранится repository»).
- Стартовый интервал `INITIAL_INTERVAL_DAYS = 7` — временный implementation
  default, не утверждён владельцем (Open questions).
- Производные ячейки таблицы (maintain+mutual, grow+mutual+short, no_reply при
  mutual) выведены из утверждённых правил; зафиксированы в `DOMAIN.md` и тестах.
- Lint-warning `@typescript-eslint/array-type` исправлен (`T[]`).

## Open questions

1. Стартовый интервал нового контакта без истории: сейчас временный default
   7 дней — подтвердить или задать значение. Владелец не решён; самостоятельно
   значение не выбирается.
2. Схема БД / `src/data` (репозитории, миграции) — отдельный Stage 2 или часть
   следующего этапа (вопрос переносится из Stage 0, решения пока нет).

## Risks / Review focus

- Таблица множителей в `src/domain/scheduling.ts` — сердце продукта; сверена
  построчно с `docs/DOMAIN.md` (11 ячеек).
- Модель Contact: добавлен `note?`; история — отдельная сущность, а не поле.
- Поведение «без потолка»: интервал уходит в сотни дней — оценить как UX для
  Stage 2+ (напоминания при таком интервале).
- 30 domain-тестов — первые доменные тесты: оценить стиль/полноту как эталон.

## Stage boundary

- Stage 2 implementation has NOT started.
- No UI / SQLite / repositories / notifications / backend code has been added.
- Domain layer remains pure TypeScript (no React / Expo / SQLite / UI imports).

## Suggested Git commit

Текущая ветка — `main`, HEAD `c1dcc89`. Правки по внешнему ревью лежат в рабочем
дереве и НЕ закоммичены — владелец коммитит их после применения патча.

Commit message:

```text
fix(domain): address stage 1 review — align contact model and docs
```

Команды на ноутбуке после применения патча:

```bash
git status
git diff --ignore-cr-at-eol
git add README.md AGENTS.md docs/DOMAIN.md docs/plans/stage-1-domain.md \
        src/domain/types.ts src/domain/contact.ts \
        src/domain/__tests__/scheduling.test.ts REVIEW_REPORT.md docs/PROJECT_STATE.md
git commit -m "fix(domain): address stage 1 review — align contact model and docs"
git push
```

## Review handoff

Stage 1 amendments ready for external review.
Stage 2 not started.
Waiting for approval.
