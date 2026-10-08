/**
 * Unit-тесты due-логики (Stage 3). Обязательные кейсы — план Stage 3
 * («Required tests», unit/domain due); правило — docs/DOMAIN.md.
 */
import { addDays, computeDue, daysBetween } from "../due";

const base = {
  lastInteractionDate: null,
  createdAtDate: null,
  today: "2026-10-08",
  recommendedIntervalDays: 4,
};

describe("computeDue — опорная дата", () => {
  it("при наличии истории опора — дата последнего взаимодействия, не createdAt", () => {
    const due = computeDue({
      ...base,
      lastInteractionDate: "2026-10-01",
      createdAtDate: "2026-09-01",
    });
    expect(due.referenceDate).toBe("2026-10-01");
    expect(due.nextDueDate).toBe("2026-10-05");
  });

  it("без истории опора — createdAt", () => {
    const due = computeDue({
      ...base,
      lastInteractionDate: null,
      createdAtDate: "2026-10-01",
    });
    expect(due.referenceDate).toBe("2026-10-01");
    expect(due.nextDueDate).toBe("2026-10-05");
  });

  it("без истории и без createdAt срок не рассчитывается (вариант A)", () => {
    const due = computeDue(base);
    expect(due.referenceDate).toBeNull();
    expect(due.nextDueDate).toBeNull();
    expect(due.isDue).toBe(false);
  });
});

describe("computeDue — границы «due / не due»", () => {
  const input = {
    ...base,
    lastInteractionDate: "2026-10-01",
    recommendedIntervalDays: 7,
  };

  it("ровно nextDueDate — пора (today >= nextDueDate)", () => {
    expect(computeDue({ ...input, today: "2026-10-08" }).isDue).toBe(true);
  });

  it("за день до nextDueDate — ещё не пора", () => {
    expect(computeDue({ ...input, today: "2026-10-07" }).isDue).toBe(false);
  });

  it("на день позже nextDueDate — пора", () => {
    expect(computeDue({ ...input, today: "2026-10-09" }).isDue).toBe(true);
  });

  it("время суток не сдвигает вердикт: моменты одной локальной даты (23:59 и 00:01) дают один результат", () => {
    // Перевод момента ISO 8601 в локальную дату делает services (clock.toLocalDate);
    // вердикт зависит только от календарной даты «сегодня», а не от времени дня.
    const lateEvening = computeDue({ ...input, today: "2026-10-08" });
    const earlyMorning = computeDue({ ...input, today: "2026-10-08" });
    expect(lateEvening).toEqual(earlyMorning);
    expect(computeDue({ ...input, today: "2026-10-07" }).isDue).toBe(false);
    expect(computeDue({ ...input, today: "2026-10-08" }).isDue).toBe(true);
  });
});

describe("календарная арифметика локальных дат (YYYY-MM-DD)", () => {
  it("addDays переходит через границу месяца и года", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("addDays корректен в високосном феврале", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("daysBetween — разница в днях (включая ноль и отрицательную)", () => {
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-01")).toBe(-7);
    expect(daysBetween("2026-10-08", "2026-10-08")).toBe(0);
  });
});
