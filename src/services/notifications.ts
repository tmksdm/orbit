/**
 * Адаптер платформы уведомлений (`expo-notifications`) — Stage 4, Фаза 2.
 *
 * Единственный модуль слоя services, зависящий от нативного `expo-notifications`
 * (аналогично `expoSqliteDriver.ts` в data). Всё, что связано с разрешениями,
 * каналом, планированием/отменой и показанными уведомлениями, изолировано здесь;
 * use-cases (features) получают `NotificationPlatform` и подменяют его в тестах
 * (docs/plans/stage-4-notifications.md, §6.6).
 *
 * «Наши» уведомления отличаются по маркеру в `content.data`:
 * `{ kind: "orbit.due-summary", cycleDate: "YYYY-MM-DD", count: N, url: "/" }`.
 * Постоянного состояния адаптер не хранит — источник сравнения (diff) для
 * согласования расписания даёт `listScheduledOurs` (§6.7, MAJOR-04).
 */

import * as Notifications from 'expo-notifications';

/** Маркер «наших» уведомлений в `content.data.kind`. */
export const NOTIFICATION_KIND = 'orbit.due-summary';

/** Идентификатор единственного канала напоминаний (решение Q5). */
export const DUE_REMINDERS_CHANNEL_ID = 'due-reminders';

/** Отображаемое имя канала. */
export const DUE_REMINDERS_CHANNEL_NAME = 'Напоминания';

/** Заголовок сводного уведомления (тело собирают use-cases). */
export const DUE_REMINDERS_TITLE = 'Orbit';

