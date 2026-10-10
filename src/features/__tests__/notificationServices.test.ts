/**
 * Unit-тесты use-cases Stage 4 (Фаза 3): серилизуемое согласование расписания
 * (`syncNotifications`), управление настройками, конкурентность, разрешения и
 * удаление устаревших показанных. Обязательные кейсы — plan §10.6, §10.7, §10.8,
 * §10.9. `NotificationPlatform` и репозиторий настроек подменяются in-memory
 * реализациями; нативный `expo-notifications` не загружается (только типы).
 */
import { createNotificationServices, type SyncResult } from "../notificationServices";
import { createOrbitServices, type OrbitServicesDeps } from "../orbitServices";
import { addDays } from "../../domain/due";
import type { NotificationSettings } from "../../domain/notifications";
import type { Contact, Interaction } from "../../domain/types";
import type {
  InstalledNotification,
  NotificationPlatform,
  PermissionState,
  PlannedNotificationRequest,
  PresentedNotification,
} from "../../services/notifications";

const TODAY = "2026-10-10";
const NOW_TIME = "18:00";
const NOW_ISO = "2026-10-10T08:00:00.000Z";

const clock = {
  now: () => NOW_ISO,
  today: () => TODAY,
  toLocalDate: (iso: string) => iso.slice(0, 10),
};
const toLocalTime = () => NOW_TIME;
const combineLocalDateTime = (date: string, time: string) => new Date(`${date}T${time}:00.000Z`);

/** Заглушка платформы уведомлений. */
class FakePlatform implements NotificationPlatform {
  permission: PermissionState = { granted: true, canAskAgain: true };
  requestResult: PermissionState | null = null;
  ensureChannelCalls = 0;
  scheduleCalls = 0;
  cancelCalls: string[] = [];
  dismissCalls: string[] = [];
  scheduled: InstalledNotification[] = [];
  presented: PresentedNotification[] = [];
  gate: Promise<void> | null = null;
  failScheduleTimes = 0;
  failEnsureTimes = 0;
  maxConcurrentList = 0;
  private concurrentList = 0;
  private seq = 0;

  async getPermissionStatus(): Promise<PermissionState> {
    return this.permission;
  }
  async requestPermission(): Promise<PermissionState> {
    return this.requestResult ?? this.permission;
  }
  async ensureChannel(): Promise<void> {
    this.ensureChannelCalls += 1;
    if (this.failEnsureTimes > 0) {
      this.failEnsureTimes -= 1;
      throw new Error("ensureChannel failed");
    }
    if (this.gate) {
      const current = this.gate;
      this.gate = null;
      await current;
    }
  }
  async listScheduledOurs(): Promise<readonly InstalledNotification[]> {
    this.concurrentList += 1;
    this.maxConcurrentList = Math.max(this.maxConcurrentList, this.concurrentList);
    await Promise.resolve();
    const copy = this.scheduled.map((item) => ({ ...item }));
    this.concurrentList -= 1;
    return copy;
  }
  async cancelNotifications(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.cancelCalls.push(id);
      this.scheduled = this.scheduled.filter((item) => item.id !== id);
    }
  }
  async cancelAllOurs(): Promise<void> {
    await this.cancelNotifications(this.scheduled.map((item) => item.id));
  }
  async schedule(req: PlannedNotificationRequest): Promise<void> {
    this.scheduleCalls += 1;
    if (this.failScheduleTimes > 0) {
      this.failScheduleTimes -= 1;
      throw new Error("schedule failed");
    }
    this.seq += 1;
    this.scheduled.push({
      id: `n${this.seq}`,
      cycleDate: req.cycleDate,
      count: req.count,
      fireAtMs: req.fireDate.getTime(),
    });
  }
  async listPresentedOurs(): Promise<readonly PresentedNotification[]> {
    return this.presented.map((item) => ({ ...item }));
  }
  async dismissNotifications(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.dismissCalls.push(id);
      this.presented = this.presented.filter((item) => item.id !== id);
    }
  }
}

