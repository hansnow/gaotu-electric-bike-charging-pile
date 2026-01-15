-- 新版查询（窗口函数）执行计划
EXPLAIN QUERY PLAN
SELECT socket_id, new_status, timestamp
FROM (
  SELECT 
    socket_id,
    new_status,
    timestamp,
    ROW_NUMBER() OVER (PARTITION BY socket_id ORDER BY timestamp DESC) as rn
  FROM status_events
  WHERE station_id = 1
) ranked
WHERE rn = 1;
