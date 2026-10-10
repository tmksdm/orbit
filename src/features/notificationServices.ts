/**
 * Use-cases Stage 4 (features): согласование расписания напоминаний и управление
 * настройками. Бизнес-правила не дублируются: календарный цикл/anchor/план —
 * domain (`src/domain/notifications.ts`), due-расчёт — domain (`computeDue` через
 * `buildContactDueView`), нативные вызовы — services (`NotificationPlatform`).
 * Здесь только композиция: чтение данных, серилизуемое согласование, разрешения
 * и сохранение настроек (ARCHITECTURE.md, правило 3).
 *
 * Согласование (`syncNotifications`) — серилизуемый `drain`-цикл с coalescing
 * (BLOCKER-03, docs/plans/stage-4-notifications.md §6.7): одновременно выполняется
 * не более одного `runSyncOnce`; триггеры во время прогона сворачиваются и
 * гарантируют ровно один повтор; публичный промис НИКОГДА не отклоняется.
 *
 * Согласование по различиям (MAJOR-04): желаемый и установленный наборы
 * сравниваются по ключу `cycleDate` (идентичность — маркер `data.kind`), поэтому
 * при неизменных данных платформа не трогается, дубли устраняются, а частичный
 * сбой доводится до желаемого следующим прогоном.
 */

import {
  planNotifications,
  resolveAnchor,
  type NotificationSettings,
} from "../domain/notifications";
import type {
  ContactRepository,
  InteractionRepository,
  NotificationSettingsRepository,
} from "../domain/ports";
import type { NotificationPlatform, PlannedNotificationRequest } from "../services/notifications";
import type { Clock } from "../services/clock";
import { contactsLabel } from "../ui/format";
import { buildContactDueView } from "./orbitServices";

/** Результат согласования: определённый для всех вызывающих (не `undefined`). */
export type SyncResult =
  | { readonly ok: true; readonly added: number; readonly removed: number; readonly kept: number; readonly blocked?: "permission" }
  | { readonly ok: false; readonly reason: string };

/** Текущее разрешение (намерение/возможность, §6.2). */
export interface PermissionInfo {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

/** Состояние настроек для UI (экран настроек — следующая фаза). */
export interface NotificationSettingsView {
  readonly enabled: boolean;
  readonly reminderTime: string;
  readonly anchorDate: string | null;
  readonly permission: PermissionInfo;
  /** Фактическая активность = намерение (`enabled`) И возможность (`granted`). */
  readonly effectiveActive: boolean;
}

/** Результат сохранения настроек. */
export type SettingsUpdateResult =
  | { readonly status: "saved"; readonly sync: SyncResult }
  | {
      readonly status: "permissionDenied";
      readonly canAskAgain: boolean;
      /**
       * Результат согласования с финальным ВЫКЛЮЧЕННЫМ состоянием (MAJOR-01):
       * снятие ранее установленных/показанных «наших». `ok:false` означает, что
       * очистка не удалась — ошибка НЕ маскируется ложным успехом (§6.9).
       */
      readonly sync: SyncResult;
    };

/** Use-cases напоминаний, доступные UI. */
export interface NotificationServices {
  /** Настройки + текущее разрешение (без запроса диалога). */
  loadNotificationSettings(): Promise<NotificationSettingsView>;
  /** Включает/выключает напоминания (при включении — запрос разрешения, §6.5). */
  setEnabled(enabled: boolean): Promise<SettingsUpdateResult>;
  /** Меняет время напоминания (HH:MM) и согласует расписание (§1.5). */
  setReminderTime(time: string): Promise<SettingsUpdateResult>;
  /** Согласование расписания; безопасно вызывать часто (серилизуется). */
  syncNotifications(): Promise<SyncResult>;
}

/** Зависимости use-cases (внедряются; в тестах — подмены). */
export interface NotificationServicesDeps {
  readonly contacts: ContactRepository;
  readonly interactions: InteractionRepository;
  readonly settings: NotificationSettingsRepository;
  readonly platform: NotificationPlatform;
  readonly clock: Clock;
  /** Локальное время суток (HH:MM) момента ISO 8601 (services). */
  readonly toLocalTime: (iso: string) => string;
  /** Локальные (дата, время) → абсолютный момент (services). */
  readonly combineLocalDateTime: (date: string, time: string) => Date;
  /** Горизонт планирования, дни (по умолчанию — domain SCHEDULE_HORIZON_DAYS). */
  readonly horizonDays?: number;
}

/** Ошибка валидации настроек (сообщение — пользовательское, русский UI). */
export class NotificationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationValidationError";
  }
}

/** Время в формате HH:MM (24 часа). */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Тело сводного уведомления: «Пора связаться: N …» (без имён, §1). */
function dueSummaryBody(count: number): string {
  return `Пора связаться: ${contactsLabel(count)}`;
}

