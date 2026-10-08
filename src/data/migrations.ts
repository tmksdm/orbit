/**
 * Миграции схемы SQLite: forward-only, версия через `PRAGMA user_version`.
 *
 * Откатов нет — сознательно для local-first MVP (docs/plans/stage-2-data.md).
 * Раннер идемпотентен: применяются только миграции с версией больше текущей,
 * поэтому повторный запуск не ломает схему.
 */

import type { SqlDatabase } from "./sqlDatabase";

/** Один шаг миграции. */
export interface Migration {
  /** Версия схемы после применения (`PRAGMA user_version`). */
  readonly version: number;
  /** Применяет изменение схемы через переданный транзакционный контекст. */
  readonly up: (tx: SqlDatabase) => Promise<void>;
}

/** Схема версии 1: контакты и отдельная история взаимодействий. */
const SCHEMA_V1_SQL = `
CREATE TABLE contacts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  strategy TEXT NOT NULL,
  minIntervalDays INTEGER NOT NULL,
  recommendedIntervalDays INTEGER NOT NULL
);

CREATE TABLE interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contactId TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  initiator TEXT NOT NULL,
  outcome TEXT NOT NULL,
  occurredAt TEXT NOT NULL
);

CREATE INDEX idx_interactions_contact ON interactions(contactId, occurredAt);
`;

/**
 * Миграция v2: необязательное поле `createdAt` у контактов (план Stage 3,
 * решение владельца — вариант A). Колонка nullable без default: значения
 * существующих строк НЕ заполняются — реальная дата создания не восстанавливается
 * (в том числе НЕ через MIN(occurredAt)). Новые контакты (Stage 3+) записывают
 * фактическое время создания.
 */
const SCHEMA_V2_SQL = `
ALTER TABLE contacts ADD COLUMN createdAt TEXT;
`;

/** Упорядоченный список миграций (по возрастанию версии). */
export const MIGRATIONS: readonly Migration[] = [
  { version: 1, up: (tx) => tx.exec(SCHEMA_V1_SQL) },
  { version: 2, up: (tx) => tx.exec(SCHEMA_V2_SQL) },
];

/** Актуальная версия схемы (версия последней миграции). */
export const SCHEMA_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/** Текущая версия схемы, записанная в БД (`PRAGMA user_version`). */
export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const rows = await db.all<{ user_version: number }>("PRAGMA user_version");
  return rows[0]?.user_version ?? 0;
}

/**
 * Применяет все миграции, версия которых больше текущей. Идемпотентна:
 * при актуальной схеме не выполняет ни одного изменения. Каждая миграция
 * и обновление `user_version` выполняются в одной транзакции.
 */
export async function runMigrations(db: SqlDatabase): Promise<void> {
  let current = await getSchemaVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) {
      continue;
    }
    await db.transaction(async (tx) => {
      await migration.up(tx);
      await tx.exec(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
}
