/**
 * Data-level unit-of-work фиксации взаимодействия.
 *
 * Обязательное уточнение владельца (docs/plans/stage-2-data.md): запись нового
 * `Interaction` и обновлённого `Contact` выполняются атомарно в ОДНОЙ
 * SQLite-транзакции. Состояние, при котором Interaction сохранён, а новый
 * рекомендуемый интервал — нет (или наоборот), недопустимо.
 *
 * Расчёт интервала НЕ дублируется: пересчёт делает чистая domain-функция
 * `recordInteraction` (Stage 1), слой data лишь сохраняет её результат.
 */

import { recordInteraction } from "../domain/contact";
import type { ContactRepository, InteractionRepository } from "../domain/ports";
import type { Contact, Interaction } from "../domain/types";
import type { SqlDatabase } from "./sqlDatabase";

/** Фиксация взаимодействия: атомарная запись события и обновлённого контакта. */
export interface InteractionRecorder {
  /**
   * Пересчитывает рекомендуемый интервал (domain) и сохраняет `Interaction`
   * и обновлённый `Contact` в одной транзакции. Возвращает обновлённый Contact.
   */
  record(contactId: string, interaction: Interaction): Promise<Contact>;
}

/** Ошибка: фиксация взаимодействия для несуществующего контакта. */
export class ContactNotFoundError extends Error {
  constructor(contactId: string) {
    super(`Contact not found: ${contactId}`);
    this.name = "ContactNotFoundError";
  }
}

/** Создаёт unit-of-work поверх драйвера и репозиториев. */
export function createInteractionRecorder(
  db: SqlDatabase,
  contacts: ContactRepository,
  interactions: InteractionRepository,
): InteractionRecorder {
  return {
    async record(contactId: string, interaction: Interaction): Promise<Contact> {
      return db.transaction(async () => {
        const contact = await contacts.getById(contactId);
        if (contact === null) {
          throw new ContactNotFoundError(contactId);
        }
        const updated = recordInteraction(contact, interaction);
        await interactions.add(contactId, interaction);
        await contacts.save(updated);
        return updated;
      });
    },
  };
}
