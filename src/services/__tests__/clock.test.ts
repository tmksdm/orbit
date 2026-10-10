/**
 * Unit-тесты конвертации «дата + время → абсолютный момент» (Stage 4, §6.6, §10.4).
 * Функция чистая, строит момент в локальной зоне устройства через конструктор
 * `Date`; время суток/DST — ответственность `Date` (несуществующее локальное
 * время нормализуется вперёд).
 */
import { combineLocalDateTime } from "../clock";

describe("combineLocalDateTime", () => {
  it("строит локальный момент из календарной даты и времени", () => {
    const d = combineLocalDateTime("2026-10-10", "19:00");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(10);
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("часы/минуты и граничный день месяца (31) корректны", () => {
    const d = combineLocalDateTime("2026-01-31", "08:05");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(5);
  });

  it("некорректная дата или время — ошибка", () => {
    expect(() => combineLocalDateTime("2026/10/10", "19:00")).toThrow();
    expect(() => combineLocalDateTime("2026-10-10", "25:00")).toThrow();
    expect(() => combineLocalDateTime("2026-10-10", "19")).toThrow();
  });

  it("нереальная календарная дата отвергается (MINOR-02)", () => {
    expect(() => combineLocalDateTime("2026-02-31", "19:00")).toThrow();
    expect(() => combineLocalDateTime("2026-02-29", "19:00")).toThrow(); // не високосный
    expect(() => combineLocalDateTime("2026-04-31", "19:00")).toThrow();
    expect(() => combineLocalDateTime("2026-13-01", "19:00")).toThrow();
    expect(() => combineLocalDateTime("2026-00-10", "19:00")).toThrow();
  });

  it("високосный 29 февраля принимается (MINOR-02)", () => {
    const d = combineLocalDateTime("2028-02-29", "19:00");
    expect(d.getFullYear()).toBe(2028);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it("валидное время всегда даёт определённый момент (в т.ч. пограничные даты DST)", () => {
    // Точный сдвиг DST зависит от зоны устройства; проверяем, что функция не
    // бросает и возвращает валидный момент (нормализация вперёд — поведение Date).
    const d = combineLocalDateTime("2026-03-08", "02:30");
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});
