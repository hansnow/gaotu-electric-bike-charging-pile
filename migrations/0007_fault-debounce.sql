-- 创建时间：2026-01-19
-- 用途：故障状态防抖过滤，避免记录短暂的瞬时故障
-- 背景：3号充电桩插座经常出现持续1-2分钟的瞬时故障（硬件抖动），需要过滤这些假故障
--       只有当故障持续超过阈值（如3分钟）时，才记录为真正的故障事件

-- 待确认故障表
-- 当检测到状态变为 fault 时，先存入此表，不立即记录事件
-- 如果故障持续超过阈值，则确认并记录事件；如果快速恢复，则丢弃
CREATE TABLE IF NOT EXISTS pending_faults (
  station_id INTEGER NOT NULL,
  socket_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  detected_at INTEGER NOT NULL,
  PRIMARY KEY (station_id, socket_id)
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_pending_faults_detected_at ON pending_faults(detected_at);
