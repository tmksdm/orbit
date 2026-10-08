# Stage Review Report

## Stage

Stage 3 — первый UI на Android. Текущий под-этап: **фаза 5 — реализация RN**
(фазы 0–4 завершены ранее: план APPROVED — коммит `c3244c7`; дизайн **B «Ритм»**
утверждён владельцем; `DESIGN.md` прошёл повторное независимое ревью —
**APPROVED**, коммит `d389810` — и владелец выдал отдельный approval на
реализацию Stage 3 по утверждённым `docs/plans/stage-3-ui.md` и `DESIGN.md`).

## Status

**Фаза 5 (реализация) выполнена. Ожидает: проверки на Android (фаза 6,
выполняет владелец) → внешнего ревью → approval.**

У агента нет Android-окружения; по плану (REVIEW-02) проверка нативного
`expo-sqlite` на устройстве обязательна, и Stage 3 НЕ принимается без неё
(«Stage boundary» плана). Инструкция и чек-лист — ниже, раздел «Manual
verification».

## Что сделано (вертикальный срез F1–F4)

- **Domain** (чистый TS, правила Stage 1 не изменены):
  - `src/domain/due.ts` — новая чистая функция `computeDue` + `addDays`/
    `daysBetween`: reference = дата последнего взаимодействия (`MAX(occurredAt)`)
    или `createdAt`; `nextDueDate = reference + recommendedIntervalDays`;
    `isDue = today >= nextDueDate`; сравнение по ЛОКАЛЬНЫМ календарным датам
    (YYYY-MM-DD) — время суток и DST не сдвигают вердикт; без истории и без
    `createdAt` срок не рассчитывается (вариант A).
  - `Contact` дополнен необязательным `createdAt` (`types.ts`, фабрика
    `createContact` — для новых контактов).
- **Data:** forward-only **миграция v2** — `ALTER TABLE contacts ADD COLUMN
  createdAt TEXT` (nullable; существующие строки остаются `NULL`, никакие даты
  не выдумываются); `contactRepository` читает/пишет `createdAt`. Атомарный
  `recorder` Stage 2 — без изменений.
- **Services:** `clock.ts` (`now()` ISO 8601 / `today()` / `toLocalDate()` —
  внедряется, в тестах подменяется) и `uuid.ts` (`expo-crypto.randomUUID`).
- **Features:** `orbitServices.ts` — use-cases (загрузка списка с группировкой
  «пора / остальные» и сортировкой по решению 2: внутри групп по возрастанию
  `nextDueDate`, без срока — в конце, затем имя NOCASE, затем `id`; карточка;
  добавление с валидацией: имя обязательно, стратегия — явный выбор;
  фиксация через атомарный `recorder` с `occurredAt` = сейчас);
  `runtime.ts` — продовая сборка (БД открывается один раз на запуск).
- **UI/app** (по `DESIGN.md`, поправки 1–3 учтены): три экрана — список
  (секции «Пора связаться»/«Остальные», кольцо ритма с единой семантикой,
  пусто/загрузка-скелетон/ошибка), добавление (поля по §6.2, обязательный
  явный выбор стратегии — радиокнопка на всю карточку, без дефолта), карточка
  контакта (только «Назад» в шапке, кольцо + имя + чип, блок «Пора связаться»,
  2 плитки «следующий контакт»/«взаимодействий», история read-only, шторка
  фиксации, баннер). Токены §2–§4, safe-area через реальные инсеты, шрифты
  Unbounded/Manrope, состояние «срок не рассчитан» — нейтральное кольцо без
  дуги (MINOR-01).
- **Тесты:** 28 новых — unit due (10), unit use-cases на подменных портах (7),
  интеграционные на `node:sqlite`: миграция v1→v2 + due для старых/новых
  контактов, идемпотентность (5), RNTL: smoke списка (1), форма добавления (3),
  карточка (4). Существующие 51 тест не ослаблялись.

## Решения технических уточнений §13 `DESIGN.md` (минимальные)

1. **Нажатие (pressed)** — `android_ripple` (нейтральный `rgba(23,26,33,0.08)`)
   + лёгкое затемнение.
2. **Иконки** — inline-SVG (формы — контурные глифы Feather, MIT), отрисовка
   `react-native-svg`; как в прототипе.
3. **Шрифты** — официальные пакеты `@expo-google-fonts/unbounded` +
   `@expo-google-fonts/manrope` через `expo-font` (уже в зависимостях).
4. **Порог дуги 6%** — оставлено значение прототипа.
5. **Авто-скрытие баннера** — 7 с (как в прототипе), с крестиком.
6. **Даты** — `Intl.DateTimeFormat('ru-RU')`: краткая «4 окт» (история),
   полная «8 октября 2026» (плитка).
7. **Оттенок `muted`** — оставлены утверждённые значения палитры; проверка
   контраста на устройстве — за ручной проверкой (фаза 6).
8. **«Срок не рассчитан» в плитке** — прочерк «—» вместо даты.

Новые зависимости этапа реализации: `expo-crypto` (предусмотрен планом),
`react-native-svg`, `@expo-google-fonts/unbounded`, `@expo-google-fonts/manrope`
(технические решения §10/§13). Нативные SVG-компоненты в тестовой среде
недоступны — в трёх компонентных тестах `react-native-svg` заменяется стáбом
(`jest.mock`), визуальные проверки опираются на соседние Text/View.

## Границы задачи (соблюдены)

- Domain — чистый TS; направление зависимостей `app → features → {ui, services,
  data} → domain` соблюдено; доступ к данным — через фасад Stage 2.
