-- 出差申请新增字段
-- return_transport_type: 返程交通方式
-- departure_time: 出发时间

ALTER TABLE absence_records ADD COLUMN IF NOT EXISTS return_transport_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE absence_records ADD COLUMN IF NOT EXISTS departure_time DATETIME DEFAULT NULL;
