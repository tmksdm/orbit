/**
 * Доменные типы приложения Orbit.
 *
 * Чистый TypeScript: без импортов react, expo, react-native, sqlite и UI.
 * Правила поведения зафиксированы в docs/DOMAIN.md.
 */

/** Стратегия связи с контактом. */
export type ContactStrategy = "maintain" | "grow";

/** Кто инициировал взаимодействие. */
export type Initiator = "me" | "them" | "mutual";

/** Результат взаимодействия. */
export type Outcome = "good" | "short" | "no_reply";

/** Факт общения. */
export interface Interaction {
  /** Кто инициировал. */
  readonly initiator: Initiator;
  /** Как прошёл контакт. */
  readonly outcome: Outcome;
  /** Когда состоялся (ISO 8601). */
  readonly occurredAt: string;
}

/** Человек в «орбите» пользователя. */
export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly strategy: ContactStrategy;
  /** Нижняя граница рекомендуемого интервала, дни. Верхней границы нет. */
  readonly minIntervalDays: number;
  /**
   * Текущий рекомендуемый интервал до следующего контакта, дни.
   * База для следующего пересчёта (docs/DOMAIN.md, «К чему применяется множитель»).
   */
  readonly recommendedIntervalDays: number;
}
