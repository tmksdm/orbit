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

describe("shouldSeedDueContact — проверка значения флага (чистая функция)", () => {
  it("включается лишь при EXPO_PUBLIC_SEED_DUE_CONTACT = '1'", () => {
    expect(shouldSeedDueContact({})).toBe(false);
    expect(shouldSeedDueContact({ EXPO_PUBLIC_SEED_DUE_CONTACT: "0" })).toBe(false);
    expect(shouldSeedDueContact({ EXPO_PUBLIC_SEED_DUE_CONTACT: "true" })).toBe(false);
    expect(shouldSeedDueContact({ EXPO_PUBLIC_SEED_DUE_CONTACT: "1" })).toBe(true);
  });
});

describe("seedRequestedFromEnv — обёртка над статическим чтением (BLOCKER-01)", () => {
  it("возвращает boolean (значение подставляет сборка статически)", () => {
    // Значение читается статическим обращением process.env.EXPO_PUBLIC_SEED_DUE_CONTACT,
    // поэтому в сборке Metro подставляет «1» либо undefined. Проверяем контракт типа;
    // сама логика значения покрыта тестом shouldSeedDueContact выше.
    expect(typeof seedRequestedFromEnv()).toBe("boolean");
  });
});

describe("seedOverdueContact — идемпотентный просроченный контакт", () => {
  it("создаёт контакт с датой создания в прошлом (срок уже прошёл)", async () => {
    const contacts = new FakeContacts();
    const created = await seedOverdueContact({ contacts, clock, combineLocalDateTime });
    expect(created).toBe(true);
    const contact = contacts.store.get(SEED_CONTACT_ID);
    expect(contact).toBeDefined();
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