/**
 * Собирает use-cases напоминаний. Серилизация состояния (`active`/`rerun`) —
 * на замыкании экземпляра сервисов; поэтому на приложение создаётся один
 * экземпляр (см. `runtime.ts`).
 */
export function createNotificationServices(deps: NotificationServicesDeps): NotificationServices {
  const { contacts, interactions, settings, platform, clock, toLocalTime, combineLocalDateTime } =
    deps;
  const horizonDays = deps.horizonDays ?? 366;

  /** Актуальный `nextDueDate` контактов и число просроченных на «сегодня». */
  async function loadDueData(): Promise<{ dueDates: string[]; overdueCount: number }> {
    const today = clock.today();
    const list = await contacts.list();
    const dueDates: string[] = [];
    let overdueCount = 0;
    for (const contact of list) {
      const history = await interactions.listByContact(contact.id);
      const view = buildContactDueView({
        contact,
        history,
        today,
        toLocalDate: clock.toLocalDate,
      });
      if (view.due.nextDueDate !== null) {
        dueDates.push(view.due.nextDueDate);
      }
      if (view.due.isDue) {
        overdueCount += 1;
      }
    }
    return { dueDates, overdueCount };
  }

  /** Снимает все установленные и удаляет все показанные «наши»; возвращает число снятых. */
  async function clearAll(): Promise<number> {
    const installed = await platform.listScheduledOurs();
    const ids = installed.map((item) => item.id);
    if (ids.length > 0) {
      await platform.cancelNotifications(ids);
    }
    const presented = await platform.listPresentedOurs();
    const presentedIds = presented.map((item) => item.id);
    if (presentedIds.length > 0) {
      await platform.dismissNotifications(presentedIds);
    }
    return ids.length;
  }

  /** Один прогон согласования: читает СВЕЖИЕ настройки/данные/разрешение (§6.7). */
  async function runSyncOnce(): Promise<SyncResult> {
    const current = await settings.load();
    await platform.ensureChannel();
    const permission = await platform.getPermissionStatus();

    // Отключено (§6.7 шаг 3): снять всё «наше».
    if (!current.enabled) {
      const removed = await clearAll();
      return { ok: true, added: 0, removed, kept: 0 };
    }
    // Включено, но разрешения нет (MAJOR-01): снять «наши», anchor сохраняется.
    if (!permission.granted) {
      const removed = await clearAll();
      return { ok: true, added: 0, removed, kept: 0, blocked: "permission" };
    }

    const today = clock.today();
    const nowTime = toLocalTime(clock.now());
    const { dueDates, overdueCount } = await loadDueData();

    // Anchor (§6.7 шаг 6): вычислить по известным датам due и сохранить — НЕ
    // дожидаясь foreground (BLOCKER-02). Повторное включение сохраняет прежний.
    let anchor = current.anchorDate;
    if (anchor === null) {
      anchor = resolveAnchor({
        todayDate: today,
        nowTime,
        reminderTime: current.reminderTime,
        contactDueDates: dueDates,
      });
      if (anchor !== null) {
        await settings.save({
          enabled: true,
          anchorDate: anchor,
          reminderTime: current.reminderTime,
        });
      }
    }
    if (anchor === null) {
      const removed = await clearAll();
      return { ok: true, added: 0, removed, kept: 0 };
    }

    const plan = planNotifications({
      anchorDate: anchor,
      reminderTime: current.reminderTime,
      todayDate: today,
      nowTime,
      horizonDays,
      contactDueDates: dueDates,
    });

    // Желаемый набор: дни цикла → момент/число/тело.
    const desired = new Map<string, { fireAtMs: number; count: number; body: string }>();
    for (const item of plan) {
      const fireDate = combineLocalDateTime(item.cycleDate, current.reminderTime);
      desired.set(item.cycleDate, {
        fireAtMs: fireDate.getTime(),
        count: item.dueCount,
        body: dueSummaryBody(item.dueCount),
      });
    }

    // Установленный набор → Map по cycleDate с обработкой дублей (MINOR-03):
    // для одного cycleDate остаётся ОДИН, остальные идут на отмену.
    const installed = await platform.listScheduledOurs();
    const installedByDate = new Map<string, (typeof installed)[number]>();
    const duplicates: string[] = [];
    for (const item of installed) {
      const existing = installedByDate.get(item.cycleDate);
      if (existing === undefined) {
        installedByDate.set(item.cycleDate, item);
        continue;
      }
      // Дубль одного cycleDate (MINOR-01): каноническим оставляем уведомление,
      // полностью совпадающее с желаемым (момент и count); если такого нет —
      // первый (его затем перепланирует diff-шаг). Остальные — на отмену.
      const want = desired.get(item.cycleDate);
      const existingMatches =
        want !== undefined && existing.fireAtMs === want.fireAtMs && existing.count === want.count;
      const itemMatches =
        want !== undefined && item.fireAtMs === want.fireAtMs && item.count === want.count;
      if (itemMatches && !existingMatches) {
        duplicates.push(existing.id); // прежний канонический устарел
        installedByDate.set(item.cycleDate, item);
      } else {
        duplicates.push(item.id);
      }
    }

    const toCancel: string[] = [...duplicates];
    const toSchedule: PlannedNotificationRequest[] = [];
    let kept = 0;

    for (const [cycleDate, item] of installedByDate) {
      const want = desired.get(cycleDate);
      if (want === undefined) {
        toCancel.push(item.id); // лишний/устаревший
        continue;
      }
      if (want.fireAtMs !== item.fireAtMs || want.count !== item.count) {
        toCancel.push(item.id); // изменилось время или число — перепланировать
        toSchedule.push({
          fireDate: new Date(want.fireAtMs),
          body: want.body,
          cycleDate,
          count: want.count,
        });
      } else {
        kept += 1; // без изменений — платформу не трогаем (идемпотентность)
      }
    }
    for (const [cycleDate, want] of desired) {
      if (!installedByDate.has(cycleDate)) {
        toSchedule.push({
          fireDate: new Date(want.fireAtMs),
          body: want.body,
          cycleDate,
          count: want.count,
        });
      }
    }

    if (toCancel.length > 0) {
      await platform.cancelNotifications(toCancel);
    }
    for (const request of toSchedule) {
      await platform.schedule(request);
    }

    // MAJOR-02: удалить устаревшие показанные (нет просрочки или count ≠ текущему).
    const presented = await platform.listPresentedOurs();
    const staleIds = presented
      .filter((item) => overdueCount === 0 || item.count !== overdueCount)
      .map((item) => item.id);
    if (staleIds.length > 0) {
      await platform.dismissNotifications(staleIds);
    }

    return { ok: true, added: toSchedule.length, removed: toCancel.length, kept };
  }

  // Серилизуемый drain-цикл (BLOCKER-03): единственный писатель расписания.
  let active: Promise<SyncResult> | null = null;
  let rerun = false;

  async function drain(): Promise<SyncResult> {
    try {
      let result: SyncResult = { ok: true, added: 0, removed: 0, kept: 0 };
      while (rerun) {
        rerun = false; // сброс ДО чтения: изменения во время прогона снова выставят флаг
        try {
          result = await runSyncOnce();
        } catch (error) {
          // MINOR-02: неожиданное исключение не должно отклонять общий промис.
          result = { ok: false, reason: String(error) };
        }
      }
      return result;
    } finally {
      active = null; // блокировка снимается всегда — очередь не «зависает»
    }
  }

  function syncNotifications(): Promise<SyncResult> {
    rerun = true; // либо запустит цикл, либо потребует повтор после текущего
    const current = active ?? drain();
    active = current;
    return current; // все ожидающие получают один и тот же АКТУАЛЬНЫЙ результат
  }

  async function setEnabled(enabled: boolean): Promise<SettingsUpdateResult> {
    const current = await settings.load();

    if (!enabled) {
      // Отключение (§1.4): anchor и время сохраняются; цикл не стирается.
      await settings.save({ ...current, enabled: false });
      return { status: "saved", sync: await syncNotifications() };
    }

    // Включение (§6.5): канал ДО запроса разрешения (Android 13+).
    await platform.ensureChannel();
    let permission = await platform.getPermissionStatus();
    if (!permission.granted) {
      permission = await platform.requestPermission();
    }
    if (!permission.granted) {
      // enabled остаётся false; anchor и время сохраняются. Согласуем с финальным
      // ВЫКЛЮЧЕННЫМ состоянием (MAJOR-01): ранее установленные и показанные «наши»
      // снимаются, чужие не затрагиваются. Ошибка очистки не маскируется — sync
      // возвращает { ok:false } и пробрасывается вызывающему (§6.9).
      await settings.save({ ...current, enabled: false });
      const sync = await syncNotifications();
      return { status: "permissionDenied", canAskAgain: permission.canAskAgain, sync };
    }
    // Намерение сохраняем; anchor вычислит и сохранит согласование (шаг 6).
    await settings.save({ ...current, enabled: true });
    return { status: "saved", sync: await syncNotifications() };
  }

  async function setReminderTime(time: string): Promise<SettingsUpdateResult> {
    if (!TIME_PATTERN.test(time)) {
      throw new NotificationValidationError("Укажите время в формате ЧЧ:ММ.");
    }
    const current = await settings.load();
    const next: NotificationSettings = { ...current, reminderTime: time };
    await settings.save(next);
    return { status: "saved", sync: await syncNotifications() };
  }

  async function loadNotificationSettings(): Promise<NotificationSettingsView> {
    const current = await settings.load();
    const permission = await platform.getPermissionStatus();
    return {
      enabled: current.enabled,
      reminderTime: current.reminderTime,
      anchorDate: current.anchorDate,
      permission,
      effectiveActive: current.enabled && permission.granted,
    };
  }

  return { loadNotificationSettings, setEnabled, setReminderTime, syncNotifications };
}