/** In-memory репозиторий настроек. */
function makeSettings(initial?: Partial<NotificationSettings>) {
  let current: NotificationSettings = {
    enabled: false,
    anchorDate: null,
    reminderTime: "19:00",
    ...initial,
  };
  return {
    load: async () => ({ ...current }),
    save: async (next: NotificationSettings) => {
      current = { ...next };
    },
    get: () => current,
  };
}

/** Контакт с заданным `nextDueDate` (через последнее взаимодействие). */
function contactDue(id: string, dueDate: string, interval = 2): Contact {
  return { id, name: id, strategy: "maintain", minIntervalDays: 2, recommendedIntervalDays: interval };
}

function historyFor(contact: Contact, dueDate: string, interval: number): Interaction[] {
  const last = addDays(dueDate, -interval);
  return [{ initiator: "me", outcome: "good", occurredAt: `${last}T10:00:00Z` }];
}

function makeContacts(entries: { contact: Contact; due: string; interval: number }[]) {
  const store = entries.map((e) => e.contact);
  const history = new Map<string, Interaction[]>();
  for (const e of entries) {
    history.set(e.contact.id, historyFor(e.contact, e.due, e.interval));
  }
  return {
    store,
    history,
    contacts: {
      list: async () => [...store],
      getById: async (id: string) => store.find((c) => c.id === id) ?? null,
      save: async (c: Contact) => {
        const i = store.findIndex((x) => x.id === c.id);
        if (i === -1) store.push(c);
        else store[i] = c;
      },
    },
    interactions: {
      add: async (contactId: string, interaction: Interaction) => {
        const arr = history.get(contactId) ?? [];
        arr.push(interaction);
        history.set(contactId, arr);
      },
      listByContact: async (contactId: string) =>
        [...(history.get(contactId) ?? [])].sort((a, b) =>
          a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
        ),
    },
  };
}

interface Harness {
  platform: FakePlatform;
  settings: ReturnType<typeof makeSettings>;
  services: ReturnType<typeof createNotificationServices>;
  contactsStore: Contact[];
  interactionHistory: Map<string, Interaction[]>;
  contactsRepo: {
    list: () => Promise<Contact[]>;
    getById: (id: string) => Promise<Contact | null>;
    save: (c: Contact) => Promise<void>;
  };
  interactionsRepo: {
    add: (contactId: string, i: Interaction) => Promise<void>;
    listByContact: (id: string) => Promise<Interaction[]>;
  };
}

