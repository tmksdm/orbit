/**
 * Хук навигации по нажатию на уведомление (план Stage 4, §6.11; MAJOR-01 ревью).
 *
 * Оркестрация навигации отделена от `_layout.tsx` — тестируется без монтирования
 * корневого layout/шрифтов; нативные вызовы изолированы в
 * `services/notifications.ts` (consume/subscribe). Готовность навигации
 * (`ready`) вычисляет `_layout.tsx` по готовности навигационного контейнера.
 *
 * Гарантии (MAJOR-01):
 *  - до готовности навигации события НЕ теряются и НЕ дают преждевременный
 *    переход — они буферизуются и обрабатываются после готовности;
 *  - переход по первоначальному ответу выполняется только по готовности
 *    (не читаем и не гасим ответ раньше);
 *  - одно событие, пришедшее из двух источников (слушатель и
 *    `getLastNotificationResponse`), обрабатывается ОДИН раз — дедупликация по
 *    идентификатору ответа, устойчивая к повторным рендерам/пересозданию эффектов;
 *  - неподдерживаемые `url` игнорируются; повторной обработки уже
 *    использованного ответа нет.
 */

import { useEffect, useRef } from "react";

import {
  consumeLastNotificationResponse,
  subscribeToNotificationResponses,
  type NotificationTap,
} from "../services/notifications";

/** `data.url`, который открывает главный экран («Пора связаться»). */
export const HOME_NOTIFICATION_URL = "/";

/**
 * @param ready готовность навигационного контейнера (root navigator смонтирован);
 * @param goHome переход на главный экран (инъекция — в `_layout.tsx` это `router.push("/")`).
 */
export function useNotificationNavigation(ready: boolean, goHome: () => void): void {
  // Идентификаторы уже обработанных ответов — устранение двойной обработки.
  const seen = useRef<Set<string>>(new Set());
  // События, пришедшие до готовности навигации (буфер).
  const pending = useRef<NotificationTap[]>([]);

  // Подписка с монтирования. До готовности события буферизуются; подписка
  // пересоздаётся при смене ready/goHome, но дедупликация по id не даёт двойного
  // перехода. Все обращения к refs — в обработчике/эффектах (не в рендере).
  useEffect(() => {
    return subscribeToNotificationResponses((tap) => {
      if (tap.url !== HOME_NOTIFICATION_URL) {
        return; // неподдерживаемый url
      }
      if (seen.current.has(tap.id)) {
        return; // уже обработан
      }
      if (!ready) {
        if (!pending.current.some((item) => item.id === tap.id)) {
          pending.current.push(tap); // сохраняем для обработки после готовности
        }
        return;
      }
      seen.current.add(tap.id);
      goHome();
    });
  }, [ready, goHome]);

  // По готовности: первоначальный ответ + буфер, каждый — не более одного раза.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const candidates: NotificationTap[] = [];
    const initial = consumeLastNotificationResponse();
    if (initial !== null) {
      candidates.push(initial);
    }
    candidates.push(...pending.current);
    pending.current = [];

    let navigated = false;
    for (const tap of candidates) {
      if (tap.url !== HOME_NOTIFICATION_URL || seen.current.has(tap.id)) {
        continue; // неподдерживаемый или уже обработанный (в т.ч. тот же id из двух источников)
      }
      seen.current.add(tap.id);
      if (!navigated) {
        navigated = true;
        goHome();
      }
    }
  }, [ready, goHome]);
}
