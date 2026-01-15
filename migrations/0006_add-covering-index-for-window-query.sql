-- 创建时间：2026-01-15
-- 用途：为窗口函数查询创建覆盖索引，避免回表读取 new_status
-- 背景：getLatestSocketEventsD1 改用窗口函数后，需要读取 (station_id, socket_id, timestamp, new_status)
--       现有 idx_events_station_socket_timestamp 不包含 new_status，导致需要回表
--       创建包含 new_status 的覆盖索引可以消除回表开销

-- 注意：此索引与 idx_events_station_socket_status_timestamp 列顺序不同
-- idx_events_station_socket_status_timestamp: (station_id, socket_id, new_status, timestamp DESC)
-- 本索引:                                     (station_id, socket_id, timestamp DESC, new_status)
-- 本索引更适合"按时间排序取最新"的查询场景

-- 创建覆盖索引
CREATE INDEX IF NOT EXISTS idx_events_station_socket_timestamp_status
ON status_events(station_id, socket_id, timestamp DESC, new_status);

-- 注：考虑删除 idx_events_station_socket_timestamp 以减少写入开销
-- 因为 idx_events_station_socket_timestamp_status 可以覆盖前者的所有查询场景
-- 但保险起见，先保留两个索引，观察生产环境后再决定是否删除
