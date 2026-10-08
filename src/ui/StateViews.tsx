/**
 * Состояния экрана (DESIGN.md §9): загрузка — скелетон из 5 строк; пусто;
 * ошибка. Компоненты представления: обращений к данным и бизнес-правил нет.
 * Пульс скелетона отключается при системном reduce-motion (§5).
 */

import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PrimaryButton } from "./Buttons";
import { AlertIcon, PersonPlusIcon } from "./icons";
import { colors, fontSize } from "./tokens";

/** Скелетон загрузки: 5 строк (аватар 44×44 + две линии), пульс 1.2 с. */
export function LoadingSkeleton() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    let cancelled = false;
    const check = AccessibilityInfo.isReduceMotionEnabled;
    if (typeof check === "function") {
      Promise.resolve(check())
        .then((enabled) => {
          if (!cancelled) setReduceMotion(Boolean(enabled));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.5);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[styles.wrap, { opacity: pulse }]}
      accessibilityLabel="Загружается"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.lines}>
            <View style={[styles.line, { width: "62%" }]} />
            <View style={[styles.line, { width: "38%" }]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

interface StateViewProps {
  readonly onAction: () => void;
}

/** Пустой список (DESIGN.md §9): иконка, заголовок, текст, кнопка. */
export function EmptyState({ onAction }: StateViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <PersonPlusIcon size={28} color={colors.accent} />
      </View>
      <Text style={styles.title}>Пока никого нет</Text>
      <Text style={styles.text}>
        Добавьте первого человека — и Orbit подскажет, когда стоит напомнить о
        себе.
      </Text>
      <PrimaryButton label="Добавить человека" onPress={onAction} />
    </View>
  );
}

interface ErrorStateProps {
  /** Заголовок и текст; по умолчанию — ошибка загрузки списка. */
  readonly title?: string;
  readonly text?: string;
  readonly actionLabel?: string;
  readonly onAction: () => void;
}

/** Ошибка (DESIGN.md §9): иконка-предупреждение, заголовок, текст, кнопка. */
export function ErrorState({
  title = "Не удалось показать контакты",
  text = "Данные хранятся только на устройстве. Попробуйте ещё раз.",
  actionLabel = "Повторить",
  onAction,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <AlertIcon size={28} color={colors.due} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      <PrimaryButton label={actionLabel} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.line,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.line,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Unbounded_600SemiBold",
    fontSize: 19,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  text: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 240,
    marginBottom: 8,
  },
});
