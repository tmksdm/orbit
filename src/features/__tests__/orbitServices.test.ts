/**
 * Unit-тесты use-cases Stage 3 (features): порядок отображения, выборка
 * ПОСЛЕДНЕГО взаимодействия, валидация добавления, фиксация с подставным
 * временем. Порты Stage 2 подменяются in-memory реализациями (план Stage 3 —
 * «компонентные тесты с подставными реализациями портов»).
 */
import { INITIAL_INTERVAL_DAYS } from "../../domain/scheduling";
import type { Contact, Interaction } from "../../domain/types";
import type { ContactRepository, InteractionRepository } from "../../domain/ports";
import {
  createOrbitServices,
  OrbitValidationError,
  type OrbitServicesDeps,
} from "../orbitServices";

const NOW = "2026-10-08T05:00:00.000Z";
const clock = {
  now: () => NOW,
  today: () => "2026-10-08",
  toLocalDate: (iso: string) => iso.slice(0, 10),
};

/** Собирает зависимости с in-memory хранилищем. */
function makeDeps(seed: Contact[] = []): {
  deps: OrbitServicesDeps;
  store: Contact[];
  history: Map<string, Interaction[]>;
  recorded: { contactId: string; interaction: Interaction }[];
} {
  const store: Contact[] = [...seed];
  const history = new Map<string, Interaction[]>();
  const recorded: { contactId: string; interaction: Interaction }[] = [];
  let idSeq = 0;
  const contacts: ContactRepository = {
    list: async () => [...store],
    getById: async (id) => store.find((c) => c.id === id) ?? null,
    save: async (c) => {
      const i = store.findIndex((x) => x.id === c.id);
      if (i === -1) store.push(c);
      else store[i] = c;
    },
  };
  const interactionsRepo: InteractionRepository = {
    add: async (contactId, interaction) => {
      const arr = history.get(contactId) ?? [];
      arr.push(interaction);
      history.set(contactId, arr);
    },
    listByContact: async (contactId) =>
      [...(history.get(contactId) ?? [])].sort((a, b) =>
        a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
      ),
  };
  const recorder = {
    record: async (contactId: string, interaction: Interaction) => {
      recorded.push({ contactId, interaction });
      const contact = store.find((c) => c.id === contactId);
      if (contact === undefined) throw new Error(`Contact not found: ${contactId}`);
      return contact;
    },
  };
  const deps: OrbitServicesDeps = {
    contacts,
    interactions: interactionsRepo,
    recorder,
    clock,
    createId: () => `id-${++idSeq}`,
  };
  return { deps, store, history, recorded };
}

function contact(partial: Partial<Contact> & { id: string }): Contact {
  return {
    name: "Имя",
    strategy: "maintain",
    minIntervalDays: 2,
    recommendedIntervalDays: 2,
    ...partial,
  };
}

function at(id: string, date: string): Interaction {
  return { initiator: "me", outcome: "good", occurredAt: `${date}T10:00:00Z` };
}

