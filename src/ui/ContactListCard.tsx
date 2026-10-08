/**
 * Карточка контакта в списке (DESIGN.md §4, §5, §6.1): кольцо ритма + имя +
 * заметка (одна строка, ellipsis) + мета «раз в N дней · <когда>». Состояние
 * «пора связаться» — заливка `due-bg` и граница `due-line`. Вся карточка
 * кликабельна (§8). Компонент представления: строку меты форматирует экран.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { RhythmRing } from "./RhythmRing";
import { colors, fontSize, radius, ripple, spacing } from "./tokens";

interface ContactListCardProps {
  readonly name: string;
  readonly note?: string;
  /** Текущий рекомендуемый интервал, дни (число в кольце). */
  readonly intervalDays: number;
  /** Прогресс дуги 0–100 или null — дуга не рисуется. */
  readonly progressPercent: number | null;
  readonly isDue: boolean;
  /** Мета-строка «раз в N дней · …» — отформатирована экраном (русский UI). */
  readonly meta: string;
  readonly onPress: () => void;
}

export function ContactListCard({
  name,
  note,
  intervalDays,
  progressPercent,
  isDue,
  meta,
  onPress,
}: ContactListCardProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={ripple}
      style={({ pressed }) => [
        styles.card,
        isDue && styles.cardDue,
        pressed && styles.pressed,
      ]}
    >
      <RhythmRing
        intervalDays={intervalDays}
        progressPercent={progressPercent}
        isDue={isDue}
      />
      <View style={styles.texts}>
        <Text style={styles.name}>{name}</Text>
        {note !== undefined && note.length > 0 && (
          <Text style={styles.note} numberOfLines={1} ellipsizeMode="tail">
            {note}
          </Text>
        )}
        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: spacing.gap,
    shadowColor: "rgba(23,26,33,0.05)",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    shadowOpacity: 1,
    elevation: 0,
  },
  cardDue: {
    borderColor: colors.dueLine,
    backgroundColor: colors.dueBg,
  },
  pressed: {
    opacity: 0.92,
  },
  texts: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: "Manrope_700Bold",
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.ink,
  },
  note: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.small,
    color: colors.muted,
  },
  meta: {
    fontFamily: "Manrope_400Regular",
    fontSize: fontSize.tiny,
    color: colors.muted,
  },
});
