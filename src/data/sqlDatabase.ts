/**
 * Минимальный драйверный интерфейс доступа к SQLite.
 *
 * Свой интерфейс слоя data (не доменный). Продовая реализация — `expo-sqlite`
 * (`expoSqliteDriver.ts`), тестовая — `node:sqlite`
 * (`testing/nodeSqliteDriver.ts`). Драйвер отвечает только за исполнение SQL:
 * сами SQL-строки и логика живут в `migrations.ts` и репозиториях, поэтому прод
 * и тесты исполняют один и тот же SQL (docs/plans/stage-2-data.md).
 *
 * API асинхронный: продовый драйвер (`expo-sqlite`) асинхронный.
 */

/** Значение, допустимое как связанный параметр SQL. */
export type SqlParam = string | number | null;

/** Результат изменяющего запроса. */
export interface SqlRunResult {
  /** Число затронутых строк. */
  readonly changes: number;
  /** rowid последней вставленной строки. */
  readonly lastInsertRowId: number;
}

/** Минимальный драйвер доступа к SQLite. */
export interface SqlDatabase {
  /** Выполняет один или несколько SQL-операторов без параметров (DDL, PRAGMA). */
  exec(sql: string): Promise<void>;
  /** Выполняет изменяющий оператор с параметрами. */
  run(sql: string, params?: readonly SqlParam[]): Promise<SqlRunResult>;
  /** Читает строки (SELECT / PRAGMA, возвращающие результат). */
  all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  /**
   * Выполняет `work` внутри одной эксклюзивной транзакции: `BEGIN` → `work(tx)`
   * → `COMMIT`, при ошибке — `ROLLBACK`, ошибка пробрасывается дальше.
   *
   * `work` получает транзакционный контекст `tx` — это тот же интерфейс, но
   * привязанный к транзакции исполнитель. Все запросы атомарной операции
   * ОБЯЗАНЫ идти через `tx`, иначе они выполняются вне транзакции
   * (важно для `expo-sqlite`, где только транзакционный контекст изолирован).
   */
  transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T>;
  /** Закрывает соединение. */
  close(): Promise<void>;
}
