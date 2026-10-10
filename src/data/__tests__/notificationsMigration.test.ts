/**
 * Интеграционные тесты Фазы 1 Stage 4 на реальном `node:sqlite` (тот же SQL, что
 * и прод): миграция v3 (`notification_settings`) и репозиторий настроек.
 * Обязательные кейсы — план Stage 4 («Required tests», §10.10).
 */
import { getSchemaVersion, MIGRATIONS, SCHEMA_VERSION } from "../migrations";
import { createDataLayer, prepareDatabase } from "../dataLayer";
import { createNodeSqliteDriver } from "../testing/nodeSqliteDriver";
import type { SqlDatabase } from "../sqlDatabase";

/** Готовит БД со схемой v1 (как до Stage 2/3) и одной строкой контакта. */
async function migrateToV1(db: SqlDatabase): Promise<void> {
  const v1 = MIGRATIONS[0];
  if (v1 === undefined) throw new Error("migration v1 missing");
  await db.transaction(async (tx) => {
    await v1.up(tx);
    await tx.exec("PRAGMA user_version = 1");
  });
}

interface SettingsRow {
  id: number;
  enabled: number;
  anchorDate: string | null;
  reminderTime: string;
}

describe("миграция v3 — таблица настроек напоминаний (§10.10)", () => {
  it("миграция v1→v2→v3 на существующей БД: строка настроек по умолчанию, данные контактов не тронуты, user_version = 3", async () => {
    const db = createNodeSqliteDriver();
    await migrateToV1(db);
    await db.run(
      "INSERT INTO contacts (id, name, note, strategy, minIntervalDays, recommendedIntervalDays) VALUES (?, ?, ?, ?, ?, ?)",
      ["c1", "Борис", null, "grow", 2, 2],
    );

    await prepareDatabase(db);

    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(3);

    const rows = await db.all<SettingsRow>(
      "SELECT id, enabled, anchorDate, reminderTime FROM notification_settings",
    );
    expect(rows).toEqual([{ id: 1, enabled: 0, anchorDate: null, reminderTime: "19:00" }]);

    const contacts = await db.all<{ name: string }>("SELECT name FROM contacts");
    expect(contacts).toEqual([{ name: "Борис" }]);

    await db.close();
  });

  it("повторный запуск миграций идемпотентен: одна строка настроек, схема не ломается", async () => {
    const db = createNodeSqliteDriver();
    await prepareDatabase(db);
    await prepareDatabase(db); // повторный запуск — no-op

    expect(await getSchemaVersion(db)).toBe(SCHEMA_VERSION);
    const rows = await db.all<SettingsRow>("SELECT id FROM notification_settings");
    expect(rows).toHaveLength(1);

    await db.close();
  });
});

describe("репозиторий настроек напоминаний (§10.10)", () => {
  it("load по умолчанию: выключено, anchor = null, время 19:00", async () => {
    const db = createNodeSqliteDriver();
    await prepareDatabase(db);
    const layer = createDataLayer(db);

    expect(await layer.notificationSettings.load()).toEqual({
      enabled: false,
      anchorDate: null,
      reminderTime: "19:00",
    });

    await db.close();
  });

  it("save/load: значения сохраняются и читаются (enabled, anchor, время)", async () => {
    const db = createNodeSqliteDriver();
    await prepareDatabase(db);
    const layer = createDataLayer(db);

    await layer.notificationSettings.save({
      enabled: true,
      anchorDate: "2026-10-10",
      reminderTime: "08:30",
    });
    expect(await layer.notificationSettings.load()).toEqual({
      enabled: true,
      anchorDate: "2026-10-10",
      reminderTime: "08:30",
    });

    // повторное сохранение с anchor = null (upsert единственной строки)
    await layer.notificationSettings.save({
      enabled: false,
      anchorDate: null,
      reminderTime: "19:00",
    });
    expect(await layer.notificationSettings.load()).toEqual({
      enabled: false,
      anchorDate: null,
      reminderTime: "19:00",
    });
    const rows = await db.all<SettingsRow>("SELECT id FROM notification_settings");
    expect(rows).toHaveLength(1);

    await db.close();
  });
});
