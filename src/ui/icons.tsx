/**
 * Иконки — inline-SVG, как в прототипе (решение §13 п.2): источник форм —
 * стандартные контурные глифы (набор Feather, MIT), отрисовка —
 * react-native-svg. Никаких бизнес-правил.
 */

import type { ReactNode } from "react";
import Svg, { Circle, Line, Path } from "react-native-svg";

interface IconProps {
  readonly size?: number;
  readonly color: string;
}

/** Общие атрибуты обводки контурной иконки 24×24. */
interface StrokeAttrs {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: "round";
  strokeLinejoin: "round";
  fill: "none";
}

/** Обёртка: контурная иконка 24×24 с общими атрибутами обводки. */
function StrokeIcon({
  size = 24,
  color,
  children,
}: IconProps & { children: (stroke: StrokeAttrs) => ReactNode }) {
  const stroke: StrokeAttrs = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {children(stroke)}
    </Svg>
  );
}

/** Шеврон «Назад» (DESIGN.md §13 п.2). */
export function ChevronLeftIcon(props: IconProps) {
  return <StrokeIcon {...props}>{(s) => <Path {...s} d="M15 18l-6-6 6-6" />}</StrokeIcon>;
}

/** «Человек+» — пустое состояние (DESIGN.md §9). */
export function PersonPlusIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      {(s) => (
        <>
          <Path {...s} d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle {...s} cx="8.5" cy="7" r="4" />
          <Line {...s} x1="20" y1="8" x2="20" y2="14" />
          <Line {...s} x1="23" y1="11" x2="17" y2="11" />
        </>
      )}
    </StrokeIcon>
  );
}

/** Предупреждение — состояние ошибки (DESIGN.md §9). */
export function AlertIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      {(s) => (
        <>
          <Path
            {...s}
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <Line {...s} x1="12" y1="9" x2="12" y2="13" />
          <Line {...s} x1="12" y1="17" x2="12.01" y2="17" />
        </>
      )}
    </StrokeIcon>
  );
}
