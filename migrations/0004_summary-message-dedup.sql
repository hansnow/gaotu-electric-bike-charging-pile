-- 添加汇总消息去重表
-- 创建时间：2025-12-09
-- 用途：记录上班/下班汇总消息的发送历史，防止重复发送

-- 创建汇总消息发送日志表
CREATE TABLE IF NOT EXISTS idle_alert_summary_logs (
  id TEXT PRIMARY KEY,                    -- 日志ID（UUID）
  message_type TEXT NOT NULL,             -- 消息类型：'window_start' 或 'window_end'
  socket_count INTEGER NOT NULL,          -- 当时的空闲插座数量
  sent_at INTEGER NOT NULL,               -- 发送时间戳（秒）
  sent_time_str TEXT NOT NULL,            -- 发送时间字符串（HH:mm，用于快速查询）
  lark_enabled INTEGER NOT NULL DEFAULT 0,-- 是否启用飞书
  lark_success INTEGER,                   -- 飞书发送是否成功（0=失败，1=成功）
  lark_message_id TEXT,                   -- 飞书消息ID
  lark_error_message TEXT,                -- 飞书错误信息
  lark_response_time_ms INTEGER,          -- 飞书响应时间（毫秒）
  webhook_enabled INTEGER NOT NULL DEFAULT 0, -- 是否启用 Webhook
  webhook_success INTEGER,                -- Webhook 发送是否成功
  webhook_error_message TEXT,             -- Webhook 错误信息
  created_at INTEGER NOT NULL             -- 记录创建时间戳（秒）
);

-- 创建索引：按消息类型和发送时间查询（用于去重）
CREATE INDEX IF NOT EXISTS idx_summary_logs_type_time
ON idle_alert_summary_logs(message_type, sent_at DESC);

-- 创建索引：按发送时间查询（用于清理旧数据）
CREATE INDEX IF NOT EXISTS idx_summary_logs_sent_at
ON idle_alert_summary_logs(sent_at DESC);
