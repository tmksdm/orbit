# DEVELOPMENT.md — процесс разработки

## Branching strategy

- `main` — стабильная ветка; изменения попадают только через PR.
- На каждый Stage/этап — отдельная ветка:
  - `feat/<theme>` — новые функции;
  - `chore/<theme>` — инфраструктура и тулинг (сейчас: `chore/project-foundation`);
  - `fix/<theme>` — исправления.

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

## Pull Request workflow

1. Ветка от `main`; работа строго по плану Stage (`docs/plans/`).
2. Перед PR локально зелёные: `npm run lint`, `npm run typecheck`, `npm test`.
3. PR в `main`; CI (`.github/workflows/ci.yml`) на каждом PR гоняет lint,
   typecheck и тесты — падение любой команды блокирует merge.
4. Merge — только после ревью и зелёного CI. Свой PR сам себе не аппрувим.
5. В PR — краткое описание «что и почему»; изменения документации — в том же PR.

## Правила цикла разработки

1. **One Stage per development cycle.** За один цикл выполняется один Stage,
   не больше.
2. **Следующий Stage стартует только после review/approval** результатов
   предыдущего (см. `AGENTS.md`).
3. Перед завершением — обновить `docs/PROJECT_STATE.md` (только проверенные факты).
