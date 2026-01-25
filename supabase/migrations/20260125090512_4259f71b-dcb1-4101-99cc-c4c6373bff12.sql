-- 给审批节点添加审批方式字段
-- approval_mode: 'countersign' (会签-需要所有审批人同意) 或 'or_sign' (或签-任一审批人同意或拒绝即可)
ALTER TABLE public.approval_nodes
ADD COLUMN approval_mode TEXT NOT NULL DEFAULT 'countersign';

-- 添加注释说明
COMMENT ON COLUMN public.approval_nodes.approval_mode IS '审批方式: countersign(会签-需要所有审批人同意), or_sign(或签-任一审批人决定即可)';