/**
 * Use-cases Stage 3: связывают экраны (`src/app`) с domain и data.
 *
 * Бизнес-правила не дублируются (ARCHITECTURE.md, правило 3): пересчёт интервала —
 * domain (`createContact`, `recordInteraction`), расчёт due — domain (`computeDue`),
 * атомарная запись взаимодействия — data (`recorder.record`). Здесь только
 * композиция: загрузка данных, view-модели, порядок отображения и валидация формы.
 *
 * Доступ к данным — через порты Stage 2 (`contacts`, `interactions`, `recorder`);
 * решение о поверхности API зафиксировано в плане Stage 3 («Technical approach»).
 */

import { createContact } from "../domain/contact";
import { computeDue, daysBetween } from "../domain/due";
import type { ContactRepository, InteractionRepository } from "../domain/ports";
import type { Contact, ContactStrategy, Initiator, Interaction, Outcome } from "../domain/types";
import type { InteractionRecorder } from "../data/interactionRecorder";
import type { Clock } from "../services/clock";

/** Генератор идентификаторов (platform API под изоляцией, см. src/services/uuid.ts). */
export type IdGenerator = () => string;

/** View-модель контакта с рассчитанным сроком («пора связаться»). */
export interface ContactDueView {
  readonly contact: Contact;
  /** Результат чистой доменной функции `computeDue`. */
  readonly due: ReturnType<typeof computeDue>;
  /** Число взаимодействий в истории. */
  readonly interactionCount: number;
  /**
   * Прогресс дуги кольца, процент (DESIGN.md §5:
   * `p = clamp(round(elapsed / interval × 100), 6, 100)`);
   * null — дуга не рисуется (срок не рассчитывается).
   */
  readonly progressPercent: number | null;
  /** Дней до срока (отрицательное — просрочено); null — срок не рассчитан. */
  readonly daysUntilDue: number | null;
}

/** View-модель главного экрана: две группы — «пора» и «остальные». */
export interface ContactListView {
  readonly due: readonly ContactDueView[];
  readonly rest: readonly ContactDueView[];
  readonly total: number;
}

/** Строка истории для отображения: локальная дата подготовлена для UI. */
export interface HistoryEntry {
  readonly initiator: Initiator;
  readonly outcome: Outcome;
  /** Момент события (ISO 8601). */
  readonly occurredAt: string;
  /** Локальная календарная дата события (YYYY-MM-DD) — готово к форматированию. */
  readonly localDate: string;
}

/** View-модель карточки контакта: то же + read-only история. */
export interface ContactCardView extends ContactDueView {
  /** История взаимодействий, отсортированная по `occurredAt` по возрастанию. */
  readonly history: readonly HistoryEntry[];
}

/** Use-cases, доступные экранам. */
export interface OrbitServices {
  /** Список контактов: due-группа сверху, порядок — по правилу плана Stage 3. */
  loadContactList(): Promise<ContactListView>;
  /** Карточка контакта или null, если не найден. */
  loadContactCard(id: string): Promise<ContactCardView | null>;
  /** Добавление контакта: стартовый интервал 2 дня, `createdAt` = сейчас. */
  addContact(input: AddContactInput): Promise<Contact>;
  /**
   * Фиксация взаимодействия через атомарную операцию Stage 2:
   * `occurredAt` = сейчас (ISO 8601), интервал пересчитывает domain.
   */
  recordInteraction(contactId: string, input: RecordInteractionInput): Promise<Contact>;
}

export interface AddContactInput {
  readonly name: string;
  readonly note?: string;
  readonly strategy: ContactStrategy;
}

export interface RecordInteractionInput {
  readonly initiator: Initiator;
  readonly outcome: Outcome;
}

/** Ошибка валидации формы (сообщение — пользовательское, русский UI). */
export class OrbitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrbitValidationError";
  }
}

/** Зависимости use-cases (внедряются; в тестах — подмены). */
export interface OrbitServicesDeps {
  readonly contacts: ContactRepository;
  readonly interactions: InteractionRepository;
  readonly recorder: InteractionRecorder;
  readonly clock: Clock;
  readonly createId: IdGenerator;
}

/**
 * Считает view-модель due для одного контакта. История ожидается
 * отсортированной по `occurredAt` по возрастанию (контракт
 * `InteractionRepository.listByContact`) — опора для due: ПОСЛЕДНЯЯ по
 * `occurredAt` запись.
 */
