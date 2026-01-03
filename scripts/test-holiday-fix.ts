#!/usr/bin/env node
/**
 * 测试节假日判断时区修复
 *
 * 验证场景:
 * 1. 北京时间 2025-01-01 00:00 (UTC 2024-12-31 16:00) → 应该识别为节假日
 * 2. 北京时间 2025-01-01 08:00 (UTC 2025-01-01 00:00) → 应该识别为节假日
 * 3. 北京时间 2025-01-02 00:00 (UTC 2025-01-01 16:00) → 应该识别为工作日(周四)
 * 4. 北京时间 2025-01-02 08:00 (UTC 2025-01-02 00:00) → 应该识别为工作日(周四)
 */

// 模拟修复后的 formatDate 函数
function formatDate(date: Date): string {
  // 转换为北京时间 (UTC+8)
  const bjOffset = 8 * 60 * 60 * 1000; // 8小时
  const bjDate = new Date(date.getTime() + bjOffset);

  const year = bjDate.getUTCFullYear();
  const month = String(bjDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bjDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 模拟修复后的 isWeekend 函数
function isWeekend(date: Date): boolean {
  // 转换为北京时间 (UTC+8)
  const bjOffset = 8 * 60 * 60 * 1000; // 8小时
  const bjDate = new Date(date.getTime() + bjOffset);

  const day = bjDate.getUTCDay();
  return day === 0 || day === 6; // 周日=0,周六=6
}

// 测试用例
const testCases = [
  {
    name: '北京时间 2025-01-01 00:00 (元旦节假日早上)',
    utcTime: new Date('2024-12-31T16:00:00.000Z'),
    expectedDate: '2025-01-01',
    expectedIsWeekend: false, // 周三
    note: '应该被识别为 2025-01-01 节假日',
  },
  {
    name: '北京时间 2025-01-01 08:00 (元旦节假日上午)',
    utcTime: new Date('2025-01-01T00:00:00.000Z'),
    expectedDate: '2025-01-01',
    expectedIsWeekend: false, // 周三
    note: '应该被识别为 2025-01-01 节假日',
  },
  {
    name: '北京时间 2025-01-02 00:00 (工作日早上)',
    utcTime: new Date('2025-01-01T16:00:00.000Z'),
    expectedDate: '2025-01-02',
    expectedIsWeekend: false, // 周四
    note: '应该被识别为 2025-01-02 工作日(周四)',
  },
  {
    name: '北京时间 2025-01-02 08:00 (工作日上午)',
    utcTime: new Date('2025-01-02T00:00:00.000Z'),
    expectedDate: '2025-01-02',
    expectedIsWeekend: false, // 周四
    note: '应该被识别为 2025-01-02 工作日(周四)',
  },
  {
    name: '北京时间 2025-01-04 08:00 (周六)',
    utcTime: new Date('2025-01-04T00:00:00.000Z'),
    expectedDate: '2025-01-04',
    expectedIsWeekend: true, // 周六
    note: '应该被识别为周末',
  },
];

console.log('===== 节假日时区修复测试 =====\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`测试: ${testCase.name}`);
  console.log(`UTC时间: ${testCase.utcTime.toISOString()}`);

  const actualDate = formatDate(testCase.utcTime);
  const actualIsWeekend = isWeekend(testCase.utcTime);

  const dateMatch = actualDate === testCase.expectedDate;
  const weekendMatch = actualIsWeekend === testCase.expectedIsWeekend;

  console.log(
    `  formatDate: ${actualDate} ${dateMatch ? '✅' : '❌ 期望: ' + testCase.expectedDate}`
  );
  console.log(
    `  isWeekend: ${actualIsWeekend} ${weekendMatch ? '✅' : '❌ 期望: ' + testCase.expectedIsWeekend}`
  );
  console.log(`  说明: ${testCase.note}`);

  if (dateMatch && weekendMatch) {
    console.log('  结果: ✅ 通过\n');
    passed++;
  } else {
    console.log('  结果: ❌ 失败\n');
    failed++;
  }
}

console.log('===== 测试总结 =====');
console.log(`总共: ${testCases.length} 个测试`);
console.log(`通过: ${passed} 个 ✅`);
console.log(`失败: ${failed} 个 ❌`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过!时区修复成功!');
  process.exit(0);
} else {
  console.log('\n⚠️ 有测试失败,请检查修复代码');
  process.exit(1);
}
