# TESTING.md — тестовая стратегия

Стратегия зафиксирована на будущее; на Stage 0 реализован smoke-тест placeholder-экрана.

## Слой → вид тестов

| Слой | Вид тестов | Инструмент |
|---|---|---|
| domain (логика, алгоритмы) | unit-тесты чистых функций | Jest |
| data (repositories, БД) | integration-тесты (реальный SQL: хранение, миграции, транзакции) | Jest + драйвер `SqlDatabase` на `node:sqlite` |
| UI-critical потоки | компонентные тесты | React Native Testing Library |
| сборка и команды | CI-проверки | GitHub Actions |

## Правила

1. **CI блокирует merge при падающих тестах.** Workflow `.github/workflows/ci.yml`
   запускает `npm run lint`, `npm run typecheck`, `npm test` на каждый PR и падает
   при ошибке любой команды.
2. **Тесты не ослабляются ради зелёного CI** (см. `AGENTS.md`, правило 7):
   падение — повод чинить код или явно обсудить сам тест.
3. Новая логика в domain попадает в репозиторий только вместе с unit-тестами.
4. Баги чинятся так: сначала падающий тест, воспроизводящий баг, затем фикс.
5. Каждый Stage держит smoke-уровень: приложение стартует, ключевой экран рендерится.

## Что уже есть

- `src/domain/__tests__/scheduling.test.ts` — 30 domain-тестов Stage 1.
- `src/data/__tests__/*.test.ts` — 20 интеграционных тестов Stage 2 (репозитории,
  миграции и идемпотентность, атомарная фиксация с rollback, foreign keys).
  Исполняются на реальном `node:sqlite` через тестовый драйвер
  `src/data/testing/nodeSqliteDriver.ts` — тот же SQL, что и прод (`expo-sqlite`).
- `__tests__/index.test.tsx` — smoke-тест главного экрана (Jest + jest-expo +
  React Native Testing Library).
- **Stage 3:** unit due-логики (`src/domain/__tests__/due.test.ts`), unit
  use-cases на подменных портах (`src/features/__tests__/orbitServices.test.ts`),
  интеграционные миграция v2 + due (`src/data/__tests__/dueMigration.test.ts`),
  компонентные RNTL: форма добавления (`src/app/__tests__/addContactScreen.test.tsx`)
  и карточка контакта (`src/app/__tests__/contactCardScreen.test.tsx`).
  В этих тестах `react-native-svg` заменяется стáбом через `jest.mock`
  (нативные SVG-компоненты в тестовой среде недоступны).
