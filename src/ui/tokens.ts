/**
 * Токены дизайн-системы — DESIGN.md (вариант B «Ритм»), §2–§4.
 * Только утверждённые значения: никаких других цветов и шрифтов.
 */

/** Цветовая палитра (DESIGN.md §2, точные значения прототипа B). */
export const colors = {
  bg: "#f4f5f8",
  surface: "#ffffff",
  ink: "#171a21",
  muted: "#6b7280",
  line: "#e6e8ee",
  accent: "#4f46e5",
  accentInk: "#ffffff",
  accentSoft: "#eceafe",
  due: "#e11d48",
  dueBg: "#fde7ec",
  dueLine: "#f6c2cd",
} as const;

/** Размеры шрифтов (DESIGN.md §3). */
export const fontSize = { title: 20, body: 15, small: 13, tiny: 11 } as const;

/** Сетка и отступы (DESIGN.md §4). */
export const spacing = { pad: 16, gap: 10 } as const;

/** Радиусы (DESIGN.md §4). */
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 } as const;

/** Тень карточки (DESIGN.md §2, shadow-card). */
export const cardShadow = "0 4px 14px rgba(23,26,33,0.05)";

/** Семантический отклик нажатия (DESIGN.md §13 п.1 — минимальное решение). */
export const ripple = { color: "rgba(23,26,33,0.08)" } as const;