function makeHarness(params?: {
  entries?: { contact: Contact; due: string; interval: number }[];
  settings?: Partial<NotificationSettings>;
  permission?: PermissionState;
  horizonDays?: number;
  platform?: FakePlatform;
}): Harness {
  const built = makeContacts(params?.entries ?? []);
  const platform = params?.platform ?? new FakePlatform();
  if (params?.permission !== undefined) platform.permission = params.permission;
  const settings = makeSettings(params?.settings);
  const services = createNotificationServices({
    contacts: built.contacts,
    interactions: built.interactions,
    settings,
    platform,
    clock,
    toLocalTime,
    combineLocalDateTime,
    horizonDays: params?.horizonDays ?? 6,
  });
  return {
    platform,
    settings,
    services,
    contactsStore: built.store,
    interactionHistory: built.history,
    contactsRepo: built.contacts,
    interactionsRepo: built.interactions,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const fireAt = (cycleDate: string, time = "19:00") =>
  combineLocalDateTime(cycleDate, time).getTime();

describe("syncNotifications — согласование по различиям (§10.6)", () => {
  it("первый sync добавляет план; второй при неизменных данных не трогает платформу", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true },
    });

    const first = await h.services.syncNotifications();
    expect(first).toEqual({ ok: true, added: 2, removed: 0, kept: 0 }); // 13, 16
    expect(h.platform.scheduleCalls).toBe(2);
    expect(h.platform.scheduled.map((s) => s.cycleDate)).toEqual(["2026-10-13", "2026-10-16"]);

    const second = await h.services.syncNotifications();
    expect(second).toEqual({ ok: true, added: 0, removed: 0, kept: 2 });
    expect(h.platform.scheduleCalls).toBe(2); // платформа НЕ трогалась
    expect(h.platform.cancelCalls).toEqual([]);
  });

  it("установленный пункт, которого нет в плане, удаляется", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-13" } });
    h.platform.scheduled = [
      { id: "old", cycleDate: "2026-10-01", count: 1, fireAtMs: fireAt("2026-10-01") },
    ];

    const result = await h.services.syncNotifications();

    expect(h.platform.cancelCalls).toContain("old");
    expect(h.platform.scheduled).toHaveLength(0);
    expect(result).toEqual({ ok: true, added: 0, removed: 1, kept: 0 });
  });

  it("изменение count дня цикла перепланирует только этот пункт", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
    });
    h.platform.scheduled = [
      { id: "s13", cycleDate: "2026-10-13", count: 9, fireAtMs: fireAt("2026-10-13") },
      { id: "s16", cycleDate: "2026-10-16", count: 1, fireAtMs: fireAt("2026-10-16") },
    ];

    const result = await h.services.syncNotifications();

    expect(h.platform.cancelCalls).toEqual(["s13"]);
    expect(result).toEqual({ ok: true, added: 1, removed: 1, kept: 1 });
    expect(h.platform.scheduled.find((s) => s.cycleDate === "2026-10-16")?.id).toBe("s16");
  });

  it("изменение времени напоминания перепланирует все пункты", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
    });
    await h.services.syncNotifications();
    const before = h.platform.scheduled.length;

    const result = await h.services.setReminderTime("08:00");

    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.sync).toEqual({ ok: true, added: before, removed: before, kept: 0 });
    expect(h.platform.scheduled.every((s) => s.fireAtMs === fireAt(s.cycleDate, "08:00"))).toBe(
      true,
    );
  });

  it("нет просроченных и нет дат due: всё снято, план пуст", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-13" } });
    h.platform.scheduled = [
      { id: "x", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
    ];
    h.platform.presented = [{ id: "p", cycleDate: "2026-10-13", count: 1 }];

    const result = await h.services.syncNotifications();

    expect(result).toEqual({ ok: true, added: 0, removed: 1, kept: 0 });
    expect(h.platform.scheduled).toHaveLength(0);
    expect(h.platform.dismissCalls).toEqual(["p"]);
  });

  it("появление нового просроченного: добавляется ближайший день цикла (сегодня)", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-10"), due: "2026-10-10", interval: 2 }],
      settings: { enabled: true },
    });

    const result = await h.services.syncNotifications();

    expect(result.ok).toBe(true);
    expect(h.platform.scheduled.map((s) => s.cycleDate)).toEqual([
      "2026-10-10",
      "2026-10-13",
      "2026-10-16",
    ]);
    expect(h.settings.get().anchorDate).toBe("2026-10-10");
  });

  it("взаимодействие убрало просрочку: лишние сняты, показанное удалено", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-10"), due: "2026-10-10", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-10" },
    });
    h.platform.scheduled = [
      { id: "s10", cycleDate: "2026-10-10", count: 1, fireAtMs: fireAt("2026-10-10") },
      { id: "s13", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
      { id: "s16", cycleDate: "2026-10-16", count: 1, fireAtMs: fireAt("2026-10-16") },
    ];
    h.platform.presented = [{ id: "p", cycleDate: "2026-10-10", count: 1 }];

    // Новое взаимодействие уводит срок далеко в будущее.
    const updated = { ...h.contactsStore[0]!, recommendedIntervalDays: 25 };
    h.contactsStore[0] = updated;
    h.interactionHistory.set("a", [
      { initiator: "me", outcome: "good", occurredAt: "2026-10-09T10:00:00Z" },
    ]);

    const result = await h.services.syncNotifications();

    expect(result.ok).toBe(true);
    expect(h.platform.scheduled).toHaveLength(0);
    expect(h.platform.cancelCalls.sort()).toEqual(["s10", "s13", "s16"]);
    expect(h.platform.dismissCalls).toEqual(["p"]);
  });

  it("частичный сбой schedule: следующий sync доводит набор до желаемого, без дублей", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
    });
    h.platform.failScheduleTimes = 1;

    const failed = await h.services.syncNotifications();
    expect(failed.ok).toBe(false);

    const fixed = await h.services.syncNotifications();
    expect(fixed).toEqual({ ok: true, added: 2, removed: 0, kept: 0 });
    expect(h.platform.scheduled.map((s) => s.cycleDate)).toEqual(["2026-10-13", "2026-10-16"]);
  });

  it("два установленных с одним cycleDate: остаётся один, лишний отменяется (MINOR-03)", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
    });
    h.platform.scheduled = [
      { id: "d1", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
      { id: "d2", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
    ];

    const result = await h.services.syncNotifications();

    expect(result).toEqual({ ok: true, added: 1, removed: 1, kept: 1 }); // +16, −d2, kept d1
    expect(h.platform.cancelCalls).toEqual(["d2"]);
    expect(h.platform.scheduled.filter((s) => s.cycleDate === "2026-10-13")).toHaveLength(1);
  });

  it("дубли cycleDate: остаётся актуальный, устаревший отменяется, лишнего schedule нет (MINOR-01)", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
    });
    // Первое устарело (count=5), второе полностью совпадает с желаемым (count=1).
    h.platform.scheduled = [
      { id: "stale", cycleDate: "2026-10-13", count: 5, fireAtMs: fireAt("2026-10-13") },
      { id: "actual", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
    ];

    const result = await h.services.syncNotifications();

    expect(h.platform.cancelCalls).toEqual(["stale"]); // устаревший дубль снят
    expect(h.platform.scheduled.find((s) => s.cycleDate === "2026-10-13")?.id).toBe("actual");
    expect(h.platform.scheduled.filter((s) => s.cycleDate === "2026-10-13")).toHaveLength(1);
    // actual совпал с желаемым → kept; extra schedule только для 2026-10-16.
    expect(h.platform.scheduleCalls).toBe(1);
    expect(result).toEqual({ ok: true, added: 1, removed: 1, kept: 1 });
  });
});

