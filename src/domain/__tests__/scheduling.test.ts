/**
 * Unit-тесты scheduling algorithm (Stage 1).
 * Обязательные кейсы — docs/plans/stage-1-domain.md, правила — docs/DOMAIN.md.
 */

import {
  computeNextIntervalDays,
  DEFAULT_MIN_INTERVAL_DAYS,
  INITIAL_INTERVAL_DAYS,
  INTERVAL_MULTIPLIERS,
} from "../scheduling";
import { createContact, recordInteraction } from "../contact";
import type { ContactStrategy, Initiator, Outcome } from "../types";

const at = "2026-10-08T00:00:00Z";

/** [strategy, initiator, outcome, утверждённый множитель] */
const approvedCases: [ContactStrategy, Initiator, Outcome, number][] = [
  ["maintain", "me", "good", 1.4],
  ["maintain", "me", "short", 1.7],
  ["maintain", "me", "no_reply", 2.2],
  ["maintain", "them", "good", 1.0],
  ["maintain", "them", "short", 1.0],
  ["grow", "me", "good", 1.4],
  ["grow", "me", "short", 1.7],
  ["grow", "me", "no_reply", 2.2],
  ["grow", "them", "good", 0.8],
  ["grow", "them", "short", 1.0],
  ["grow", "mutual", "good", 0.8],
];

describe("computeNextIntervalDays — утверждённые множители MVP", () => {
  test.each(approvedCases)("%s + %s + %s → ×%s", (strategy, initiator, outcome, m) => {
    const next = computeNextIntervalDays({
      strategy,
      initiator,
      outcome,
      currentIntervalDays: 10,
    });
    expect(next).toBe(Math.round(10 * m));
  });

  test.each([10, 20, 7])(
    "множители применяются к текущему интервалу, база = %d",
    (base) => {
      for (const [strategy, byInitiator] of Object.entries(INTERVAL_MULTIPLIERS)) {
        for (const [initiator, byOutcome] of Object.entries(byInitiator)) {
          for (const [outcome, m] of Object.entries(byOutcome)) {
            const next = computeNextIntervalDays({
              strategy: strategy as ContactStrategy,
              initiator: initiator as Initiator,
              outcome: outcome as Outcome,
              currentIntervalDays: base,
            });
            expect(next).toBe(Math.max(Math.round(base * m), DEFAULT_MIN_INTERVAL_DAYS));
          }
        }
      }
    },
  );
});

describe("производные правила (выведены из утверждённых, см. docs/DOMAIN.md)", () => {
  test("maintain + mutual + good не сокращает интервал", () => {
    expect(
      computeNextIntervalDays({
        strategy: "maintain",
        initiator: "mutual",
        outcome: "good",
        currentIntervalDays: 10,
      }),
    ).toBe(10);
  });

  test("maintain + mutual + no_reply увеличивает интервал", () => {
    expect(
      computeNextIntervalDays({
        strategy: "maintain",
        initiator: "mutual",
        outcome: "no_reply",
        currentIntervalDays: 10,
      }),
    ).toBe(22);
  });

  test("grow + mutual + short не сокращает интервал", () => {
    expect(
      computeNextIntervalDays({
        strategy: "grow",
        initiator: "mutual",
        outcome: "short",
        currentIntervalDays: 10,
      }),
    ).toBe(10);
  });

  test("grow + mutual + no_reply увеличивает интервал независимо от стратегии", () => {
    expect(
      computeNextIntervalDays({
        strategy: "grow",
        initiator: "mutual",
        outcome: "no_reply",
        currentIntervalDays: 10,
      }),
    ).toBe(22);
  });
});

describe("повторный no_reply — накопление", () => {
  test("10 → 22 → 48 → 106 (каждый no_reply умножает текущий интервал)", () => {
    let contact = createContact({
      id: "c1",
      name: "Аня",
      strategy: "grow",
      recommendedIntervalDays: 10,
    });
    const seen: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      contact = recordInteraction(contact, {
        initiator: "me",
        outcome: "no_reply",
        occurredAt: at,
      });
      seen.push(contact.recommendedIntervalDays);
    }
    expect(seen).toEqual([22, 48, 106]);
  });
});

