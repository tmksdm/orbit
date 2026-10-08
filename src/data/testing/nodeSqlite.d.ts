/**
 * Минимальные типы экспериментального модуля `node:sqlite` (используется только
 * тестовым драйвером). Проект не тянет `@types/node` в продовые зависимости;
 * tsconfig ограничивает набор типов (`types: ["jest"]`), поэтому здесь объявлен
 * только нужный срез API.
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
