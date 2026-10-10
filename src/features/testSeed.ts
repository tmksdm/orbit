/**
 * Одноразовый SQLite-fixture для ручной Android-проверки Stage 4 (Фаза 5, MAJOR-01).
 *
 * Назначение — подготовить ТЕСТОВЫЕ ДАННЫЕ так, чтобы владелец получил реальное
 * уведомление **без многодневного ожидания**. Через UI это невозможно: новый контакт
 * получает минимальный срок 2 календарных дня (`INITIAL_INTERVAL_DAYS`), а фиксация
 * взаимодействия только переносит срок вперёд. Фикстура создаёт один контакт с датой
 * создания в прошлом, из-за чего он сразу просрочен.
 *
 * Изоляция от продакшн-логики и безопасность:
 *  - активируется ТОЛЬКО по переменной окружения сборки
 *    `EXPO_PUBLIC_SEED_DUE_CONTACT=1` (профиль `preview-seeded`); в обычных сборках
 *    (`preview`, `production`) флаг не выставлен — код не выполняется;
 *  - НЕ меняет алгоритмы контактов, интервалы и правила напоминаний;
 *  - НЕ добавляет ничего в пользовательский интерфейс и не является продуктовой функцией;
 *  - идемпотентна по фиксированному id — повторные запуски не создают дублей.
 *
 * Уведомление, которое получает владелец, — **реальное**: его планирует обычная
 * продуктовая логика по реально просроченному контакту. Моделируется только исходное
 * состояние данных, а не событие показа (моделируемое событие реальным не выдаётся).
 */

import { createContact } from "../domain/contact";
import { addDays } from "../domain/due";
import type { ContactRepository } from "../domain/ports";
import type { Clock } from "../services/clock";

/** Фиксированный id тестового контакта (идемпотентность фикстуры). */
export const SEED_CONTACT_ID = "seed-due-contact-v1";

/** Имя тестового контакта — намеренно помечено как тестовое (видно в списке). */
export const SEED_CONTACT_NAME = "Тестовый контакт (просрочен)";

/**
 * Сколько дней назад «создан» тестовый контакт. Срок = дата создания + 2 дня
 * (`INITIAL_INTERVAL_DAYS`) → при возрасте 5 дней контакт просрочен на 3 дня.
 */
const SEED_AGE_DAYS = 5;

/** Зависимости фикстуры (внедряются; в тестах — подмены). */
export interface SeedDeps {
  readonly contacts: ContactRepository;
  readonly clock: Clock;
  /** Локальные (дата, время) → абсолютный момент (services). */
  readonly combineLocalDateTime: (date: string, time: string) => Date;
}

/** true, если фикстуру нужно применить (переменная окружения выставлена в «1»). */
export function shouldSeedDueContact(env: Record<string, string | undefined>): boolean {
  return env.EXPO_PUBLIC_SEED_DUE_CONTACT === "1";
}

/**
 * Читает окружение безопасно, без зависимости от типов Node (`process` доступен в
 * рантайме Metro/jest, но не обязан быть типизирован в проекте).
 */
export function seedRequestedFromEnv(): boolean {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return shouldSeedDueContact(g.process?.env ?? {});
}

/**
 * Идемпотентно создаёт один просроченный контакт, если его ещё нет.
 *
 * @returns `true` — контакт создан этим вызовом; `false` — уже существовал.
 */
export async function seedOverdueContact(deps: SeedDeps): Promise<boolean> {
  const existing = await deps.contacts.getById(SEED_CONTACT_ID);
  if (existing !== null) {
    return false;
  }
  const createdDate = addDays(deps.clock.today(), -SEED_AGE_DAYS);
  const createdAt = deps.combineLocalDateTime(createdDate, "10:00").toISOString();
  const contact = createContact({
    id: SEED_CONTACT_ID,
    name: SEED_CONTACT_NAME,
    strategy: "maintain",
    createdAt,
  });
  await deps.contacts.save(contact);
  return true;
}
