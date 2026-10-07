/**
 * Contact: фабрика контакта и применение взаимодействия.
 *
 * Чистый TypeScript, без React / Expo / SQLite / UI. Функции иммутабельны:
 * возвращают новый Contact, не меняя переданный.
 */

import {
  computeNextIntervalDays,
  DEFAULT_MIN_INTERVAL_DAYS,
  INITIAL_INTERVAL_DAYS,
} from "./scheduling";
import type { Contact, ContactStrategy, Interaction } from "./types";

/** Параметры создания контакта. */
export interface ContactInput {
  readonly id: string;
  readonly name: string;
  readonly strategy: ContactStrategy;
  /** Нижняя граница интервала; по умолчанию — DEFAULT_MIN_INTERVAL_DAYS. */
  readonly minIntervalDays?: number;
  /** Стартовый интервал; по умолчанию — INITIAL_INTERVAL_DAYS. */
  readonly recommendedIntervalDays?: number;
}

/** Создаёт контакт без истории. */
export function createContact(input: ContactInput): Contact {
  const minIntervalDays = input.minIntervalDays ?? DEFAULT_MIN_INTERVAL_DAYS;
  const initial = input.recommendedIntervalDays ?? INITIAL_INTERVAL_DAYS;
  return {
    id: input.id,
    name: input.name,
    strategy: input.strategy,
    minIntervalDays,
    recommendedIntervalDays: Math.max(initial, minIntervalDays),
  };
}

/**
 * Применяет взаимодействие к контакту: возвращает новый Contact с пересчитанным
 * рекомендуемым интервалом. База пересчёта — текущий рекомендуемый интервал
 * контакта, а не фактический промежуток между взаимодействиями (docs/DOMAIN.md).
 */
export function recordInteraction(contact: Contact, interaction: Interaction): Contact {
  return {
    ...contact,
    recommendedIntervalDays: computeNextIntervalDays({
      strategy: contact.strategy,
      initiator: interaction.initiator,
      outcome: interaction.outcome,
      currentIntervalDays: contact.recommendedIntervalDays,
      minIntervalDays: contact.minIntervalDays,
    }),
  };
}
