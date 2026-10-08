/**
 * Кнопки (DESIGN.md §5): primary — фон `accent`; secondary — `surface` с
 * границей; отключённая — opacity .45 и без реакции (aria-disabled).
 * Нажатие — материальный отклик (§13 п.1: android_ripple + лёгкое затемнение).
 */

import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSize, radius, ripple } from "./tokens";

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled}
      accessibilityRole="button"
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled}
      accessibilityRole="button"
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  primaryLabel: {
    color: colors.accentInk,
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.body,
    fontWeight: "700",
  },
  secondaryLabel: {
    color: colors.ink,
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.body,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.9,
  },
});
