/**
 * 故障状态防抖模块单元测试
 * 测试故障防抖逻辑的正确性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addPendingFault,
  removePendingFault,
  isPendingFault,
  confirmPendingFaults,
  cleanupRecoveredFaults,
  getFaultDebounceConfig,
  type PendingFault,
} from './fault-debounce';
import type { SocketStatus, StatusChangeEvent } from './status-tracker';

// 模拟 D1 数据库
function createMockDB() {
  const data = new Map<string, any>();
  
  return {
    prepare: vi.fn((sql: string) => {
      const stmt = {
        bind: vi.fn((...bindArgs: any[]) => {
          // 使用闭包保存 bindArgs
          const savedArgs = [...bindArgs];
          const boundStmt = {
            run: vi.fn(async () => {
              // 模拟 INSERT OR REPLACE
              if (sql.includes('INSERT OR REPLACE INTO pending_faults')) {
                const key = `${savedArgs[0]}-${savedArgs[1]}`;
                data.set(key, {
                  station_id: savedArgs[0],
                  socket_id: savedArgs[1],
                  old_status: savedArgs[2],
                  detected_at: savedArgs[3],
                });
              }
              // 模拟 DELETE
              else if (sql.includes('DELETE FROM pending_faults')) {
                const key = `${savedArgs[0]}-${savedArgs[1]}`;
                data.delete(key);
              }
              return { success: true };
            }),
            first: vi.fn(async () => {
              // 模拟 SELECT ... WHERE station_id = ? AND socket_id = ?
              if (sql.includes('SELECT * FROM pending_faults') && sql.includes('WHERE station_id = ? AND socket_id = ?')) {
                const key = `${savedArgs[0]}-${savedArgs[1]}`;
                const value = data.get(key);
                return value || null;
              }
              return null;
            }),
            all: vi.fn(async () => {
              // 模拟 SELECT ... WHERE detected_at <= ?
              if (sql.includes('WHERE detected_at <= ?')) {
                const cutoffTime = savedArgs[0];
                const results = Array.from(data.values()).filter(
                  (item: any) => item.detected_at <= cutoffTime
                );
                return { results };
              }
              return { results: [] };
            }),
          };
          return boundStmt;
        }),
        // 支持直接调用 all() 不带 bind
        all: vi.fn(async () => {
          // 模拟 SELECT * FROM pending_faults (无 WHERE)
          if (sql.includes('SELECT * FROM pending_faults') && !sql.includes('WHERE')) {
            return { results: Array.from(data.values()) };
          }
          return { results: [] };
        }),
      };
      return stmt;
    }),
    batch: vi.fn(async (queries: any[]) => {
      for (const query of queries) {
        await query.run();
      }
      return { success: true };
    }),
    _data: data, // 用于测试时访问内部数据
  };
}

describe('fault-debounce', () => {
  let mockDB: any;

  beforeEach(() => {
    mockDB = createMockDB();
  });

  describe('addPendingFault', () => {
    it('应该成功添加待确认故障', async () => {
      await addPendingFault(mockDB, 1, 12, 'available', 1000);
      
      const pending = await isPendingFault(mockDB, 1, 12);
      expect(pending).not.toBeNull();
      expect(pending?.station_id).toBe(1);
      expect(pending?.socket_id).toBe(12);
      expect(pending?.old_status).toBe('available');
      expect(pending?.detected_at).toBe(1000);
    });

    it('应该支持覆盖已存在的待确认故障', async () => {
      await addPendingFault(mockDB, 1, 12, 'available', 1000);
      await addPendingFault(mockDB, 1, 12, 'occupied', 2000);
      
      const pending = await isPendingFault(mockDB, 1, 12);
      expect(pending?.old_status).toBe('occupied');
      expect(pending?.detected_at).toBe(2000);
    });
  });

  describe('removePendingFault', () => {
    it('应该成功移除待确认故障', async () => {
      await addPendingFault(mockDB, 1, 12, 'available', 1000);
      await removePendingFault(mockDB, 1, 12);
      
      const pending = await isPendingFault(mockDB, 1, 12);
      expect(pending).toBeNull();
    });

    it('移除不存在的待确认故障应该不报错', async () => {
      await expect(removePendingFault(mockDB, 1, 12)).resolves.not.toThrow();
    });
  });

  describe('isPendingFault', () => {
    it('应该正确返回待确认故障', async () => {
      await addPendingFault(mockDB, 1, 12, 'available', 1000);
      
      const pending = await isPendingFault(mockDB, 1, 12);
      expect(pending).not.toBeNull();
      expect(pending?.station_id).toBe(1);
      expect(pending?.socket_id).toBe(12);
    });

    it('应该返回 null 当不存在待确认故障时', async () => {
      const pending = await isPendingFault(mockDB, 1, 12);
      expect(pending).toBeNull();
    });
  });

  describe('confirmPendingFaults', () => {
    it('应该确认超过阈值的故障', async () => {
      const now = 10000; // 当前时间
      const threshold = 3 * 60 * 1000; // 3分钟
      const oldTime = now - threshold - 1000; // 超过阈值
      
      await addPendingFault(mockDB, 1, 12, 'available', oldTime);
      
      const stationNameMap = new Map<number, string>();
      stationNameMap.set(1, '测试充电桩');
      
      const events = await confirmPendingFaults(mockDB, now, { fault_debounce_minutes: 3 }, stationNameMap);
      
      expect(events).toHaveLength(1);
      expect(events[0].stationId).toBe(1);
      expect(events[0].socketId).toBe(12);
      expect(events[0].oldStatus).toBe('available');
      expect(events[0].newStatus).toBe('fault');
      expect(events[0].timestamp).toBe(oldTime);
      expect(events[0].stationName).toBe('测试充电桩');
    });

    it('不应该确认未超过阈值的故障', async () => {
      const now = 10000;
      const threshold = 3 * 60 * 1000;
      const recentTime = now - threshold + 1000; // 未超过阈值
      
      await addPendingFault(mockDB, 1, 12, 'available', recentTime);
      
      const events = await confirmPendingFaults(mockDB, now, { fault_debounce_minutes: 3 }, new Map());
      
      expect(events).toHaveLength(0);
    });

    it('应该按时间顺序返回确认的故障', async () => {
      const now = 10000;
      const threshold = 3 * 60 * 1000;
      
      await addPendingFault(mockDB, 1, 12, 'available', now - threshold - 2000);
      await addPendingFault(mockDB, 2, 13, 'occupied', now - threshold - 1000);
      
      const stationNameMap = new Map<number, string>();
      stationNameMap.set(1, '1号充电桩');
      stationNameMap.set(2, '2号充电桩');
      
      const events = await confirmPendingFaults(mockDB, now, { fault_debounce_minutes: 3 }, stationNameMap);
      
      expect(events).toHaveLength(2);
      expect(events[0].socketId).toBe(12); // 更早的
      expect(events[0].stationName).toBe('1号充电桩');
      expect(events[1].socketId).toBe(13); // 更晚的
      expect(events[1].stationName).toBe('2号充电桩');
    });

    it('应该为未知的充电桩使用默认名称', async () => {
      const now = 10000;
      const threshold = 3 * 60 * 1000;
      const oldTime = now - threshold - 1000;
      
      await addPendingFault(mockDB, 99, 1, 'available', oldTime);
      
      // 不提供 stationNameMap
      const events = await confirmPendingFaults(mockDB, now, { fault_debounce_minutes: 3 }, new Map());
      
      expect(events).toHaveLength(1);
      expect(events[0].stationName).toBe('充电桩99');
    });
  });

  describe('cleanupRecoveredFaults', () => {
    it('应该清理已恢复的待确认故障', async () => {
      await addPendingFault(mockDB, 1, 12, 'available', 1000);
      await addPendingFault(mockDB, 1, 13, 'occupied', 2000);
      
      // 插座12已恢复为available，插座13仍为fault
      const currentSockets = new Map<number, Map<number, SocketStatus>>();
      const stationSockets = new Map<number, SocketStatus>();
      stationSockets.set(12, 'available');
      stationSockets.set(13, 'fault');
      currentSockets.set(1, stationSockets);
      
      await cleanupRecoveredFaults(mockDB, currentSockets);
      
      // 插座12的待确认记录应该被删除
      const pending12 = await isPendingFault(mockDB, 1, 12);
      expect(pending12).toBeNull();
      
      // 插座13的待确认记录应该保留
      const pending13 = await isPendingFault(mockDB, 1, 13);
      expect(pending13).not.toBeNull();
    });

    it('应该保留仍为故障状态的待确认记录', async () => {
      await addPendingFault(mockDB, 1, 12, 'available', 1000);
      
      const currentSockets = new Map<number, Map<number, SocketStatus>>();
      const stationSockets = new Map<number, SocketStatus>();
      stationSockets.set(12, 'fault'); // 仍为故障
      currentSockets.set(1, stationSockets);
      
      await cleanupRecoveredFaults(mockDB, currentSockets);
      
      const pending = await isPendingFault(mockDB, 1, 12);
      expect(pending).not.toBeNull();
    });
  });

  describe('getFaultDebounceConfig', () => {
    it('应该返回默认配置', () => {
      const config = getFaultDebounceConfig();
      expect(config.fault_debounce_minutes).toBe(3);
    });

    it('应该从环境变量读取配置', () => {
      const env = { FAULT_DEBOUNCE_MINUTES: '5' };
      const config = getFaultDebounceConfig(env);
      expect(config.fault_debounce_minutes).toBe(5);
    });

    it('应该忽略无效的环境变量值', () => {
      const env = { FAULT_DEBOUNCE_MINUTES: 'invalid' };
      const config = getFaultDebounceConfig(env);
      expect(config.fault_debounce_minutes).toBe(3); // 使用默认值
    });

    it('应该忽略负数的环境变量值', () => {
      const env = { FAULT_DEBOUNCE_MINUTES: '-1' };
      const config = getFaultDebounceConfig(env);
      expect(config.fault_debounce_minutes).toBe(3); // 使用默认值
    });
  });
});
