/**
 * Адаптер `SqlDatabase` поверх асинхронного API `expo-sqlite`.
 *
 * Это единственный модуль слоя data, зависящий от нативного `expo-sqlite`;
 * тесты используют тестовый драйвер (`testing/nodeSqliteDriver.ts`), исполняющий
 * тот же SQL.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import type { SqlDatabase, SqlParam, SqlRunResult } from "./sqlDatabase";

/** Оборачивает открытую БД `expo-sqlite` в интерфейс `SqlDatabase`. */
export function createExpoSqliteDriver(database: SQLiteDatabase): SqlDatabase {
  return {
    async exec(sql: string): Promise<void> {
      await database.execAsync(sql);
    },

    async run(sql: string, params: readonly SqlParam[] = []): Promise<SqlRunResult> {
      const result = await database.runAsync(sql, [...params]);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },

    async all<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return database.getAllAsync<T>(sql, [...params]);
    },

    async transaction<T>(work: () => Promise<T>): Promise<T> {
      // `withTransactionAsync` не generic — захватываем результат вручную;
      // при ошибке expo-sqlite откатывает транзакцию и пробрасывает ошибку.
      let outcome: { value: T } | undefined;
      await database.withTransactionAsync(async () => {
        outcome = { value: await work() };
      });
      if (outcome === undefined) {
        throw new Error("Transaction callback did not run");
      }
      return outcome.value;
    },

    async close(): Promise<void> {
      await database.closeAsync();
    },
  };
}
