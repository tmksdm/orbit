/**
 * Unit-тесты доменной логики напоминаний Stage 4 (цикл, anchor, план).
 * Обязательные кейсы — план Stage 4 («Required tests», §10.1, §10.2, §10.3,
 * §10.4, §10.5). Функции чистые и детерминированные.
 */
import {
  cycleDatesFrom,
  isCycleDate,
  NOTIFICATION_CYCLE_DAYS,
  planNotifications,
  resolveAnchor,
  resolveFirstCycleDate,
} from '../notifications';

describe('resolveFirstCycleDate — первая дата цикла при наступившем сроке', () => {
  it('есть просроченные, время ещё не прошло → сегодня', () => {
    expect(
      resolveFirstCycleDate({
        todayDate: '2026-10-10',
        nowTime: '18:00',
        reminderTime: '19:00',
        hasOverdueContacts: true,
      }),
    ).toBe('2026-10-10');
  });

  it('время ровно сейчас (совпадение) → завтра (time <= nowTime)', () => {
    expect(
      resolveFirstCycleDate({
        todayDate: '2026-10-10',
        nowTime: '19:00',
        reminderTime: '19:00',
        hasOverdueContacts: true,
      }),
    ).toBe('2026-10-11');
  });

  it('время прошло → завтра', () => {
    expect(
      resolveFirstCycleDate({
        todayDate: '2026-10-10',
        nowTime: '20:30',
        reminderTime: '19:00',
        hasOverdueContacts: true,
      }),
    ).toBe('2026-10-11');
  });

  it('просроченных нет → null', () => {
    expect(
      resolveFirstCycleDate({
        todayDate: '2026-10-10',
        nowTime: '18:00',
        reminderTime: '19:00',
        hasOverdueContacts: false,
      }),
    ).toBeNull();
  });
});

describe('resolveAnchor — по известным датам due, без ожидания foreground (§10.2)', () => {
  const base = { todayDate: '2026-10-10', nowTime: '18:00', reminderTime: '19:00' };

  it('есть просроченные, время не прошло → anchor = today', () => {
    expect(resolveAnchor({ ...base, contactDueDates: ['2026-10-05'] })).toBe('2026-10-10');
  });

  it('есть просроченные, время прошло → anchor = today + 1', () => {
    expect(
      resolveAnchor({ ...base, nowTime: '20:00', contactDueDates: ['2026-10-05'] }),
    ).toBe('2026-10-11');
  });

  it('просроченных нет, есть ближайшая будущая дата → anchor = min(будущих)', () => {
    expect(
      resolveAnchor({ ...base, contactDueDates: ['2026-10-20', '2026-10-15', '2026-11-01'] }),
    ).toBe('2026-10-15');
  });

  it('первый срок наступает сегодня, время не прошло → today', () => {
    expect(resolveAnchor({ ...base, contactDueDates: ['2026-10-10'] })).toBe('2026-10-10');
  });

  it('первый срок наступает сегодня, время прошло → today + 1', () => {
    expect(
      resolveAnchor({ ...base, nowTime: '19:00', contactDueDates: ['2026-10-10'] }),
    ).toBe('2026-10-11');
  });

  it('контактов нет / даты due неизвестны → null', () => {
    expect(resolveAnchor({ ...base, contactDueDates: [] })).toBeNull();
  });

  it('смешение прошедших и будущих: приоритет у просрочки (today | tomorrow)', () => {
    expect(resolveAnchor({ ...base, contactDueDates: ['2026-10-01', '2026-10-25'] })).toBe(
      '2026-10-10',
    );
  });
});

describe('cycleDatesFrom — даты цикла от anchor', () => {
  it('from = anchor → anchor, +3, +6, … (limit штук)', () => {
    expect(cycleDatesFrom('2026-10-10', '2026-10-10', 3)).toEqual([
      '2026-10-10',
      '2026-10-13',
      '2026-10-16',
    ]);
  });

  it('from между днями цикла → первая дата ≥ from', () => {
    expect(cycleDatesFrom('2026-10-10', '2026-10-12', 2)).toEqual(['2026-10-13', '2026-10-16']);
  });

  it('from на дне цикла → этот день включается', () => {
    expect(cycleDatesFrom('2026-10-10', '2026-10-13', 1)).toEqual(['2026-10-13']);
  });

  it('limit = 0 → пустой список', () => {
    expect(cycleDatesFrom('2026-10-10', '2026-10-10', 0)).toEqual([]);
  });

  it('граница месяца', () => {
    expect(cycleDatesFrom('2026-10-28', '2026-10-28', 2)).toEqual(['2026-10-28', '2026-10-31']);
  });

  it('граница года', () => {
    expect(cycleDatesFrom('2026-12-29', '2026-12-29', 3)).toEqual([
      '2026-12-29',
      '2027-01-01',
      '2027-01-04',
    ]);
  });

  it('високосный февраль', () => {
    expect(cycleDatesFrom('2028-02-27', '2028-02-27', 3)).toEqual([
      '2028-02-27',
      '2028-03-01',
      '2028-03-04',
    ]);
  });
});

