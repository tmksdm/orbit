# ARCHITECTURE.md — архитектура проекта

Зафиксированные слои и правила зависимостей. Преднамеренно просто: детали будут
уточняться на следующих стадиях, но эти правила — жёсткие.

## Слои

| Слой | Каталог | Ответственность |
|---|---|---|
| domain | `src/domain` | чистая бизнес-логика: сущности (Contact, Interaction), стратегии, расчёт рекомендаций. Чистый TypeScript — без React, Expo, SQLite, UI и сети |
| data | `src/data` | хранилище и репозитории (Expo SQLite и др.); реализуют интерфейсы (порты), объявленные в domain |
| services | `src/services` | системные сервисы вокруг приложения (уведомления, дата/время и т.п.); изолируют platform API |
| features | `src/features` | фичевые модули: связывают UI с domain через data/services |
| ui | `src/ui` | переиспользуемые UI-компоненты без бизнес-правил |
| app | `src/app` | экраны и навигация (Expo Router); композиция |

## Направление зависимостей

```text
app (экраны, роутинг)
  └── features
        ├── ui           (компоненты без правил)
        ├── services     (platform API)
        └── data         (хранилище, порты domain)
              └── domain (чистая логика)
```

## Правила

1. **Зависимости направлены вниз.** Верхний слой знает нижний, но не наоборот.
2. **Domain не зависит от инфраструктуры.** В `src/domain` нет импортов react, expo,
   react-native, sqlite и UI — только чистый TypeScript. Логика тестируется
   unit-тестами без эмуляторов и переносима.
3. **UI не содержит domain business rules.** Экраны отображают состояние и вызывают
   use cases (features); расчёты и правила живут в `src/domain`.
4. **Доступ к данным — через порты.** Интерфейсы репозиториев объявляет domain,
   реализации (например, Expo SQLite) — `src/data`. Так позже можно добавить
   синхронизацию или другую БД, не переписывая domain layer.
5. **Не усложнять.** Без лишних абстракций и слоёв «на вырост»: новая абстракция
   появляется только со второй реализацией или реальной потребностью Stage.

## Слой данных (Stage 2)

- Порты репозиториев объявлены в `src/domain/ports.ts` (`ContactRepository`,
  `InteractionRepository`); реализация — `src/data` (направление DATA → DOMAIN).
- Продовый драйвер — `expo-sqlite` (`expoSqliteDriver.ts`) поверх минимального
  интерфейса `SqlDatabase` (`sqlDatabase.ts`); тесты исполняют тот же SQL на
  `node:sqlite` (тестовый драйвер `src/data/testing/`).
- Схема и миграции — `migrations.ts` (forward-only, `PRAGMA user_version`);
  `PRAGMA foreign_keys = ON` включается при открытии БД (`dataLayer.ts`).
- Фиксация взаимодействия — data-level unit-of-work (`interactionRecorder.ts`):
  запись `Interaction` и обновлённого `Contact` в одной транзакции. Расчёт
  интервала остаётся в domain (`recordInteraction`), репозитории его не дублируют.

Тестовая стратегия по слоям — `docs/TESTING.md`. Понятия domain — `docs/DOMAIN.md`.
