import { createContact } from "../../domain/contact";
import type { Interaction } from "../../domain/types";
import { createContactRepository } from "../contactRepository";
import { ContactNotFoundError, createInteractionRecorder } from "../interactionRecorder";
import { createInteractionRepository } from "../interactionRepository";
import { runMigrations } from "../migrations";
import type { SqlDatabase, SqlParam } from "../sqlDatabase";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";

const INTERACTION: Interaction = {
  initiator: "them",
  outcome: "good",
  occurredAt: "2026-10-01T09:00:00.000Z",
};

async function setup() {
  const db = createNodeSqliteDriver();
  await db.exec("PRAGMA foreign_keys = ON");
  await runMigrations(db);
  const contacts = createContactRepository(db);
  const interactions = createInteractionRepository(db);
  await contacts.save(
    createContact({ id: "c1", name: "Ann", strategy: "grow", recommendedIntervalDays: 10 }),
  );
  return { db, contacts, interactions };
}

describe("interactionRecorder (atomic save)", () => {
  it("saves the interaction and the recomputed contact together", async () => {
    const { db, contacts, interactions } = await setup();
    const recorder = createInteractionRecorder(db);

    const updated = await recorder.record("c1", INTERACTION);

    // grow + them + good → ×0.8, база 10 → 8.
    expect(updated.recommendedIntervalDays).toBe(8);
    expect((await contacts.getById("c1"))?.recommendedIntervalDays).toBe(8);
    expect(await interactions.listByContact("c1")).toEqual([INTERACTION]);

    await db.close();
  });

  it("rolls back the interaction when the contact save fails (atomicity)", async () => {
    const { db, contacts, interactions } = await setup();
    // Заставляем именно ВТОРОЙ шаг (сохранение Contact) упасть на реальном SQLite.
    await db.exec(
      `CREATE TRIGGER fail_contact_update BEFORE UPDATE ON contacts
         BEGIN SELECT RAISE(ABORT, 'boom'); END;`,
    );
    const recorder = createInteractionRecorder(db);

    await expect(recorder.record("c1", INTERACTION)).rejects.toThrow();

    // Interaction записан не был, интервал контакта не изменён — частичных данных нет.
    expect(await interactions.listByContact("c1")).toEqual([]);
    expect((await contacts.getById("c1"))?.recommendedIntervalDays).toBe(10);

    await db.close();
  });

  it("fails and writes nothing for an unknown contact", async () => {
    const { db, interactions } = await setup();
    const recorder = createInteractionRecorder(db);

    await expect(recorder.record("missing", INTERACTION)).rejects.toBeInstanceOf(
      ContactNotFoundError,
    );
    expect(await interactions.listByContact("missing")).toEqual([]);

    await db.close();
  });

  it("runs every SQL statement of a record inside the transaction context", async () => {
    const calls: { scope: "base" | "tx"; sql: string }[] = [];
    const makeDriver = (scope: "base" | "tx"): SqlDatabase => ({
      async exec(sql: string): Promise<void> {
        calls.push({ scope, sql });
      },
      async run(sql: string): Promise<{ changes: number; lastInsertRowId: number }> {
        calls.push({ scope, sql });
        return { changes: 1, lastInsertRowId: 1 };
      },
      async all<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]> {
        calls.push({ scope, sql });
        if (/FROM contacts/i.test(sql) && params?.[0] === "c1") {
          const row = {
            id: "c1",
            name: "Ann",
            note: null,
            strategy: "grow",
            minIntervalDays: 2,
            recommendedIntervalDays: 10,
          };
          return [row] as unknown as T[];
        }
        return [] as unknown as T[];
      },
      async transaction<T>(work: (tx: SqlDatabase) => Promise<T>): Promise<T> {
        return work(makeDriver("tx"));
      },
      async close(): Promise<void> {},
    });

    const recorder = createInteractionRecorder(makeDriver("base"));
    const updated = await recorder.record("c1", INTERACTION);

    expect(updated.recommendedIntervalDays).toBe(8);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    // Ни один запрос операции не выполнен вне транзакционного контекста.
    expect(calls.every((call) => call.scope === "tx")).toBe(true);
  });
});
