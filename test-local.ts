/**
 * 本地测试脚本
 * 可以直接运行来测试API功能
 */

import { getDeviceDetail } from './util';
import { DeviceDetailRequest } from './types';

// 从 API.md 中获取的中电金信充电桩 simId 列表（按 1、2、3 顺序排序）
const ZHONGDIANJINXIN_DEVICES = [
  {
    name: "中电金信自行车充电1号桩",
    simId: "867997075125699"
  },
  {
    name: "中电金信自行车充电2号桩",
    simId: "863060079195715"
  },
  {
    name: "中电金信自行车充电3号桩",
    simId: "863060079153326"
  }
];

async function runLocalTest() {
  try {
    console.log('=== 开始本地测试（仅详情接口）===\n');

    console.log(`测试 ${ZHONGDIANJINXIN_DEVICES.length} 个中电金信充电桩...\n`);

    let totalZeroPorts = 0;
    let totalFreePortCount = 0;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < ZHONGDIANJINXIN_DEVICES.length; i++) {
      const device = ZHONGDIANJINXIN_DEVICES[i];
      console.log(`[${i + 1}/${ZHONGDIANJINXIN_DEVICES.length}] 测试: ${device.name}`);
      console.log(`  simId: ${device.simId}`);

      try {
        const detailParams: DeviceDetailRequest = {
          simId: device.simId,
          mapType: 2,
          chargeTypeTag: 0,
          appEntrance: 1,
          version: 'new'
        };

        const detail = await getDeviceDetail(detailParams);

        // 统计ports中为0的数量（空闲端口）
        // ports[0] 固定为0，无意义；ports[1]开始代表插座状态，0=空闲，1=占用
        const zeroPorts = detail.ports.slice(1).filter(port => port === 0).length;
        totalZeroPorts += zeroPorts;
        totalFreePortCount += detail.device.freePortCount;
        successCount++;

        console.log(`  ✅ 成功获取详情`);
        console.log(`     总端口数: ${detail.device.portNumber}`);
        console.log(`     空闲端口数(freePortCount字段): ${detail.device.freePortCount}`);
        console.log(`     空闲端口数(ports数组统计，跳过ports[0]): ${zeroPorts}`);
        console.log(`     端口状态数组: [${detail.ports.join(', ')}]`);
        console.log(`     端口状态数组(跳过ports[0]): [${detail.ports.slice(1).join(', ')}]`);
        console.log(`     设备状态: ${detail.errorMsg || '正常'}`);
        console.log(`     设备地址: ${detail.device.address}`);
        console.log(`     在线状态: ${detail.device.online === 1 ? '在线' : '离线'}`);

      } catch (error) {
        failureCount++;
        console.log(`  ❌ 获取详情失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log(''); // 空行分隔
    }

    // 输出总结
    console.log('=== 测试结果总结 ===');
    console.log(`测试设备总数: ${ZHONGDIANJINXIN_DEVICES.length}`);
    console.log(`成功获取详情: ${successCount}`);
    console.log(`获取详情失败: ${failureCount}`);

    if (successCount > 0) {
      console.log(`总空闲端口数(来自freePortCount字段): ${totalFreePortCount}`);
      console.log(`总空闲端口数(来自ports数组统计，跳过ports[0]): ${totalZeroPorts}`);
      console.log(`平均空闲端口数(freePortCount): ${(totalFreePortCount / successCount).toFixed(1)}`);
      console.log(`平均空闲端口数(ports数组): ${(totalZeroPorts / successCount).toFixed(1)}`);

      // 检查两种统计方式是否一致
      const isConsistent = totalFreePortCount === totalZeroPorts;
      console.log(`统计一致性: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
    }

    console.log('\n测试完成!');

  } catch (error) {
    console.error('测试执行失败:', error);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  runLocalTest();
}