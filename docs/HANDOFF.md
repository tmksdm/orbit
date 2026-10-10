# HANDOFF.md — быстрый вход в проект Orbit

Короткая «шпаргалка»: где мы сейчас и что делать дальше. Подробный журнал проверенных
фактов — `docs/PROJECT_STATE.md`; правила работы — `AGENTS.md`.

## Текущий Stage
Stage 4 — Local Notifications. План — **APPROVED** (`docs/plans/stage-4-notifications.md`).
Реализация **начата** (поручение владельца 2026-10-10). Фаза 1 (domain + миграция v3)
**одобрена** независимым ревью; выполнена **Фаза 2** (адаптер `expo-notifications` +
`clock.combineLocalDateTime` + зависимость `expo-notifications`) — ожидает независимого
ревью.

## Статус
- Stage 1–3 — **APPROVED** (Stage 3 — финальный коммит `ba96436`).
- План Stage 4 — **APPROVED** (коммит `9e92df7`); решения владельца Q1–Q6 зафиксированы.
- Stage 4, Фаза 1 — **APPROVED** независимым ревью (коммиты `2a07bad`, `b22a54f`).
- Stage 4, Фаза 2 реализована, проверки зелёные, **запушена в `main`**; ожидается
  независимое ревью. Следующая часть — только после разрешения владельца.
- Открытых вопросов и блокирующих замечаний нет.

## Последний принятый результат
Фаза 1 Stage 4 (APPROVED ревью, коммиты `2a07bad`, `b22a54f`). Фаза 2: адаптер
`expo-notifications` (`src/services/notifications.ts`), `clock.combineLocalDateTime`,
зависимость `expo-notifications ~57.0.22`; проверки lint/typecheck/test — зелёные.

## Текущая задача
Остановка после Фазы 2 в ожидании независимого ревью и разрешения владельца на
следующую часть (Фаза 3 плана — `syncNotifications` и use-cases настроек).

## Workflow
Агент работает напрямую в `main`: проверки → просмотр `git diff` → commit → push.
Ветки и Pull Request'ы не используются. Следующий Stage — только с явного разрешения
владельца. Детали — `AGENTS.md` (раздел «Workflow»), `docs/DEVELOPMENT.md`.

## Незакрытые вопросы
Нет (Q1–Q6 закрыты решениями владельца).

## Куда смотреть
- `AGENTS.md` — контракт агента и workflow.
- `docs/PROJECT_STATE.md` — подробный журнал состояния.
- `docs/plans/stage-4-notifications.md` — утверждённый план Stage 4.
- `docs/PRODUCT.md`, `docs/DOMAIN.md`, `ARCHITECTURE.md`, `DESIGN.md` — по необходимости.
