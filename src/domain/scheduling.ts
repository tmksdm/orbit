/**
 * Scheduling algorithm доменного слоя: пересчёт рекомендуемого интервала
 * до следующего контакта.
 *
 * Чистые, детерминированные функции: без часов, случайности, I/O и зависимостей
 * от React / Expo / SQLite / UI. Правила — docs/DOMAIN.md (решения владельца
 * от 2026-10-08):
 *
 *  - множитель применяется к ТЕКУЩЕМУ рекомендуемому интервалу контакта,
 *    а не к фактическому промежутку между взаимодействиями;
 *  - каждый новый no_reply снова умножает текущий интервал (× 2.2),
 *    независимо от стратегии и инициатора;
 *  - maxIntervalDays НЕ существует — интервал растёт без искусственного потолка;
 *  - результат не опускается ниже minIntervalDays;
 *  - дробные дни округляются до целого (Math.round).
 */

import type { ContactStrategy, Initiator, Outcome } from "./types";

/** Нижняя граница интервала по умолчанию (дни). */
export const DEFAULT_MIN_INTERVAL_DAYS = 2;

/** Стартовый интервал контакта без истории (дни) — см. REVIEW_REPORT.md, Open questions. */
export const INITIAL_INTERVAL_DAYS = 7;

/**
 * Утверждённые множители MVP. Производные ячейки (выведены из правил,
 * не меняют утверждённых значений):
 *  - maintain + mutual — как maintain + them (maintain никогда не сокращает);
 *  - grow + mutual + short — ×1.0 (короткий контакт не сокращает интервал);
 *  - no_reply — ×2.2 при любом инициаторе (приоритет правила no_reply).
 */
export const INTERVAL_MULTIPLIERS: Readonly<
  Record<ContactStrategy, Readonly<Record<Initiator, Readonly<Record<Outcome, number>>>>>
> = {
  maintain: {
    me: { good: 1.4, short: 1.7, no_reply: 2.2 },
    them: { good: 1.0, short: 1.0, no_reply: 2.2 },
    mutual: { good: 1.0, short: 1.0, no_reply: 2.2 },
  },
  grow: {
    me: { good: 1.4, short: 1.7, no_reply: 2.2 },
    them: { good: 0.8, short: 1.0, no_reply: 2.2 },
    mutual: { good: 0.8, short: 1.0, no_reply: 2.2 },
  },
};

/** Вход пересчёта интервала. */
export interface IntervalInput {
  /** Стратегия контакта. */
  readonly strategy: ContactStrategy;
  /** Кто инициировал взаимодействие. */
  readonly initiator: Initiator;
  /** Результат взаимодействия. */
  readonly outcome: Outcome;
  /** Текущий рекомендуемый интервал (дни) — база пересчёта. */
  readonly currentIntervalDays: number;
  /** Нижняя граница результата (дни); по умолчанию — DEFAULT_MIN_INTERVAL_DAYS. */
  readonly minIntervalDays?: number;
}

/**
 * Пересчитывает рекомендуемый интервал после одного взаимодействия.
 * Детерминирована: одинаковый вход → одинаковый результат.
 */
export function computeNextIntervalDays(input: IntervalInput): number {
  const minIntervalDays = input.minIntervalDays ?? DEFAULT_MIN_INTERVAL_DAYS;
  const multiplier =
    INTERVAL_MULTIPLIERS[input.strategy][input.initiator][input.outcome];
  const rounded = Math.round(input.currentIntervalDays * multiplier);
  return Math.max(rounded, minIntervalDays);
}
