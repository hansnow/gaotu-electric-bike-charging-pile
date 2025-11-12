-- 空闲提醒功能数据库表
-- 创建时间：2025-11-06

-- 提醒配置表
CREATE TABLE idle_alert_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idle_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  time_range_start TEXT NOT NULL DEFAULT '08:00',
  time_range_end TEXT NOT NULL DEFAULT '17:00',
  webhook_urls TEXT NOT NULL DEFAULT '[]',
  enabled_station_ids TEXT, -- JSON 数组，null 表示全部充电桩
  enabled INTEGER NOT NULL DEFAULT 1,
  retry_times INTEGER NOT NULL DEFAULT 2,
  retry_interval_seconds INTEGER NOT NULL DEFAULT 60,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 插入默认配置
INSERT INTO idle_alert_config (
  idle_threshold_minutes,
  time_range_start,
  time_range_end,
  webhook_urls,
  enabled,
  created_at,
  updated_at
) VALUES (30, '08:00', '17:00', '[]', 1, unixepoch(), unixepoch());

-- 提醒日志表
CREATE TABLE idle_alert_logs (
  id TEXT PRIMARY KEY,
  station_id INTEGER NOT NULL,
  station_name TEXT NOT NULL,
  socket_id INTEGER NOT NULL,
  idle_minutes INTEGER NOT NULL,
  idle_start_time INTEGER NOT NULL,
  webhook_url TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  success INTEGER NOT NULL,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  triggered_at INTEGER NOT NULL,
  sent_at INTEGER NOT NULL,
  log_date TEXT NOT NULL
);

CREATE INDEX idx_alert_logs_date ON idle_alert_logs(log_date);
CREATE INDEX idx_alert_logs_station ON idle_alert_logs(station_id, socket_id);
CREATE INDEX idx_alert_logs_success ON idle_alert_logs(success);

-- 节假日缓存表
CREATE TABLE holiday_cache (
  date TEXT PRIMARY KEY,
  is_holiday INTEGER NOT NULL,
  holiday_name TEXT,
  cached_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'apple_ical'
);

CREATE INDEX idx_holiday_cached_at ON holiday_cache(cached_at);
