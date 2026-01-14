-- 创建时间：2026-01-14
-- 用途：优化 status_events 查询索引，解决高 rows read 问题

-- 复合索引 1：加速 getLatestSocketEventsD1 的 JOIN 查询
-- 覆盖 WHERE station_id = ? + GROUP BY socket_id + MAX(timestamp)
CREATE INDEX IF NOT EXISTS idx_events_station_socket_timestamp
ON status_events(station_id, socket_id, timestamp DESC);

-- 复合索引 2：加速空闲检测的 available 事件查询
-- 覆盖 WHERE station_id = ? AND socket_id = ? AND new_status = 'available' ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS idx_events_station_socket_status_timestamp
ON status_events(station_id, socket_id, new_status, timestamp DESC);

-- 删除已被复合索引覆盖的单列索引
DROP INDEX IF EXISTS idx_events_station;
