-- 对比旧版和新版 getLatestSocketEventsD1 的执行计划
-- 注意：需要分别执行每个查询

-- 旧版查询（聚合+JOIN）
EXPLAIN QUERY PLAN
SELECT event.socket_id as socket_id, event.new_status as new_status, event.timestamp as timestamp
FROM status_events event
INNER JOIN (
  SELECT socket_id, MAX(timestamp) as max_timestamp
  FROM status_events
  WHERE station_id = 1
  GROUP BY socket_id
) latest
  ON event.socket_id = latest.socket_id AND event.timestamp = latest.max_timestamp
WHERE event.station_id = 1;
