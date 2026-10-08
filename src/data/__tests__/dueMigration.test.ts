/**
 * Интеграционные тесты Stage 3 на реальном `node:sqlite` (тот же SQL, что и
 * прод): миграция v2 (`createdAt`) и due-правило для существующих и новых
 * контактов. Обязательные кейсы — план Stage 3 («Required tests»,
 * интеграционные: миграции и due).
 */
import { getSchemaVersion, MIGRATIONS, SCHEMA_VERSION } from "../migrations";
import { createDataLayer, prepareDatabase } from "../dataLayer";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";
import type { SqlDatabase } from "../sqlDatabase";
import { computeDue } from "../../domain/due";

const TODAY = "2026-10-08";

/** Готовит БД со схемой v1 (как до Stage 3). */
async function migrateToV1(db: SqlDatabase): Promise<void> {
  const v1 = MIGRATIONS[0];
  if (v1 === undefined) throw new Error("migration v1 missing");
  await db.transaction(async (tx) => {
    await v1.up(tx);
    await tx.exec("PRAGMA user_version = 1");
  });
}

async function insertV1Contact(
  db: SqlDatabase,
  id: string,
  name: string,
): Promise<void> {
  await db.run(
    "INSERT INTO contacts (id, name, note, strategy, minIntervalDays, recommendedIntervalDays) VALUES (?, ?, ?, ?, ?, ?)",
    [id, name, null, "grow", 2, 2],
  );
}

async function insertInteraction(
  db: SqlDatabase,
  contactId: string,
  occurredAt: string,
): Promise<void> {
  await db.run(
    "INSERT INTO interactions (contactId, initiator, outcome, occurredAt) VALUES (?, ?, ?, ?)",
    [contactId, "me", "good", occurredAt],
  );
}

describe("миграция v2 и due (Stage 3)", () => {
  it("существующий контакт с историей: после миграции createdAt = NULL, due — от последнего взаимодействия", async () => {
    const db = createNodeSqliteDriver();
    await migrateToV1(db);
    await insertV1Contact(db, "c1", "Борис");
    await insertInteraction(db, "c1", "2026-10-01T10:00:00Z");
    await insertInteraction(db, "c1", "2026-10-06T10:00:00Z");

    await prepareDatabase(db);
    const layer = createDataLayer(db);

    const contact = await layer.contacts.getById("c1");
    expect(contact).not.toBeNull();
    expect(contact?.createdAt).toBeUndefined(); // вариант A: даты не придумываются

    const history = await layer.interactions.listByContact("c1");
    const last = history[history.length - 1];
    const due = computeDue({
      lastInteractionDate: last === undefined ? null : last.occurredAt.slice(0, 10),
      createdAtDate: null,
      today: TODAY,
      recommendedIntervalDays: contact?.recommendedIntervalDays ?? 0,
    });
    expect(due.referenceDate).toBe("2026-10-06"); // последнее по occurredAt, не первое
    expect(due.nextDueDate).toBe("2026-10-08");
    expect(due.isDue).toBe(true);
    await db.close();
  });

  it("существующий контакт без истории: createdAt = NULL, срок не рассчитывается", async () => {
    const db = createNodeSqliteDriver();
    await migrateToV1(db);
    await insertV1Contact(db, "c2", "Вера");

    await prepareDatabase(db);
    const layer = createDataLayer(db);

    const contact = await layer.contacts.getById("c2");
    expect(contact?.createdAt).toBeUndefined();
    const due = computeDue({
      lastInteractionDate: null,
      createdAtDate: contact?.createdAt ?? null,
      today: TODAY,
      recommendedIntervalDays: contact?.recommendedIntervalDays ?? 0,
    });
    expect(due.nextDueDate).toBeNull();
    expect(due.isDue).toBe(false); // в группу «пора» не попадает
    await db.close();
  });

  it("новый контакт без истории: createdAt заполнен, срок считается от даты создания", async () => {
    const db = createNodeSqliteDriver();
    await prepareDatabase(db);
    const layer = createDataLayer(db);

    await layer.contacts.save({
      id: "n1",
      name: "Новый",
      strategy: "maintain",
      minIntervalDays: 2,
      recommendedIntervalDays: 2,
      createdAt: "2026-10-06T05:00:00.000Z",
    });

    const contact = await layer.contacts.getById("n1");
    expect(contact?.createdAt).toBe("2026-10-06T05:00:00.000Z");
    const due = computeDue({
      lastInteractionDate: null,
      createdAtDate: contact?.createdAt?.slice(0, 10) ?? null,
      today: TODAY,
      recommendedIntervalDays: contact?.recommendedIntervalDays ?? 0,
    });
    expect(due.referenceDate).toBe("2026-10-06");
    expect(due.nextDueDate).toBe("2026-10-08");
    expect(due.isDue).toBe(true);
    await db.close();
  });

  it("повторный запуск миграций не меняет данные и схему (идемпотентность v2)", async () => {
    const db = createNodeSqliteDriver();
    await migrateToV1(db);
    await insertV1Contact(db, "c3", "Глеб");
    await insertInteraction(db, "c3", "2026-10-02T10:00:00Z");

    await prepareDatabase(db);
    await prepareDatabase(db); // повторный запуск — no-op

    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const layer = createDataLayer(db);
    const contact = await layer.contacts.getById("c3");
    expect(contact?.createdAt).toBeUndefined();
    expect(await layer.interactions.listByContact("c3")).toHaveLength(1);

    const columns = await db.all<{ name: string }>(
      "PRAGMA table_info(contacts)",
    );
    expect(columns.map((c) => c.name)).toContain("createdAt");
    await db.close();
  });
});
