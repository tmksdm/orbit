/**
 * Компонентные тесты экрана настроек (план Stage 4, §10.11): рендер, включение,
 * отказ в разрешении, запрет навсегда, отзыв разрешения, смена времени,
 * отключение. `NotificationServices` подменяется; нативный time picker —
 * стабом, вызывающим onChange при нажатии.
 */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import SettingsScreen from "../settings";
import type {
  NotificationServices,
  NotificationSettingsView,
} from "../../features/notificationServices";

// Нативные SVG-компоненты недоступны — стаб (обычный View).
jest.mock("react-native-svg", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const makeStub = () =>
    function SvgStub(props: Record<string, unknown>) {
      return React.createElement(View, props);
    };
  const stubs: Record<string, unknown> = { __esModule: true, default: makeStub() };
  for (const name of ["Svg", "Circle", "Line", "Path", "Rect", "G"]) {
    stubs[name] = makeStub();
  }
  return stubs;
});

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react") as typeof import("react");
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect:
      (callback: () => void | (() => void)) =>
      useEffect(() => callback(), [callback]),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Стаб нативного time picker: кнопка «picker-set» вызывает onChange (тип set).
jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (e: unknown, d: Date) => void }) =>
      React.createElement(
        Pressable,
        {
          testID: "picker-set",
          onPress: () => onChange({ type: "set" }, new Date(2026, 9, 10, 8, 30)),
        },
        React.createElement(Text, null, "picker"),
      ),
  };
});

function view(partial?: Partial<NotificationSettingsView>): NotificationSettingsView {
  return {
    enabled: false,
    reminderTime: "19:00",
    anchorDate: null,
    permission: { granted: true, canAskAgain: true },
    effectiveActive: false,
    ...partial,
  };
}

function makeServices(
  initial: NotificationSettingsView,
  overrides?: Partial<NotificationServices>,
): {
  services: NotificationServices;
  setEnabled: jest.Mock;
  setReminderTime: jest.Mock;
  loadNotificationSettings: jest.Mock;
} {
  const loadNotificationSettings = jest.fn(async () => initial);
  const setEnabled = jest.fn(async () => ({
    status: "saved" as const,
    sync: { ok: true as const, added: 0, removed: 0, kept: 0 },
  }));
  const setReminderTime = jest.fn(async () => ({
    status: "saved" as const,
    sync: { ok: true as const, added: 0, removed: 0, kept: 0 },
  }));
  const services: NotificationServices = {
    loadNotificationSettings,
    setEnabled,
    setReminderTime,
    syncNotifications: jest.fn(),
    ...overrides,
  };
  return {
    services,
    setEnabled: services.setEnabled as jest.Mock,
    setReminderTime: services.setReminderTime as jest.Mock,
    loadNotificationSettings: services.loadNotificationSettings as jest.Mock,
  };
}

async function renderScreen(services: NotificationServices) {
  const result = await render(
    <SettingsScreen services={() => Promise.resolve(services)} />,
  );
  await result.findByTestId("reminders-switch");
  return result;
}

describe("экран настроек напоминаний (§10.11)", () => {
  it("рендерится: переключатель выключен, время 19:00", async () => {
    const { services } = makeServices(view());
    const screen = await renderScreen(services);

    expect(screen.getByTestId("reminders-switch").props.value).toBe(false);
    expect(screen.getByText("19:00")).toBeTruthy();
  });

  it("включение разрешено: setEnabled(true) вызван, переключатель включён", async () => {
    const initial = view();
    const { services, setEnabled, loadNotificationSettings } = makeServices(initial);
    loadNotificationSettings
      .mockResolvedValueOnce(initial) // монтирование: выключено
      .mockResolvedValue({ ...initial, enabled: true }); // после включения

    const screen = await renderScreen(services);

    await act(async () => {
      fireEvent(screen.getByTestId("reminders-switch"), "valueChange", true);
    });

    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByTestId("reminders-switch").props.value).toBe(true),
    );
  });

  it("включение, разрешение отклонено (canAskAgain=true): выключено + сообщение", async () => {
    const initial = view({ permission: { granted: false, canAskAgain: true } });
    const { services, setEnabled } = makeServices(initial, {
      setEnabled: jest.fn(async () => ({
        status: "permissionDenied" as const,
        canAskAgain: true,
        sync: { ok: true as const, added: 0, removed: 0, kept: 0 },
      })),
    });
    const screen = await renderScreen(services);

    await act(async () => {
      fireEvent(screen.getByTestId("reminders-switch"), "valueChange", true);
    });

    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(true));
    expect(screen.getByTestId("reminders-switch").props.value).toBe(false);
    await waitFor(() =>
      expect(screen.getByText("Без разрешения напоминания не работают.")).toBeTruthy(),
    );
    expect(screen.queryByText("Открыть настройки Android")).toBeNull();
  });

  it("разрешение запрещено навсегда: объяснение и кнопка «Открыть настройки Android»", async () => {
    const { services } = makeServices(
      view({ permission: { granted: false, canAskAgain: false } }),
    );
    const screen = await renderScreen(services);

    expect(
      screen.getByText("Напоминания запрещены в настройках Android."),
    ).toBeTruthy();
    expect(screen.getByText("Открыть настройки Android")).toBeTruthy();
  });

  it("разрешение отозвано при включённых напоминаниях: предупреждение + кнопка, переключатель включён", async () => {
    const { services } = makeServices(
      view({ enabled: true, permission: { granted: false, canAskAgain: true } }),
    );
    const screen = await renderScreen(services);

    expect(
      screen.getByText(/Разрешение отозвано — напоминания не приходят/),
    ).toBeTruthy();
    expect(screen.getByText("Открыть настройки Android")).toBeTruthy();
    expect(screen.getByTestId("reminders-switch").props.value).toBe(true);
  });

  it("изменение времени: выбранное время сохраняется и отображается", async () => {
    const initial = view({ enabled: true });
    const { services, setReminderTime, loadNotificationSettings } = makeServices(initial);
    loadNotificationSettings
      .mockResolvedValueOnce(initial)
      .mockResolvedValue({ ...initial, reminderTime: "08:30" });
    const screen = await renderScreen(services);

    await act(async () => {
      fireEvent.press(screen.getByTestId("reminder-time"));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("picker-set"));
    });

    await waitFor(() => expect(setReminderTime).toHaveBeenCalledWith("08:30"));
    await waitFor(() => expect(screen.getByText("08:30")).toBeTruthy());
  });

  it("отключение: setEnabled(false) вызван через use-case", async () => {
    const initial = view({ enabled: true });
    const { services, setEnabled } = makeServices(initial);
    const screen = await renderScreen(services);

    await act(async () => {
      fireEvent(screen.getByTestId("reminders-switch"), "valueChange", false);
    });

    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false));
  });
});
