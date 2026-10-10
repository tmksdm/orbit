/**
 * Экран настроек напоминаний (план Stage 4, §6.10; Q2/Q4/Q5). Переключатель
 * «Напоминания», выбор времени (нативный Android time picker), пояснение и
 * состояния разрешений. Бизнес-логики не содержит: запрос разрешения, сохранение
 * и согласование — use-cases (`features/notificationServices`), не компонент
 * (ARCHITECTURE.md, правило 3). Токены — DESIGN.md, новых правил не вводим.
 */
import { useCallback, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  NotificationServices,
  NotificationSettingsView,
} from "../features/notificationServices";
import { getNotificationServices } from "../features/runtime";
import { SecondaryButton } from "../ui/Buttons";
import { ScreenBar } from "../ui/ScreenBar";
import { ErrorState, LoadingSkeleton } from "../ui/StateViews";
import { colors, fontSize, radius, ripple, spacing } from "../ui/tokens";

type Status = "loading" | "ready" | "error";

interface SettingsScreenProps {
  /** Подмена сервисов в компонентных тестах; по умолчанию — продовая сборка. */
  readonly services?: () => Promise<NotificationServices>;
}

/** Локальное время (HH:MM) момента. */
function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** «HH:MM» → Date (важен только часовой/минутный компонент для mode="time"). */
function parseTime(time: string): Date {
  const parts = time.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  return new Date(2026, 0, 1, hours, minutes, 0, 0);
}

export default function SettingsScreen({
  services = getNotificationServices,
}: SettingsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>("loading");
  const [settings, setSettings] = useState<NotificationSettingsView | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (svc: NotificationServices) => {
    setSettings(await svc.loadNotificationSettings());
  }, []);

  const load = useCallback(() => {
    let alive = true;
    setStatus("loading");
    services()
      .then(async (svc) => {
        const view = await svc.loadNotificationSettings();
        if (alive) {
          setSettings(view);
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

  // Перезагрузка при каждом фокусе — возврат из системных настроек Android
  // показывает актуальное разрешение.
  useFocusEffect(load);

  const onToggle = useCallback(
    async (next: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const svc = await services();
        await svc.setEnabled(next);
        await refresh(svc);
      } catch {
        setError("Не удалось сохранить настройку. Попробуйте ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    [busy, services, refresh],
  );

  const onPickTime = useCallback(
    async (event: DateTimePickerEvent, date?: Date) => {
      setPickerVisible(false);
      if (event.type !== "set" || date === undefined) return;
      setBusy(true);
      setError(null);
      try {
        const svc = await services();
        await svc.setReminderTime(formatTime(date));
        await refresh(svc);
      } catch {
        setError("Не удалось сохранить время. Попробуйте ещё раз.");
      } finally {
        setBusy(false);
      }
    },
    [services, refresh],
  );

  const denied = settings !== null && !settings.permission.granted;
  const showSettingsButton =
    settings !== null && denied && (settings.enabled || !settings.permission.canAskAgain);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenBar title="Напоминания" onBack={() => router.back()} />
      </View>

      {status === "loading" && <LoadingSkeleton />}

      {status === "error" && <ErrorState onAction={load} />}

      {status === "ready" && settings !== null && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowTexts}>
                <Text style={styles.rowTitle}>Напоминания</Text>
                <Text style={styles.rowHint}>
                  Одно сводное уведомление о просроченных контактах
                </Text>
              </View>
              <Switch
                testID="reminders-switch"
                value={settings.enabled}
                onValueChange={onToggle}
                disabled={busy}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.surface}
              />
            </View>

            <View style={styles.divider} />

            <Pressable
              testID="reminder-time"
              disabled={!settings.enabled || busy}
              onPress={() => setPickerVisible(true)}
              android_ripple={ripple}
              style={styles.row}
            >
              <Text
                style={[
                  styles.rowTitle,
                  !settings.enabled && styles.rowTitleDisabled,
                ]}
              >
                Время напоминания
              </Text>
              <Text
                style={[
                  styles.timeValue,
                  !settings.enabled && styles.rowTitleDisabled,
                ]}
              >
                {settings.reminderTime}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.explanation}>
            Напоминания локальные — приходят с устройства, без интернета. Раз в
            3 дня, в выбранное время, если есть просроченные контакты. Показано
            только их число, без имён. Нажатие открывает главный экран.
          </Text>

          {denied && (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                {settings.enabled
                  ? "Разрешение отозвано — напоминания не приходят. Включите их в настройках Android."
                  : settings.permission.canAskAgain
                    ? "Без разрешения напоминания не работают."
                    : "Напоминания запрещены в настройках Android."}
              </Text>
            </View>
          )}

          {showSettingsButton && (
            <SecondaryButton
              label="Открыть настройки Android"
              onPress={() => {
                Linking.openSettings();
              }}
            />
          )}

          {error !== null && (
            <Text testID="settings-error" style={styles.error}>
              {error}
            </Text>
          )}

          {pickerVisible && (
            <DateTimePicker
              value={parseTime(settings.reminderTime)}
              mode="time"
              is24Hour
              onChange={onPickTime}
            />
          )}
        </ScrollView>
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
    gap: 14,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.ink,
  },
  rowTitleDisabled: {
    color: colors.muted,
  },
  rowHint: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.tiny,
    color: colors.muted,
  },
  timeValue: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  explanation: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: colors.muted,
    paddingHorizontal: 2,
  },
  warn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dueLine,
    backgroundColor: colors.dueBg,
  },
  warnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.due,
    lineHeight: fontSize.small * 1.4,
  },
  error: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.due,
  },
});
