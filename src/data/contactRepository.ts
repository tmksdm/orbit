/**
 * Реализация `ContactRepository` (domain-порт) поверх `SqlDatabase`.
 *
 * Направление зависимостей DATA → DOMAIN (ARCHITECTURE.md, правило 4).
 */

import type { ContactRepository } from "../domain/ports";
import type { Contact, ContactStrategy } from "../domain/types";
import type { SqlDatabase } from "./sqlDatabase";

/** Строка таблицы `contacts` (после миграции v2). */
interface ContactRow {
  id: string;
  name: string;
  note: string | null;
  strategy: string;
  minIntervalDays: number;
  recommendedIntervalDays: number;
  /** NULL у существующих до-v2 записей (вариант A — реальная дата не восстанавливается). */
  createdAt: string | null;
}

const SELECT_COLUMNS =
  "id, name, note, strategy, minIntervalDays, recommendedIntervalDays, createdAt";

function toContact(row: ContactRow): Contact {
  const base: Contact = {
    id: row.id,
    name: row.name,
    strategy: row.strategy as ContactStrategy,
    minIntervalDays: row.minIntervalDays,
    recommendedIntervalDays: row.recommendedIntervalDays,
  };
  const withCreatedAt =
    row.createdAt === null ? base : { ...base, createdAt: row.createdAt };
  return row.note === null ? withCreatedAt : { ...withCreatedAt, note: row.note };
}

/** Создаёт реализацию `ContactRepository` поверх драйвера. */
export function createContactRepository(db: SqlDatabase): ContactRepository {
  return {
    async list(): Promise<Contact[]> {
      const rows = await db.all<ContactRow>(
        `SELECT ${SELECT_COLUMNS} FROM contacts ORDER BY name COLLATE NOCASE, id`,
      );
      return rows.map(toContact);
    },

    async getById(id: string): Promise<Contact | null> {
      const rows = await db.all<ContactRow>(
        `SELECT ${SELECT_COLUMNS} FROM contacts WHERE id = ?`,
        [id],
      );
      const row = rows[0];
      return row === undefined ? null : toContact(row);
    },

    async save(contact: Contact): Promise<void> {
      await db.run(
        `INSERT INTO contacts
           (id, name, note, strategy, minIntervalDays, recommendedIntervalDays, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           note = excluded.note,
           strategy = excluded.strategy,
           minIntervalDays = excluded.minIntervalDays,
           recommendedIntervalDays = excluded.recommendedIntervalDays,
           createdAt = excluded.createdAt`,
        [
          contact.id,
          contact.name,
          contact.note ?? null,
          contact.strategy,
          contact.minIntervalDays,
          contact.recommendedIntervalDays,
          contact.createdAt ?? null,
        ],
      );
    },
  };
}
