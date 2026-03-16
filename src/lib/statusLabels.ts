/**
 * 统一的状态标签映射 - 所有业务模块共用
 * 确保列表和详情页面状态显示一致
 */

export interface StatusConfig {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

export const allStatusConfig: Record<string, StatusConfig> = {
  pending: { label: "待审批", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200" },
  processing: { label: "审批中", variant: "secondary", className: "bg-blue-50 text-blue-700 border-blue-200" },
  approved: { label: "已通过", variant: "default", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "已拒绝", variant: "destructive", className: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "已完成", variant: "outline", className: "bg-slate-50 text-slate-600 border-slate-200" },
  cancelled: { label: "已取消", variant: "outline", className: "bg-slate-50 text-slate-400 border-slate-200" },
  withdrawn: { label: "已撤回", variant: "outline", className: "bg-slate-50 text-slate-400 border-slate-200" },
  returned_restart: { label: "退回重审", variant: "destructive", className: "bg-orange-50 text-orange-700 border-orange-200" },
  return_to_initiator: { label: "退回发起人", variant: "destructive", className: "bg-orange-50 text-orange-700 border-orange-200" },
  return_to_previous: { label: "退回上一步", variant: "destructive", className: "bg-orange-50 text-orange-700 border-orange-200" },
  revision_required: { label: "需修改", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

/**
 * 获取状态配置，找不到时返回原始状态文本
 */
export const getStatusLabel = (status: string): StatusConfig => {
  return allStatusConfig[status] || { label: status, variant: "secondary" as const, className: "bg-slate-50 text-slate-500 border-slate-200" };
};
