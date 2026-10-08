/**
 * Due-логика «пора связаться» (Stage 3): чистая доменная функция.
 *
 * Правило — docs/DOMAIN.md («Правило „пора связаться“ (due) — Stage 3») и
 * docs/plans/stage-3-ui.md (раздел «Due-логика»):
 *
 *  - referenceDate = дата ПОСЛЕДНЕГО взаимодействия; если истории нет — `createdAt`;
 *  - nextDueDate = referenceDate + recommendedIntervalDays (календарные дни);
 *  - контакт требует внимания, если today >= nextDueDate;
 *  - сравнение — по ЛОКАЛЬНОЙ календарной дате (YYYY-MM-DD), а не моментам
 *    времени: время суток и переходы часовых поясов/DST не сдвигают вердикт
 *    на границе суток;
 *  - если истории нет и `createdAt` неизвестен (старые до-v2 записи) — срок
 *    НЕ рассчитывается: nextDueDate = null, isDue = false (вариант A владельца).
 *
 * Функция детерминирована: «сегодня» передаётся параметром, часы домен не читает.
 * Контракт дат: все поля — строки ЛОКАЛЬНЫХ календарных дат (YYYY-MM-DD);
 * перевод момента ISO 8601 в локальную дату делает слой services
 * (src/services/clock.ts). Алгоритм пересчёта интервала due НЕ меняет —
 * он только читает recommendedIntervalDays.
 */

/** Миллисекунд в сутках — для календарной арифметики над датами без времени. */
const MS_PER_DAY = 86_400_000;

/** Вход расчёта due. */
export interface DueInput {
  /**
   * Локальная календарная дата (YYYY-MM-DD) ПОСЛЕДНЕГО взаимодействия
   * (выбирается вызывающим слоем по максимуму `occurredAt`) или null, если
   * истории нет.
   */
  readonly lastInteractionDate: string | null;
  /** Локальная календарная дата (YYYY-MM-DD) создания контакта или null. */
  readonly createdAtDate: string | null;
  /** Локальная календарная дата «сегодня» (YYYY-MM-DD). */
  readonly today: string;
  /** Текущий рекомендуемый интервал, дни (due только читает его). */
  readonly recommendedIntervalDays: number;
}

/** Результат расчёта due. */
export interface DueResult {
  /** Опорная дата (локальная YYYY-MM-DD); null — срок не рассчитывается. */
  readonly referenceDate: string | null;
  /** Дата следующего контакта (локальная YYYY-MM-DD); null — не рассчитывается. */
  readonly nextDueDate: string | null;
  /** true — срок наступил или прошёл (today >= nextDueDate), контакт «пора связаться». */
  readonly isDue: boolean;
}

/** Разбирает локальную дату YYYY-MM-DD; ошибка — при нарушении формата. */
function toUtcMs(date: string): number {
  const parts = date.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const valid =
    parts.length === 3 &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31;
  if (!valid) {
    throw new Error(`Invalid local date (expected YYYY-MM-DD): ${date}`);
  }
  return Date.UTC(year, month - 1, day);
}

/** Форматирует момент как дату UTC-пространства (YYYY-MM-DD). */
function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  const year = String(d.getUTCFullYear()).padStart(4, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Прибавляет `days` календарных дней к локальной дате YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Разница в календарных днях между локальными датами (`to` − `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/**
 * Считает due-информацию контакта. Чистая и детерминированная: одинаковый
 * вход → одинаковый результат.
 */
export function computeDue(input: DueInput): DueResult {
  const reference = input.lastInteractionDate ?? input.createdAtDate;
  if (reference === null) {
    // Нет истории и неизвестна дата создания (старые до-v2 записи):
    // срок не рассчитывается — контакт виден в списке, но не «пора».
    return { referenceDate: null, nextDueDate: null, isDue: false };
  }
  const nextDueDate = addDays(reference, input.recommendedIntervalDays);
  // Строки YYYY-MM-DD сравниваются лексикографически — как календарные даты.
  return { referenceDate: reference, nextDueDate, isDue: input.today >= nextDueDate };
}
