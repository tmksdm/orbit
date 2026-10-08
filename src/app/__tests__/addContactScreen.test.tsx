/**
 * Компонентные тесты формы добавления (план Stage 3, «Required tests»,
 * компонентные/RNTL): сохранение недоступно без явного выбора стратегии
 * (решение 3), имя обязательно, после сохранения — возврат в список.
 */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import AddContactScreen from "../add-contact";
import type { OrbitServices } from "../../features/orbitServices";

const mockBack = jest.fn();

// Нативные SVG-компоненты в тестовой среде недоступны — стаб (обычный View).
jest.mock("react-native-svg", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const makeStub = () =>
    function SvgStub(props: Record<string, unknown>) {
      return React.createElement(View, props);
    };
  const stubs: Record<string, unknown> = {
    __esModule: true,
    default: makeStub(),
  };
  for (const name of ["Svg", "Circle", "Line", "Path", "Rect", "G"]) {
    stubs[name] = makeStub();
  }
  return stubs;
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function makeServices(): { services: OrbitServices; addContact: jest.Mock } {
  const addContact = jest.fn(async () => ({
    id: "new-1",
    name: "Марина",
    strategy: "grow",
    minIntervalDays: 2,
    recommendedIntervalDays: 2,
  }));
  const services = {
    loadContactList: jest.fn(),
    loadContactCard: jest.fn(),
    addContact,
    recordInteraction: jest.fn(),
  } as unknown as OrbitServices;
  return { services, addContact };
}

async function renderForm(services: OrbitServices) {
  const view = await render(
    <AddContactScreen services={() => Promise.resolve(services)} />,
  );
  // findBy* — документированный паттерн RNTL для асинхронного монтирования:
  // сам управляет act-окружением (ручной act-дренаж после render даёт
  // «overlapping act()» на React 19 и теряет последующие fireEvent).
  const nameInput = await view.findByPlaceholderText(
    "Например, Марина Соколова",
  );
  return { view, nameInput };
}

describe("форма добавления контакта (F2)", () => {
  it("кнопка «Сохранить» недоступна, пока не заданы имя и стратегия (решение 3)", async () => {
    const { services } = makeServices();
    const { view, nameInput } = await renderForm(services);

    // Дерево перепрашивается после каждого взаимодействия:
    const saveDisabled = () =>
      view.getByRole("button", { name: "Сохранить" }).props.accessibilityState
        ?.disabled;

    expect(saveDisabled()).toBe(true);

    // Обходной путь для RNTL 14 + React 19.2: fireEvent без собственной
    // act-обёртки попадает в «overlapping act()» и теряет обновление
    // (воспроизводится даже на минимальном компоненте) — оборачиваем сами.
    // Заполнено только имя — стратегия не выбрана, сохранение недоступно:
    await act(async () => {
      fireEvent.changeText(nameInput, "Марина");
    });
    expect(saveDisabled()).toBe(true);

    // Явный выбор стратегии делает сохранение доступным:
    await act(async () => {
      fireEvent.press(view.getByTestId("strategy-grow"));
    });
    expect(saveDisabled()).toBe(false);
  });

  it("имя обязательно: ошибка под полем, если поле осталось пустым", async () => {
    const { services } = makeServices();
    const { view, nameInput } = await renderForm(services);

    expect(view.queryByText(/без него контакт не сохранить/)).toBeNull();
    await act(async () => {
      fireEvent(nameInput, "blur");
    });
    expect(
      view.getByText("Укажите имя — без него контакт не сохранить."),
    ).toBeTruthy();
  });

  it("сохранение вызывает use-case (стратегия — явный выбор) и возвращается в список", async () => {
    const { services, addContact } = makeServices();
    const { view, nameInput } = await renderForm(services);

    await act(async () => {
      fireEvent.changeText(nameInput, "Марина");
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("strategy-grow"));
    });
    await act(async () => {
      fireEvent.press(view.getByRole("button", { name: "Сохранить" }));
    });

    await waitFor(() =>
      expect(addContact).toHaveBeenCalledWith({
        name: "Марина",
        note: undefined,
        strategy: "grow",
      }),
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
