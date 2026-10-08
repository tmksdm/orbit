/**
 * Data-level unit-of-work фиксации взаимодействия.
 *
 * Обязательное уточнение владельца (docs/plans/stage-2-data.md): запись нового
 * `Interaction` и обновлённого `Contact` выполняются атомарно в ОДНОЙ
 * эксклюзивной SQLite-транзакции. Состояние, при котором Interaction сохранён,
 * а новый рекомендуемый интервал — нет (или наоборот), недопустимо.
 *
 * Изоляция (BLOCKER-01 внешнего ревью Stage 2): все запросы операции выполняются
 * через транзакционный контекст `tx`, который передаёт `SqlDatabase.transaction`.
 * Репозитории для операции строятся поверх `tx`, поэтому чтение, вставка события
 * и сохранение контакта действительно идут внутри одной изолированной транзакции
 * и не пересекаются с параллельными запросами.
 *
 * Расчёт интервала НЕ дублируется: пересчёт делает чистая domain-функция
 * `recordInteraction` (Stage 1), слой data лишь сохраняет её результат.
 */

import { recordInteraction } from "../domain/contact";
import type { Contact, Interaction } from "../domain/types";
import { createContactRepository } from "./contactRepository";
import { createInteractionRepository } from "./interactionRepository";
import type { SqlDatabase } from "./sqlDatabase";

/** Фиксация взаимодействия: атомарная запись события и обновлённого контакта. */
export interface InteractionRecorder {
  /**
   * Пересчитывает рекомендуемый интервал (domain) и сохраняет `Interaction`
   * и обновлённый `Contact` в одной эксклюзивной транзакции. Возвращает
   * обновлённый Contact.
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

/** Создаёт unit-of-work поверх драйвера. */
export function createInteractionRecorder(db: SqlDatabase): InteractionRecorder {
  return {
    async record(contactId: string, interaction: Interaction): Promise<Contact> {
      return db.transaction(async (tx) => {
        // Репозитории строятся поверх транзакционного контекста: их запросы
        // выполняются внутри той же транзакции (изоляция атомарной операции).
        const contacts = createContactRepository(tx);
        const interactions = createInteractionRepository(tx);

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
