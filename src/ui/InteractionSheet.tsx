/**
 * Нижняя шторка «Зафиксировать общение» (DESIGN.md §4, §6.3, §8): выбор
 * инициатора и результата обязателен; сохранение недоступно, пока выбран не
 * каждый из двух. Выбор — локальное состояние представления; бизнес-правил нет.
 *
 * Реализация — абсолютный оверлей (затемнение + нижняя панель) без RN Modal:
 * минимально и одинаково предсказуемо на устройстве и в тестах. Родитель
 * монтирует шторку только на время показа — выбор сбрасывается при закрытии
 * (без эффекта-сброса).
 */

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Initiator, Outcome } from "../domain/types";
import { PrimaryButton } from "./Buttons";
import { initiatorLabel, outcomeLabel } from "./format";
import { colors, fontSize, radius, ripple } from "./tokens";

const INITIATORS: readonly Initiator[] = ["me", "them", "mutual"];
const OUTCOMES: readonly Outcome[] = ["good", "short", "no_reply"];

interface InteractionSheetProps {
  readonly onClose: () => void;
  readonly onSave: (initiator: Initiator, outcome: Outcome) => void;
  /** Идёт сохранение — кнопка неактивна. */
  readonly saving?: boolean;
  /** Ошибка сохранения (от экрана); показывается под кнопкой. */
  readonly error?: string | null;
}

/** Сетка опций 2 колонки (§4): опция — min-height 52, радиус 14. */
function OptionGrid<T extends string>({
  testPrefix,
  options,
  selected,
  label,
  onSelect,
}: {
  testPrefix: string;
  options: readonly T[];
  selected: T | null;
  label: (value: T) => string;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.grid}>
      {options.map((value) => {
        const active = selected === value;
        return (
          <Pressable
            key={value}
            testID={`${testPrefix}-${value}`}
            onPress={() => onSelect(value)}
            android_ripple={ripple}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {label(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InteractionSheet({
  onClose,
  onSave,
  saving = false,
  error = null,
}: InteractionSheetProps) {
  const [initiator, setInitiator] = useState<Initiator | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // REVIEW-01 / DESIGN.md §8: сохранение недоступно, пока выбран не каждый из
  // двух (инициатор и результат) — кнопка неактивна, пока форма неполна.
  const incomplete = initiator === null || outcome === null;
  const saveDisabled = saving || incomplete;
  const showError = incomplete || (error !== null && error.length > 0);

  return (
    <View style={styles.scrim}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Закрыть"
      />
      <View style={styles.panel}>
        <View style={styles.handle} />
        <Text style={styles.title}>Зафиксировать общение</Text>

        <Text style={styles.label}>Кто был инициатором</Text>
        <OptionGrid
          testPrefix="initiator"
          options={INITIATORS}
          selected={initiator}
          label={(v) => initiatorLabel[v]}
          onSelect={setInitiator}
        />

        <Text style={styles.label}>Как прошло</Text>
        <OptionGrid
          testPrefix="outcome"
          options={OUTCOMES}
          selected={outcome}
          label={(v) => outcomeLabel[v]}
          onSelect={setOutcome}
        />

        {showError && (
          <Text style={styles.error}>
            {error !== null && error.length > 0
              ? error
              : "Выберите инициатора и результат."}
          </Text>
        )}

        <PrimaryButton
          label="Сохранить"
          disabled={saveDisabled}
          onPress={() => {
            if (initiator !== null && outcome !== null) {
              onSave(initiator, outcome);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(12,14,18,0.42)",
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 10,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Unbounded_600SemiBold",
    fontSize: 20,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  optionLabelActive: {
    color: colors.accent,
  },
  error: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.due,
  },
});
