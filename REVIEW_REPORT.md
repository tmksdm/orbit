# Stage Review Report

## Stage

Stage 0 — Project Foundation & Agent Development Environment

## Status

Ready for external review.

## Summary

Создан с нуля фундамент приложения **Orbit** («Орбита») по ТЗ Stage 0:

- каркас Expo SDK 57 + React Native 0.86 + TypeScript (expo-router), сведённый к одному
  placeholder-экрану `src/app/index.tsx` («Orbit — Stage 0»);
- TypeScript strict + `noUncheckedIndexedAccess`;
- тулинг: ESLint 9 (flat config, `eslint-config-expo` + `eslint-config-prettier`),
  Prettier, Jest (jest-expo) + React Native Testing Library; команды `npm run lint`,
  `npm run typecheck`, `npm test`, `npm run format` — проверены, зелёные;
- архитектурные каталоги `src/{domain,data,services,features,ui}` — пустые (`.gitkeep`),
  продуктовой логики нет;
- документация: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `docs/PRODUCT.md`,
  `docs/DOMAIN.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/SYNC.md`,
  `docs/PROJECT_STATE.md`, ADR `docs/decisions/001-local-first.md`,
  `docs/plans/TEMPLATE.md`, draft-план `docs/plans/stage-1-domain.md`;
- domain-правила `maintain` / `grow` зафиксированы в `docs/DOMAIN.md` по уточнению
  владельца (типы, 6 правил с предварительными множителями, границы 2/45 дней,
  инвариант, таблица поведения, открытые вопросы) — **не реализованы в коде**;
- CI: `.github/workflows/ci.yml` (lint → typecheck → test на PR/push в `main`);
- git: `main` + ветка `chore/project-foundation`, 10 логических Conventional Commits;
- синхронизация с ноутбуком владельца: `tools/sync/make_patch.sh`, `docs/SYNC.md`.

## Requirements coverage

| Требование Stage 0 | Статус |
|---|---|
| Expo + React Native + TypeScript проект, запускается | implemented |
| Минимальный placeholder-экран (без продуктовых экранов) | implemented |
| TypeScript strict mode | implemented (strict + noUncheckedIndexedAccess) |
| ESLint | implemented |
| Prettier | implemented |
| Jest | implemented |
| React Native Testing Library | implemented |
| `npm run lint` / `typecheck` / `test` реально выполняются | implemented (см. Verification) |
| Каталоги `src/{domain,data,services,features,ui}` без продуктовой логики | implemented |
| Domain не зависит от React / Expo / SQLite / UI | implemented (структурно: в `src/domain` только `.gitkeep`; правило зафиксировано в `ARCHITECTURE.md`, `AGENTS.md` п.5) |
| `AGENTS.md` — операционный контракт | implemented (+ «Ритуал завершения Stage») |
| `README.md`, `ARCHITECTURE.md`, `docs/{PRODUCT,DOMAIN,DEVELOPMENT,TESTING}.md` | implemented |
| ADR `docs/decisions/001-local-first.md` | implemented |
| `docs/plans/TEMPLATE.md` | implemented |
| `docs/plans/stage-1-domain.md` (draft, не выполняется) | implemented |
| GitHub Actions CI (lint/typecheck/test на PR, падение при ошибке) | implemented — workflow создан; фактический прогон в Actions пока невозможен (нет remote, push делает владелец) |
| Git: ветка `chore/project-foundation`, Conventional Commits, малые коммиты | implemented |
| Pull Request из `chore/project-foundation` в `main` | not implemented — у среды разработки нет доступов к GitHub; PR создаёт владелец вручную после push (см. Suggested Git commit) |
| Финальные проверки: git status / git diff / без секретов / нет Stage 1 / документация согласована | implemented (см. Manual verification) |

## Changed files

- `package.json` — Expo SDK 57 + expo-router; скрипты `lint` / `typecheck` / `test` / `format`; dev-зависимости Jest/RNTL/ESLint/Prettier.
- `tsconfig.json` — strict + `noUncheckedIndexedAccess`, типовой tsconfig Expo.
- `eslint.config.js`, `.prettierrc`, `.prettierignore` — линт и форматирование.
- `jest.config.js` — preset `jest-expo`, тестовое окружение RNTL.
- `src/app/index.tsx` — единственный placeholder-экран («Orbit», «Stage 0 — project foundation»).
- `src/app/_layout.tsx` — минимальный корневой layout (Expo Router).
- `src/{domain,data,services,features,ui}/.gitkeep` — пустые слои.
- `__tests__/index.test.tsx` — smoke-тест placeholder-экрана.
- `AGENTS.md` — контракт агента: 10 правил, карта документов, команды, протокол обмена, «Ритуал завершения Stage».
- `README.md` — стартовая справка (стек, команды, структура).
- `ARCHITECTURE.md` — слои, направление зависимостей, порты данных.
- `docs/PRODUCT.md` — назначение, проблема, принципы, стратегии, НЕ-цели, сценарии MVP.
- `docs/DOMAIN.md` — глоссарий, типы `ContactStrategy`/`Initiator`/`Outcome`, 6 правил интервала, границы 2/45 дней, инвариант, таблица поведения, открытые вопросы.
- `docs/DEVELOPMENT.md` — ветки, Conventional Commits, PR-процесс, «один Stage за цикл».
- `docs/TESTING.md` — стратегия тестов по слоям, блокирующий CI.
- `docs/SYNC.md` — протокол обмена файлами с ноутбуком (AI Drive, аккаунты).
- `docs/PROJECT_STATE.md` — журнал состояния (проверенные факты, следующий шаг).
- `docs/decisions/001-local-first.md` — ADR: local-first, без backend/auth/sync.
- `docs/plans/TEMPLATE.md` — шаблон плана Stage (Goal/Scope/Out of scope/Acceptance criteria/…).
- `docs/plans/stage-1-domain.md` — draft-план Stage 1 (domain model + scheduling), не выполнялся.
- `tools/sync/make_patch.sh` — сборка и выкладка патча агентом (поле `account:` в метаданных).
- `.github/workflows/ci.yml` — CI workflow (Node 22 → npm ci → lint → typecheck → test).
- `.gitattributes` (`* text=auto eol=lf`), `app.json`, `assets/` — конфигурация приложения и переводы строк.

