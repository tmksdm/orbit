# План Stage 2 — Data Layer (порты репозиториев и Expo SQLite)

- Статус: **Approved (2026-10-08) — реализация выполнена**
- Дата постановки: 2026-10-08

Владелец утвердил план одним сообщением с двумя обязательными уточнениями
(атомарная запись Interaction + Contact; явное включение foreign keys SQLite).
Уточнения внесены 2026-10-08 (раздел «Обязательные уточнения владельца»), после
чего план считается approved.

## Goal

Реализовать слой данных local-first: объявить в domain порты репозиториев и
реализовать их на Expo SQLite в `src/data` — хранение контактов и отдельной
истории взаимодействий, версионированные миграции схемы и интеграционные тесты.
Продуктовую логику (scheduling) не трогаем: утверждённые правила Stage 1
(`INITIAL_INTERVAL_DAYS = 2`, множители, `no_reply` ×2.0, `min = 2`, без
`maxIntervalDays`) остаются как есть.

## Scope

- Порты репозиториев в `src/domain/ports.ts` (чистый TypeScript, без React / Expo /
  SQLite / UI) — реализуют принцип `ARCHITECTURE.md`, правило 4.
- Схема SQLite: таблицы `contacts`, `interactions` (+ версия схемы).
- Минимальный драйверный интерфейс `SqlDatabase` и его реализация поверх
  `expo-sqlite`.
- Реализация репозиториев в `src/data`.
- Data-level unit-of-work: атомарная запись Interaction + обновлённого Contact в
  одной SQLite-транзакции (обязательное уточнение владельца, см. ниже).
- Раннер миграций (forward-only, версия схемы через `PRAGMA user_version`).
- Интеграционные тесты репозиториев и миграций.
- Обновление документации (`ARCHITECTURE.md`, `docs/TESTING.md`, при необходимости
  `docs/DOMAIN.md`) и `docs/PROJECT_STATE.md`.

## Out of scope

UI и экраны, `features`, уведомления/напоминания, сидирование дефолтов, cloud sync,
authentication, backend, AI. Изменение scheduling-правил и утверждённых множителей.
Удаление/редактирование контакта и взаимодействий (в MVP не требуется — read-only
история). Генерация идентификатора контакта (нужна на Stage 3 при создании из UI).
Расчёт «кому пора связаться» (due-логика) — Stage 3. Реализация Stage 3 не начинается.

## Technical approach

- Направление зависимостей: `data → domain`. Порты объявляет domain, `src/data`
  даёт реализацию (`ARCHITECTURE.md`, правила 1 и 4).
- Зависимость: `expo-sqlite` ставится через `npx expo install expo-sqlite`
  (совместимая с Expo SDK 57 версия — не хардкодить номер, сверяться с SDK).
- Схема (migration 1):

  ```sql
  CREATE TABLE contacts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    note TEXT,                      -- NULL допустим (note?)
    strategy TEXT NOT NULL,
    minIntervalDays INTEGER NOT NULL,
    recommendedIntervalDays INTEGER NOT NULL
  );
  CREATE TABLE interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contactId TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    initiator TEXT NOT NULL,
    outcome TEXT NOT NULL,
    occurredAt TEXT NOT NULL        -- ISO 8601
  );
  CREATE INDEX idx_interactions_contact ON interactions(contactId, occurredAt);
  ```

- `recordInteraction` остаётся чистой domain-функцией Stage 1; слой данных только
  сохраняет события и обновлённый Contact — расчёт интервала в domain не дублируется.
- Атомарность (обязательное уточнение владельца): фиксация взаимодействия — это
  запись нового `Interaction` И обновлённого `Contact` (`recommendedIntervalDays`
  из domain-функции `recordInteraction`) в рамках ОДНОЙ SQLite-транзакции.
  Реализуется data-level unit-of-work поверх минимального транзакционного API
  драйвера; scheduling-логика остаётся в domain, репозитории не дублируют
  `recordInteraction`.
