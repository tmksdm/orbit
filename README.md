# Orbit («Орбита») — Stage 3

Мобильное приложение, помогающее не терять полезные и интересные социальные связи:
пользователь добавляет людей, фиксирует факты общения, а приложение подсказывает,
когда стоит связаться снова. Local-first, без регистрации и backend. Первая
платформа — Android.

**Статус:** Stage 3 — первый UI на Android. План **APPROVED**, дизайн **B «Ритм»**
утверждён (`DESIGN.md`). **Фаза 5 (реализация) выполнена** (2026-10-08): список
контактов с экраном «с кем пора связаться», добавление контакта, карточка с
фиксацией взаимодействия; due-логика — `src/domain/due.ts`; миграция SQLite v2
(`contacts.createdAt`); данные — локальный SQLite (Stage 2). **Фаза 6 (проверка
нативного `expo-sqlite` на Android) — за владельцем**; Stage 3 не закрыт до
проверки и ревью. Текущее состояние и следующий шаг — `docs/PROJECT_STATE.md`.

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
  app/        # экраны и навигация (expo-router): список, добавление, карточка — Stage 3
  domain/     # чистая бизнес-логика: scheduling (Stage 1) + due (Stage 3)
  data/       # хранилище и репозитории (порты domain) — Expo SQLite, миграции v1–v2
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