- Утверждённые алгоритмы Stage 1 (множители, `min = 2`, старт = 2, отсутствие
  верхней границы, `no_reply` ×2.0 накопительно) не изменены.
- Демонстрационная логика HTML-прототипа (стартовые интервалы 14/30, «+7/−7»)
  не переносилась; вне-scope функции (уведомления, редактирование/удаление,
  выбор даты, локализация, тёмная тема) не добавлялись.

## Verification

### lint / typecheck

`npm run lint` (eslint .) и `npm run typecheck` (tsc --noEmit) — 0 ошибок,
0 предупреждений, exit code 0 (2026-10-08).

### tests

```text
Test Suites: 13 passed, 13 total
Tests:       79 passed, 79 total
```

Интеграционные тесты исполняются на реальном `node:sqlite` (тот же SQL, что и
прод); компонентные — RNTL с подменными портами и подменным временем.

## Files changed (этот патч)

| Область | Файлы |
|---|---|
| domain | `src/domain/types.ts`, `src/domain/contact.ts`, `src/domain/due.ts` (новый), `src/domain/__tests__/due.test.ts` (новый) |
| data | `src/data/migrations.ts`, `src/data/contactRepository.ts`, `src/data/__tests__/dueMigration.test.ts` (новый) |
| services | `src/services/clock.ts`, `src/services/uuid.ts` (новые) |
| features | `src/features/orbitServices.ts`, `src/features/runtime.ts` (новые), `src/features/__tests__/orbitServices.test.ts` (новый) |
| ui | `src/ui/{tokens,format,icons,Buttons,RhythmRing,ScreenBar,StateViews,ContactListCard,InteractionSheet}` (новые) |
| app | `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/add-contact.tsx` (новый), `src/app/contact/[id].tsx` (новый), `src/app/__tests__/{addContactScreen,contactCardScreen}.test.tsx` (новые) |
| тесты/smoke | `__tests__/index.test.tsx` (перезаписан под главный экран Stage 3) |
| тесты (стаб SVG) | стаб `react-native-svg` через `jest.mock` в трёх компонентных тест-файлах |
| зависимости | `package.json`, `package-lock.json` |
| документация | `README.md`, `docs/DOMAIN.md`, `docs/TESTING.md`, `docs/PROJECT_STATE.md`, `REVIEW_REPORT.md` |

## Manual verification (Android) — выполнить владельцу

**Обязательно для приёмки Stage 3** (план, REVIEW-02). Проверка на `node:sqlite`
не заменяет нативный `expo-sqlite`.

Подготовка: применить патч (`orbit.cmd`, пункт 3, VPN включён), затем в
`D:\Pr\orbit`: `npm install`, `npm run android` (устройство/эмулятор) или
`npx expo start` + Expo Go.

Чек-лист (план Stage 3):
1. Приложение запускается на Android; пустой список → «Пока никого нет».
2. Добавить контакт (имя + явный выбор стратегии) → контакт в списке, интервал = 2.
3. **Рост:** зафиксировать `no_reply` → интервал 2 → 4; повторить → 8.
4. **Сокращение (REVIEW-01):** на контакте `grow` с интервалом 4 (после `no_reply`)
   зафиксировать `them + good` → интервал 4 → 3.
5. **Нижняя граница:** при интервале 2 зафиксировать `them + good` → остаётся 2.
6. Полностью закрыть и перезапустить приложение → контакты, интервалы и история
   на месте (нативный `expo-sqlite` переживает перезапуск).
7. Главный экран: контакты с наступившим сроком — сверху, блок «Пора связаться».
8. Оценить удобство сценариев на телефоне (клавиатура, шторка, кольца).

Результаты зафиксировать в этом отчёте (раздел ниже) перед финальным ревью.

```text
[заполняется владельцем после проверки]
1. …
```

## Deviations (нет продуктовых)

Продуктовое поведение — ровно по утверждённым документам. Технические решения
этапа реализации, выносимые на ревью: перечислены в разделах «§13» и «Новые
зависимости»; клавиатура — стандартный режим «resize» Android (без
KeyboardAvoidingView); список перезагружается при каждом фокусе экрана
(`useFocusEffect`); доступ к истории — через одобренную поверхность
`interactions.listByContact` (без изменений портов); шторка фиксации —
абсолютный оверлей без RN Modal (закрытие — тап по затемнению; аппаратная
«Назад» при открытой шторке не перехватывается — уточнение уровня §13).

## Suggested Git commit

Предлагается 4 логических коммита:

```bash
git add src/domain/types.ts src/domain/contact.ts src/domain/due.ts src/domain/__tests__/due.test.ts docs/DOMAIN.md
git commit -m "feat(domain): due-логика «пора связаться» и Contact.createdAt"

git add src/data/migrations.ts src/data/contactRepository.ts src/data/__tests__/dueMigration.test.ts
git commit -m "feat(data): forward-only миграция v2 (contacts.createdAt)"

git add package.json package-lock.json jest.config.js jest.setup.js src/services src/features src/ui src/app __tests__/index.test.tsx
git commit -m "feat(app): первый UI — список, добавление, карточка (Stage 3, фаза 5)"

git add README.md docs/TESTING.md docs/PROJECT_STATE.md REVIEW_REPORT.md
git commit -m "docs(stage-3): актуализация документации и отчёт фазы 5"

git push
```

## Review handoff

Патч выложен в `/orbit_sync/to_laptop` (версия `20261008-04`; забрать —
`orbit.cmd`, пункт 3, VPN включён). Stage 3 **не завершён**: после Android-
проверки по чек-листу — независимое ревью и approval. Следующий Stage
самостоятельно не начинается (`AGENTS.md`, ритуал).
