/**
 * Smoke-тест главного экрана (план Stage 3, «Required tests», smoke):
 * приложение стартует, главный экран рендерится.
 */
import { render, waitFor } from "@testing-library/react-native";

import IndexScreen from "../src/app/index";
import type { OrbitServices } from "../src/features/orbitServices";

// Нативные SVG-компоненты в тестовой среде недоступны — стаб (обычный View);
// визуальные проверки опираются на соседние Text/View.
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

function fakeServices(
  loadContactList: OrbitServices["loadContactList"],
): OrbitServices {
  return {
    loadContactList,
    loadContactCard: jest.fn(),
    addContact: jest.fn(),
    recordInteraction: jest.fn(),
  };
}

describe("главный экран (smoke, Stage 3)", () => {
  it("рендерит шапку Orbit и пустое состояние на пустой БД", async () => {
    const services = fakeServices(
      jest.fn(async () => ({ due: [], rest: [], total: 0 })),
    );
    const view = await render(
      <IndexScreen services={() => Promise.resolve(services)} />,
    );

    expect(view.getByText("Orbit")).toBeTruthy();
    await waitFor(() =>
      expect(view.getByText("Пока никого нет")).toBeTruthy(),
    );
    expect(view.getByText("Добавить человека")).toBeTruthy();
  });
});
