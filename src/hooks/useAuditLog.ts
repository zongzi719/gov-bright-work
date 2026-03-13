import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/offlineApi";

interface AuditLogEntry {
  operator_id: string;
  operator_name: string;
  operator_role?: string | null;
  action: string;
  module: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  detail?: Record<string, any>;
}

interface OperatorInfo {
  id: string;
  name: string;
  role: string | null;
}

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined" && (window as any).GOV_CONFIG?.API_BASE_URL) {
    return (window as any).GOV_CONFIG.API_BASE_URL;
  }
  return "http://localhost:3001";
};

const parseStoredJson = <T = any>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const getOperatorInfo = (): OperatorInfo => {
  // Admin session (online)
  const adminSession = parseStoredJson<any>("adminSession");
  if (adminSession) {
    return {
      id: adminSession.userId || "",
      name: adminSession.name || "管理员",
      role: adminSession.roles?.[0] || "admin",
    };
  }

  // Admin session (offline)
  const adminUser = parseStoredJson<any>("adminUser");
  if (adminUser) {
    return {
      id: adminUser.id || "",
      name: adminUser.name || "管理员",
      role: adminUser.roles?.[0] || adminUser.role || "admin",
    };
  }

  // Frontend user
  const frontendUser = parseStoredJson<any>("frontendUser");
  if (frontendUser) {
    return {
      id: frontendUser.id || "",
      name: frontendUser.name || "普通用户",
      role: "user",
    };
  }

  // H5 leader user
  const h5User = parseStoredJson<any>("h5User");
  if (h5User) {
    return {
      id: h5User.id || "",
      name: h5User.name || "移动端用户",
      role: "user",
    };
  }

  return { id: "", name: "", role: null };
};

export const logAudit = async (
  entry: Omit<AuditLogEntry, "operator_id" | "operator_name" | "operator_role"> &
    Partial<Pick<AuditLogEntry, "operator_id" | "operator_name" | "operator_role">>,
) => {
  try {
    const operator = getOperatorInfo();
    const operatorId = entry.operator_id || operator.id;

    // 无有效操作人则不记录，避免 UUID 类型报错
    if (!operatorId) return;

    const logEntry = {
      operator_id: operatorId,
      operator_name: entry.operator_name || operator.name || "未知用户",
      operator_role: entry.operator_role ?? operator.role ?? null,
      action: entry.action,
      module: entry.module,
      target_type: entry.target_type || null,
      target_id: entry.target_id || null,
      target_name: entry.target_name || null,
      detail: entry.detail || {},
      ip_address: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent?.substring(0, 500) || null : null,
    };

    if (isOfflineMode()) {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      }).catch(() => {
        /* silently fail */
      });
    } else {
      const { error } = await supabase.from("audit_logs" as any).insert(logEntry as any);
      if (error) {
        throw error;
      }
    }
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};

// Action constants
export const AUDIT_ACTIONS = {
  LOGIN: "登录",
  LOGOUT: "退出登录",
  PASSWORD_CHANGE: "修改密码",
  CREATE: "新增",
  UPDATE: "修改",
  DELETE: "删除",
  VIEW: "查看",
  APPROVE: "审批通过",
  REJECT: "审批驳回",
  ROLE_ASSIGN: "分配角色",
  ROLE_REMOVE: "移除角色",
  EXPORT: "导出",
  PAGE_VIEW: "页面访问",
  UI_CLICK: "界面操作",
  FORM_SUBMIT: "提交表单",
} as const;

export const AUDIT_MODULES = {
  AUTH: "认证管理",
  BANNER: "轮播图管理",
  NOTICE: "通知公告",
  MENU: "食堂菜谱",
  CONTACT: "通讯录管理",
  ABSENCE: "外出管理",
  LEAVE: "假期管理",
  SUPPLY: "办公用品",
  SCHEDULE: "日程管理",
  LEADER_SCHEDULE: "领导日程",
  APPROVAL: "审批设置",
  SYSTEM: "系统管理",
  ROLE: "角色管理",
  PERMISSION: "权限管理",
  WORKBENCH: "前台工作台",
  TODO: "待办事项",
  MOBILE_DOC: "移动端公文",
} as const;
