/**
 * Unit-тесты хука навигации по нажатию на уведомление (§6.11, MAJOR-01).
 * Сервисы notifications подменяются; `goHome` — инъекция, поэтому экспорт
 * expo-router не требуется. `renderHook` в этой версии RNTL асинхронный.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  HOME_NOTIFICATION_URL,
  useNotificationNavigation,
} from "../useNotificationNavigation";
import {
  consumeLastNotificationUrl,
  subscribeToNotificationResponses,
} from "../../services/notifications";

jest.mock("../../services/notifications", () => ({
  consumeLastNotificationUrl: jest.fn(),
  subscribeToNotificationResponses: jest.fn(),
}));

const consumeMock = consumeLastNotificationUrl as jest.Mock;
const subscribeMock = subscribeToNotificationResponses as jest.Mock;

let listener: ((url: string) => void) | null = null;
const unsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  listener = null;
  subscribeMock.mockImplementation((handler: (url: string) => void) => {
    listener = handler;
    return unsubscribe;
  });
});

describe("useNotificationNavigation (§6.11, MAJOR-01)", () => {
  it("холодный запуск: до готовности навигации перехода нет, после — однократный", async () => {
    consumeMock.mockReturnValue(HOME_NOTIFICATION_URL);
    const goHome = jest.fn();

    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationNavigation(ready, goHome),
      { initialProps: { ready: false } },
    );

    expect(goHome).not.toHaveBeenCalled();
    // Первоначальный ответ не потерян: пока не готово — даже не читаем/не гасим.
    expect(consumeMock).not.toHaveBeenCalled();

    await rerender({ ready: true });

    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it("нажатие при работающем приложении: переход по поддерживаемому url", async () => {
    consumeMock.mockReturnValue(null);
    const goHome = jest.fn();
    await renderHook(() => useNotificationNavigation(true, goHome));

    await act(async () => {
      listener?.(HOME_NOTIFICATION_URL);
    });

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(goHome).toHaveBeenCalledTimes(1);
  });

  it("повторной обработки уже использованного response нет", async () => {
    consumeMock.mockReturnValue(HOME_NOTIFICATION_URL);
    const goHome = jest.fn();
    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationNavigation(ready, goHome),
      { initialProps: { ready: true } },
    );

    await waitFor(() => expect(goHome).toHaveBeenCalledTimes(1));
    await rerender({ ready: true }); // повторные рендеры не переобрабатывают ответ

    expect(goHome).toHaveBeenCalledTimes(1);
    expect(consumeMock).toHaveBeenCalledTimes(1);
  });

  it("неподдерживаемые url игнорируются (первоначальный ответ и нажатие)", async () => {
    consumeMock.mockReturnValue("/settings");
    const goHome = jest.fn();
    await renderHook(() => useNotificationNavigation(true, goHome));

    await act(async () => {
      listener?.("/settings");
      listener?.("/contact/1");
      listener?.("https://example.com");
    });

    expect(goHome).not.toHaveBeenCalled();
  });
});