## Architecture

- **Структура (по `ARCHITECTURE.md`):** слои `domain` / `data` / `services` / `features` / `ui` (+ `app` — экраны и роутинг Expo Router). Сейчас каталоги пустые, кроме `src/app` (один экран) и `__tests__`.
- **Направление зависимостей — строго вниз:** `app → features → {ui, services, data} → domain`; доступ к данным — через порты, объявленные в domain, реализации — в `data` (Expo SQLite в будущем).
- **Почему domain независим:** вся продуктовая математика (рекомендации интервалов) должна тестироваться unit-тестами без эмуляторов, переживать смену платформы (Android → iOS) и будущую синхронизацию без переписывания; React/Expo/SQLite/UI — инфраструктура, которая меняется чаще, чем бизнес-правила.
- **Принятые решения:** local-first без backend (ADR-001); «плоская» структура слоёв без лишних абстракций; single source of truth по доменным правилам — `docs/DOMAIN.md`; строгий TS; порты для хранилища.
- **Сознательно оставлено на Stage 1:** реализация `Contact` / `Interaction` в TypeScript, вычисление adaptive interval, точные множители и обработка `mutual`, тесты domain-логики (unit).

## Domain specification

Текущее понимание (зафиксировано в `docs/DOMAIN.md`, источник истины — уточнение владельца):

- **maintain** — «не потерять, не навязываться»: при инициативе в основном от пользователя интервалы постепенно увеличиваются; входящая инициатива другого — сигнал взаимности, интервал не обязан расти; сама стратегия никогда не сокращает интервал.
- **grow** — «сближаться только вслед за взаимностью»: частота растёт только при положительных сигналах со стороны другого человека; желание пользователя сблизиться сигналом не считается.
- **initiator** — `me` / `them` / `mutual`; **outcome** — `good` / `short` / `no_reply`.
- **adaptive interval** — рекомендуемый интервал до следующего контакта, пересчитывается по истории взаимодействий и стратегии.
- **min/max interval** — жёсткие границы (предварительно 2 и 45 дней), ни одна стратегия не выходит за них.

Подтверждения:

- `grow + them + good` позволяет сокращать интервал (предварительно × 0.8).
- `grow + me` сам по себе не позволяет сокращать интервал (good → × 1.4, как в maintain).
- `no_reply` приводит к увеличению интервала (× 2.2, приоритет над стратегией `grow`).

Эти правила **задокументированы, но не реализованы в коде** — реализация на Stage 1.

## Verification

### lint
Команда:
npm run lint

Результат:
`eslint .` — выполнился без предупреждений и ошибок (exit code 0).

### typecheck
Команда:
npm run typecheck

Результат:
`tsc --noEmit` — без ошибок (exit code 0).

### tests
Команда:
npm test

Результат:
```text
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Ran all test suites.
```

## Manual verification

- Наличие и корректность всех обязательных файлов Stage 0 — 14/14 (список выше).
- TypeScript strict подтверждён (`tsconfig.json`: `"strict": true`, `noUncheckedIndexedAccess: true`).
- Поиск по `src/` и `__tests__/` (schedul / adaptive / maintain / grow / notification / contact) — продуктовой логики Stage 1 в коде нет.
- Секреты: `git ls-files` — `.env*`, ключи, креды отсутствуют; build-артефактов и временных файлов в репозитории нет (`git status` чистый).
- Согласованность документации: `PRODUCT.md` ↔ `DOMAIN.md` ↔ `ARCHITECTURE.md` — определения maintain/grow единые, направление зависимостей совпадает, противоречий нет.
- Git: ветка `chore/project-foundation`, 10 коммитов (Conventional Commits), дерево чистое.
- Синхронизация: патчи `20261007-01…04` выложены в `/orbit_sync/to_laptop`; кит v4 (с пунктом 8 «Сменить аккаунт», совместимостью с Windows PowerShell 5.1) проверен распаковкой.

