# Stage Review Report

## Stage

Stage 1 — Domain Model & Scheduling Algorithm

## Status

Ready for external review.

## Summary

Stage 0 approved владельцем 2026-10-08. Утверждённые решения (финальные
множители MVP, накопление no_reply, отказ от maxIntervalDays, база = текущий
рекомендуемый интервал, min = 2 дня) зафиксированы в `docs/DOMAIN.md`,
`docs/plans/stage-1-domain.md` и `docs/PRODUCT.md`. Затем реализован доменный
слой — чистый TypeScript без React / Expo / SQLite / UI:

- `src/domain/types.ts` — `ContactStrategy`, `Initiator`, `Outcome`,
  `Interaction`, `Contact`;
- `src/domain/scheduling.ts` — таблица утверждённых множителей
  `INTERVAL_MULTIPLIERS` и чистая детерминированная функция
  `computeNextIntervalDays` (min-clamp, Math.round, без верхней границы);
- `src/domain/contact.ts` — фабрика `createContact` и иммутабельное
  `recordInteraction`;
- `src/domain/__tests__/scheduling.test.ts` — 31 тест, покрывающий все
  обязательные кейсы плана Stage 1.

UI, SQLite, repositories, notifications, backend — не затронуты (вне scope).

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
| Первое взаимодействие / отсутствие истории | implemented (стартовый интервал 7) + тесты |
| Детерминированность | implemented + тесты (и иммутабельность) |
| Unit tests — обязательный список плана | implemented (31 тест) |
| Обновление domain-документации | implemented (`DOMAIN.md`, `PRODUCT.md`, план Stage 1) |
| UI / SQLite / repositories / notifications / backend | not implemented — запрещены на Stage 1 |

## Changed files

- `docs/DOMAIN.md` — финальные правила: утверждённая таблица множителей, производные ячейки (mutual), накопление no_reply с примером 10→22→48→106, отказ от max с обоснованием, min = 2, округление, стартовый интервал.
- `docs/PRODUCT.md` — сценарий 5: максимальный интервал удалён из продукта; угасание без взаимности — нормальный результат.
- `docs/plans/stage-1-domain.md` — план Stage 1 (approved, выполняется): scope, technical approach, обязательные тесты, acceptance criteria.
- `src/domain/types.ts` — доменные типы (чистый TS).
- `src/domain/scheduling.ts` — множители и `computeNextIntervalDays` (чистая, детерминированная).
- `src/domain/contact.ts` — `Contact`, фабрика, `recordInteraction` (иммутабельно).
- `src/domain/__tests__/scheduling.test.ts` — 31 unit-тест.
- `REVIEW_REPORT.md` — этот отчёт (версия Stage 1; отчёт Stage 0 был в патче 20261007-05).
- `docs/PROJECT_STATE.md` — журнал (Stage 0 approved; Stage 1 выполнен).

## Architecture

- Слои и направление зависимостей — без изменений (`ARCHITECTURE.md`):
  `app → features → {ui, services, data} → domain`. Domain — основание стека.
- Domain остаётся независимым от React / Expo / SQLite, потому что: (1) вся
  продуктовая математика тестируется unit-тестами без эмуляторов (31 тест за
  ~1 с); (2) смена платформы и будущая синхронизация не должны трогать
  бизнес-правила; (3) инфраструктура меняется чаще правил.
- Новые архитектурные решения: правила интервала — чистые функции от явного
  входа (без чтения часов/БД внутри); Contact иммутабелен; таблица множителей —
  экспортируемая константа (прозрачность рекомендаций — принцип `PRODUCT.md`).
- На Stage 3+ (data) остаётся: хранение Contact/Interaction, миграции —
  через порты, объявленные domain.

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

Подтверждения:

- `grow + them + good` позволяет сокращать интервал (× 0.8; 10 → 8).
- `grow + me` сам по себе не позволяет сокращать интервал (good → × 1.4).
- `no_reply` приводит к увеличению интервала (× 2.2, независимо от стратегии;
  каждый новый no_reply умножает текущий интервал ещё раз: 10 → 22 → 48 → 106).