describe('isCycleDate — день цикла', () => {
  it('anchor и кратные 3 — да (в т.ч. границы месяца/года)', () => {
    expect(isCycleDate('2026-10-31', '2026-11-03')).toBe(true);
    expect(isCycleDate('2026-12-30', '2027-01-02')).toBe(true);
  });

  it('не кратные 3 — нет', () => {
    expect(isCycleDate('2026-10-31', '2026-11-01')).toBe(false);
    expect(isCycleDate('2026-10-10', '2026-10-11')).toBe(false);
  });

  it('сам anchor — день цикла', () => {
    expect(isCycleDate('2026-10-10', '2026-10-10')).toBe(true);
  });
});

describe('planNotifications — план на горизонт (§10.1, §10.4, §10.5)', () => {
  const horizon = 366;

  it('контакт с nextDueDate == день цикла включён (due включительно)', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '18:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-13'],
    });
    expect(plan[0]).toEqual({ cycleDate: '2026-10-13', dueCount: 1 });
  });

  it('nextDueDate на день позже дня цикла в него не входит', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '18:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-14'],
    });
    // 2026-10-13 пропускается (dueCount = 0), первая дата — 2026-10-16.
    expect(plan[0]?.cycleDate).toBe('2026-10-16');
  });

  it('dueCount == 0 → день отсутствует в плане (цикл сохраняется)', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '18:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-12'],
    });
    expect(plan.map((p) => p.cycleDate)).not.toContain('2026-10-10');
    expect(plan[0]?.cycleDate).toBe('2026-10-13');
  });

  it('сегодня — день цикла, время прошло → сегодня не планируется', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '20:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-10'],
    });
    expect(plan[0]?.cycleDate).toBe('2026-10-13');
  });

  it('прошедшие даты цикла отсутствуют в плане', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-01',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '18:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-10'],
    });
    expect(plan.every((p) => p.cycleDate >= '2026-10-10')).toBe(true);
    expect(plan[0]?.cycleDate).toBe('2026-10-10');
  });

  it('горизонт: только даты в пределах horizonDays, порядок возрастающий', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '18:00',
      horizonDays: 6,
      contactDueDates: ['2026-10-10'],
    });
    expect(plan.map((p) => p.cycleDate)).toEqual(['2026-10-10', '2026-10-13', '2026-10-16']);
  });

  it('новое взаимодействие переносит будущий срок: anchor не меняется, dueCount пересчитан', () => {
    // anchor фиксирован 2026-10-10; сегодня 2026-10-12; контакт due 2026-10-15.
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-12',
      nowTime: '18:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-15'],
    });
    // 2026-10-13 — день цикла, но due 10-15 ещё не наступил → пропуск;
    // 2026-10-16 — первый день цикла с dueCount > 0.
    expect(plan[0]?.cycleDate).toBe('2026-10-16');
    expect(plan[0]?.dueCount).toBe(1);
  });

  it('нет просроченных и нет дат → план пуст', () => {
    expect(
      planNotifications({
        anchorDate: '2026-10-10',
        reminderTime: '19:00',
        todayDate: '2026-10-10',
        nowTime: '18:00',
        horizonDays: horizon,
        contactDueDates: [],
      }),
    ).toEqual([]);
  });

  it('несколько просроченных контактов суммируются в dueCount', () => {
    const plan = planNotifications({
      anchorDate: '2026-10-10',
      reminderTime: '19:00',
      todayDate: '2026-10-10',
      nowTime: '18:00',
      horizonDays: horizon,
      contactDueDates: ['2026-10-01', '2026-10-09', '2026-10-10'],
    });
    expect(plan[0]).toEqual({ cycleDate: '2026-10-10', dueCount: 3 });
  });

  it('шаг плана соответствует NOTIFICATION_CYCLE_DAYS', () => {
    expect(NOTIFICATION_CYCLE_DAYS).toBe(3);
  });
});
