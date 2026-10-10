/**
 * Unit-тесты хука навигации по нажатию на уведомление (§6.11; MAJOR-01 ревью):
 * события до готовности навигации, первоначальный ответ, одно событие из двух
 * источников, отсутствие повторной обработки, неподдерживаемые url.
 * Сервисы notifications подменяются; `goHome` — инъекция (expo-router не нужен).
 * `renderHook` в этой версии RNTL асинхронный; `rerender` меняет `ready`.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  HOME_NOTIFICATION_URL,
  useNotificationNavigation,
} from "../useNotificationNavigation";
import {
  consumeLastNotificationResponse,
  subscribeToNotificationResponses,
  type NotificationTap,
} from "../../services/notifications";

jest.mock("../../services/notifications", () => ({
  consumeLastNotificationResponse: jest.fn(),
  subscribeToNotificationResponses: jest.fn(),
}));

const consumeMock = consumeLastNotificationResponse as jest.Mock;
const subscribeMock = subscribeToNotificationResponses as jest.Mock;

let listener: ((tap: NotificationTap) => void) | null = null;
const unsubscribe = jest.fn();
const tap = (id: string, url: string | null = HOME_NOTIFICATION_URL): NotificationTap => ({
  id,
  url,
});

beforeEach(() => {
  jest.clearAllMocks();
  listener = null;
  subscribeMock.mockImplementation((handler: (t: NotificationTap) => void) => {
    listener = handler;
    return unsubscribe;
  });
});

describe("useNotificationNavigation (§6.11, MAJOR-01)", () => {
  it("холодный запуск: первоначальный ответ обрабатывается один раз после готовности", async () => {
    consumeMock.mockReturnValue(tap("init"));
    const goHome = jest.fn();

    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationNavigation(ready, goHome),
      { initialProps: { ready: false } },
    );

    expect(goHome).not.toHaveBeenCalled();
    expect(consumeMock).not.toHaveBeenCalled(); // не читаем/не гасим до готовности

    await rerender({ ready: true });

    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it("событие до готовности навигации сохраняется и обрабатывается после готовности", async () => {
    consumeMock.mockReturnValue(null);
    const goHome = jest.fn();

    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationNavigation(ready, goHome),
      { initialProps: { ready: false } },
    );

    await act(async () => {
      listener?.(tap("e1")); // событие до готовности
    });
    expect(goHome).not.toHaveBeenCalled(); // преждевременного перехода нет

    await rerender({ ready: true });

    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it("одно событие из двух источников обрабатывается один раз (без двойного перехода)", async () => {
    consumeMock.mockReturnValue(tap("dup")); // источник 1: getLastNotificationResponse
    const goHome = jest.fn();

    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationNavigation(ready, goHome),
      { initialProps: { ready: false } },
    );

    await act(async () => {
      listener?.(tap("dup")); // источник 2: слушатель, тот же id
    });

    await rerender({ ready: true });

    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(goHome).toHaveBeenCalledTimes(1); // ровно один переход
  });

  it("нажатие при работающем приложении (готово): один переход", async () => {
    consumeMock.mockReturnValue(null);
    const goHome = jest.fn();
    await renderHook(() => useNotificationNavigation(true, goHome));

    await act(async () => {
      listener?.(tap("w1"));
    });

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(goHome).toHaveBeenCalledTimes(1);
  });

  it("повторная доставка одного id слушателем не даёт второго перехода", async () => {
    consumeMock.mockReturnValue(null);
    const goHome = jest.fn();
    await renderHook(() => useNotificationNavigation(true, goHome));

    await act(async () => {
      listener?.(tap("dup"));
      listener?.(tap("dup"));
    });

    expect(goHome).toHaveBeenCalledTimes(1);
  });

  it("повторной обработки уже использованного ответа нет (рендер/эффекты)", async () => {
    consumeMock.mockReturnValue(tap("x"));
    const goHome = jest.fn();

    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationNavigation(ready, goHome),
      { initialProps: { ready: true } },
    );

    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    await rerender({ ready: true }); // повторный рендер не переобрабатывает ответ

    expect(goHome).toHaveBeenCalledTimes(1);
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it("неподдерживаемые url игнорируются (первоначальный ответ и нажатие)", async () => {
    consumeMock.mockReturnValue(tap("s", "/settings"));
    const goHome = jest.fn();
    await renderHook(() => useNotificationNavigation(true, goHome));

    await act(async () => {
      listener?.(tap("a", "/settings"));
      listener?.(tap("b", null));
      listener?.(tap("c", "https://example.com"));
    });

    expect(goHome).not.toHaveBeenCalled();
  });
});
