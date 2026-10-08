/**
 * Сборка слоя данных поверх готового драйвера.
 *
 * Модуль не импортирует `expo-sqlite` (в отличие от `index.ts`), поэтому его
 * можно использовать в интеграционных тестах и в любой среде без нативного модуля.
 */

import type { ContactRepository, InteractionRepository } from "../domain/ports";
import { createContactRepository } from "./contactRepository";
import { createInteractionRecorder, type InteractionRecorder } from "./interactionRecorder";
import { createInteractionRepository } from "./interactionRepository";
import { runMigrations } from "./migrations";
import type { SqlDatabase } from "./sqlDatabase";

/** Собранный слой данных приложения. */
export interface OrbitDataLayer {
  readonly db: SqlDatabase;
  readonly contacts: ContactRepository;
  readonly interactions: InteractionRepository;
  readonly recorder: InteractionRecorder;
}

/**
 * Подготавливает соединение: включает foreign keys и применяет миграции.
 * `PRAGMA foreign_keys` действует на соединение и вне транзакции, поэтому
 * ставится первым (обязательное уточнение владельца, docs/plans/stage-2-data.md).
 */
export async function prepareDatabase(db: SqlDatabase): Promise<void> {
  await db.exec("PRAGMA foreign_keys = ON");
  await runMigrations(db);
}

/** Собирает репозитории и unit-of-work поверх драйвера. */
export function createDataLayer(db: SqlDatabase): OrbitDataLayer {
  const contacts = createContactRepository(db);
  const interactions = createInteractionRepository(db);
  const recorder = createInteractionRecorder(db, contacts, interactions);
  return { db, contacts, interactions, recorder };
}
