-- ============================================
-- 2026-03-19 增量更新 SQL（MariaDB 兼容）
-- 功能：请假记录增加诊断证明书上传附件字段
-- 执行方式: mysql -u root -p gov_platform < medical-certificate-2026-03-19.sql
-- ============================================

-- 给 absence_records 表增加诊断证明书字段（存储图片URL路径）
ALTER TABLE absence_records ADD COLUMN IF NOT EXISTS medical_certificate_url VARCHAR(500) DEFAULT NULL COMMENT '诊断证明书图片URL（病假时必填）';

-- ============================================
-- 验证
-- ============================================
SELECT 'absence_records.medical_certificate_url' AS `字段`, COUNT(*) AS `存在` 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'absence_records' 
  AND COLUMN_NAME = 'medical_certificate_url';