describe("верхней границы нет (maxIntervalDays удалён)", () => {
  test("рост выше 45 продолжается без потолка", () => {
    let contact = createContact({
      id: "c2",
      name: "Борис",
      strategy: "grow",
      recommendedIntervalDays: 10,
    });
    for (let i = 0; i < 5; i += 1) {
      contact = recordInteraction(contact, {
        initiator: "me",
        outcome: "no_reply",
        occurredAt: at,
      });
    }
    // 10 → 22 → 48 → 106 → 233 → 513
    expect(contact.recommendedIntervalDays).toBe(513);
  });
});

describe("очень большие интервалы", () => {
  test("10 000 → 22 000 без потери точности", () => {
    expect(
      computeNextIntervalDays({
        strategy: "grow",
        initiator: "me",
        outcome: "no_reply",
        currentIntervalDays: 10_000,
      }),
    ).toBe(22_000);
  });

  test("миллион дней умножается корректно", () => {
    expect(
      computeNextIntervalDays({
        strategy: "maintain",
        initiator: "me",
        outcome: "short",
        currentIntervalDays: 1_000_000,
      }),
    ).toBe(1_700_000);
  });
});

describe("minIntervalDays", () => {
  test("дефолт (2): сближение не опускается ниже 2 дней", () => {
    expect(
      computeNextIntervalDays({
        strategy: "grow",
        initiator: "them",
        outcome: "good",
        currentIntervalDays: 2,
      }),
    ).toBe(2);
  });

  test("кастомная граница: результат не ниже minIntervalDays", () => {
    expect(
      computeNextIntervalDays({
        strategy: "grow",
        initiator: "them",
        outcome: "good",
        currentIntervalDays: 5,
        minIntervalDays: 5,
      }),
    ).toBe(5);
  });

  test("не опускает уже поднятый минимум и не мешает росту", () => {
    expect(
      computeNextIntervalDays({
        strategy: "maintain",
        initiator: "me",
        outcome: "good",
        currentIntervalDays: 3,
        minIntervalDays: 2,
      }),
    ).toBe(4); // 3 × 1.4 = 4.2 → 4
  });
});

describe("первое взаимодействие и отсутствие истории", () => {
  test("новый контакт получает стартовый интервал (не фактический промежуток)", () => {
    const contact = createContact({ id: "c3", name: "Вера", strategy: "grow" });
    expect(contact.recommendedIntervalDays).toBe(INITIAL_INTERVAL_DAYS);
    expect(contact.recommendedIntervalDays).toBe(7);
  });

  test("первое взаимодействие считает от стартового интервала, даже если человек написал через 2 дня", () => {
    let contact = createContact({ id: "c3", name: "Вера", strategy: "grow" });
    contact = recordInteraction(contact, {
      initiator: "them",
      outcome: "good",
      occurredAt: at,
    });
    // 7 × 0.8 = 5.6 → 6; база — рекомендуемый интервал (7), а не фактические 2 дня
    expect(contact.recommendedIntervalDays).toBe(6);
  });

  test("отсутствие истории — детерминированный дефолт, ошибка не бросается", () => {
    const a = createContact({ id: "c4", name: "Глеб", strategy: "maintain" });
    const b = createContact({ id: "c4", name: "Глеб", strategy: "maintain" });
    expect(a.recommendedIntervalDays).toBe(b.recommendedIntervalDays);
  });
});

describe("детерминированность", () => {
  test("одинаковый вход → одинаковый результат", () => {
    const run = (): number =>
      computeNextIntervalDays({
        strategy: "grow",
        initiator: "them",
        outcome: "good",
        currentIntervalDays: 10,
      });
    expect(run()).toBe(run());
    expect(run()).toBe(8);
  });

  test("recordInteraction иммутабелен: исходный контакт не меняется", () => {
    const before = createContact({
      id: "c5",
      name: "Даша",
      strategy: "grow",
      recommendedIntervalDays: 10,
    });
    const after = recordInteraction(before, {
      initiator: "them",
      outcome: "good",
      occurredAt: at,
    });
    expect(before.recommendedIntervalDays).toBe(10);
    expect(after.recommendedIntervalDays).toBe(8);
    expect(after).not.toBe(before);
  });
});
