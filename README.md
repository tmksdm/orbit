# Orbit («Орбита») — Stage 2

Мобильное приложение, помогающее не терять полезные и интересные социальные связи:
пользователь добавляет людей, фиксирует факты общения, а приложение подсказывает,
когда стоит связаться снова. Local-first, без регистрации и backend. Первая
платформа — Android.

**Статус:** Stage 2 — Data Layer реализован (порты репозиториев в `src/domain`,
их реализация на Expo SQLite в `src/data`: схема, миграции, атомарная фиксация
взаимодействия). Stage 1 (domain) — принят. Stage 3 (UI) **не начат**;
UI, напоминания и остальные продуктовые функции ещё не реализованы. Текущее
состояние и следующий шаг — `docs/PROJECT_STATE.md`.

## Стек

- Expo (SDK 57) + React Native + Expo Router
- TypeScript (strict)
- ESLint + Prettier
- Jest + React Native Testing Library
- GitHub Actions (CI: lint / typecheck / test)

## Требования

- Node.js 22, npm 10+

## Команды

| Команда | Что делает |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | запуск на Android (эмулятор/устройство) |
| `npm run lint` | ESLint |
| `npm run typecheck` | проверка типов TypeScript (`tsc --noEmit`) |
| `npm test` | Jest + React Native Testing Library |
| `npm run format` | Prettier по проекту |

## Структура

```text
src/
  app/        # экраны и навигация (expo-router) — сейчас один placeholder Stage 0
  domain/     # чистая бизнес-логика, без React/Expo/SQLite/UI — реализована на Stage 1
  data/       # хранилище и репозитории (порты domain) — реализовано на Stage 2 (Expo SQLite)
  services/   # системные сервисы (platform API)
  features/   # фичевые модули, связывающие UI и domain
  ui/         # переиспользуемые UI-компоненты без бизнес-правил
docs/         # документация, планы стадий, ADR
tools/sync/   # синхронизация с ноутбуком (см. docs/SYNC.md)
```

Правила слоёв и направление зависимостей — `ARCHITECTURE.md`.

## Документация

- `AGENTS.md` — операционный контракт для coding agents (начни с него)
- `docs/PRODUCT.md` — продуктовое видение и принципы
- `docs/DOMAIN.md` — domain-концепции (Contact, Interaction, maintain/grow)
- `docs/DEVELOPMENT.md` — ветки, коммиты, PR, цикл разработки
- `docs/TESTING.md` — тестовая стратегия
- `docs/plans/` — планы стадий и шаблон плана
- `docs/decisions/` — ADR
- `docs/SYNC.md` — обмен файлами с ноутбуком пользователя
