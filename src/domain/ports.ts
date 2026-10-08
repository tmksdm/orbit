/**
 * Порты репозиториев доменного слоя.
 *
 * Чистый TypeScript: без импортов react, expo, react-native, sqlite и UI
 * (ARCHITECTURE.md, правило 2). Интерфейсы объявляет domain, реализации даёт
 * слой data — направление зависимостей DATA → DOMAIN (ARCHITECTURE.md, правило 4).
 *
 * API асинхронный (Promise): драйвер `expo-sqlite` асинхронный
 * (docs/plans/stage-2-data.md).
 */

import type { Contact, Interaction } from "./types";

/** Хранилище контактов. */
export interface ContactRepository {
  /** Все контакты. */
  list(): Promise<Contact[]>;
  /** Контакт по id или null, если не найден. */
  getById(id: string): Promise<Contact | null>;
  /** Создаёт или обновляет контакт по id (upsert). */
  save(contact: Contact): Promise<void>;
}

/** Хранилище истории взаимодействий. */
export interface InteractionRepository {
  /** Добавляет взаимодействие контакту. */
  add(contactId: string, interaction: Interaction): Promise<void>;
  /** История контакта, отсортированная по `occurredAt` (по возрастанию). */
  listByContact(contactId: string): Promise<Interaction[]>;
}
