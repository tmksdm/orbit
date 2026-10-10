/**
 * Unit-тесты адаптера уведомлений (Stage 4, Фаза 2). Нативный `expo-notifications`
 * подменяется заглушкой; проверяются маркер «наших» уведомлений, преобразование
 * запланированных/показанных и корректные вызовы платформы
 * (docs/plans/stage-4-notifications.md, §6.6, §10.6, §10.8).
 */
import * as Notifications from 'expo-notifications';

import {
  configureNotificationHandler,
  createNotificationPlatform,
  DUE_REMINDERS_CHANNEL_ID,
  DUE_REMINDERS_TITLE,
  isOurs,
  mapPresentedNotification,
  mapScheduledRequest,
  NOTIFICATION_KIND,
  readMarker,
} from '../notifications';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mocked = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  cancelAllScheduledNotificationsAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  getPresentedNotificationsAsync: jest.Mock;
  dismissNotificationAsync: jest.Mock;
  setNotificationHandler: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('маркер «наших» уведомлений', () => {
  it('readMarker/isOurs распознают наше уведомление и отвергают чужое/битое', () => {
    const ours = { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 2 };
    expect(readMarker(ours)).toEqual({ cycleDate: '2026-10-10', count: 2 });
    expect(isOurs(ours)).toBe(true);
    expect(isOurs({ kind: 'other' })).toBe(false);
    expect(isOurs({ kind: NOTIFICATION_KIND, cycleDate: '2026-10-10' })).toBe(false); // нет count
    expect(isOurs(undefined)).toBe(false);
  });
});

describe('mapScheduledRequest / mapPresentedNotification', () => {
  const when = new Date(2026, 9, 10, 19, 0);

  it('запланированное наше уведомление → { id, cycleDate, count, fireAtMs }', () => {
    const request = {
      identifier: 'id-1',
      content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 3 } },
      trigger: { type: 'date', date: when },
    } as unknown as Notifications.NotificationRequest;
    expect(mapScheduledRequest(request)).toEqual({
      id: 'id-1',
      cycleDate: '2026-10-10',
      count: 3,
      fireAtMs: when.getTime(),
    });
  });

  it('не наше или без момента → null', () => {
    const foreign = {
      identifier: 'f',
      content: { data: { kind: 'other' } },
      trigger: { type: 'date', date: when },
    } as unknown as Notifications.NotificationRequest;
    const noDate = {
      identifier: 'n',
      content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 1 } },
      trigger: null,
    } as unknown as Notifications.NotificationRequest;
    expect(mapScheduledRequest(foreign)).toBeNull();
    expect(mapScheduledRequest(noDate)).toBeNull();
  });

  it('показанное наше уведомление → { id, cycleDate, count }', () => {
    const notification = {
      date: when.getTime(),
      request: {
        identifier: 'p-1',
        content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 4 } },
        trigger: null,
      },
    } as unknown as Notifications.Notification;
    expect(mapPresentedNotification(notification)).toEqual({
      id: 'p-1',
      cycleDate: '2026-10-10',
      count: 4,
    });
  });
});

describe('createNotificationPlatform — вызовы платформы', () => {
  it('getPermissionStatus/requestPermission мапят granted и canAskAgain', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mocked.requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: false });
    const platform = createNotificationPlatform();
    await expect(platform.getPermissionStatus()).resolves.toEqual({
      granted: false,
      canAskAgain: true,
    });
    await expect(platform.requestPermission()).resolves.toEqual({
      granted: true,
      canAskAgain: false,
    });
  });

  it('ensureChannel создаёт канал «Напоминания» с importance DEFAULT (решение Q5)', async () => {
    mocked.setNotificationChannelAsync.mockResolvedValue(null);
    await createNotificationPlatform().ensureChannel();
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(DUE_REMINDERS_CHANNEL_ID, {
      name: 'Напоминания',
      importance: 5,
    });
  });

  it('listScheduledOurs фильтрует по маркеру (чужое не попадает)', async () => {
    const when = new Date(2026, 9, 10, 19, 0);
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'a',
        content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 1 } },
        trigger: { type: 'date', date: when },
      },
      {
        identifier: 'b',
        content: { data: { kind: 'other' } },
        trigger: { type: 'date', date: when },
      },
    ]);
    expect(await createNotificationPlatform().listScheduledOurs()).toEqual([
      { id: 'a', cycleDate: '2026-10-10', count: 1, fireAtMs: when.getTime() },
    ]);
  });

  it('cancelNotifications/dismissNotifications вызывают платформу по id', async () => {
    mocked.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mocked.dismissNotificationAsync.mockResolvedValue(undefined);
    const platform = createNotificationPlatform();
    await platform.cancelNotifications(['x', 'y']);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenNthCalledWith(1, 'x');
    await platform.dismissNotifications(['p']);
    expect(mocked.dismissNotificationAsync).toHaveBeenCalledWith('p');
  });

  it('cancelAllOurs отменяет ТОЛЬКО наши уведомления (MAJOR-01), чужие не трогает', async () => {
    mocked.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    const when = new Date(2026, 9, 10, 19, 0);
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'ours-1',
        content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 1 } },
        trigger: { type: 'date', date: when },
      },
      { identifier: 'foreign', content: { data: { kind: 'other' } }, trigger: { type: 'date', date: when } },
      {
        identifier: 'ours-2',
        content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-13', count: 2 } },
        trigger: { type: 'date', date: when },
      },
    ]);

    await createNotificationPlatform().cancelAllOurs();

    // Глобальная отмена не используется — только адресная по id наших.
    expect(mocked.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ours-1');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ours-2');
    expect(mocked.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('foreign');
  });

  it('schedule планирует разовое уведомление с маркером и DATE-триггером', async () => {
    mocked.scheduleNotificationAsync.mockResolvedValue('new-id');
    const fireDate = new Date(2026, 9, 10, 19, 0);
    await createNotificationPlatform().schedule({
      fireDate,
      body: 'Пора связаться: 3 контакта',
      cycleDate: '2026-10-10',
      count: 3,
    });
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: DUE_REMINDERS_TITLE,
        body: 'Пора связаться: 3 контакта',
        data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 3, url: '/' },
      },
      trigger: { type: 'date', date: fireDate, channelId: DUE_REMINDERS_CHANNEL_ID },
    });
  });

  it('listPresentedOurs фильтрует показанные по маркеру', async () => {
    mocked.getPresentedNotificationsAsync.mockResolvedValue([
      {
        date: 0,
        request: {
          identifier: 'p',
          content: { data: { kind: NOTIFICATION_KIND, cycleDate: '2026-10-10', count: 2 } },
          trigger: null,
        },
      },
      { date: 0, request: { identifier: 'q', content: { data: { kind: 'other' } }, trigger: null } },
    ]);
    expect(await createNotificationPlatform().listPresentedOurs()).toEqual([
      { id: 'p', cycleDate: '2026-10-10', count: 2 },
    ]);
  });

  it('configureNotificationHandler показывает баннер/список без звука и бейджа', async () => {
    configureNotificationHandler();
    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = mocked.setNotificationHandler.mock.calls[0]?.[0] as {
      handleNotification: () => Promise<{
        shouldShowBanner: boolean;
        shouldShowList: boolean;
        shouldPlaySound: boolean;
        shouldSetBadge: boolean;
      }>;
    };
    await expect(handler.handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});
