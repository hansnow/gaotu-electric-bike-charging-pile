/**
 * 状态跟踪器单元测试
 * 测试充电桩状态变化检测和存储功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parsePortStatus,
  detectStatusChanges,
  storeSnapshot,
  storeEvents,
  getEvents,
  getLatestStatus,
  storeLatestStatus,
  getTimeString,
  getDateString,
  type Socket,
  type StationStatus,
  type StatusChangeEvent,
  type StatusSnapshot,
} from './status-tracker';

describe('parsePortStatus', () => {
  it('应该正确解析端口状态数组', () => {
    // ports[0] 固定为0，无意义；ports[1]开始代表插座状态
    const ports = [0, 0, 1, 0, 1, 1];
    const totalPorts = 5;

    const result = parsePortStatus(ports, totalPorts);

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ id: 1, status: 'available' }); // ports[1] = 0
    expect(result[1]).toEqual({ id: 2, status: 'occupied' });  // ports[2] = 1
    expect(result[2]).toEqual({ id: 3, status: 'available' }); // ports[3] = 0
    expect(result[3]).toEqual({ id: 4, status: 'occupied' });  // ports[4] = 1
    expect(result[4]).toEqual({ id: 5, status: 'occupied' });  // ports[5] = 1
  });

  it('当端口数组长度小于总端口数时，应该补充空闲端口', () => {
    const ports = [0, 0, 1, 0];
    const totalPorts = 6;

    const result = parsePortStatus(ports, totalPorts);

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({ id: 1, status: 'available' });
    expect(result[1]).toEqual({ id: 2, status: 'occupied' });
    expect(result[2]).toEqual({ id: 3, status: 'available' });
    expect(result[3]).toEqual({ id: 4, status: 'available' }); // 补充的
    expect(result[4]).toEqual({ id: 5, status: 'available' }); // 补充的
    expect(result[5]).toEqual({ id: 6, status: 'available' }); // 补充的
  });

  it('应该正确处理所有端口都空闲的情况', () => {
    const ports = [0, 0, 0, 0];
    const totalPorts = 3;

    const result = parsePortStatus(ports, totalPorts);

    expect(result).toHaveLength(3);
    result.forEach((socket, index) => {
      expect(socket).toEqual({ id: index + 1, status: 'available' });
    });
  });

  it('应该正确处理所有端口都占用的情况', () => {
    const ports = [0, 1, 1, 1];
    const totalPorts = 3;

    const result = parsePortStatus(ports, totalPorts);

    expect(result).toHaveLength(3);
    result.forEach((socket, index) => {
      expect(socket).toEqual({ id: index + 1, status: 'occupied' });
    });
  });
});

describe('detectStatusChanges', () => {
  const timestamp = Date.now();
  const stationId = 1;
  const stationName = '测试充电桩';

  it('应该检测到从空闲到占用的变化', () => {
    const oldSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'available' },
      { id: 3, status: 'available' },
    ];

    const newSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },  // 变化
      { id: 3, status: 'available' },
    ];

    const changes = detectStatusChanges(
      oldSockets,
      newSockets,
      stationId,
      stationName,
      timestamp
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      stationId: 1,
      stationName: '测试充电桩',
      socketId: 2,
      oldStatus: 'available',
      newStatus: 'occupied',
      timestamp: timestamp,
    });
    expect(changes[0].id).toBe(`${stationId}-2-${timestamp}`);
  });

  it('应该检测到从占用到空闲的变化', () => {
    const oldSockets: Socket[] = [
      { id: 1, status: 'occupied' },
      { id: 2, status: 'occupied' },
      { id: 3, status: 'occupied' },
    ];

    const newSockets: Socket[] = [
      { id: 1, status: 'occupied' },
      { id: 2, status: 'available' },  // 变化
      { id: 3, status: 'occupied' },
    ];

    const changes = detectStatusChanges(
      oldSockets,
      newSockets,
      stationId,
      stationName,
      timestamp
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      socketId: 2,
      oldStatus: 'occupied',
      newStatus: 'available',
    });
  });

  it('应该检测到多个插座的状态变化', () => {
    const oldSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },
      { id: 3, status: 'available' },
      { id: 4, status: 'occupied' },
    ];

    const newSockets: Socket[] = [
      { id: 1, status: 'occupied' },   // 变化
      { id: 2, status: 'available' },  // 变化
      { id: 3, status: 'available' },
      { id: 4, status: 'occupied' },
    ];

    const changes = detectStatusChanges(
      oldSockets,
      newSockets,
      stationId,
      stationName,
      timestamp
    );

    expect(changes).toHaveLength(2);
    
    const change1 = changes.find(c => c.socketId === 1);
    expect(change1).toBeDefined();
    expect(change1?.oldStatus).toBe('available');
    expect(change1?.newStatus).toBe('occupied');

    const change2 = changes.find(c => c.socketId === 2);
    expect(change2).toBeDefined();
    expect(change2?.oldStatus).toBe('occupied');
    expect(change2?.newStatus).toBe('available');
  });

  it('当没有状态变化时应该返回空数组', () => {
    const oldSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },
      { id: 3, status: 'available' },
    ];

    const newSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },
      { id: 3, status: 'available' },
    ];

    const changes = detectStatusChanges(
      oldSockets,
      newSockets,
      stationId,
      stationName,
      timestamp
    );

    expect(changes).toHaveLength(0);
  });

  it('当旧状态中不存在某个插座时不应该报告变化', () => {
    const oldSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },
    ];

    const newSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },
      { id: 3, status: 'available' },  // 新增的插座
    ];

    const changes = detectStatusChanges(
      oldSockets,
      newSockets,
      stationId,
      stationName,
      timestamp
    );

    expect(changes).toHaveLength(0);
  });
});

describe('getTimeString', () => {
  it('应该返回格式化的时间字符串', () => {
    const date = new Date('2025-10-11T15:30:45.123Z');
    const result = getTimeString(date);
    
    expect(result).toBe('2025-10-11 23:30:45');
  });

  it('当不传参数时应该返回当前时间', () => {
    const result = getTimeString();
    
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('getDateString', () => {
  it('应该返回日期字符串 YYYY-MM-DD', () => {
    const date = new Date('2025-10-11T15:30:45.123Z');
    const result = getDateString(date);
    
    expect(result).toBe('2025-10-11');
  });

  it('当不传参数时应该返回当前日期', () => {
    const result = getDateString();
    
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('KV 存储函数', () => {
  // 模拟 KV 存储
  let mockKV: Map<string, { value: string; expiration?: number }>;
  let mockEnv: any;

  beforeEach(() => {
    mockKV = new Map();
    mockEnv = {
      CHARGING_EVENTS: {
        get: vi.fn(async (key: string) => {
          const item = mockKV.get(key);
          return item ? item.value : null;
        }),
        put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
          mockKV.set(key, { value, expiration: options?.expirationTtl });
        }),
      },
    };
  });

  describe('storeSnapshot', () => {
    it('应该正确存储状态快照', async () => {
      const snapshot: StatusSnapshot = {
        timestamp: Date.now(),
        timeString: '2025-10-11 15:30:45',
        stations: [
          {
            id: 1,
            name: '测试充电桩',
            simId: '123456',
            sockets: [{ id: 1, status: 'available' }],
            online: true,
            address: '测试地址',
            timestamp: Date.now(),
          },
        ],
      };

      await storeSnapshot(mockEnv, snapshot);

      // 检查是否调用了 put 方法
      expect(mockEnv.CHARGING_EVENTS.put).toHaveBeenCalled();
      
      // 获取调用次数
      const putCallCount = mockEnv.CHARGING_EVENTS.put.mock.calls.length;
      
      // 检查最后一次调用（应该是带有过期时间的那次）
      const lastCall = mockEnv.CHARGING_EVENTS.put.mock.calls[putCallCount - 1];
      expect(lastCall[0]).toMatch(/^snapshot:\d{4}-\d{2}-\d{2}:\d+$/);
      expect(lastCall[1]).toBe(JSON.stringify(snapshot));
      expect(lastCall[2]).toEqual({ expirationTtl: 7 * 24 * 60 * 60 });
    });

    it('应该使用正确的键格式存储快照', async () => {
      const timestamp = new Date('2025-10-11T15:30:45.123Z').getTime();
      const snapshot: StatusSnapshot = {
        timestamp,
        timeString: '2025-10-11 15:30:45',
        stations: [],
      };

      await storeSnapshot(mockEnv, snapshot);

      const lastCall = mockEnv.CHARGING_EVENTS.put.mock.calls[
        mockEnv.CHARGING_EVENTS.put.mock.calls.length - 1
      ];
      expect(lastCall[0]).toBe(`snapshot:2025-10-11:${timestamp}`);
    });
  });

  describe('storeEvents', () => {
    it('应该正确存储状态变化事件', async () => {
      const events: StatusChangeEvent[] = [
        {
          id: '1-1-123456',
          stationId: 1,
          stationName: '测试充电桩',
          socketId: 1,
          oldStatus: 'available',
          newStatus: 'occupied',
          timestamp: 123456,
          timeString: '2025-10-11 15:30:45',
        },
      ];

      await storeEvents(mockEnv, events);

      expect(mockEnv.CHARGING_EVENTS.put).toHaveBeenCalled();
      
      const lastCall = mockEnv.CHARGING_EVENTS.put.mock.calls[
        mockEnv.CHARGING_EVENTS.put.mock.calls.length - 1
      ];
      const storedEvents = JSON.parse(lastCall[1]);
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0]).toEqual(events[0]);
    });

    it('当事件为空数组时不应该存储', async () => {
      await storeEvents(mockEnv, []);

      expect(mockEnv.CHARGING_EVENTS.put).not.toHaveBeenCalled();
    });

    it('应该合并新事件到现有事件中', async () => {
      // 使用实际的时间戳（2025-10-11）
      const baseTimestamp = new Date('2025-10-11T15:00:00Z').getTime();
      
      const existingEvents: StatusChangeEvent[] = [
        {
          id: `1-1-${baseTimestamp}`,
          stationId: 1,
          stationName: '测试充电桩',
          socketId: 1,
          oldStatus: 'available',
          newStatus: 'occupied',
          timestamp: baseTimestamp,
          timeString: '2025-10-11 15:00:00',
        },
      ];

      // 先存储现有事件
      const dateKey = '2025-10-11';
      mockKV.set(`events:${dateKey}`, { value: JSON.stringify(existingEvents) });

      const newTimestamp = baseTimestamp + 30 * 60 * 1000; // 30分钟后
      const newEvents: StatusChangeEvent[] = [
        {
          id: `1-1-${newTimestamp}`,
          stationId: 1,
          stationName: '测试充电桩',
          socketId: 1,
          oldStatus: 'occupied',
          newStatus: 'available',
          timestamp: newTimestamp,
          timeString: '2025-10-11 15:30:00',
        },
      ];

      await storeEvents(mockEnv, newEvents);

      const lastCall = mockEnv.CHARGING_EVENTS.put.mock.calls[
        mockEnv.CHARGING_EVENTS.put.mock.calls.length - 1
      ];
      const storedEvents = JSON.parse(lastCall[1]);
      
      expect(storedEvents).toHaveLength(2);
      // 应该按时间戳倒序排列（最新的在前）
      expect(storedEvents[0].timestamp).toBe(newTimestamp);
      expect(storedEvents[1].timestamp).toBe(baseTimestamp);
    });

    it('应该限制事件数量为1000个', async () => {
      // 使用实际的时间戳（2025-10-11）
      const baseTimestamp = new Date('2025-10-11T15:00:00Z').getTime();
      
      // 创建1000个现有事件
      const existingEvents: StatusChangeEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `1-1-${baseTimestamp + i}`,
        stationId: 1,
        stationName: '测试充电桩',
        socketId: 1,
        oldStatus: 'available',
        newStatus: 'occupied',
        timestamp: baseTimestamp + i,
        timeString: `2025-10-11 15:00:00`,
      }));

      const dateKey = '2025-10-11';
      mockKV.set(`events:${dateKey}`, { value: JSON.stringify(existingEvents) });

      // 添加10个新事件（时间戳更大）
      const newEvents: StatusChangeEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `1-1-${baseTimestamp + 1000 + i}`,
        stationId: 1,
        stationName: '测试充电桩',
        socketId: 1,
        oldStatus: 'occupied',
        newStatus: 'available',
        timestamp: baseTimestamp + 1000 + i,
        timeString: `2025-10-11 16:00:00`,
      }));

      await storeEvents(mockEnv, newEvents);

      const lastCall = mockEnv.CHARGING_EVENTS.put.mock.calls[
        mockEnv.CHARGING_EVENTS.put.mock.calls.length - 1
      ];
      const storedEvents = JSON.parse(lastCall[1]);
      
      // 应该只保留1000个事件
      expect(storedEvents).toHaveLength(1000);
      // 应该保留最新的事件（时间戳最大的）
      expect(storedEvents[0].timestamp).toBe(baseTimestamp + 1009);
      expect(storedEvents[999].timestamp).toBe(baseTimestamp + 10);
    });

    it('应该设置7天过期时间', async () => {
      const events: StatusChangeEvent[] = [
        {
          id: '1-1-123456',
          stationId: 1,
          stationName: '测试充电桩',
          socketId: 1,
          oldStatus: 'available',
          newStatus: 'occupied',
          timestamp: 123456,
          timeString: '2025-10-11 15:30:45',
        },
      ];

      await storeEvents(mockEnv, events);

      const lastCall = mockEnv.CHARGING_EVENTS.put.mock.calls[
        mockEnv.CHARGING_EVENTS.put.mock.calls.length - 1
      ];
      expect(lastCall[2]).toEqual({ expirationTtl: 7 * 24 * 60 * 60 });
    });
  });

  describe('getEvents', () => {
    it('应该正确获取指定日期的事件', async () => {
      const events: StatusChangeEvent[] = [
        {
          id: '1-1-123456',
          stationId: 1,
          stationName: '测试充电桩',
          socketId: 1,
          oldStatus: 'available',
          newStatus: 'occupied',
          timestamp: 123456,
          timeString: '2025-10-11 15:30:45',
        },
      ];

      mockKV.set('events:2025-10-11', { value: JSON.stringify(events) });

      const result = await getEvents(mockEnv, '2025-10-11');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(events[0]);
    });

    it('当指定日期没有事件时应该返回空数组', async () => {
      const result = await getEvents(mockEnv, '2025-10-12');

      expect(result).toHaveLength(0);
    });

    it('当JSON解析失败时应该返回空数组', async () => {
      mockKV.set('events:2025-10-11', { value: 'invalid json' });

      const result = await getEvents(mockEnv, '2025-10-11');

      expect(result).toHaveLength(0);
    });
  });

  describe('storeLatestStatus 和 getLatestStatus', () => {
    it('应该正确存储和获取最新状态', async () => {
      const status: StationStatus = {
        id: 1,
        name: '测试充电桩',
        simId: '123456',
        sockets: [
          { id: 1, status: 'available' },
          { id: 2, status: 'occupied' },
        ],
        online: true,
        address: '测试地址',
        timestamp: Date.now(),
      };

      await storeLatestStatus(mockEnv, status);

      const result = await getLatestStatus(mockEnv, 1);

      expect(result).toEqual(status);
    });

    it('当没有最新状态时应该返回null', async () => {
      const result = await getLatestStatus(mockEnv, 999);

      expect(result).toBeNull();
    });

    it('当JSON解析失败时应该返回null', async () => {
      mockKV.set('latest:1', { value: 'invalid json' });

      const result = await getLatestStatus(mockEnv, 1);

      expect(result).toBeNull();
    });

    it('应该使用正确的键格式', async () => {
      const status: StationStatus = {
        id: 123,
        name: '测试充电桩',
        simId: '123456',
        sockets: [],
        online: true,
        address: '测试地址',
        timestamp: Date.now(),
      };

      await storeLatestStatus(mockEnv, status);

      expect(mockEnv.CHARGING_EVENTS.put).toHaveBeenCalledWith(
        'latest:123',
        JSON.stringify(status)
      );
    });
  });
});

describe('边界情况测试', () => {
  it('parsePortStatus 应该处理空的 ports 数组', () => {
    const ports: number[] = [0];
    const totalPorts = 3;

    const result = parsePortStatus(ports, totalPorts);

    expect(result).toHaveLength(3);
    result.forEach((socket, index) => {
      expect(socket).toEqual({ id: index + 1, status: 'available' });
    });
  });

  it('detectStatusChanges 应该处理空的插座数组', () => {
    const changes = detectStatusChanges([], [], 1, '测试', Date.now());

    expect(changes).toHaveLength(0);
  });

  it('detectStatusChanges 应该处理新旧插座数量不一致的情况', () => {
    const oldSockets: Socket[] = [
      { id: 1, status: 'available' },
      { id: 2, status: 'occupied' },
    ];

    const newSockets: Socket[] = [
      { id: 1, status: 'occupied' },  // 变化
      { id: 2, status: 'occupied' },
      { id: 3, status: 'available' },  // 新增
      { id: 4, status: 'available' },  // 新增
    ];

    const changes = detectStatusChanges(
      oldSockets,
      newSockets,
      1,
      '测试',
      Date.now()
    );

    expect(changes).toHaveLength(1);
    expect(changes[0].socketId).toBe(1);
    expect(changes[0].oldStatus).toBe('available');
    expect(changes[0].newStatus).toBe('occupied');
  });
});
