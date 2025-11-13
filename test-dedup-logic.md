# 空闲提醒去重逻辑测试说明

## 新逻辑说明

### 改进前（旧逻辑）
去重基于：`(station_id, socket_id, log_date)`

**问题**：同一天内，插座即使中间被占用过，再次空闲也不会提醒。

```
08:00 插座 #1 变为空闲（idle_start_time = T1）
08:05 发送提醒 ✅
10:00 插座 #1 被占用
11:00 插座 #1 再次空闲（idle_start_time = T2）
11:05 不会提醒 ❌（因为 log_date 相同）
```

### 改进后（新逻辑）
去重基于：`(station_id, socket_id, idle_start_time)`

**优势**：每次新的空闲周期都会独立判断，插座被占用后再次空闲会重新提醒。

```
08:00 插座 #1 变为空闲（idle_start_time = T1）
08:05 发送提醒 ✅（查询：idle_start_time = T1 未提醒过）
10:00 插座 #1 被占用
11:00 插座 #1 再次空闲（idle_start_time = T2）
11:05 再次发送提醒 ✅（查询：idle_start_time = T2 未提醒过）
```

## 测试场景

### 场景 1：持续空闲不重复提醒
```
时间          事件                         提醒状态
-----------------------------------------------------------
08:00        插座变为空闲 (T1)            -
08:05        空闲时长 = 5分钟              ✅ 发送提醒 (idle_start_time=T1)
08:10        空闲时长 = 10分钟             ⏭️ 跳过 (T1已提醒)
08:15        空闲时长 = 15分钟             ⏭️ 跳过 (T1已提醒)
...
17:00        空闲时长 = 540分钟            ⏭️ 跳过 (T1已提醒)
```

### 场景 2：中间被占用后重新提醒
```
时间          事件                         提醒状态
-----------------------------------------------------------
08:00        插座变为空闲 (T1)            -
08:05        空闲时长 = 5分钟              ✅ 发送提醒 (idle_start_time=T1)
08:30        插座被占用                   -
09:00        插座再次空闲 (T2)            -
09:05        空闲时长 = 5分钟              ✅ 发送提醒 (idle_start_time=T2)
09:30        插座被占用                   -
10:00        插座再次空闲 (T3)            -
10:05        空闲时长 = 5分钟              ✅ 发送提醒 (idle_start_time=T3)
```

### 场景 3：发送失败会重试
```
时间          事件                         提醒状态
-----------------------------------------------------------
08:00        插座变为空闲 (T1)            -
08:05        空闲时长 = 5分钟              ❌ 发送失败 (success=0)
08:06        空闲时长 = 6分钟              ✅ 重试成功 (T1 之前失败，可重试)
08:07        空闲时长 = 7分钟              ⏭️ 跳过 (T1已成功提醒)
```

## 数据库查询示例

### 查询某个插座的所有提醒记录
```sql
SELECT
  datetime(triggered_at, 'unixepoch', '+8 hours') as 提醒时间,
  station_name as 充电桩,
  socket_id as 插座,
  idle_minutes as 空闲分钟,
  datetime(idle_start_time, 'unixepoch', '+8 hours') as 空闲开始时间,
  success as 是否成功,
  log_date as 日期
FROM idle_alert_logs
WHERE station_id = 1 AND socket_id = 5
ORDER BY triggered_at;
```

### 检查去重是否生效
```sql
-- 查询同一个 idle_start_time 的所有提醒
SELECT
  datetime(triggered_at, 'unixepoch', '+8 hours') as 提醒时间,
  idle_minutes as 空闲分钟,
  success as 是否成功,
  COUNT(*) OVER (PARTITION BY station_id, socket_id, idle_start_time) as 该周期提醒次数
FROM idle_alert_logs
WHERE station_id = 1 AND socket_id = 5
ORDER BY idle_start_time, triggered_at;
```

## 部署说明

修改已完成，部署到生产环境后即可生效。

### 代码变更文件
- ✅ `idle-alert/idle-detector.ts` - 修改去重查询逻辑
- ✅ `docs/idle-alert-implementation.md` - 更新文档说明
- ✅ `docs/idle-alert-design.md` - 更新设计文档

### 数据库变更
**无需迁移**：现有的 `idle_alert_logs` 表结构已包含 `idle_start_time` 字段，无需修改数据库。

### 兼容性
- ✅ 向后兼容：现有日志数据不受影响
- ✅ 不会产生重复提醒：历史的 `idle_start_time` 仍会被正确去重

## 验证方法

部署后可以通过以下方式验证：

1. **查看日志**：观察 Worker 日志中的去重消息
   ```
   [IDLE_ALERT] 充电桩 X 插座 Y 本次空闲周期已提醒，跳过
   ```

2. **模拟测试**：
   - 让某个插座空闲超过阈值 → 收到提醒
   - 占用该插座几分钟
   - 再次让该插座空闲超过阈值 → 应该再次收到提醒

3. **查询数据库**：检查同一天内同一插座的多个 `idle_start_time` 记录
