/**
 * Карточка контакта (план Stage 3, F3; DESIGN.md §6.3, поправки 2–3):
 * в шапке только «Назад» (поправка 2); кольцо + имя + чип стратегии; блок
 * «Пора связаться» (если срок наступил); заметка; ДВЕ плитки показателей
 * (поправка 3); read-only история; фиксация взаимодействия через нижнюю
 * шторку. Бизнес-правил не содержит: расчёты — domain, запись — use-cases.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Initiator, Outcome } from "../../domain/types";
import type {
  ContactCardView,
  OrbitServices,
} from "../../features/orbitServices";
import { getOrbitServices } from "../../features/runtime";
import { PrimaryButton } from "../../ui/Buttons";
import {
  daysLabel,
  formatLongDate,
  formatShortDate,
  initiatorLabel,
  outcomeLabel,
  strategyLabel,
} from "../../ui/format";
import { InteractionSheet } from "../../ui/InteractionSheet";
import { RhythmRing } from "../../ui/RhythmRing";
import { ScreenBar } from "../../ui/ScreenBar";
import { ErrorState, LoadingSkeleton } from "../../ui/StateViews";
import { colors, fontSize, radius, spacing } from "../../ui/tokens";

type Status = "loading" | "ready" | "error" | "notfound";

interface ContactCardScreenProps {
  /** Идентификатор контакта; по умолчанию — из параметров маршрута. */
  readonly id?: string;
  /** Подмена сервисов в компонентных тестах; по умолчанию — продовая сборка. */
  readonly services?: () => Promise<OrbitServices>;
}