- Foreign keys (обязательное уточнение владельца): при открытии БД выполняется
  `PRAGMA foreign_keys = ON` (per-connection, вне транзакции), поскольку схема
  использует `REFERENCES contacts(id) ON DELETE CASCADE`.
- Порты асинхронные (Promise), т.к. драйвер `expo-sqlite` асинхронный.
- Репозитории пишутся поверх минимального драйверного интерфейса `SqlDatabase`
  (свой, не доменный); продовый драйвер — `expo-sqlite`, тестовый — in-memory.
- Предлагаемая раскладка `src/data`:
  - `sqlDatabase.ts` — интерфейс драйвера (`exec`, `run`, `all`);
  - `expoSqliteDriver.ts` — реализация поверх `expo-sqlite`;
  - `migrations.ts` — упорядоченные шаги + раннер (`PRAGMA user_version`);
  - `contactRepository.ts`, `interactionRepository.ts` — реализации портов;
  - `index.ts` — открытие БД и сборка репозиториев;
  - `__tests__/` — интеграционные тесты на тестовом драйвере.

## Обязательные уточнения владельца (2026-10-08, внесены)

1. **Атомарная запись Interaction + Contact.** Фиксация взаимодействия состоит из
   двух связанных записей: новый `Interaction` и `Contact` с новым
   `recommendedIntervalDays` (из domain-функции `recordInteraction`). Обе записи
   выполняются атомарно в одной SQLite-транзакции; состояние, при котором
   Interaction записан, а новый interval — нет (или наоборот), недопустимо.
   - scheduling-логика остаётся в domain (`recordInteraction` не дублируется в data);
   - добавлен минимальный транзакционный API на уровне data/`SqlDatabase` и
     data-level unit-of-work фиксации взаимодействия (см. `src/data`);
   - обязательный тест rollback: искусственная ошибка во второй части операции
     не оставляет частично записанных данных.
2. **Явно включить foreign keys SQLite.** При открытии БД выполняется
   `PRAGMA foreign_keys = ON`; наличие/поведение проверяется интеграционным тестом
   (нарушение FK отклоняется, `ON DELETE CASCADE` работает).

## Финальные решения (утверждены владельцем 2026-10-08)

1. **Stage 2 = Data Layer.** Подтверждается: порты + `expo-sqlite` + миграции.
   Прежняя оговорка «Stage 3+» в отчёте снимается. После Stage 2 идёт **Stage 3 —
   первый реально используемый UI на телефоне**; отдельного инфраструктурного этапа
   между ними нет.
2. **Форма портов** — два маленьких порта в `src/domain/ports.ts` (не единый
   «god»-repository):

   ```ts
   import type { Contact, Interaction } from "./types";

   export interface ContactRepository {
     list(): Promise<Contact[]>;
     getById(id: string): Promise<Contact | null>;
     save(contact: Contact): Promise<void>;      // upsert по id
   }

   export interface InteractionRepository {
     add(contactId: string, interaction: Interaction): Promise<void>;
     listByContact(contactId: string): Promise<Interaction[]>; // сортировка по occurredAt
   }
   ```

3. **Async API** — порты возвращают `Promise` (драйвер асинхронный).
4. **Подход к тестам данных.** Репозитории тестируются против тестового драйвера,
   реализующего `SqlDatabase`; прод и тест используют одни и те же SQL-строки и
   раннер миграций. Приоритет — встроенный `node:sqlite` (Node 22, без новой
   зависимости) для реального прогона SQL; запасной вариант — собственный
   in-memory драйвер, реализующий тот же интерфейс (если раннер/CI дают трение).
   Выбор фиксируется коротким спайком в начале Stage 2. Ложная зелёнка недопустима:
   тесты обязаны исполнять SQL, а не проверять заглушку.
5. **Новая зависимость** — только `expo-sqlite` (runtime). Подтвердить.
6. **Миграции** — ручной раннер на `PRAGMA user_version`, forward-only, без
   откатов (осознанно для local-first MVP).