describe("loadContactList — порядок отображения (решение 2)", () => {
  it("due-контакты сверху по возрастанию nextDueDate; остальные ниже; без срока — в конце", async () => {
    const { deps, history } = makeDeps([
      contact({ id: "a", name: "Анна", recommendedIntervalDays: 4 }), // last 10-06 → due 10-10
      contact({ id: "b", name: "Борис", recommendedIntervalDays: 2 }), // last 10-05 → due 10-07
      contact({ id: "c", name: "Вера", recommendedIntervalDays: 2 }), // last 10-01 → due 10-03
      contact({ id: "d", name: "Глеб", recommendedIntervalDays: 4, createdAt: "2026-09-20T10:00:00Z" }), // без истории → due 09-24
      contact({ id: "e", name: "Дима", recommendedIntervalDays: 2 }), // без опоры → без срока
    ]);
    history.set("a", [at("a", "2026-10-06")]);
    history.set("b", [at("b", "2026-10-05")]);
    history.set("c", [at("c", "2026-10-01")]);

    const view = await createOrbitServices(deps).loadContactList();

    // Группа «пора»: d (09-24) → c (10-03) → b (10-07);
    // группа «остальные»: a (10-10, ближайшие сверху) → e (без срока — в конце).
    expect(view.due.map((v) => v.contact.id)).toEqual(["d", "c", "b"]);
    expect(view.rest.map((v) => v.contact.id)).toEqual(["a", "e"]);
    expect(view.total).toBe(5);
  });

  it("при равном nextDueDate — по имени без учёта регистра, затем по id", async () => {
    const { deps, history } = makeDeps([
      contact({ id: "x1", name: "олег", recommendedIntervalDays: 2 }),
      contact({ id: "y1", name: "Олег", recommendedIntervalDays: 2 }),
      contact({ id: "b2", name: "Борис", recommendedIntervalDays: 2 }),
    ]);
    history.set("x1", [at("x1", "2026-10-01")]);
    history.set("y1", [at("y1", "2026-10-01")]);
    history.set("b2", [at("b2", "2026-10-01")]);

    const view = await createOrbitServices(deps).loadContactList();

    // Все три due с nextDueDate = 2026-10-03; имена: «борис» < «олег» (регистр
    // не учитывается); при полном совпадении имён — по id.
    expect(view.due.map((v) => v.contact.id)).toEqual(["b2", "x1", "y1"]);
  });

  it("опора — ПОСЛЕДНЕЕ взаимодействие по occurredAt, а не первое", async () => {
    const { deps, history } = makeDeps([contact({ id: "c1", recommendedIntervalDays: 2 })]);
    history.set("c1", [at("c1", "2026-10-01"), at("c1", "2026-10-06")]);

    const view = await createOrbitServices(deps).loadContactList();

    // От 10-06 + 2 дня = 10-08 → сегодня; (ошибочно от 10-01 было бы -5 дней).
    expect(view.due).toHaveLength(1);
    expect(view.due[0]?.daysUntilDue).toBe(0);
  });

  it("прогресс кольца: elapsed/interval, нижний порог 6%, без опоры — null", async () => {
    const { deps, history } = makeDeps([
      contact({ id: "half", recommendedIntervalDays: 4 }),
      contact({ id: "min", recommendedIntervalDays: 4 }),
      contact({ id: "none", recommendedIntervalDays: 4 }),
    ]);
    history.set("half", [at("half", "2026-10-06")]); // 2/4 → 50%
    history.set("min", [at("min", "2026-10-08")]); // 0/4 → 0% → порог 6%

    const view = await createOrbitServices(deps).loadContactList();

    const byId = (id: string) =>
      [...view.due, ...view.rest].find((v) => v.contact.id === id);
    expect(byId("half")?.progressPercent).toBe(50);
    expect(byId("min")?.progressPercent).toBe(6);
    expect(byId("none")?.progressPercent).toBeNull();
  });
});

describe("addContact (F2)", () => {
  it("создаёт контакт: имя обрезано, стартовый интервал 2 (утверждено), createdAt = сейчас, сохранён", async () => {
    const { deps, store } = makeDeps();
    const created = await createOrbitServices(deps).addContact({
      name: "  Марина  ",
      note: "  ",
      strategy: "grow",
    });

    expect(created.name).toBe("Марина");
    expect(created.note).toBeUndefined(); // пустая заметка не сохраняется
    expect(created.strategy).toBe("grow");
    expect(created.recommendedIntervalDays).toBe(INITIAL_INTERVAL_DAYS);
    expect(created.minIntervalDays).toBe(2);
    expect(created.id).toBe("id-1");
    expect(created.createdAt).toBe(NOW);
    expect(store).toHaveLength(1);
  });

  it("пустое имя — ошибка валидации с понятным сообщением", async () => {
    const { deps } = makeDeps();
    await expect(
      createOrbitServices(deps).addContact({ name: "   ", strategy: "grow" }),
    ).rejects.toThrow("Укажите имя — без него контакт не сохранить.");
    await expect(
      createOrbitServices(deps).addContact({
        name: "Имя",
        strategy: "auto" as never,
      }),
    ).rejects.toThrow(OrbitValidationError);
  });
});

describe("recordInteraction (F3)", () => {
  it("передаёт в атомарную операцию occurredAt = сейчас (тестируемый источник времени)", async () => {
    const { deps, recorded } = makeDeps([contact({ id: "c1" })]);
    await createOrbitServices(deps).recordInteraction("c1", {
      initiator: "them",
      outcome: "no_reply",
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.contactId).toBe("c1");
    expect(recorded[0]?.interaction).toEqual({
      initiator: "them",
      outcome: "no_reply",
      occurredAt: NOW,
    });
  });
});
