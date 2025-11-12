# 空闲提醒功能回溯指南

## 简介

空闲提醒回溯脚本用于分析历史数据，验证空闲提醒功能在过去某个时间点的工作情况。这个脚本运行在 **dry-run 模式**，不会发送实际的 Webhook 通知，也不会修改数据库。

## 使用场景

- 🔍 **调试功能**：验证空闲提醒逻辑是否正确
- 📊 **分析历史**：了解过去某天应该触发多少提醒
- ⚙️ **测试配置**：在应用新配置前，用历史数据测试效果
- 🐛 **问题排查**：分析为什么某天没有触发提醒

## 快速开始

### 方法一：使用线上数据（推荐）

由于本地数据库没有线上的真实数据，推荐直接在远程数据库上执行 SQL 查询：

```bash
# 1. 查看某天的配置
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote \
  --command "SELECT * FROM idle_alert_config"

# 2. 查看某天的空闲事件
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote \
  --command "SELECT station_id, socket_id, COUNT(*) as cnt
             FROM status_events
             WHERE date(timestamp/1000, 'unixepoch', '+8 hours') = '2025-11-11'
               AND new_status = 'available'
             GROUP BY station_id, socket_id"

# 3. 查看某天的提醒日志
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote \
  --command "SELECT * FROM idle_alert_logs WHERE log_date = '2025-11-11'"
```

### 方法二：使用本地数据库

如果你有本地测试数据，可以使用回溯脚本：

```bash
# 1. 确保本地数据库已初始化
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local

# 2. 运行回溯脚本
pnpm backtest 2025-11-11

# 3. 指定具体时间
pnpm backtest "2025-11-11 14:30"
```

## 回溯脚本输出说明

脚本会输出以下信息：

### 1. 配置信息
```
配置信息: {
  enabled: '✅ 已启用',
  threshold: '5 分钟',
  timeRange: '00:00 - 23:59',
  webhookCount: 1,
  stationFilter: '监控所有充电桩'
}
```

### 2. 时间窗口检查
```
✅ 在时间窗口内 (14:30)
```
或
```
❌ 不在时间窗口内 (22:00)
```

### 3. 工作日检查
```
✅ 工作日
```
或
```
❌ 非工作日（周末或节假日）
```

### 4. 空闲插座列表

脚本会列出所有检测到的空闲插座，并标注是否应该发送提醒：

```
✅ 应发送提醒的插座:
  - 1号充电桩 插座9: 空闲 218 分钟 (自 2025-11-11 12:39:49)
  - 1号充电桩 插座6: 空闲 464 分钟 (自 2025-11-11 14:33:49)

⏭️  跳过提醒的插座:
  - 2号充电桩 插座3: 未达到阈值 (3/5分钟) (空闲 3 分钟)
  - 3号充电桩 插座5: 当天已提醒过 (空闲 120 分钟)
```

### 5. 统计摘要
```
--- 回溯结果统计 ---
在线充电桩: 3 个
空闲插座总数: 15 个
应发送提醒: 8 个
跳过提醒: 7 个
```

## 常见场景分析

### 场景 1：为什么某天没有触发提醒？

运行回溯脚本，检查以下几点：

1. **功能是否启用**：`enabled: '✅ 已启用'`
2. **是否在时间窗口内**：检查回溯的时间点是否在配置的时间范围内
3. **是否为工作日**：确认不是周末或节假日
4. **是否有空闲插座**：查看空闲插座总数
5. **空闲时长是否达标**：检查 `skipReason` 是否为"未达到阈值"

### 场景 2：验证新配置的效果

在修改配置（如调整空闲阈值）前，可以用历史数据测试：

```bash
# 1. 临时修改本地配置（不影响线上）
# 编辑本地数据库的 idle_alert_config 表

# 2. 运行回溯看效果
pnpm backtest "2025-11-11 14:00"

# 3. 对比不同配置下的提醒数量
```

### 场景 3：分析某天的提醒情况

```bash
# 1. 回溯该天的检测结果
pnpm backtest 2025-11-11

# 2. 查询实际的提醒日志
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote \
  --command "SELECT station_name, socket_id, idle_minutes, success
             FROM idle_alert_logs
             WHERE log_date = '2025-11-11'"

# 3. 对比回溯结果和实际日志
```

## 限制说明

1. **本地数据库为空**：本地数据库只有表结构，没有线上的充电桩状态和事件数据
2. **需要手动同步数据**：如果要用回溯脚本分析真实数据，需要先导出线上数据到本地
3. **推荐直接查询远程**：对于生产环境的数据分析，推荐使用 `wrangler d1 execute --remote`

## 手动导出远程数据（可选）

如果需要在本地使用真实数据运行回溯脚本：

```bash
# 1. 导出远程数据
npx wrangler d1 export gaotu-electric-bike-charging-pile-db --remote \
  --output backup.sql

# 2. 导入到本地
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --local \
  --file backup.sql

# 3. 运行回溯脚本
pnpm backtest 2025-11-11
```

## 故障排查

### 错误：数据库表不存在

```bash
❌ 数据库表不存在

解决方法:
  1. 运行本地 migrations:
     wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local
```

**解决**：按提示运行 migrations 命令。

### 错误：找不到配置

```bash
❌ 回溯失败: 未找到空闲提醒配置
```

**解决**：确保数据库中有配置数据，或插入默认配置：

```sql
INSERT INTO idle_alert_config (
  idle_threshold_minutes,
  time_range_start,
  time_range_end,
  webhook_urls,
  enabled,
  created_at,
  updated_at
) VALUES (30, '08:00', '17:00', '[]', 1, unixepoch(), unixepoch());
```

## 进阶用法

### 批量回溯多个日期

创建一个 shell 脚本：

```bash
#!/bin/bash
dates=(
  "2025-11-11"
  "2025-11-12"
  "2025-11-13"
)

for date in "${dates[@]}"; do
  echo "=== 回溯 $date ==="
  pnpm backtest "$date"
  echo ""
done
```

### 输出到文件

```bash
pnpm backtest 2025-11-11 > backtest-2025-11-11.log 2>&1
```

## 总结

- ✅ 使用 `pnpm backtest <日期>` 快速验证功能逻辑
- ✅ 使用 `wrangler d1 execute --remote` 查询线上真实数据
- ✅ 脚本运行在 dry-run 模式，不会产生副作用
- ✅ 适合调试、测试配置、分析历史数据
