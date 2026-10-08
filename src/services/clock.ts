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

/** Продовый источник времени: системные часы устройства. */
export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  today: () => toLocalDate(new Date().toISOString()),
  toLocalDate,
};
