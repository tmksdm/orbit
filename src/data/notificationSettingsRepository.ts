/**
 * Реализация `NotificationSettingsRepository` (domain-порт) поверх `SqlDatabase`.
 *
 * Направление зависимостей DATA → DOMAIN (ARCHITECTURE.md, правило 4). Таблица
 * `notification_settings` — одна строка (id = 1), миграция v3
 * (docs/plans/stage-4-notifications.md, §6.3).
 */

import type { NotificationSettings } from "../domain/notifications";
import { DEFAULT_REMINDER_TIME } from "../domain/notifications";
import type { NotificationSettingsRepository } from "../domain/ports";
import type { SqlDatabase } from "./sqlDatabase";

/** Строка таблицы `notification_settings` (служебный `id` не читается). */
interface NotificationSettingsRow {
  enabled: number;
  anchorDate: string | null;
  reminderTime: string;
}

const SELECT_COLUMNS = "enabled, anchorDate, reminderTime";

/** Создаёт реализацию `NotificationSettingsRepository` поверх драйвера. */
export function createNotificationSettingsRepository(
  db: SqlDatabase,
): NotificationSettingsRepository {
  return {
    async load(): Promise<NotificationSettings> {
      const rows = await db.all<NotificationSettingsRow>(
        `SELECT ${SELECT_COLUMNS} FROM notification_settings WHERE id = 1`,
      );
      const row = rows[0];
      if (row === undefined) {
        return {
          enabled: false,
          anchorDate: null,
          reminderTime: DEFAULT_REMINDER_TIME,
        };
      }
      return {
        enabled: row.enabled !== 0,
        anchorDate: row.anchorDate,
        reminderTime: row.reminderTime,
      };
    },

    async save(settings: NotificationSettings): Promise<void> {
      await db.run(
        `INSERT INTO notification_settings (id, enabled, anchorDate, reminderTime)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           enabled = excluded.enabled,
           anchorDate = excluded.anchorDate,
           reminderTime = excluded.reminderTime`,
        [settings.enabled ? 1 : 0, settings.anchorDate, settings.reminderTime],
      );
    },
  };
}