7. **Сидирование дефолтов** — вне scope: Stage 2 хранит, но контакты не создаёт.
   Стартовый интервал = 2 и `no_reply` ×2.0 уже утверждены и не дублируются в data.
8. **Идентичность взаимодействий.** Domain-тип `Interaction` (`initiator`, `outcome`,
   `occurredAt`) не меняется — это value-объект Stage 1. Идентификатор строки
   взаимодействия — внутреннее дело data layer (`INTEGER PRIMARY KEY`); порт отдаёт
   `Interaction[]` без id. Альтернатива (отдельный `InteractionRecord` с `id`) — при
   появлении редактирования/удаления истории, сейчас не требуется.

## Acceptance criteria

- [ ] Порты объявлены в `src/domain/ports.ts` и не импортируют React / Expo /
      react-native / SQLite / UI.
- [ ] Реализации репозиториев в `src/data`; направление `data → domain` соблюдено.
- [ ] Создание и чтение контакта (все поля; `note` пуст и задан), upsert
      `recommendedIntervalDays`; добавление взаимодействия и чтение истории по
      контакту (порядок по `occurredAt`).
- [ ] Миграции применяются при открытии БД и идемпотентны (повторный запуск не
      ломает схему; версия схемы корректна).
- [ ] Фиксация Interaction + Contact атомарна (одна транзакция); rollback-тест
      зелёный; `PRAGMA foreign_keys = ON` включён и проверен тестом.
- [ ] `npm run lint`, `npm run typecheck`, `npm test` — зелёные.
- [ ] Документация обновлена, `docs/PROJECT_STATE.md` дополнен проверенными фактами.
- [ ] Stage 3 не начат.

## Required tests

- Пустая БД → `list()` контактов пуст.
- Создание + чтение контакта: все поля, `note` отсутствует и `note` задан.
- `save` обновляет существующий контакт (upsert), `recommendedIntervalDays` читается обратно.
- `add` взаимодействия + `listByContact` возвращает историю в порядке `occurredAt`.
- История изолирована по `contactId` (события одного не попадают в другой).
- Миграция «с нуля» и повторный запуск (идемпотентность, версия схемы).
- Атомарность: ошибка во второй части фиксации (сохранение Contact) откатывает
  и запись Interaction — частичных данных нет.
- Foreign keys: вставка Interaction с несуществующим `contactId` отклоняется;
  удаление Contact удаляет его Interactions (`ON DELETE CASCADE`).
- Smoke: открытие БД и сборка репозиториев не бросают ошибку.

## Manual verification

- Прогон на эмуляторе/устройстве: открытие БД при старте, добавление данных,
  повторный запуск — данные сохраняются между сессиями.
- Если запуск на устройстве в среде агента недоступен — проверка ограничивается
  интеграционными тестами, и это честно фиксируется в `REVIEW_REPORT.md`.

## Risks

- `expo-sqlite` — нативный модуль; в `jest` (jest-expo) не запускается напрямую.
  Снимается тестовым драйвером (решение 4) + спайк.
- Два драйвера (prod/test) должны исполнять один и тот же SQL — SQL держим в одном
  месте (`migrations.ts` и репозитории), драйвер отвечает только за исполнение.
- Миграции без откатов — осознанно; «на сдачу» forward-only достаточно для MVP.
- Открытый вопрос стартового интервала закрыт (approved = 2 дня); в Stage 2 дефолты
  не сидируются.

## Completion report

Заполняется по завершении: что сделано, коммиты, результаты проверок, отклонения.
По завершении — `REVIEW_REPORT.md`, остановка, ожидание внешнего ревью. Stage 3
самостоятельно не начинается.

## Дорожная карта

- **Stage 2 (этот план):** Data Layer — персистентность.
- **Stage 3:** первый вертикальный UI-срез на телефоне — список «с кем связаться»
  (due), добавление контакта, фиксация взаимодействия и видимый пересчёт интервала.
  Промежуточный инфраструктурный этап между Stage 2 и Stage 3 не вводится.
