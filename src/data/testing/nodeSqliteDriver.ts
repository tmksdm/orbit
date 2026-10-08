/**
 * Тестовый драйвер `SqlDatabase` поверх встроенного `node:sqlite` (Node 22).
 *
 * Исполняет тот же SQL, что и продовый драйвер, — репозитории и раннер миграций
 * тестируются против реальной СУБД, а не заглушки (docs/plans/stage-2-data.md).
 * `node:sqlite` синхронный; интерфейс `SqlDatabase` асинхронный, поэтому методы
 * обёрнуты в `Promise`.
 *
 * `node:sqlite` использует одно соединение, поэтому транзакционный контекст —
 * тот же драйвер: все запросы на этом соединении внутри `BEGIN…COMMIT` входят в
 * транзакцию, как и в `expo-sqlite` при использовании транзакционного `txn`.
 */

import { DatabaseSync } from "node:sqlite";

import type { SqlDatabase, SqlParam, SqlRunResult } from "../sqlDatabase";

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

/** Создаёт in-memory драйвер (по умолчанию) или драйвер по пути к файлу. */
export function createNodeSqliteDriver(path = ":memory:"): SqlDatabase {
  const database = new DatabaseSync(path);
  let inTransaction = false;

  const driver: SqlDatabase = {
    async exec(sql: string): Promise<void> {
      database.exec(sql);
    },

    async run(sql: string, params: readonly SqlParam[] = []): Promise<SqlRunResult> {
      const result = database.prepare(sql).run(...params);
      return {
        changes: toNumber(result.changes),
        lastInsertRowId: toNumber(result.lastInsertRowid),
      };
    },

    async all<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return database.prepare(sql).all(...params) as T[];
    },

    async transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
      if (inTransaction) {
        return work(driver);
      }
      database.exec("BEGIN");
      inTransaction = true;
      try {
        const result = await work(driver);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      } finally {
        inTransaction = false;
      }
    },

    async close(): Promise<void> {
      database.close();
    },
  };

  return driver;
}