## Dependencies

Основные:

- `expo`, `expo-router`, `react`, `react-native` — каркас приложения и навигация (Expo SDK 57).
- `typescript` — строгая типизация (`tsc --noEmit`).
- `eslint` + `eslint-config-expo` — линт с правилами Expo/React Native.
- `eslint-config-prettier` — отключение стилистических правил ESLint в пользу Prettier.
- `prettier` — форматирование.
- `jest` + `jest-expo` — тест-раннер с preset для Expo/React Native.
- `@testing-library/react-native` — тестирование React Native компонентов.
- `@types/jest`, `@types/react` — типы для тестов и React.

Потенциально лишние: из шаблона `create-expo-app` остались сопутствующие пакеты
(`expo-constants`, `expo-font`, `expo-image`, `expo-linking`, `expo-splash-screen`,
`expo-status-bar`, `expo-symbols`, `expo-system-ui`, `expo-web-browser`,
`expo-glass-effect`, `expo-device`, `@expo/ui`, `react-native-web` и сопутствующие
react-native-*). Часть из них нужна expo-router/платформам; чистка остатков шаблонного
UI — кандидат на отдельный chore-коммит, в Stage 0 не выполнялась (ТЗ, ч. 1: не удалять
без веской причины).

## Deviations

- Push и Pull Request не выполнялись — у среды нет доступов к GitHub; команды для владельца — в разделе Suggested Git commit.
- `noUncheckedIndexedAccess: true` добавлен сверх strict (строже ТЗ).
- Сверх ТЗ (по инструкциям владельца в процессе Stage 0): `tools/sync/make_patch.sh` + `docs/SYNC.md` (протокол обмена), `docs/PROJECT_STATE.md` (журнал), `REVIEW_REPORT.md` (этот отчёт), `.gitattributes`.
- Git identity коммитов Stage 0 — `Orbit Agent <orbit-agent@localhost>` (рабочая среда без аккаунта владельца); при желании историю можно переписать перед push, иначе оставить как есть.
- Шаблонный `LICENSE` (MIT), `.vscode/` и шаблонные зависимости оставлены (ТЗ, ч. 1).
- Smoke-тест использует `await render(...)` — асинхронный API @testing-library/react-native v14.

## Open questions

1. **`mutual`**: точная обработка взаимной инициативы — согласовать до реализации Stage 1 (сейчас — «возможно уменьшить», TBD в `DOMAIN.md`).
2. **Недостающие множители**: `maintain + me + short` и `maintain + them + short` — заданы только направления («увеличить сильнее», «сохранить или слегка увеличить»); нужны точные значения или полномочия предложить на Stage 1.
3. **Накопление**: поведение при повторных однотипных взаимодействиях (например, несколько `no_reply` подряд — каждый раз × 2.2 до max?).
4. **Data layer**: схема БД и `src/data` (репозитории, миграции) — отдельный Stage после Stage 1 или его часть?
5. **Чистка шаблонных зависимостей** (см. Dependencies) — делать ли отдельным chore-коммитом?

## Risks / Review focus

- **CI не был исполнен** в GitHub Actions (нет remote в среде разработки): при первом push проверить, что `.github/workflows/ci.yml` зелёный (Node 22, `npm ci` + три проверки).
- **Синхронизатор на ноутбуке** (`orbit-sync.ps1`) правился по факту ошибки совместимости с Windows PowerShell 5.1 — стоит прогнать пункты 1/4/3 и убедиться в работоспособности.
- **Переводы строк**: файлы созданы с LF; на Windows `git status` может показывать все файлы изменёнными — реальные изменения смотреть через `git diff --ignore-cr-at-eol` (`.gitattributes` добавлен).
- **Минимальное тестовое покрытие** — один smoke-тест placeholder-экрана: это сознательный объём Stage 0; domain-тесты появятся на Stage 1.
- **Коммиты с identity агента** — см. Deviations.

## Stage boundary

- Stage 1 implementation has NOT started.
- No scheduling algorithm has been implemented.
- No product functionality outside Stage 0 has been intentionally added.

## Suggested Git commit

Текущие незакоммиченные изменения: `REVIEW_REPORT.md` (новый), `AGENTS.md`
(раздел «Ритуал завершения Stage»), `docs/PROJECT_STATE.md` (записи журнала).
Это один логический набор «подготовка к ревью» — предлагается один коммит.

Commit message:

```text
docs(project): add stage 0 review report and stage completion workflow
```

Команды на ноутбуке после синхронизации (текущая ветка — `chore/project-foundation`):

```bash
git status
git diff --ignore-cr-at-eol        # реальный diff без шума переводов строк
git add REVIEW_REPORT.md AGENTS.md docs/PROJECT_STATE.md
git commit -m "docs(project): add stage 0 review report and stage completion workflow"
git push -u origin chore/project-foundation
```

После push — создать PR из `chore/project-foundation` в `main` на GitHub
(merge — не выполнять самостоятельно; `--force` не требуется).

## Review handoff

Stage 0 ready for external review.
Stage 1 not started.
Waiting for approval.