export default function ContactCardScreen({
  id: idProp,
  services = getOrbitServices,
}: ContactCardScreenProps) {
  const route = useLocalSearchParams<{ id?: string | string[] }>();
  const id = idProp ?? (typeof route.id === "string" ? route.id : undefined);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<ContactCardView | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(() => {
    if (id === undefined) {
      setStatus("notfound");
      return;
    }
    let alive = true;
    setStatus("loading");
    services()
      .then((svc) => svc.loadContactCard(id))
      .then((card) => {
        if (!alive) return;
        if (card === null) {
          setStatus("notfound");
        } else {
          setView(card);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [id, services]);

  // Перезагрузка при каждом фокусе; кнопка «Повторить» вызывает ту же загрузку.
  useFocusEffect(load);

  useEffect(() => {
    if (banner === null) return;
    const timer = setTimeout(() => setBanner(null), 7000); // §13 п.5 — 7 с из прототипа
    return () => clearTimeout(timer);
  }, [banner]);

  const saveInteraction = useCallback(
    async (initiator: Initiator, outcome: Outcome) => {
      if (id === undefined) return;
      setSaving(true);
      setSheetError(null);
      try {
        const svc = await services();
        const updated = await svc.recordInteraction(id, { initiator, outcome });
        const card = await svc.loadContactCard(id);
        if (card !== null) setView(card);
        setSheetVisible(false);
        setBanner(
          `Рекомендуемый интервал — ${daysLabel(updated.recommendedIntervalDays)}.`,
        );
      } catch {
        setSheetError("Не удалось сохранить. Попробуйте ещё раз.");
      } finally {
        setSaving(false);
      }
    },
    [id, services],
  );

  const d = view?.daysUntilDue ?? null;
  const dueNote =
    d === null
      ? null
      : d === 0
        ? "сегодня"
        : d < 0
          ? `просрочено на ${daysLabel(-d)}`
          : null;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        {/* Поправка 2: в шапке только навигация назад, без имени контакта. */}
        <ScreenBar onBack={() => router.back()} />
      </View>

      {status === "loading" && <LoadingSkeleton />}

      {status === "error" && <ErrorState onAction={load} />}

      {status === "notfound" && (
        <ErrorState
          title="Контакт не найден"
          text="Данные хранятся только на устройстве."
          actionLabel="Назад"
          onAction={() => router.back()}
        />
      )}

      {status === "ready" && view !== null && (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            {banner !== null && (
              <View style={styles.banner}>
                <View style={styles.bannerTexts}>
                  <Text style={styles.bannerTitle}>
                    Взаимодействие сохранено
                  </Text>
                  <Text style={styles.bannerLine}>{banner}</Text>
                </View>
                <Pressable
                  onPress={() => setBanner(null)}
                  hitSlop={8}
                  accessibilityLabel="Закрыть"
                  style={styles.bannerClose}
                >
                  <Text style={styles.bannerCloseText}>×</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.topBlock}>
              <RhythmRing
                intervalDays={view.contact.recommendedIntervalDays}
                progressPercent={view.progressPercent}
                isDue={view.due.isDue}
              />
              <View style={styles.topTexts}>
                <Text style={styles.name}>{view.contact.name}</Text>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {strategyLabel[view.contact.strategy]}
                  </Text>
                </View>
              </View>
            </View>

            {view.due.isDue && dueNote !== null && (
              <View style={styles.dueBlock}>
                <Text style={styles.dueBlockText}>
                  Пора связаться · {dueNote}
                </Text>
              </View>
            )}

            {view.contact.note !== undefined &&
              view.contact.note.length > 0 && (
                <Text style={styles.note}>{view.contact.note}</Text>
              )}

            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text style={styles.tileValue}>
                  {view.due.nextDueDate === null
                    ? "—"
                    : formatLongDate(view.due.nextDueDate)}
                </Text>
                <Text style={styles.tileLabel}>следующий контакт</Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileValue}>{view.interactionCount}</Text>
                <Text style={styles.tileLabel}>взаимодействий</Text>
              </View>
            </View>

            <Text style={styles.historyHeader}>История</Text>

            {view.history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>
                  {view.contact.createdAt === undefined
                    ? "Взаимодействий пока нет. Срок следующего контакта пока не рассчитан"
                    : "Взаимодействий пока нет. Отсчёт идёт от даты добавления контакта."}
                </Text>
              </View>
            ) : (
              <View>
                {view.history.map((item, index) => (
                  <View
                    key={`${item.occurredAt}-${index}`}
                    style={[
                      styles.historyRow,
                      index === view.history.length - 1 &&
                        styles.historyRowLast,
                    ]}
                  >
                    <Text style={styles.historyDate}>
                      {formatShortDate(item.localDate)}
                    </Text>
                    <View style={styles.historyTexts}>
                      <Text style={styles.historyInitiator}>
                        {initiatorLabel[item.initiator]}
                      </Text>
                      <Text style={styles.historyOutcome}>
                        {outcomeLabel[item.outcome]}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View
            style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}
          >
            <PrimaryButton
              label="Зафиксировать общение"
              onPress={() => setSheetVisible(true)}
            />
          </View>

          {/* Шторка монтируется на время показа — выбор сбрасывается при закрытии. */}
          {sheetVisible && (
            <InteractionSheet
              onClose={() => setSheetVisible(false)}
              onSave={saveInteraction}
              saving={saving}
              error={sheetError}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.pad,
    paddingTop: 6,
    paddingBottom: 24,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
    marginBottom: 14,
    padding: 12,
    paddingLeft: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  bannerTexts: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.ink,
  },
  bannerLine: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    color: colors.muted,
  },
  bannerClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerCloseText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 18,
    color: colors.muted,
  },
  topBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4,
  },
  topTexts: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontFamily: "Manrope_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.22,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.tiny,
    fontWeight: "700",
    color: colors.accent,
  },
  dueBlock: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dueLine,
    backgroundColor: colors.dueBg,
  },
  dueBlockText: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.due,
  },
  note: {
    marginTop: 12,
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.45,
    color: colors.ink,
  },
  tiles: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  tile: {
    flex: 1,
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tileValue: {
    fontFamily: "Unbounded_600SemiBold",
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
  },
  tileLabel: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10.5,
    lineHeight: 10.5 * 1.25,
    color: colors.muted,
  },
  historyHeader: {
    marginTop: 26,
    marginBottom: 10,
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.tiny,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  emptyHistory: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: "dashed",
  },
  emptyHistoryText: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.45,
    color: colors.muted,
  },
  historyRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  historyDate: {
    width: 78,
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    color: colors.muted,
  },
  historyTexts: {
    flex: 1,
    gap: 2,
  },
  historyInitiator: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.ink,
  },
  historyOutcome: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.tiny,
    color: colors.muted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.pad,
    paddingTop: 12,
  },
});
