/**
 * Реализация `InteractionRepository` (domain-порт) поверх `SqlDatabase`.
 *
 * `Interaction` остаётся value-объектом Stage 1 (`initiator`, `outcome`,
 * `occurredAt`); `id` строки — внутренняя деталь data layer (docs/plans/stage-2-data.md).
 */

import type { InteractionRepository } from "../domain/ports";
import type { Interaction, Initiator, Outcome } from "../domain/types";
import type { SqlDatabase } from "./sqlDatabase";

/** Строка таблицы `interactions` (без служебного `id`). */
interface InteractionRow {
  initiator: string;
  outcome: string;
  occurredAt: string;
}

function toInteraction(row: InteractionRow): Interaction {
  return {
    initiator: row.initiator as Initiator,
    outcome: row.outcome as Outcome,
    occurredAt: row.occurredAt,
  };
}

/** Создаёт реализацию `InteractionRepository` поверх драйвера. */
export function createInteractionRepository(db: SqlDatabase): InteractionRepository {
  return {
    async add(contactId: string, interaction: Interaction): Promise<void> {
      await db.run(
        `INSERT INTO interactions (contactId, initiator, outcome, occurredAt)
         VALUES (?, ?, ?, ?)`,
        [contactId, interaction.initiator, interaction.outcome, interaction.occurredAt],
      );
    },

    async listByContact(contactId: string): Promise<Interaction[]> {
      const rows = await db.all<InteractionRow>(
        `SELECT initiator, outcome, occurredAt
           FROM interactions
          WHERE contactId = ?
          ORDER BY occurredAt ASC, id ASC`,
        [contactId],
      );
      return rows.map(toInteraction);
    },
  };
}
