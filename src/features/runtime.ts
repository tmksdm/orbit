/**
 * Продовая сборка приложения: открывает локальную БД (`expo-sqlite`) и собирает
 * use-cases над системными часами, `expo-crypto` и платформой уведомлений.
 *
 * Единственное место, где сходятся нативные зависимости; экраны получают сервисы
 * через props с дефолтом из `getOrbitServices`/`getNotificationServices` —
 * компонентные тесты подставляют подмены, не касаясь нативных модулей (план
 * Stage 3/4). БД открывается один раз на запуск приложения; согласование
 * напоминаний (`NotificationServices`) создаётся один раз и делит то же
 * соединение с БД.
 */
import { openOrbitDatabase } from "../data";
import { combineLocalDateTime, systemClock, toLocalTime } from "../services/clock";
import { configureNotificationHandler, createNotificationPlatform } from "../services/notifications";
import { createUuid } from "../services/uuid";
import {
  createNotificationServices,
  type NotificationServices,
} from "./notificationServices";
import { createOrbitServices, type OrbitServices } from "./orbitServices";

/** Собранные сервисы приложения. */
export interface OrbitRuntime {
  readonly orbit: OrbitServices;
  readonly notifications: NotificationServices;
}

let cached: Promise<OrbitRuntime> | null = null;
let orbitServices: Promise<OrbitServices> | null = null;
let notificationServices: Promise<NotificationServices> | null = null;

/**
 * Открывает (один раз) БД и собирает сервисы приложения.
 *
 * При успешном запуске инициализация единственная (промис кешируется). При ошибке
 * отклонённый промис в кеше НЕ остаётся (REVIEW-03): кеш сбрасывается, поэтому
 * следующий вызов повторяет попытку, а не возвращает навсегда ту же ошибку.
 */
export function getRuntime(): Promise<OrbitRuntime> {
  if (cached === null) {
    cached = openOrbitDatabase()
      .then((data) => {
        const notifications = createNotificationServices({
          contacts: data.contacts,
          interactions: data.interactions,
          settings: data.notificationSettings,
          platform: createNotificationPlatform(),
          clock: systemClock,
          toLocalTime,
          combineLocalDateTime,
        });
        const orbit = createOrbitServices({
          contacts: data.contacts,
          interactions: data.interactions,
          recorder: data.recorder,
          clock: systemClock,
          createId: createUuid,
          // §6.9: после успешного сохранения взаимодействия согласуем напоминания.
          onInteractionRecorded: () => notifications.syncNotifications(),
        });
        return { orbit, notifications };
      })
      .catch((error: unknown) => {
        // Повторная попытка возможна: неудачная инициализация не кешируется.
        cached = null;
        throw error;
      });
  }
  return cached;
}

/** OrbitServices для экранов Stage 3. */
export function getOrbitServices(): Promise<OrbitServices> {
  if (orbitServices === null) {
    orbitServices = getRuntime()
      .then((runtime) => runtime.orbit)
      .catch((error: unknown) => {
        orbitServices = null;
        throw error;
      });
  }
  return orbitServices;
}

/** NotificationServices для экрана настроек (Stage 4). */
export function getNotificationServices(): Promise<NotificationServices> {
  if (notificationServices === null) {
    notificationServices = getRuntime()
      .then((runtime) => runtime.notifications)
      .catch((error: unknown) => {
        notificationServices = null;
        throw error;
      });
  }
  return notificationServices;
}

/**
 * Настраивает обработчик показа уведомлений в foreground (один раз при старте).
 * Вызывается из `_layout.tsx`.
 */
export function setupNotifications(): void {
  configureNotificationHandler();
}
