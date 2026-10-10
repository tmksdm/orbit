/**
 * Хук навигации по нажатию на уведомление (план Stage 4, §6.11; MAJOR-01 ревью).
 *
 * Отделяет оркестрацию навигации от `_layout.tsx`, чтобы её можно было
 * тестировать без монтирования корневого layout/шрифтов. Нативные вызовы
 * изолированы в `services/notifications.ts` (consume/subscribe).
 *
 * Гарантии:
 *  - переход по первоначальному ответу выполняется ТОЛЬКО после готовности
 *    навигационного дерева (`ready`), иначе ранний `router.push` теряется, пока
 *    `RootLayout` возвращает `null` из-за загрузки шрифтов;
 *  - первоначальный ответ НЕ теряется: пока не готово — мы его не читаем и не
 *    гасим; читаем и гасим один раз по готовности (`consumeLastNotificationUrl`);
 *  - повторной обработки уже использованного ответа нет: `consume` очищает
 *    последний ответ, а эффект зависит только от `ready`/`goHome`;
 *  - нажатия при уже работающем приложении приходят через подписку;
 *  - неподдерживаемые `url` игнорируются.
 */

import { useEffect } from "react";

import {
  consumeLastNotificationUrl,
  subscribeToNotificationResponses,
} from "../services/notifications";

/** `data.url`, который открывает главный экран («Пора связаться»). */
export const HOME_NOTIFICATION_URL = "/";

/**
 * @param ready готовность навигационного дерева (шрифты загружены / ошибка);
 * @param goHome переход на главный экран (инъекция — в `_layout.tsx` это `router.push("/")`).
 */
export function useNotificationNavigation(ready: boolean, goHome: () => void): void {
  // Нажатия при работающем приложении (подписка активна с монтирования).
  useEffect(() => {
    return subscribeToNotificationResponses((url) => {
      if (url === HOME_NOTIFICATION_URL) {
        goHome();
      }
    });
  }, [goHome]);

  // Первоначальный ответ, открывший приложение: только по готовности навигации.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (consumeLastNotificationUrl() === HOME_NOTIFICATION_URL) {
      goHome();
    }
  }, [ready, goHome]);
}
