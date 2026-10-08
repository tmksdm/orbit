/**
 * Точка входа слоя данных приложения: открытие локальной БД `expo-sqlite`
 * и сборка репозиториев.
 *
 * Импортирует нативный `expo-sqlite`, поэтому тесты используют
 * `dataLayer.ts` + тестовый драйвер, а не этот модуль.
 */

import * as SQLite from "expo-sqlite";

import { createDataLayer, prepareDatabase, type OrbitDataLayer } from "./dataLayer";
import { createExpoSqliteDriver } from "./expoSqliteDriver";
import type { SqlDatabase } from "./sqlDatabase";

export type { OrbitDataLayer } from "./dataLayer";
export { createDataLayer, prepareDatabase } from "./dataLayer";
export type { SqlDatabase, SqlParam, SqlRunResult } from "./sqlDatabase";
export type { Migration } from "./migrations";
export { MIGRATIONS, SCHEMA_VERSION, getSchemaVersion, runMigrations } from "./migrations";
export { createContactRepository } from "./contactRepository";
export { createInteractionRepository } from "./interactionRepository";
export type { InteractionRecorder } from "./interactionRecorder";
export { ContactNotFoundError, createInteractionRecorder } from "./interactionRecorder";

/** Имя файла локальной БД приложения. */
export const DATABASE_NAME = "orbit.db";

/**
 * Открывает БД приложения, включает foreign keys и применяет миграции.
 * Возвращает собранный слой данных.
 */
export async function openOrbitDatabase(
  name: string = DATABASE_NAME,
): Promise<OrbitDataLayer> {
  const native = await SQLite.openDatabaseAsync(name);
  const db: SqlDatabase = createExpoSqliteDriver(native);
  await prepareDatabase(db);
  return createDataLayer(db);
}
