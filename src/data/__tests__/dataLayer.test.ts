import { createDataLayer, prepareDatabase } from "../dataLayer";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";

describe("data layer smoke", () => {
  it("opens a database and builds repositories without errors", async () => {
    const db = createNodeSqliteDriver();
    await prepareDatabase(db);
    const layer = createDataLayer(db);

    expect(await layer.contacts.list()).toEqual([]);
    expect(await layer.interactions.listByContact("any")).toEqual([]);

    await db.close();
  });

  it("enables SQLite foreign keys on prepare", async () => {
    const db = createNodeSqliteDriver();
    await prepareDatabase(db);

    const rows = await db.all<{ foreign_keys: number }>("PRAGMA foreign_keys");
    expect(rows[0]?.foreign_keys).toBe(1);

    await db.close();
  });
});
