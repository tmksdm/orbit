/**
 * Форматирование для отображения — русский UI (решение 6 плана Stage 3),
 * даты ru-RU (DESIGN.md §13 п.6). Только представление: никакой бизнес-логики,
 * значения приходят из features/domain.
 */

import type { ContactStrategy, Initiator, Outcome } from "../domain/types";

/** «N день/дня/дней» — русские формы числа с существительным. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  const form =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;
  return `${n} ${form}`;
}

/** «2 дня», «5 дней», «1 день». */
export function daysLabel(n: number): string {
  return plural(n, "день", "дня", "дней");
}

/** «1 контакт», «2 контакта», «5 контактов». */
export function contactsLabel(n: number): string {
  return plural(n, "контакт", "контакта", "контактов");
}

/** Подписи стратегий (русский UI, DESIGN.md §6.2). */
export const strategyLabel: Record<ContactStrategy, string> = {
  maintain: "Не потерять связь",
  grow: "Сближаться",
};

/** Подписи инициаторов (DESIGN.md §6.3). */
export const initiatorLabel: Record<Initiator, string> = {
  me: "Вы",
  them: "Другой человек",
  mutual: "Взаимно",
};

/** Подписи результатов (DESIGN.md §6.3). */
export const outcomeLabel: Record<Outcome, string> = {
  good: "Хорошее общение",
  short: "Короткое общение",
  no_reply: "Нет ответа",
};

/** Русские названия месяцев (родительный падеж) — форматируем сами, без Intl:
 * вывод Intl.DateTimeFormat отличается между Node и Hermes/Android
 * («8 октября 2026 г.» против «8 октября 2026»), UI должен быть одинаковым. */
const MONTHS_LONG = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

const MONTHS_SHORT = [
  "янв.",
  "февр.",
  "мар.",
  "апр.",
  "мая",
  "июн.",
  "июл.",
  "авг.",
  "сент.",
  "окт.",
  "нояб.",
  "дек.",
] as const;

/** Разбор локальной даты YYYY-MM-DD (формат гарантирует domain). */
function parseLocalDate(localDate: string): {
  day: number;
  month: number;
} {
  const parts = localDate.split("-").map(Number);
  return { day: parts[2] ?? 0, month: parts[1] ?? 1 };
}

/** Краткая дата «12 окт.» — история взаимодействий. */
export function formatShortDate(localDate: string): string {
  const { day, month } = parseLocalDate(localDate);
  return `${day} ${MONTHS_SHORT[month - 1] ?? ""}`.trim();
}

/** Полная дата «12 октября 2026» — плитка «следующий контакт». */
export function formatLongDate(localDate: string): string {
  const { day, month } = parseLocalDate(localDate);
  const year = Number(localDate.slice(0, 4));
  return `${day} ${MONTHS_LONG[month - 1] ?? ""} ${year}`.trim();
}
