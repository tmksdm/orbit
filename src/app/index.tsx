/**
 * Главный экран — список контактов (план Stage 3, F1; DESIGN.md §6.1, §9).
 * Экран композирует компоненты src/ui и вызывает use-cases (features);
 * бизнес-правил не содержит (ARCHITECTURE.md, правило 3). Список перезагружается
 * при каждом фокусе — возврат с других экранов показывает актуальные данные.
 */
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../ui/Buttons";
import { ContactListCard } from "../ui/ContactListCard";
import { contactsLabel, daysLabel } from "../ui/format";
import { ScreenBar } from "../ui/ScreenBar";
import { EmptyState, ErrorState, LoadingSkeleton } from "../ui/StateViews";
import { colors, fontSize, spacing } from "../ui/tokens";
import type {
  ContactDueView,
  ContactListView,
  OrbitServices,
} from "../features/orbitServices";
import { getOrbitServices } from "../features/runtime";

type Status = "loading" | "ready" | "error";

interface IndexScreenProps {
  /** Подмена сервисов в компонентных тестах; по умолчанию — продовая сборка. */
  readonly services?: () => Promise<OrbitServices>;
}

function subtitleFor(status: Status, view: ContactListView | null): string {
  if (status !== "ready" || view === null || view.total === 0) {
    return "Локально на устройстве";
  }
  if (view.due.length > 0) {
    return `${contactsLabel(view.total)} · ${view.due.length} пора связаться`;
  }
  return contactsLabel(view.total);
}

function metaFor(entry: ContactDueView): string {
  const base = `раз в ${daysLabel(entry.contact.recommendedIntervalDays)}`;
  const d = entry.daysUntilDue;
  if (d === null) {
    return base; // срок не рассчитывается — без даты (DESIGN.md §6.1)
  }
  if (d < 0) return `${base} · просрочено на ${daysLabel(-d)}`;
  if (d === 0) return `${base} · пора связаться сегодня`;
  return `${base} · через ${daysLabel(d)}`;
}

export default function IndexScreen({
  services = getOrbitServices,
}: IndexScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<ContactListView | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setStatus("loading");
    services()
      .then((svc) => svc.loadContactList())
      .then((list) => {
        if (alive) {
          setView(list);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [services]);

  // Перезагрузка при каждом фокусе — возврат с других экранов показывает
  // актуальные данные. Кнопка «Повторить» вызывает ту же загрузку.
  useFocusEffect(load);

  const openContact = useCallback(
    (id: string) => {
      router.push({ pathname: "/contact/[id]", params: { id } });
    },
    [router],
  );
  const openAdd = useCallback(() => {
    router.push({ pathname: "/add-contact" });
  }, [router]);

  const hasData = status === "ready" && view !== null && view.total > 0;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenBar title="Orbit" subtitle={subtitleFor(status, view)} />
      </View>

      {status === "loading" && <LoadingSkeleton />}

      {status === "error" && <ErrorState onAction={load} />}

      {status === "ready" && view !== null && view.total === 0 && (
        <EmptyState onAction={openAdd} />
      )}

      {hasData && view !== null && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          {view.due.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Пора связаться</Text>
                <Text style={styles.sectionCounter}>{view.due.length}</Text>
              </View>
              {view.due.map((entry) => (
                <ContactListCard
                  key={entry.contact.id}
                  name={entry.contact.name}
                  note={entry.contact.note}
                  intervalDays={entry.contact.recommendedIntervalDays}
                  progressPercent={entry.progressPercent}
                  isDue={entry.due.isDue}
                  meta={metaFor(entry)}
                  onPress={() => openContact(entry.contact.id)}
                />
              ))}
            </View>
          )}
          {view.rest.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Остальные</Text>
              </View>
              {view.rest.map((entry) => (
                <ContactListCard
                  key={entry.contact.id}
                  name={entry.contact.name}
                  note={entry.contact.note}
                  intervalDays={entry.contact.recommendedIntervalDays}
                  progressPercent={entry.progressPercent}
                  isDue={entry.due.isDue}
                  meta={metaFor(entry)}
                  onPress={() => openContact(entry.contact.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {hasData && (
        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}
        >
          <PrimaryButton label="Добавить человека" onPress={openAdd} />
        </View>
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
    paddingTop: 4,
    paddingBottom: 24,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.tiny,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  sectionCounter: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.tiny,
    fontWeight: "700",
    color: colors.due,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.pad,
    paddingTop: 12,
  },
});
