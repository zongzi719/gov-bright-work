import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/offlineApi";

interface AuditLogEntry {
  operator_id: string;
  operator_name: string;
  operator_role?: string;
  action: string;
  module: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  detail?: Record<string, any>;
}

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).GOV_CONFIG?.API_BASE_URL) {
    return (window as any).GOV_CONFIG.API_BASE_URL;
  }
  return 'http://localhost:3001';
};

const getOperatorInfo = (): { id: string; name: string; role: string } => {
  // Try admin session first
  const adminSession = localStorage.getItem('adminSession');
  if (adminSession) {
    try {
      const session = JSON.parse(adminSession);
      return {
        id: session.userId || 'unknown',
        name: session.name || '管理员',
        role: session.roles?.[0] || 'admin',
      };
    } catch { /* ignore */ }
  }

  // Try offline admin
  const adminUser = localStorage.getItem('adminUser');
  if (adminUser) {
    try {
      const user = JSON.parse(adminUser);
      return {
        id: user.id || 'unknown',
        name: user.name || '管理员',
        role: user.roles?.[0] || user.role || 'admin',
      };
    } catch { /* ignore */ }
  }

  return { id: 'unknown', name: '未知', role: 'unknown' };
};

export const logAudit = async (entry: Omit<AuditLogEntry, 'operator_id' | 'operator_name' | 'operator_role'> & Partial<Pick<AuditLogEntry, 'operator_id' | 'operator_name' | 'operator_role'>>) => {
  try {
    const operator = getOperatorInfo();
    const logEntry = {
      operator_id: entry.operator_id || operator.id,
      operator_name: entry.operator_name || operator.name,
      operator_role: entry.operator_role || operator.role,
      action: entry.action,
      module: entry.module,
      target_type: entry.target_type || null,
      target_id: entry.target_id || null,
      target_name: entry.target_name || null,
      detail: entry.detail || {},
      ip_address: null,
      user_agent: navigator.userAgent?.substring(0, 500) || null,
    };

    if (isOfflineMode()) {
      const baseUrl = getApiBaseUrl();
      await fetch(`${baseUrl}/api/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      }).catch(() => { /* silently fail */ });
    } else {
      await supabase.from('audit_logs' as any).insert(logEntry as any);
    }
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

// Action constants
export const AUDIT_ACTIONS = {
  LOGIN: '登录',
  LOGOUT: '退出登录',
  PASSWORD_CHANGE: '修改密码',
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '删除',
  VIEW: '查看',
  APPROVE: '审批通过',
  REJECT: '审批驳回',
  ROLE_ASSIGN: '分配角色',
  ROLE_REMOVE: '移除角色',
  EXPORT: '导出',
} as const;

export const AUDIT_MODULES = {
  AUTH: '认证管理',
  BANNER: '轮播图管理',
  NOTICE: '通知公告',
  MENU: '食堂菜谱',
  CONTACT: '通讯录管理',
  ABSENCE: '外出管理',
  LEAVE: '假期管理',
  SUPPLY: '办公用品',
  SCHEDULE: '日程管理',
  LEADER_SCHEDULE: '领导日程',
  APPROVAL: '审批设置',
  SYSTEM: '系统管理',
  ROLE: '角色管理',
  PERMISSION: '权限管理',
} as const;
