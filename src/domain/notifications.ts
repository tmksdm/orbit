/**
 * Domain-логика локальных напоминаний (Stage 4): модель настроек и чистые функции
 * календарного трёхдневного цикла, расчёта anchor и планирования на горизонт.
 *
 * Чистый TypeScript: без импортов react, expo, react-native, sqlite и UI
 * (ARCHITECTURE.md, правило 2). Функции детерминированы — «сегодня» и текущее
 * время передаются параметрами, домен часы не читает; перевод момента ISO 8601 в
 * локальную дату и «дата+время → момент» делает слой services. Контракт дат —
 * локальные календарные даты YYYY-MM-DD, время — HH:MM (как в src/domain/due.ts).
 *
 * Правила — docs/plans/stage-4-notifications.md (§6.2, §6.4, §6.5.1).
 * Календарная арифметика НЕ дублируется: переиспользуются `addDays`/`daysBetween`
 * из src/domain/due.ts.
 */

import { addDays, daysBetween } from './due';

/** Длина календарного цикла напоминаний, дни. */
export const NOTIFICATION_CYCLE_DAYS = 3;

/** Время напоминания по умолчанию (локальное). */
export const DEFAULT_REMINDER_TIME = '19:00';

/** Горизонт планирования в календарных днях (решение Q3; ≈122 уведомления). */
export const SCHEDULE_HORIZON_DAYS = 366;

/**
 * Настройки напоминаний (единственная строка хранилища).
 *
 * `enabled` — намерение пользователя иметь напоминания; фактическая возможность
 * показывать уведомления = `enabled && permission.granted` (§6.2, §6.7). Anchor
 * хранится независимо от разрешения и сохраняется при его отзыве/выдаче.
 */
export interface NotificationSettings {
  /** Намерение пользователя иметь напоминания (по умолчанию false). */
  readonly enabled: boolean;
  /** Локальная дата YYYY-MM-DD начала цикла; null — цикл ещё не начат. */
  readonly anchorDate: string | null;
  /** Локальное время напоминания HH:MM (по умолчанию DEFAULT_REMINDER_TIME). */
  readonly reminderTime: string;
}

/** Запланированное сводное уведомление на день цикла. */
export interface PlannedNotification {
  /** День цикла (локальная дата YYYY-MM-DD). */
  readonly cycleDate: string;
  /** Число просроченных контактов на начало этого дня цикла (> 0). */
  readonly dueCount: number;
}

/**
 * Первая дата цикла (§1.3, §6.4): при уже наступившем сроке.
 *
 *  - нет просроченных контактов → null (дату цикла определяет `resolveAnchor`);
 *  - время ещё не прошло (`reminderTime > nowTime`) → сегодня;
 *  - время прошло или совпало (`reminderTime <= nowTime`) → завтра.
 */
export function resolveFirstCycleDate(input: {
  readonly todayDate: string;
  readonly nowTime: string;
  readonly reminderTime: string;
  readonly hasOverdueContacts: boolean;
}): string | null {
  if (!input.hasOverdueContacts) {
    return null;
  }
  return input.reminderTime > input.nowTime ? input.todayDate : addDays(input.todayDate, 1);
}

/**
 * Даты цикла ≥ `fromDate`, максимум `limit` штук; шаг — NOTIFICATION_CYCLE_DAYS
 * календарных дней от `anchorDate` (§6.4). Порядок — по возрастанию.
 */
export function cycleDatesFrom(anchorDate: string, fromDate: string, limit: number): string[] {
  if (limit <= 0) {
    return [];
  }
  const offset = daysBetween(anchorDate, fromDate);
  const startIndex = offset <= 0 ? 0 : Math.ceil(offset / NOTIFICATION_CYCLE_DAYS);
  const dates: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    dates.push(addDays(anchorDate, (startIndex + i) * NOTIFICATION_CYCLE_DAYS));
  }
  return dates;
}

/** true, если `date` — день цикла (`date ≡ anchorDate` по модулю 3 календарных дня). */
export function isCycleDate(anchorDate: string, date: string): boolean {
  return daysBetween(anchorDate, date) % NOTIFICATION_CYCLE_DAYS === 0;
}

/**
 * Вычисляет anchor по известным датам due — БЕЗ ожидания foreground (BLOCKER-02,
 * §6.5.1). Учитывает будущие известные `nextDueDate`, поэтому первое уведомление
 * появляется даже если приложение больше не открывали.
 *
 * @param contactDueDates известные `nextDueDate` контактов (без null).
 *
 *  - есть `dueDate <= today` (уже просрочен) → `resolveFirstCycleDate(hasOverdue)`
 *    → today | tomorrow;
 *  - иначе есть будущая `dueDate > today` → минимальная будущая дата (первый день
 *    цикла);
 *  - иначе (нет контактов / нет вычисляемых сроков) → null.
 */
export function resolveAnchor(input: {
  readonly todayDate: string;
  readonly nowTime: string;
  readonly reminderTime: string;
  readonly contactDueDates: readonly string[];
}): string | null {
  const known = input.contactDueDates.filter((date) => date.length > 0);
  const hasOverdue = known.some((date) => date <= input.todayDate);
  if (hasOverdue) {
    return resolveFirstCycleDate({
      todayDate: input.todayDate,
      nowTime: input.nowTime,
      reminderTime: input.reminderTime,
      hasOverdueContacts: true,
    });
  }
  const future = known.filter((date) => date > input.todayDate);
  if (future.length === 0) {
    return null;
  }
  return future.reduce((min, date) => (date < min ? date : min));
}

/**
 * План уведомлений на горизонт (§6.4): только сегодняшние/будущие дни цикла в
 * пределах `horizonDays`, у которых `dueCount > 0`.
 *
 *  1. дни цикла берутся от `max(anchorDate, todayDate)` — прошедшие не планируются;
 *  2. `dueCount(cycleDate)` = число контактов с `nextDueDate <= cycleDate`;
 *  3. `dueCount == 0` → день пропускается (цикл в календаре сохраняется);
 *  4. сегодня + `reminderTime <= nowTime` → сегодня не планируется (§1.5);
 *  5. план ограничен `addDays(todayDate, horizonDays)`; порядок — возрастающий.
 */
export function planNotifications(input: {
  readonly anchorDate: string;
  readonly reminderTime: string;
  readonly todayDate: string;
  readonly nowTime: string;
  readonly horizonDays: number;
  readonly contactDueDates: readonly string[];
}): PlannedNotification[] {
  const start = input.anchorDate > input.todayDate ? input.anchorDate : input.todayDate;
  const end = addDays(input.todayDate, input.horizonDays);
  const maxCount = Math.floor(input.horizonDays / NOTIFICATION_CYCLE_DAYS) + 2;
  const dates = cycleDatesFrom(input.anchorDate, start, maxCount);
  const plan: PlannedNotification[] = [];
  for (const cycleDate of dates) {
    if (cycleDate > end) {
      break;
    }
    if (cycleDate === input.todayDate && input.reminderTime <= input.nowTime) {
      continue;
    }
    const dueCount = input.contactDueDates.filter((date) => date <= cycleDate).length;
    if (dueCount === 0) {
      continue;
    }
    plan.push({ cycleDate, dueCount });
  }
  return plan;
}
