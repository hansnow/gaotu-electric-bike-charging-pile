-- 添加飞书消息发送支持
-- 创建时间：2025-11-13

-- 在 idle_alert_config 表中添加飞书相关字段
ALTER TABLE idle_alert_config ADD COLUMN lark_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE idle_alert_config ADD COLUMN lark_auth_token TEXT;
ALTER TABLE idle_alert_config ADD COLUMN lark_chat_id TEXT;

-- 在 idle_alert_logs 表中添加飞书相关字段
ALTER TABLE idle_alert_logs ADD COLUMN lark_message_id TEXT;
ALTER TABLE idle_alert_logs ADD COLUMN lark_success INTEGER;
ALTER TABLE idle_alert_logs ADD COLUMN lark_error_message TEXT;
ALTER TABLE idle_alert_logs ADD COLUMN lark_response_time_ms INTEGER;
