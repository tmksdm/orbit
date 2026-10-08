/**
 * Кольцо ритма (DESIGN.md §1, §5): число внутри — текущий рекомендуемый
 * интервал (`recommendedIntervalDays`), дуга — прогресс времени относительно
 * интервала; состояние «пора связаться» — дуга цвета `due`. Семантика едина
 * на всех экранах (поправка 3).
 *
 * Дуга — SVG-круг с `strokeDasharray`: точный аналог conic-gradient прототипа.
 * Без опорной даты (progressPercent = null) — только нейтральный трек `line`,
 * число показывается (MINOR-01: «кольцо без опорной даты»). Нижний порог 6% —
 * значение прототипа (§13 п.4, оставлено).
 */

import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "./tokens";

const SIZE = 54;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const INNER_RADIUS = RADIUS - STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RhythmRingProps {
  /** Текущий рекомендуемый интервал, дни (число внутри кольца). */
  readonly intervalDays: number;
  /** Прогресс дуги 0–100 или null — дуга не рисуется. */
  readonly progressPercent: number | null;
  /** Состояние «пора связаться» — дуга цвета `due`. */
  readonly isDue: boolean;
}

export function RhythmRing({ intervalDays, progressPercent, isDue }: RhythmRingProps) {
  const arcColor = isDue ? colors.due : colors.accent;
  const clamped =
    progressPercent === null ? null : Math.min(100, Math.max(0, progressPercent));
  const arc =
    clamped === null ? 0 : (clamped / 100) * CIRCUMFERENCE;
  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.line}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={INNER_RADIUS} fill={colors.surface} />
        {clamped !== null && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={arcColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${arc} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </Svg>
      <View style={styles.numberWrap} pointerEvents="none">
        <Text style={styles.number}>{intervalDays}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  numberWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontFamily: "Unbounded_700Bold",
    fontSize: 16,
    color: colors.ink,
  },
});