describe("syncNotifications — конкурентность и разрешения (§10.7, BLOCKER-03)", () => {
  it("первый (единственный) вызов резолвится определённым {ok:true}", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-13" } });
    const result = await h.services.syncNotifications();
    expect(result.ok).toBe(true);
  });

  it("два параллельных вызова: не более одного runSyncOnce; общий промис определён", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-13" } });
    const gate = deferred();
    h.platform.gate = gate.promise;

    const p1 = h.services.syncNotifications();
    const p2 = h.services.syncNotifications();
    expect(p2).toBe(p1); // один и тот же актуальный промис
    gate.resolve();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toEqual(r2);
    expect(r1.ok).toBe(true);
    expect(h.platform.maxConcurrentList).toBeLessThanOrEqual(1);
  });

  it("N частых триггеров во время прогона сворачиваются в ОДИН повтор", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-13" } });
    const gate = deferred();
    h.platform.gate = gate.promise;

    const first = h.services.syncNotifications();
    for (let i = 0; i < 5; i += 1) {
      h.services.syncNotifications();
    }
    gate.resolve();
    await first;

    // ensureChannel вызывается один раз за итерацию drain → 1 + один повтор.
    expect(h.platform.ensureChannelCalls).toBe(2);
  });

  it("исключение внутри runSyncOnce: промис не отклоняется, все получают ok:false, блокировка снята", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-13" } });
    // Исключение устойчиво (все итерации drain): параллельный триггер ставит
    // rerun, и обе итерации возвращают ok:false — все ожидающие получают его.
    h.platform.failEnsureTimes = 2;

    const p1 = h.services.syncNotifications();
    const p2 = h.services.syncNotifications();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);

    // Следующий вызов запускает новый цикл (очередь не зависла).
    const r3 = await h.services.syncNotifications();
    expect(r3.ok).toBe(true);
  });

  it("разрешение отозвано при enabled=true: наши сняты, anchor сохранён, blocked=permission", async () => {
    const h = makeHarness({
      settings: { enabled: true, anchorDate: "2026-10-13" },
      permission: { granted: false, canAskAgain: true },
    });
    h.platform.scheduled = [
      { id: "x", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
    ];

    const result = await h.services.syncNotifications();

    expect(result).toEqual({ ok: true, added: 0, removed: 1, kept: 0, blocked: "permission" });
    expect(h.platform.scheduled).toHaveLength(0);
    expect(h.settings.get().anchorDate).toBe("2026-10-13"); // anchor сохранён
  });

  it("разрешение выдано снова: расписание восстановлено с прежним anchor", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
      permission: { granted: false, canAskAgain: true },
    });
    await h.services.syncNotifications(); // снято, anchor сохранён

    h.platform.permission = { granted: true, canAskAgain: true };
    const result = await h.services.syncNotifications();

    expect(result.ok).toBe(true);
    expect(h.settings.get().anchorDate).toBe("2026-10-13");
    expect(h.platform.scheduled.map((s) => s.cycleDate)).toEqual(["2026-10-13", "2026-10-16"]);
  });

  it("enabled=false при выданном разрешении: ничего не планируется, установленные сняты", async () => {
    const h = makeHarness({ settings: { enabled: false, anchorDate: "2026-10-13" } });
    h.platform.scheduled = [
      { id: "x", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
    ];

    const result = await h.services.syncNotifications();

    expect(result).toEqual({ ok: true, added: 0, removed: 1, kept: 0 });
    expect(h.platform.scheduleCalls).toBe(0);
    expect(h.platform.scheduled).toHaveLength(0);
  });

  it("setEnabled: отказ в разрешении — enabled остаётся false, статус permissionDenied", async () => {
    const h = makeHarness({ permission: { granted: false, canAskAgain: false } });
    h.platform.requestResult = { granted: false, canAskAgain: false };

    const result = await h.services.setEnabled(true);

    expect(result.status).toBe("permissionDenied");
    if (result.status !== "permissionDenied") return;
    expect(result.canAskAgain).toBe(false);
    expect(result.sync.ok).toBe(true); // пустое расписание — очистка успешна
    expect(h.settings.get().enabled).toBe(false);
    expect(h.platform.scheduleCalls).toBe(0);
  });

  it("setEnabled(true) при отказе в разрешении снимает старое расписание Orbit, сохраняя anchor и время (MAJOR-01)", async () => {
    const h = makeHarness({
      settings: { enabled: false, anchorDate: "2026-10-13", reminderTime: "08:30" },
      permission: { granted: false, canAskAgain: true },
    });
    h.platform.requestResult = { granted: false, canAskAgain: true };
    // Ранее установленные и показанное «наши» (например, от прежнего состояния).
    h.platform.scheduled = [
      { id: "old1", cycleDate: "2026-10-13", count: 1, fireAtMs: fireAt("2026-10-13") },
      { id: "old2", cycleDate: "2026-10-16", count: 1, fireAtMs: fireAt("2026-10-16") },
    ];
    h.platform.presented = [{ id: "p", cycleDate: "2026-10-13", count: 1 }];

    const result = await h.services.setEnabled(true);

    expect(result.status).toBe("permissionDenied");
    if (result.status !== "permissionDenied") return;
    expect(result.canAskAgain).toBe(true);
    expect(result.sync).toEqual({ ok: true, added: 0, removed: 2, kept: 0 });
    expect(h.platform.scheduled).toHaveLength(0); // старое расписание снято
    expect(h.platform.cancelCalls.sort()).toEqual(["old1", "old2"]);
    expect(h.platform.dismissCalls).toEqual(["p"]); // показанное удалено
    expect(h.platform.scheduleCalls).toBe(0);
    expect(h.settings.get().enabled).toBe(false);
    expect(h.settings.get().anchorDate).toBe("2026-10-13"); // anchor сохранён
    expect(h.settings.get().reminderTime).toBe("08:30"); // время сохранено
  });

  it("setEnabled(true) при выданном разрешении: включает и планирует (anchor сразу)", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
    });
    const result = await h.services.setEnabled(true);
    expect(result.status).toBe("saved");
    expect(h.settings.get().enabled).toBe(true);
    expect(h.settings.get().anchorDate).toBe("2026-10-13");
    expect(h.platform.scheduled.map((s) => s.cycleDate)).toEqual(["2026-10-13", "2026-10-16"]);
  });
});

