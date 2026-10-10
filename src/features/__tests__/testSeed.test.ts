/**
 * Unit-тесты одноразового fixture (Stage 4, Фаза 5, MAJOR-01): активация по флагу и
 * идемпотентное создание просроченного тестового контакта. Нативный SQLite не нужен —
 * используется in-memory подмена `ContactRepository`; продакшн-логика не затрагивается.
 */
import { addDays } from "../../domain/due";
import type { Contact } from "../../domain/types";
import {
  SEED_CONTACT_ID,
  seedOverdueContact,
  seedRequestedFromEnv,
  shouldSeedDueContact,
} from "../testSeed";

/** In-memory подмена `ContactRepository`. */
class FakeContacts {
  readonly store = new Map<string, Contact>();
  async list(): Promise<Contact[]> {
    return [...this.store.values()];
  }
  async getById(id: string): Promise<Contact | null> {
    return this.store.get(id) ?? null;
  }
  async save(contact: Contact): Promise<void> {
    this.store.set(contact.id, contact);
  }
}

const TODAY = "2026-10-10";
const clock = {
  now: () => "2026-10-10T00:00:00.000Z",
  today: () => TODAY,
  toLocalDate: (iso: string) => iso.slice(0, 10),
};
const combineLocalDateTime = (date: string, time: string) => new Date(`${date}T${time}:00.000Z`);

describe("shouldSeedDueContact — активация фикстуры только по флагу", () => {
  it("включается лишь при EXPO_PUBLIC_SEED_DUE_CONTACT = '1'", () => {
    expect(shouldSeedDueContact({})).toBe(false);
    expect(shouldSeedDueContact({ EXPO_PUBLIC_SEED_DUE_CONTACT: "0" })).toBe(false);
    expect(shouldSeedDueContact({ EXPO_PUBLIC_SEED_DUE_CONTACT: "true" })).toBe(false);
    expect(shouldSeedDueContact({ EXPO_PUBLIC_SEED_DUE_CONTACT: "1" })).toBe(true);
  });

  it("seedRequestedFromEnv читает окружение без типов Node", () => {
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
    const saved = g.process?.env?.EXPO_PUBLIC_SEED_DUE_CONTACT;
    if (g.process !== undefined) g.process.env = { ...g.process.env };
    expect(seedRequestedFromEnv()).toBe(false);
    if (g.process !== undefined && g.process.env !== undefined) {
      g.process.env.EXPO_PUBLIC_SEED_DUE_CONTACT = "1";
      expect(seedRequestedFromEnv()).toBe(true);
      if (saved === undefined) delete g.process.env.EXPO_PUBLIC_SEED_DUE_CONTACT;
      else g.process.env.EXPO_PUBLIC_SEED_DUE_CONTACT = saved;
    }
  });
});

describe("seedOverdueContact — идемпотентный просроченный контакт", () => {
  it("создаёт контакт с датой создания в прошлом (срок уже прошёл)", async () => {
    const contacts = new FakeContacts();

    const created = await seedOverdueContact({ contacts, clock, combineLocalDateTime });

    expect(created).toBe(true);
    const contact = contacts.store.get(SEED_CONTACT_ID);
    expect(contact).toBeDefined();
    // Дата создания = сегодня − 5; срок = дата + 2 дня → просрочен (≤ сегодня).
    expect(contact?.createdAt?.slice(0, 10)).toBe(addDays(TODAY, -5));
    const dueDate = addDays(addDays(TODAY, -5), contact?.recommendedIntervalDays ?? 0);
    expect(dueDate <= TODAY).toBe(true);
  });

  it("второй запуск не создаёт дублей (идемпотентность по фиксированному id)", async () => {
    const contacts = new FakeContacts();

    const first = await seedOverdueContact({ contacts, clock, combineLocalDateTime });
    const second = await seedOverdueContact({ contacts, clock, combineLocalDateTime });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(contacts.store.size).toBe(1);
  });
});
