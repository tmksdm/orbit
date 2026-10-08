import { createContact } from "../../domain/contact";
import type { ContactRepository } from "../../domain/ports";
import type { Interaction } from "../../domain/types";
import { createContactRepository } from "../contactRepository";
import { ContactNotFoundError, createInteractionRecorder } from "../interactionRecorder";
import { createInteractionRepository } from "../interactionRepository";
import { runMigrations } from "../migrations";
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
    const recorder = createInteractionRecorder(db, contacts, interactions);

    const updated = await recorder.record("c1", INTERACTION);

    // grow + them + good → ×0.8, база 10 → 8.
    expect(updated.recommendedIntervalDays).toBe(8);
    expect((await contacts.getById("c1"))?.recommendedIntervalDays).toBe(8);
    expect(await interactions.listByContact("c1")).toEqual([INTERACTION]);

    await db.close();
  });

  it("writes nothing when the second step fails (rollback)", async () => {
    const { db, contacts, interactions } = await setup();
    const failingContacts: ContactRepository = {
      list: () => contacts.list(),
      getById: (id) => contacts.getById(id),
      save: () => Promise.reject(new Error("boom")),
    };
    const recorder = createInteractionRecorder(db, failingContacts, interactions);

    await expect(recorder.record("c1", INTERACTION)).rejects.toThrow("boom");

    // Interaction не записан, интервал контакта не изменён.
    expect(await interactions.listByContact("c1")).toEqual([]);
    expect((await contacts.getById("c1"))?.recommendedIntervalDays).toBe(10);

    await db.close();
  });

  it("fails and writes nothing for an unknown contact", async () => {
    const { db, contacts, interactions } = await setup();
    const recorder = createInteractionRecorder(db, contacts, interactions);

    await expect(recorder.record("missing", INTERACTION)).rejects.toBeInstanceOf(
      ContactNotFoundError,
    );
    expect(await interactions.listByContact("missing")).toEqual([]);

    await db.close();
  });
});
