/**
 * Адаптер `SqlDatabase` поверх асинхронного API `expo-sqlite`.
 *
 * Единственный модуль слоя data, зависящий от нативного `expo-sqlite`; тесты
 * используют тестовый драйвер (`testing/nodeSqliteDriver.ts`), исполняющий тот
 * же SQL.
 *
 * Транзакция выполняется через `withExclusiveTransactionAsync`: она даёт
 * эксклюзивный транзакционный контекст `txn`, и только запросы, выполненные
 * через него, действительно идут внутри транзакции и изолированы от
 * параллельных запросов (BLOCKER-01 внешнего ревью Stage 2). Обычный
 * `withTransactionAsync` так не гарантирует изоляцию, поэтому не используется.
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

    async transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
      // `withExclusiveTransactionAsync` не generic — захватываем результат вручную.
      // Все запросы должны идти через транзакционный `txn` (см. `createExpoSqliteDriver(txn)`);
      // при ошибке expo-sqlite откатывает транзакцию и пробрасывает ошибку.
      let outcome: { value: T } | undefined;
      await database.withExclusiveTransactionAsync(async (txn) => {
        const tx = createExpoSqliteDriver(txn);
        outcome = { value: await work(tx) };
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