describe("отображение показанных уведомлений (§10.8, MAJOR-02)", () => {
  function overdueHarness(count: number, presentedCount: number) {
    const entries = [
      { contact: contactDue("a", "2026-10-09"), due: "2026-10-09", interval: 2 },
    ];
    if (count >= 2) {
      entries.push({ contact: contactDue("b", "2026-10-08"), due: "2026-10-08", interval: 2 });
    }
    const h = makeHarness({ entries, settings: { enabled: true, anchorDate: "2026-10-10" } });
    h.platform.presented = [{ id: "shown", cycleDate: "2026-10-10", count: presentedCount }];
    return h;
  }

  it("показанное совпадает с текущим count — остаётся", async () => {
    const h = overdueHarness(2, 2);
    await h.services.syncNotifications();
    expect(h.platform.dismissCalls).toEqual([]);
    expect(h.platform.presented).toHaveLength(1);
  });

  it("count изменился — устаревшая сводка удаляется", async () => {
    const h = overdueHarness(2, 5);
    await h.services.syncNotifications();
    expect(h.platform.dismissCalls).toEqual(["shown"]);
    expect(h.platform.presented).toHaveLength(0);
  });

  it("полное устранение просрочки — все показанные удаляются", async () => {
    const h = makeHarness({ settings: { enabled: true, anchorDate: "2026-10-10" } });
    h.platform.presented = [
      { id: "p1", cycleDate: "2026-10-10", count: 1 },
      { id: "p2", cycleDate: "2026-10-13", count: 2 },
    ];
    await h.services.syncNotifications();
    expect(h.platform.dismissCalls.sort()).toEqual(["p1", "p2"]);
  });
});

