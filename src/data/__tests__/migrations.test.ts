import { getSchemaVersion, runMigrations, SCHEMA_VERSION } from "../migrations";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";

describe("migrations", () => {
  it("creates the schema from scratch and records the schema version", async () => {
    const db = createNodeSqliteDriver();

    expect(await getSchemaVersion(db)).toBe(0);

    await runMigrations(db);

    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(["contacts", "interactions"]),
    );

    await db.close();
  });

  it("is idempotent: a repeated run does not change the schema or version", async () => {
    const db = createNodeSqliteDriver();

    await runMigrations(db);
    await runMigrations(db);

    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const indexes = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_interactions_contact'",
    );
    expect(indexes).toHaveLength(1);

    await db.close();
  });
});
