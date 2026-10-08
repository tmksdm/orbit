/**
 * Unit-тесты продовой сборки сервисов (`src/features/runtime.ts`).
 *
 * REVIEW-03: отклонённый промис инициализации НЕ должен навсегда оставаться в
 * кеше — после ошибки следующий вызов повторяет попытку; при успешном запуске
 * инициализация выполняется ровно один раз (общий промис на всех вызывающих).
 * `openOrbitDatabase` и platform-сервисы (clock/uuid) подменяются.
 */
import type { OrbitServices } from "../orbitServices";

jest.mock("../../data", () => ({ openOrbitDatabase: jest.fn() }));
jest.mock("../../services/clock", () => ({
  systemClock: {
    now: () => "2026-10-08T00:00:00.000Z",
    today: () => "2026-10-08",
    toLocalDate: (iso: string) => iso.slice(0, 10),
  },
}));
jest.mock("../../services/uuid", () => ({ createUuid: () => "id-1" }));

interface RuntimeModule {
  getOrbitServices: () => Promise<OrbitServices>;
}

/** Свежий экземпляр замоканного слоя данных (после `jest.resetModules`). */
function dataModule(): { openOrbitDatabase: jest.Mock } {
  return jest.requireMock<{ openOrbitDatabase: jest.Mock }>("../../data");
}

/** Свежий экземпляр модуля runtime (сбрасывает внутренний кеш промиса). */
function freshRuntime(): RuntimeModule {
  return jest.requireActual<RuntimeModule>("../runtime");
}

const fakeData = { contacts: {}, interactions: {}, recorder: {} };

describe("runtime.getOrbitServices (REVIEW-03)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("после ошибки инициализации следующий вызов повторяет попытку", async () => {
    const data = dataModule();
    data.openOrbitDatabase
      .mockRejectedValueOnce(new Error("init failed"))
      .mockResolvedValueOnce(fakeData);
    const { getOrbitServices } = freshRuntime();

    await expect(getOrbitServices()).rejects.toThrow("init failed");
    // Отклонённый промис не остался в кеше — попытка повторяется:
    await expect(getOrbitServices()).resolves.toBeDefined();
    expect(data.openOrbitDatabase).toHaveBeenCalledTimes(2);
  });

  it("успешная инициализация выполняется один раз (общий кеш)", async () => {
    const data = dataModule();
    data.openOrbitDatabase.mockResolvedValue(fakeData);
    const { getOrbitServices } = freshRuntime();

    const first = getOrbitServices();
    const second = getOrbitServices();
    expect(second).toBe(first);
    await expect(first).resolves.toBeDefined();
    expect(data.openOrbitDatabase).toHaveBeenCalledTimes(1);
  });
});
