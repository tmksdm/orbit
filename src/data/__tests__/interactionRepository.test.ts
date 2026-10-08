import { createContact } from "../../domain/contact";
import { createContactRepository } from "../contactRepository";
import { createInteractionRepository } from "../interactionRepository";
import { runMigrations } from "../migrations";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";

async function setup() {
  const db = createNodeSqliteDriver();
  await db.exec("PRAGMA foreign_keys = ON");
  await runMigrations(db);
  const contacts = createContactRepository(db);
  const interactions = createInteractionRepository(db);
  await contacts.save(createContact({ id: "a", name: "A", strategy: "maintain" }));
  await contacts.save(createContact({ id: "b", name: "B", strategy: "grow" }));
  return { db, interactions };
}

describe("interactionRepository", () => {
  it("adds interactions and lists them in ascending occurredAt order", async () => {
    const { db, interactions } = await setup();

    await interactions.add("a", {
      initiator: "me",
      outcome: "good",
      occurredAt: "2026-10-03T09:00:00.000Z",
    });
    await interactions.add("a", {
      initiator: "them",
      outcome: "short",
      occurredAt: "2026-10-01T09:00:00.000Z",
    });
    await interactions.add("a", {
      initiator: "me",
      outcome: "no_reply",
      occurredAt: "2026-10-02T09:00:00.000Z",
    });

    const history = await interactions.listByContact("a");
    expect(history.map((item) => item.occurredAt)).toEqual([
      "2026-10-01T09:00:00.000Z",
      "2026-10-02T09:00:00.000Z",
      "2026-10-03T09:00:00.000Z",
    ]);

    await db.close();
  });

  it("keeps history isolated per contact", async () => {
    const { db, interactions } = await setup();

    await interactions.add("a", {
      initiator: "me",
      outcome: "good",
      occurredAt: "2026-10-01T09:00:00.000Z",
    });
    await interactions.add("b", {
      initiator: "them",
      outcome: "good",
      occurredAt: "2026-10-02T09:00:00.000Z",
    });

    expect(await interactions.listByContact("a")).toHaveLength(1);
    expect((await interactions.listByContact("b"))[0]?.initiator).toBe("them");

    await db.close();
  });

  it("rejects an interaction for a missing contact (foreign key)", async () => {
    const { db, interactions } = await setup();

    await expect(
      interactions.add("missing", {
        initiator: "me",
        outcome: "good",
        occurredAt: "2026-10-01T09:00:00.000Z",
      }),
    ).rejects.toThrow();

    await db.close();
  });

  it("cascades: deleting a contact removes its interactions", async () => {
    const { db, interactions } = await setup();

    await interactions.add("a", {
      initiator: "me",
      outcome: "good",
      occurredAt: "2026-10-01T09:00:00.000Z",
    });
    await db.run("DELETE FROM contacts WHERE id = ?", ["a"]);

    expect(await interactions.listByContact("a")).toEqual([]);

    await db.close();
  });
});
