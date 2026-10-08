/**
 * Компонентные тесты карточки контакта (план Stage 3, «Required tests»,
 * компонентные/RNTL): фиксация взаимодействия и отображение обновлённого
 * интервала; подача «срок не рассчитан» (MINOR-01/§13 п.8).
 */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import ContactCardScreen from "../contact/[id]";
import { computeDue } from "../../domain/due";
import type { Contact } from "../../domain/types";
import type {
  ContactCardView,
  OrbitServices,
} from "../../features/orbitServices";

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

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react") as typeof import("react");
  return {
    useRouter: () => ({ push: jest.fn(), back: mockBack }),
    useLocalSearchParams: () => ({ id: "c1" }),
    useFocusEffect:
      (callback: () => void | (() => void)) =>
      useEffect(() => callback(), [callback]),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function makeView(overrides?: {
  contact?: Partial<Contact>;
  intervalDays?: number;
  history?: ContactCardView["history"];
  daysUntilDue?: number | null;
  progressPercent?: number | null;
}): ContactCardView {
  const contact: Contact = {
    id: "c1",
    name: "Марина",
    strategy: "grow",
    minIntervalDays: 2,
    recommendedIntervalDays: 4,
    createdAt: "2026-10-01T10:00:00Z",
    ...overrides?.contact,
  };
  const intervalDays = overrides?.intervalDays ?? contact.recommendedIntervalDays;
  const history =
    overrides?.history ??
    [
      {
        initiator: "me" as const,
        outcome: "good" as const,
        occurredAt: "2026-10-04T10:00:00Z",
        localDate: "2026-10-04",
      },
    ];
  return {
    contact,
    due: computeDue({
      lastInteractionDate: history.length > 0 ? "2026-10-04" : null,
      createdAtDate: contact.createdAt === undefined ? null : "2026-10-01",
      today: "2026-10-08",
      recommendedIntervalDays: intervalDays,
    }),
    interactionCount: history.length,
    progressPercent: overrides?.progressPercent ?? null,
    daysUntilDue: overrides?.daysUntilDue ?? null,
    history,
  };
}

function makeServices(
  cardView: ContactCardView,
  updatedView: ContactCardView,
): { services: OrbitServices; recordInteraction: jest.Mock } {
  const recordInteraction = jest.fn(async () => ({
    ...cardView.contact,
    recommendedIntervalDays: 8,
  }));
  const services = {
    loadContactList: jest.fn(),
    loadContactCard: jest
      .fn()
      .mockResolvedValueOnce(cardView)
      .mockResolvedValue(updatedView),
    addContact: jest.fn(),
    recordInteraction,
  } as unknown as OrbitServices;
  return { services, recordInteraction };
}

async function renderCard(services: OrbitServices) {
  const view = await render(
    <ContactCardScreen id="c1" services={() => Promise.resolve(services)} />,
  );
  // findBy* — документированный паттерн RNTL для асинхронной загрузки:
  // сам управляет act-окружением (ручной act-дренаж после render даёт
  // «overlapping act()» на React 19 и теряет последующие fireEvent).
  await view.findByText("Марина");
  return view;
}

describe("карточка контакта (F3)", () => {
  it("показывает имя, стратегию, блок «пора связаться», плитки и историю", async () => {
    const view = makeView({ daysUntilDue: 0, progressPercent: 100 });
    const { services } = makeServices(view, view);
    const screen = await renderCard(services);

    expect(screen.getByText("Сближаться")).toBeTruthy();
    expect(screen.getByText(/Пора связаться · сегодня/)).toBeTruthy();
    expect(screen.getByText("8 октября 2026")).toBeTruthy(); // плитка «следующий контакт»
    expect(screen.getByText("4 окт.")).toBeTruthy(); // история
    expect(screen.getByText("Вы")).toBeTruthy();
    expect(screen.getByText("Хорошее общение")).toBeTruthy();
  });

  it("фиксация взаимодействия: инициатор и результат обязательны, обновлённый интервал отображается", async () => {
    const view = makeView();
    const updated = makeView({
      contact: { recommendedIntervalDays: 8 },
      intervalDays: 8,
      history: [
        ...view.history,
        {
          initiator: "mutual" as const,
          outcome: "no_reply" as const,
          occurredAt: "2026-10-08T05:00:00.000Z",
          localDate: "2026-10-08",
        },
      ],
    });
    const { services, recordInteraction } = makeServices(view, updated);
    const screen = await renderCard(services);

    // Обходной путь для RNTL 14 + React 19.2: fireEvent без собственной
    // act-обёртки попадает в «overlapping act()» и теряет обновление
    // (воспроизводится даже на минимальном компоненте) — оборачиваем сами.
    await act(async () => {
      fireEvent.press(
        screen.getByRole("button", { name: "Зафиксировать общение" }),
      );
    });

    // Сохранение без полного выбора недоступно (DESIGN.md §8):
    const save = () => screen.getByRole("button", { name: "Сохранить" });
    await act(async () => {
      fireEvent.press(save());
    });
    expect(recordInteraction).not.toHaveBeenCalled();
    expect(screen.getByText("Выберите инициатора и результат.")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId("initiator-mutual"));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("outcome-no_reply"));
    });
    await act(async () => {
      fireEvent.press(save());
    });

    await waitFor(() =>
      expect(recordInteraction).toHaveBeenCalledWith("c1", {
        initiator: "mutual",
        outcome: "no_reply",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Взаимодействие сохранено")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Рекомендуемый интервал — 8 дней."),
      ).toBeTruthy(),
    );
    // Обновлённый интервал виден в кольце (число 8 из перезагруженной карточки):
    await waitFor(() => expect(screen.getByText("8")).toBeTruthy());
  });

  it("без истории и без createdAt: срок не рассчитан — без блока «пора», дата «—», особый текст истории", async () => {
    const view = makeView({
      contact: { createdAt: undefined, recommendedIntervalDays: 3 },
      intervalDays: 3,
      history: [],
    });
    const { services } = makeServices(view, view);
    const screen = await renderCard(services);

    expect(screen.queryByText(/Пора связаться/)).toBeNull();
    expect(screen.getByText("—")).toBeTruthy(); // §13 п.8: прочерк вместо даты
    expect(
      screen.getByText(
        "Взаимодействий пока нет. Срок следующего контакта пока не рассчитан",
      ),
    ).toBeTruthy();
  });

  it("с известным createdAt и пустой историей текст про отсчёт от даты добавления", async () => {
    const view = makeView({ history: [] });
    const { services } = makeServices(view, view);
    const screen = await renderCard(services);

    expect(
      screen.getByText(
        "Взаимодействий пока нет. Отсчёт идёт от даты добавления контакта.",
      ),
    ).toBeTruthy();
  });
});
