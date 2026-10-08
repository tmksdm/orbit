import { createContact } from "../../domain/contact";
import { createContactRepository } from "../contactRepository";
import { runMigrations } from "../migrations";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";

async function makeRepository() {
  const db = createNodeSqliteDriver();
  await runMigrations(db);
  return { db, repository: createContactRepository(db) };
}

describe("contactRepository", () => {
  it("returns an empty list for an empty database", async () => {
    const { db, repository } = await makeRepository();
    expect(await repository.list()).toEqual([]);
    await db.close();
  });

  it("creates and reads a contact with all fields, note omitted", async () => {
    const { db, repository } = await makeRepository();

    await repository.save(
      createContact({
        id: "c1",
        name: "Ann",
        strategy: "grow",
        minIntervalDays: 3,
        recommendedIntervalDays: 5,
      }),
    );

    const contact = await repository.getById("c1");
    expect(contact).toEqual({
      id: "c1",
      name: "Ann",
      strategy: "grow",
      minIntervalDays: 3,
      recommendedIntervalDays: 5,
    });
    expect(contact?.note).toBeUndefined();

    await db.close();
  });

  it("persists an explicit note", async () => {
    const { db, repository } = await makeRepository();

    await repository.save(
      createContact({ id: "c1", name: "Ann", note: "from work", strategy: "maintain" }),
    );

    expect((await repository.getById("c1"))?.note).toBe("from work");

    await db.close();
  });

  it("upserts on save and reads the updated interval back", async () => {
    const { db, repository } = await makeRepository();

    await repository.save(createContact({ id: "c1", name: "Ann", strategy: "maintain" }));
    await repository.save({
      ...createContact({ id: "c1", name: "Ann", strategy: "maintain" }),
      recommendedIntervalDays: 8,
    });

    expect((await repository.getById("c1"))?.recommendedIntervalDays).toBe(8);
    expect(await repository.list()).toHaveLength(1);

    await db.close();
  });

  it("returns null for a missing contact", async () => {
    const { db, repository } = await makeRepository();
    expect(await repository.getById("missing")).toBeNull();
    await db.close();
  });
});
