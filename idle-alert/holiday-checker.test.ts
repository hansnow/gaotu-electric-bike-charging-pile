import { describe, it, expect } from 'vitest';
import {
  createHolidayChecker,
  formatDate,
  isWeekend,
  parseICS,
} from './holiday-checker';

type HolidayCacheRow = {
  date: string;
  is_holiday: number;
  holiday_name: string | null;
  cached_at: number;
  source: string;
};

function createMockDb(rows: HolidayCacheRow[]): D1Database {
  const cache = new Map(rows.map((row) => [row.date, row]));

  return {
    prepare: () => ({
      bind: (dateStr: string) => ({
        first: async <T>() => (cache.get(dateStr) as T) ?? null,
      }),
    }),
    batch: async () => [],
  } as unknown as D1Database;
}

describe('parseICS', () => {
  it('expands ranges and distinguishes holiday vs workday entries', () => {
    const icsText = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:test-1
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260104
SUMMARY;LANGUAGE=zh_CN:元旦（休）
END:VEVENT
BEGIN:VEVENT
UID:test-2
DTSTART;VALUE=DATE:20260104
SUMMARY;LANGUAGE=zh_CN:元旦（班）
END:VEVENT
BEGIN:VEVENT
UID:test-3
DTSTART;VALUE=DATE:20260105
SUMMARY;LANGUAGE=zh_CN:小寒
END:VEVENT
END:VCALENDAR`;

    const result = parseICS(icsText);

    expect(result).toEqual([
      { date: '2026-01-01', name: '元旦（休）', isHoliday: true },
      { date: '2026-01-02', name: '元旦（休）', isHoliday: true },
      { date: '2026-01-03', name: '元旦（休）', isHoliday: true },
      { date: '2026-01-04', name: '元旦（班）', isHoliday: false },
    ]);
  });
});

describe('formatDate / isWeekend (Beijing timezone)', () => {
  const cases = [
    {
      name: '北京时间 2025-01-01 00:00',
      date: new Date('2024-12-31T16:00:00.000Z'),
      expectedDate: '2025-01-01',
      expectedWeekend: false,
    },
    {
      name: '北京时间 2025-01-01 08:00',
      date: new Date('2025-01-01T00:00:00.000Z'),
      expectedDate: '2025-01-01',
      expectedWeekend: false,
    },
    {
      name: '北京时间 2025-01-02 00:00',
      date: new Date('2025-01-01T16:00:00.000Z'),
      expectedDate: '2025-01-02',
      expectedWeekend: false,
    },
    {
      name: '北京时间 2025-01-02 08:00',
      date: new Date('2025-01-02T00:00:00.000Z'),
      expectedDate: '2025-01-02',
      expectedWeekend: false,
    },
    {
      name: '北京时间 2025-01-04 08:00',
      date: new Date('2025-01-04T00:00:00.000Z'),
      expectedDate: '2025-01-04',
      expectedWeekend: true,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(formatDate(testCase.date)).toBe(testCase.expectedDate);
      expect(isWeekend(testCase.date)).toBe(testCase.expectedWeekend);
    });
  }
});

describe('createHolidayChecker.isWorkday', () => {
  it('uses cached holiday data to decide workdays', async () => {
    const now = Math.floor(Date.now() / 1000);
    const db = createMockDb([
      { date: '2026-01-01', is_holiday: 1, holiday_name: '元旦（休）', cached_at: now, source: 'test' },
      { date: '2026-01-02', is_holiday: 1, holiday_name: '元旦（休）', cached_at: now, source: 'test' },
      { date: '2026-01-03', is_holiday: 1, holiday_name: '元旦（休）', cached_at: now, source: 'test' },
      { date: '2026-01-04', is_holiday: 0, holiday_name: '元旦（班）', cached_at: now, source: 'test' },
    ]);

    const checker = createHolidayChecker(db, async () => {
      throw new Error('unexpected fetch call');
    });

    const cases = [
      { date: '2026-01-01', expected: false },
      { date: '2026-01-02', expected: false },
      { date: '2026-01-03', expected: false },
      { date: '2026-01-04', expected: true },
    ];

    for (const testCase of cases) {
      const result = await checker.isWorkday(new Date(`${testCase.date}T00:00:00.000Z`));
      expect(result).toBe(testCase.expected);
    }
  });
});
