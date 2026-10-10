/**
 * Источник времени под изоляцией platform API (план Stage 3, «Technical
 * approach»): внедряется в features и подменяется в тестах фиксированным
 * значением. Домен остаётся детерминированным — он принимает «сегодня»
 * параметром, а перевод момента ISO 8601 в локальную календарную дату
 * выполняется здесь (см. src/domain/due.ts).
 */

/** Источник времени и календарных дат приложения. */
export interface Clock {
  /** Текущий момент (ISO 8601, UTC) — например, для `occurredAt` и `createdAt`. */
  now(): string;
  /** Локальная календарная дата «сегодня» (YYYY-MM-DD). */
  today(): string;
  /** Локальная календарная дата (YYYY-MM-DD) момента ISO 8601. */
  toLocalDate(iso: string): string;
}

/** Локальная календарная дата (YYYY-MM-DD) момента ISO 8601 в зоне устройства. */
export function toLocalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO 8601 moment: ${iso}`);
  }
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Абсолютный момент из локальной календарной даты (YYYY-MM-DD) и локального
 * времени (HH:MM) в текущей зоне устройства (Stage 4, §6.6). При несуществующем
 * локальном времени (переход на летнее время, «весной») `Date` нормализует
 * значение вперёд — задокументированное поведение JavaScript, отдельно не
 * компенсируется. Функция детерминирована и не зависит от текущих часов.
 */
export function combineLocalDateTime(date: string, time: string): Date {
  const dateParts = date.split("-");
  const timeParts = time.split(":");
  const year = Number(dateParts[0]);
  const month = Number(dateParts[1]);
  const day = Number(dateParts[2]);
  const hours = Number(timeParts[0]);
  const minutes = Number(timeParts[1]);
  const validDate =
    dateParts.length === 3 &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31;
  if (!validDate) {
    throw new Error(`Invalid local date (expected YYYY-MM-DD): ${date}`);
  }
  const validTime =
    timeParts.length === 2 &&
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59;
  if (!validTime) {
    throw new Error(`Invalid local time (expected HH:MM): ${time}`);
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** Продовый источник времени: системные часы устройства. */
export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  today: () => toLocalDate(new Date().toISOString()),
  toLocalDate,
};