describe("сохранность данных при ошибке sync (§10.9)", () => {
  it("sync бросает ошибку после recordInteraction: Interaction и Contact сохранены; ok:false", async () => {
    const h = makeHarness({
      entries: [{ contact: contactDue("a", "2026-10-13"), due: "2026-10-13", interval: 2 }],
      settings: { enabled: true, anchorDate: "2026-10-13" },
    });
    h.platform.failEnsureTimes = 1; // sync вернёт ok:false (не бросает наружу)

    const syncResults: SyncResult[] = [];
    const recorder = {
      record: async (contactId: string, interaction: Interaction) => {
        const contact = h.contactsStore.find((c) => c.id === contactId);
        if (contact === undefined) throw new Error(`Contact not found: ${contactId}`);
        await h.interactionsRepo.add(contactId, interaction);
        const updated = { ...contact, recommendedIntervalDays: 4 };
        await h.contactsRepo.save(updated);
        return updated;
      },
    };
    const deps: OrbitServicesDeps = {
      contacts: h.contactsRepo,
      interactions: h.interactionsRepo,
      recorder,
      clock,
      createId: () => "id-1",
      onInteractionRecorded: async () => {
        syncResults.push(await h.services.syncNotifications());
      },
    };
    const orbit = createOrbitServices(deps);

    const updated = await orbit.recordInteraction("a", { initiator: "them", outcome: "no_reply" });

    expect(updated.recommendedIntervalDays).toBe(4);
    expect(h.interactionHistory.get("a")).toHaveLength(2); // история + новое (без дублей)
    expect(h.contactsStore[0]?.recommendedIntervalDays).toBe(4);
    expect(syncResults[0]?.ok).toBe(false); // ошибка sync не откатила сохранение
  });
});
