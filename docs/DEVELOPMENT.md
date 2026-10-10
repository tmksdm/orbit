# DEVELOPMENT.md — процесс разработки

## Branching strategy

- `main` — стабильная ветка; изменения попадают только через PR.
- На каждый Stage/этап — отдельная ветка от актуального `main`:
  - `feat/<theme>` — новые функции;
  - `chore/<theme>` — инфраструктура и тулинг (сейчас: `chore/project-foundation`);
  - `fix/<theme>` — исправления;
  - `docs/<theme>` — документация и правила процесса.

## Conventional Commits

Формат: `<type>(<scope>): <краткое описание>`.

- типы: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`;
- scope — часть проекта: `project`, `tooling`, `structure`, `domain`, `ui`, `sync`, …;
- описание — с маленькой буквы, без точки в конце;
- коммиты небольшие и логические: один коммит — одно самостоятельное изменение,
  которое можно отревьюить отдельно.

Примеры:

```text
chore(project): initialize Expo TypeScript application
chore(tooling): configure linting formatting and tests
docs(project): add architecture and agent development rules
ci: add validation workflow
```

## Pull Request workflow (GitHub-first)

Основной канал передачи изменений — GitHub. Агент работает в отдельной ветке,
коммитит и пушит её сам в рамках порученной задачи; в `main` изменения попадают
только через Pull Request.

1. Ветка от актуального `main`; работа строго по плану Stage/задаче (`docs/plans/`).
2. Агент коммитит и пушит изменения в рабочую ветку (без отдельной просьбы владельца).
3. Перед PR локально зелёные: `npm run lint`, `npm run typecheck`, `npm test`, плюс
   дополнительные проверки из плана задачи.
4. Агент открывает PR в `main`; CI (`.github/workflows/ci.yml`) на каждом PR гоняет
   lint, typecheck и тесты — падение любой команды блокирует merge.
5. В PR — краткое описание «что и почему»; изменения документации — в том же PR.
6. Независимый ревьюер проверяет PR, код, требования и результаты тестов.
7. Замечания ревью агент исправляет в той же ветке и обновляет PR.
8. Merge в `main` — только после независимого APPROVED и явного разрешения владельца.
   Агент merge не выполняет и следующий Stage самостоятельно не начинает.
9. Свой PR сам себе не аппрувим.

## Правила цикла разработки

1. **One Stage per development cycle.** За один цикл выполняется один Stage,
   не больше.
2. **Следующий Stage стартует только после review/approval** результатов
   предыдущего, включая независимое APPROVED Pull Request'а и явное разрешение
   владельца (см. `AGENTS.md`).
3. Перед завершением — обновить `docs/PROJECT_STATE.md` (только проверенные факты).