Реализовано в `src/domain` и покрыто тестами (этот пункт ТЗ Stage 0/1:
«задокументировано, но не реализовано» — снят: на Stage 1 реализация разрешена
и выполнена).

## Verification

### lint
Команда:
npm run lint

Результат:
`eslint .` — без предупреждений и ошибок (exit code 0), 2026-10-08.

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
(1 suite — smoke placeholder-экрана Stage 0, 1 — scheduling Stage 1.)

## Manual verification

- Греп-проверка `src/` — в `src/domain` нет импортов react / expo /
  react-native / sqlite / UI; продуктовых экранов и хранилища не появилось.
- Сверка таблицы множителей в коде с утверждённой таблицей `docs/DOMAIN.md` —
  совпадает построчно; производные ячейки помечены в обоих местах.
- Секретов нет (`git ls-files`), build-артефактов нет, `git status` чистый
  после коммитов.
- Согласованность: `DOMAIN.md` ↔ `PRODUCT.md` ↔ `ARCHITECTURE.md` ↔ код.

## Dependencies

Новые зависимости Stage 1 — **отсутствуют**: домен и тесты написаны на уже
установленных `typescript`, `jest`, `jest-expo`, `@types/jest`. Лишних
зависимостей не добавлено.

## Deviations

- Стартовый интервал контакта без истории принят `INITIAL_INTERVAL_DAYS = 7` —
  в решениях владельца значение не задано (см. Open questions).
- Производные ячейки таблицы (maintain+mutual, grow+mutual+short,
  no_reply при mutual) выведены из утверждённых правил — в утверждённом списке
  их не было; зафиксированы в `DOMAIN.md` и тестах.
- Ветка Stage 1 (`feat/stage-1-domain`) создана от последнего коммита
  `chore/project-foundation` (до merge PR Stage 0 в main) — см. Suggested Git commit.
- `REVIEW_REPORT.md` заменён отчётом Stage 1 (предыдущий — про Stage 0 — был в
  патче 20261007-05 и в истории git).

## Open questions

1. Стартовый интервал нового контакта без истории: сейчас 7 дней — подтвердить
   или задать значение.
2. Схема БД / `src/data` (репозитории, миграции) — отдельный Stage 2 или часть
   следующего этапа (вопрос переносится из Stage 0, решения пока нет).

## Risks / Review focus

- Проверить таблицу множителей в `src/domain/scheduling.ts` построчно против
  утверждённого списка (11 ячеек) — это сердце продукта.
- Производные правила mutual — подтверждить трактовку (они не были явными
  в решениях).
- Поведение «без потолка»: интервал уходит в сотни дней — убедиться, что это
  желаемый UX для_stage 2+ (напоминания при таком интервале).
- Тесты — 31 шт., но это первые domain-тесты: оценить стиль/полноту как
  эталон для следующих этапов.

## Stage boundary

- Stage 2 implementation has NOT started.
- No UI / SQLite / repositories / notifications / backend code has been added.
- Domain layer remains pure TypeScript (no React / Expo / SQLite / UI imports).

## Suggested Git commit

Незакоммиченные изменения на момент отчёта — только `REVIEW_REPORT.md` и
`docs/PROJECT_STATE.md`; код и правила уже в трёх логических коммитах
(`80df9b9` docs, `dffc56f` feat, `2d0abec` test). Поэтому владелец делает один
завершающий коммит.

Commit message:

```text
docs(project): complete stage 1 and update review report
```

Команды на ноутбуке после синхронизации (текущая ветка — `feat/stage-1-domain`):

```bash
git status
git diff --ignore-cr-at-eol
git add REVIEW_REPORT.md docs/PROJECT_STATE.md
git commit -m "docs(project): complete stage 1 and update review report"
git push -u origin feat/stage-1-domain
```

Замечание по порядку веток: `feat/stage-1-domain` ответвлялась от
`chore/project-foundation`. Сначала смержи PR Stage 0 (`chore/project-foundation`
→ `main`), затем пушь и PR этой ветки — GitHub покажет в Stage 1 PR только
доменные изменения. Force push не нужен и не используется.

## Review handoff

Stage 1 ready for external review.
Stage 2 not started.
Waiting for approval.
