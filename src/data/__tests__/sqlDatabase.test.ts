import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createContact } from "../../domain/contact";
import { createContactRepository } from "../contactRepository";
import { createInteractionRepository } from "../interactionRepository";
import { runMigrations } from "../migrations";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";

const INSERT_CONTACT =
  "INSERT INTO contacts (id, name, note, strategy, minIntervalDays, recommendedIntervalDays) VALUES (?, ?, ?, ?, ?, ?)";

describe("SqlDatabase.transaction (node driver)", () => {
  it("commits on success", async () => {
    const db = createNodeSqliteDriver();
    await runMigrations(db);

    await db.transaction(async (tx) => {
      await tx.run(INSERT_CONTACT, ["c1", "Ann", null, "grow", 2, 10]);
    });

    expect(await createContactRepository(db).getById("c1")).not.toBeNull();
    await db.close();
  });

  it("rolls back on error and rethrows", async () => {
    const db = createNodeSqliteDriver();
    await runMigrations(db);

    await expect(
      db.transaction(async (tx) => {
        await tx.run(INSERT_CONTACT, ["c1", "Ann", null, "grow", 2, 10]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await createContactRepository(db).list()).toEqual([]);
    await db.close();
  });

  it("isolates an in-flight transaction from a concurrent connection", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orbit-stage2-"));
    const file = join(dir, "orbit.sqlite");

    const writer = createNodeSqliteDriver(file);
    await writer.exec("PRAGMA foreign_keys = ON");
    await runMigrations(writer);
    await createContactRepository(writer).save(
      createContact({ id: "c1", name: "Ann", strategy: "grow", recommendedIntervalDays: 10 }),
    );

    const reader = createNodeSqliteDriver(file);
    const readerInteractions = createInteractionRepository(reader);

    try {
      await writer.transaction(async (tx) => {
        await createInteractionRepository(tx).add("c1", {
          initiator: "them",
          outcome: "good",
          occurredAt: "2026-10-01T09:00:00.000Z",
        });
        // Ещё не закоммичено — второе соединение записи не видит.
        expect(await readerInteractions.listByContact("c1")).toEqual([]);
      });

      // После COMMIT запись видна обоим соединениям.
      expect(await readerInteractions.listByContact("c1")).toHaveLength(1);
    } finally {
      await reader.close();
      await writer.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
