/**
 * Минимальные ambient-типы node-модулей, используемых ТОЛЬКО тестовым
 * инструментарием слоя data (тестовый драйвер `node:sqlite` и работа с
 * временными файлами в интеграционных тестах).
 *
 * Проект сознательно ограничивает набор глобальных типов (`tsconfig`
 * `types: ["jest"]`) и не тянет `@types/node` в типовую среду приложения;
 * здесь объявлен ровно тот срез API, который нужен тестам.
 */

declare module "node:sqlite" {
  export interface StatementSync {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}

declare module "node:fs" {
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}
