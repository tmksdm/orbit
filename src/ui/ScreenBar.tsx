/**
 * Шапка экрана (DESIGN.md §4): строка «Назад» (опционально) + заголовок
 * Unbounded 20/600 + подзаголовок Manrope 11/400 `muted`. Зона нажатия кнопки
 * «Назад» ≥44dp (§10): hitSlop 12 поверх 40×40.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { BellIcon, ChevronLeftIcon } from "./icons";
import { colors, fontSize, radius, ripple, spacing } from "./tokens";

interface ScreenBarProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  /** Иконка действия справа (Q4 — вход в настройки напоминаний). */
  readonly onAction?: () => void;
  readonly actionLabel?: string;
}

export function ScreenBar({ title, subtitle, onBack, onAction, actionLabel }: ScreenBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {onBack !== undefined && (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityLabel="Назад"
            android_ripple={ripple}
            style={styles.iconButton}
          >
            <ChevronLeftIcon size={22} color={colors.ink} />
          </Pressable>
        )}
        {title !== undefined && <Text style={styles.title}>{title}</Text>}
        <View style={styles.spacer} />
        {onAction !== undefined && (
          <Pressable
            onPress={onAction}
            hitSlop={12}
            accessibilityLabel={actionLabel ?? "Действие"}
            android_ripple={ripple}
            style={styles.iconButton}
          >
            <BellIcon size={22} color={colors.ink} />
          </Pressable>
        )}
      </View>
      {subtitle !== undefined && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.pad,
    paddingTop: 6,
    paddingBottom: 14,
  },
  row: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    marginLeft: -8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Unbounded_600SemiBold",
    fontSize: fontSize.title,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.tiny,
    color: colors.muted,
    marginTop: 2,
  },
});
