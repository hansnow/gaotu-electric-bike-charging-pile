-- 充电桩最新状态表
CREATE TABLE latest_status (
  station_id INTEGER PRIMARY KEY,
  station_name TEXT NOT NULL,
  sim_id TEXT NOT NULL,
  sockets TEXT NOT NULL,  -- JSON 格式
  online INTEGER NOT NULL,
  address TEXT,
  timestamp INTEGER NOT NULL
);

-- 状态变化事件表
CREATE TABLE status_events (
  id TEXT PRIMARY KEY,
  station_id INTEGER NOT NULL,
  station_name TEXT NOT NULL,
  socket_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_date TEXT NOT NULL, -- YYYY-MM-DD 字符串，写入时直接赋值
  time_string TEXT NOT NULL
);

-- 创建索引以加速查询
CREATE INDEX idx_events_timestamp ON status_events(timestamp);
CREATE INDEX idx_events_station ON status_events(station_id);
CREATE INDEX idx_events_event_date ON status_events(event_date);

-- KV 配额统计表（替换现有 KV 计数器）
CREATE TABLE quota_stats (
  date TEXT PRIMARY KEY,
  write_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL
);
