#!/usr/bin/env node
/**
 * 测试 parseICS 修复
 *
 * 验证：
 * 1. 时间段事件（DTSTART + DTEND）能够正确展开为多个日期
 * 2. 能够区分节假日（休）和调休补班日（班）
 */

// 模拟 ICS 文件内容（2026年元旦）
const testICS = `BEGIN:VCALENDAR
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

// 复制修复后的 parseICS 函数
function parseICS(
  icsText: string
): { date: string; name: string; isHoliday: boolean }[] {
  const holidays: { date: string; name: string; isHoliday: boolean }[] = [];

  const lines = icsText.split(/\r?\n/);

  let inEvent = false;
  let currentStartDate = '';
  let currentEndDate = '';
  let currentSummary = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentStartDate = '';
      currentEndDate = '';
      currentSummary = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (currentStartDate && currentSummary) {
        const isHoliday = currentSummary.includes('（休）') || !currentSummary.includes('（班）');

        if (currentEndDate) {
          const startDate = new Date(currentStartDate + 'T00:00:00Z');
          const endDate = new Date(currentEndDate + 'T00:00:00Z');

          let currentDate = new Date(startDate);
          while (currentDate < endDate) {
            const dateStr = formatDateStr(currentDate);
            holidays.push({
              date: dateStr,
              name: currentSummary,
              isHoliday: isHoliday,
            });
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
          }
        } else {
          holidays.push({
            date: currentStartDate,
            name: currentSummary,
            isHoliday: isHoliday,
          });
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    if (trimmed.startsWith('DTSTART')) {
      const match = trimmed.match(/DTSTART[^:]*:(\d{8})/);
      if (match) {
        const dateStr = match[1];
        currentStartDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
    }

    if (trimmed.startsWith('DTEND')) {
      const match = trimmed.match(/DTEND[^:]*:(\d{8})/);
      if (match) {
        const dateStr = match[1];
        currentEndDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
    }

    if (trimmed.startsWith('SUMMARY')) {
      const match = trimmed.match(/SUMMARY[^:]*:(.+)/);
      if (match) {
        currentSummary = match[1];
      }
    }
  }

  return holidays;
}

function formatDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

console.log('===== parseICS 修复测试 =====\n');

const result = parseICS(testICS);

console.log(`解析结果（共 ${result.length} 条）:\n`);
result.forEach((item) => {
  const type = item.isHoliday ? '节假日（休）' : '调休补班日（班）';
  console.log(`  ${item.date}: ${item.name} → ${type}`);
});

// 验证
console.log('\n===== 验证 =====\n');

const expected = [
  { date: '2026-01-01', name: '元旦（休）', isHoliday: true },
  { date: '2026-01-02', name: '元旦（休）', isHoliday: true },
  { date: '2026-01-03', name: '元旦（休）', isHoliday: true },
  { date: '2026-01-04', name: '元旦（班）', isHoliday: false },
  { date: '2026-01-05', name: '小寒', isHoliday: true },
];

let passed = 0;
let failed = 0;

for (const exp of expected) {
  const actual = result.find((r) => r.date === exp.date);
  if (!actual) {
    console.log(`❌ ${exp.date}: 缺失`);
    failed++;
    continue;
  }

  const nameMatch = actual.name === exp.name;
  const isHolidayMatch = actual.isHoliday === exp.isHoliday;

  if (nameMatch && isHolidayMatch) {
    console.log(`✅ ${exp.date}: ${exp.name} (isHoliday=${exp.isHoliday})`);
    passed++;
  } else {
    console.log(
      `❌ ${exp.date}: 期望 ${exp.name} (isHoliday=${exp.isHoliday}), 实际 ${actual.name} (isHoliday=${actual.isHoliday})`
    );
    failed++;
  }
}

console.log('\n===== 测试总结 =====');
console.log(`总共: ${expected.length} 个测试`);
console.log(`通过: ${passed} 个 ✅`);
console.log(`失败: ${failed} 个 ❌`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过!parseICS 修复成功!');
  process.exit(0);
} else {
  console.log('\n⚠️ 有测试失败,请检查修复代码');
  process.exit(1);
}