export function buildContactDueView(params: {
  contact: Contact;
  history: readonly Interaction[];
  today: string;
  toLocalDate: (iso: string) => string;
}): ContactDueView {
  const { contact, history, today, toLocalDate } = params;
  const last = history[history.length - 1];
  const due = computeDue({
    lastInteractionDate: last === undefined ? null : toLocalDate(last.occurredAt),
    createdAtDate: contact.createdAt === undefined ? null : toLocalDate(contact.createdAt),
    today,
    recommendedIntervalDays: contact.recommendedIntervalDays,
  });
  const progressPercent =
    due.referenceDate === null
      ? null
      : Math.min(
          100,
          Math.max(
            6,
            Math.round(
              (daysBetween(due.referenceDate, today) / contact.recommendedIntervalDays) * 100,
            ),
          ),
        );
  return {
    contact,
    due,
    interactionCount: history.length,
    progressPercent,
    daysUntilDue: due.nextDueDate === null ? null : daysBetween(today, due.nextDueDate),
  };
}

/**
 * Порядок отображения (утверждённое решение 2, план Stage 3): группа 1 — «пора»,
 * группа 2 — «остальные» (включая контакты без рассчитываемого срока); внутри
 * группы — по возрастанию `nextDueDate` (без срока — в конце), при совпадении —
 * по имени без учёта регистра, затем по `id`.
 */
function compareByNameThenId(a: Contact, b: Contact): number {
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  if (an !== bn) return an < bn ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function compareViews(a: ContactDueView, b: ContactDueView): number {
  const ad = a.due.nextDueDate;
  const bd = b.due.nextDueDate;
  if (ad === null && bd === null) return compareByNameThenId(a.contact, b.contact);
  if (ad === null) return 1; // без срока — в конце группы
  if (bd === null) return -1;
  if (ad !== bd) return ad < bd ? -1 : 1;
  return compareByNameThenId(a.contact, b.contact);
}

/** Разбивает контакты на группы «пора» / «остальные» с сортировкой по правилу. */
export function buildContactListView(params: {
  contacts: readonly Contact[];
  historyByContact: ReadonlyMap<string, readonly Interaction[]>;
  today: string;
  toLocalDate: (iso: string) => string;
}): ContactListView {
  const { contacts, historyByContact, today, toLocalDate } = params;
  const views = contacts.map((contact) =>
    buildContactDueView({
      contact,
      history: historyByContact.get(contact.id) ?? [],
      today,
      toLocalDate,
    }),
  );
  const due = views.filter((v) => v.due.isDue).sort(compareViews);
  const rest = views.filter((v) => !v.due.isDue).sort(compareViews);
  return { due, rest, total: views.length };
}

/** Собирает use-cases поверх портов Stage 2 и сервисов. */
export function createOrbitServices(deps: OrbitServicesDeps): OrbitServices {
  const { contacts, interactions, recorder, clock, createId } = deps;

  async function loadHistoryForAll(
    list: readonly Contact[],
  ): Promise<Map<string, readonly Interaction[]>> {
    const map = new Map<string, readonly Interaction[]>();
    await Promise.all(
      list.map(async (contact) => {
        map.set(contact.id, await interactions.listByContact(contact.id));
      }),
    );
    return map;
  }

  return {
    async loadContactList(): Promise<ContactListView> {
      const list = await contacts.list();
      const historyByContact = await loadHistoryForAll(list);
      return buildContactListView({
        contacts: list,
        historyByContact,
        today: clock.today(),
        toLocalDate: clock.toLocalDate,
      });
    },

    async loadContactCard(id): Promise<ContactCardView | null> {
      const contact = await contacts.getById(id);
      if (contact === null) return null;
      const history = await interactions.listByContact(id);
      const view = buildContactDueView({
        contact,
        history,
        today: clock.today(),
        toLocalDate: clock.toLocalDate,
      });
      const entries: HistoryEntry[] = history.map((item) => ({
        initiator: item.initiator,
        outcome: item.outcome,
        occurredAt: item.occurredAt,
        localDate: clock.toLocalDate(item.occurredAt),
      }));
      return { ...view, history: entries };
    },

    async addContact(input): Promise<Contact> {
      const name = input.name.trim();
      if (name.length === 0) {
        throw new OrbitValidationError("Укажите имя — без него контакт не сохранить.");
      }
      if (input.strategy !== "maintain" && input.strategy !== "grow") {
        // Решение 3: явный выбор стратегии обязателен, автоматического значения нет.
        throw new OrbitValidationError("Выберите одну из стратегий.");
      }
      const note = input.note?.trim();
      const contact = createContact({
        id: createId(),
        name,
        note: note === undefined || note.length === 0 ? undefined : note,
        strategy: input.strategy,
        createdAt: clock.now(),
      });
      await contacts.save(contact);
      return contact;
    },

    async recordInteraction(contactId, input): Promise<Contact> {
      const occurredAt = clock.now();
      return recorder.record(contactId, {
        initiator: input.initiator,
        outcome: input.outcome,
        occurredAt,
      });
    },
  };
}