/** Состояние разрешения на уведомления (намерение/возможность, §6.2, MAJOR-01). */
export interface PermissionState {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

/** Запрос на планирование одного сводного уведомления. */
export interface PlannedNotificationRequest {
  /** Абсолютный момент = локальные (cycleDate, reminderTime). */
  readonly fireDate: Date;
  /** Текст уведомления ("Пора связаться: N …"). */
  readonly body: string;
  /** Маркер данных — день цикла (YYYY-MM-DD). */
  readonly cycleDate: string;
  /** Число просроченных на момент планирования (для правила устаревания MAJOR-02). */
  readonly count: number;
}

/** Установленное (запланированное) «наше» уведомление — источник diff. */
export interface InstalledNotification {
  readonly id: string;
  readonly cycleDate: string;
  readonly count: number;
  /** Абсолютный момент срабатывания, мс (из `trigger.date`). */
  readonly fireAtMs: number;
}

/** Показанное (в трее) «наше» уведомление. */
export interface PresentedNotification {
  readonly id: string;
  readonly cycleDate: string;
  readonly count: number;
}

/** Порт платформы уведомлений; внедряется в features и подменяется в тестах. */
export interface NotificationPlatform {
  /** Текущее разрешение (без запроса диалога). */
  getPermissionStatus(): Promise<PermissionState>;
  /** Запрос разрешения (диалог Android 13+). */
  requestPermission(): Promise<PermissionState>;
  /** Создаёт канал напоминаний. Вызывается ДО запроса разрешения (Android 13+). */
  ensureChannel(): Promise<void>;
  /** Установленное «наше» расписание (фильтр по маркеру). */
  listScheduledOurs(): Promise<readonly InstalledNotification[]>;
  /** Отменяет конкретные «наши» уведомления по id. */
  cancelNotifications(ids: readonly string[]): Promise<void>;
  /** Отменяет все «наши» (отключение / нет разрешения). */
  cancelAllOurs(): Promise<void>;
  /** Планирует одно разовое уведомление. */
  schedule(req: PlannedNotificationRequest): Promise<void>;
  /** Показанные «наши» уведомления (фильтр по маркеру). */
  listPresentedOurs(): Promise<readonly PresentedNotification[]>;
  /** Удаляет показанные «наши» уведомления по id. */
  dismissNotifications(ids: readonly string[]): Promise<void>;
}

/** Маркер данных «нашего» уведомления. */
interface NotificationMarker {
  readonly cycleDate: string;
  readonly count: number;
}

/**
 * Читает маркер из `content.data`. Возвращает `null`, если это не «наше»
 * уведомление или данные повреждены (лишнее/чужое не трогаем).
 */
export function readMarker(data: Record<string, unknown> | undefined): NotificationMarker | null {
  if (data === undefined || data.kind !== NOTIFICATION_KIND) {
    return null;
  }
  const cycleDate = data.cycleDate;
  const count = data.count;
  if (typeof cycleDate !== 'string' || typeof count !== 'number') {
    return null;
  }
  return { cycleDate, count };
}

/** true, если `data` помечено нашим маркером. */
export function isOurs(data: Record<string, unknown> | undefined): boolean {
  return readMarker(data) !== null;
}

/** Абсолютный момент из `trigger.date` (Date | number | ISO-строка); иначе null. */
function triggerMomentMs(trigger: Notifications.NotificationTrigger): number | null {
  if (trigger === null || typeof trigger !== 'object' || !('date' in trigger)) {
    return null;
  }
  const raw = (trigger as { date?: unknown }).date;
  if (raw instanceof Date) {
    return raw.getTime();
  }
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Преобразует запрос планировщика в `InstalledNotification`; не «наше» → null. */
export function mapScheduledRequest(
  request: Notifications.NotificationRequest,
): InstalledNotification | null {
  const marker = readMarker(request.content.data);
  if (marker === null) {
    return null;
  }
  const fireAtMs = triggerMomentMs(request.trigger);
  if (fireAtMs === null) {
    return null;
  }
  return {
    id: request.identifier,
    cycleDate: marker.cycleDate,
    count: marker.count,
    fireAtMs,
  };
}

/** Преобразует показанное уведомление в `PresentedNotification`; не «наше» → null. */
export function mapPresentedNotification(
  notification: Notifications.Notification,
): PresentedNotification | null {
  const marker = readMarker(notification.request.content.data);
  if (marker === null) {
    return null;
  }
  return {
    id: notification.request.identifier,
    cycleDate: marker.cycleDate,
    count: marker.count,
  };
}

/** Содержимое уведомления: тело из use-case + наш маркер. */
function buildContent(
  req: PlannedNotificationRequest,
): Notifications.NotificationContentInput {
  return {
    title: DUE_REMINDERS_TITLE,
    body: req.body,
    data: {
      kind: NOTIFICATION_KIND,
      cycleDate: req.cycleDate,
      count: req.count,
      url: '/',
    },
  };
}

/** Продовая реализация порта поверх `expo-notifications`. */
export function createNotificationPlatform(): NotificationPlatform {
  return {
    async getPermissionStatus(): Promise<PermissionState> {
      const status = await Notifications.getPermissionsAsync();
      return { granted: status.granted, canAskAgain: status.canAskAgain };
    },

    async requestPermission(): Promise<PermissionState> {
      const status = await Notifications.requestPermissionsAsync();
      return { granted: status.granted, canAskAgain: status.canAskAgain };
    },

    async ensureChannel(): Promise<void> {
      await Notifications.setNotificationChannelAsync(DUE_REMINDERS_CHANNEL_ID, {
        name: DUE_REMINDERS_CHANNEL_NAME,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    },

    async listScheduledOurs(): Promise<readonly InstalledNotification[]> {
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      const result: InstalledNotification[] = [];
      for (const request of requests) {
        const mapped = mapScheduledRequest(request);
        if (mapped !== null) {
          result.push(mapped);
        }
      }
      return result;
    },

    async cancelNotifications(ids: readonly string[]): Promise<void> {
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    },

    async cancelAllOurs(): Promise<void> {
      // Адресная отмена: только уведомления с нашим маркером (MAJOR-01). НЕ
      // используем глобальный `cancelAllScheduledNotificationsAsync`, чтобы не
      // удалять другие запланированные уведомления приложения.
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      for (const request of requests) {
        if (isOurs(request.content.data)) {
          await Notifications.cancelScheduledNotificationAsync(request.identifier);
        }
      }
    },

    async schedule(req: PlannedNotificationRequest): Promise<void> {
      await Notifications.scheduleNotificationAsync({
        content: buildContent(req),
        // Разовые уведомления на конкретный момент (не `repeats`): тело и набор
        // дат меняются со временем (§6.6).
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: req.fireDate,
          channelId: DUE_REMINDERS_CHANNEL_ID,
        },
      });
    },

    async listPresentedOurs(): Promise<readonly PresentedNotification[]> {
      const presented = await Notifications.getPresentedNotificationsAsync();
      const result: PresentedNotification[] = [];
      for (const notification of presented) {
        const mapped = mapPresentedNotification(notification);
        if (mapped !== null) {
          result.push(mapped);
        }
      }
      return result;
    },

    async dismissNotifications(ids: readonly string[]): Promise<void> {
      for (const id of ids) {
        await Notifications.dismissNotificationAsync(id);
      }
    },
  };
}

/**
 * Устанавливает обработчик показа уведомлений в foreground: баннер/список — да,
 * звук/бейдж — нет (§6.6). Вызывается при инициализации приложения (следующая
 * фаза — точка инициализации sync).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Читает `data.url` ответа на уведомление; иначе null. */
function responseUrl(response: Notifications.NotificationResponse): string | null {
  const url = response.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
}

/**
 * Забирает и ГАСИТ последний ответ на уведомление (§6.11): нажатие открывает
 * главный экран. Возвращает `data.url` или null; последний ответ очищается,
 * чтобы навигация не повторялась при следующих запусках.
 */
export function consumeLastNotificationUrl(): string | null {
  const response = Notifications.getLastNotificationResponse();
  if (response === null) {
    return null;
  }
  const url = responseUrl(response);
  Notifications.clearLastNotificationResponse();
  return url;
}

/**
 * Подписка на нажатие по уведомлению (§6.11). Возвращает функцию отписки.
 * Изоляция нативного API — здесь (как и все прочие вызовы `expo-notifications`).
 */
export function subscribeToNotificationResponses(handler: (url: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = responseUrl(response);
    if (url !== null) {
      handler(url);
    }
  });
  return () => subscription.remove();
}

