import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AUDIT_ACTIONS, AUDIT_MODULES, logAudit } from "@/hooks/useAuditLog";

const DEDUPE_WINDOW_MS = 1500;

type StorageUser = {
  id?: string;
  userId?: string;
  roles?: string[];
};

const safeParse = (raw: string | null): StorageUser | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StorageUser;
  } catch {
    return null;
  }
};

const getCurrentOperatorId = (): string => {
  if (typeof window === "undefined") return "";

  const adminSession = safeParse(localStorage.getItem("adminSession"));
  if (adminSession?.userId) return adminSession.userId;

  const adminUser = safeParse(localStorage.getItem("adminUser"));
  if (adminUser?.id) return adminUser.id;

  const frontendUser = safeParse(localStorage.getItem("frontendUser"));
  if (frontendUser?.id) return frontendUser.id;

  const h5User = safeParse(localStorage.getItem("h5User"));
  if (h5User?.id) return h5User.id;

  return "";
};

const normalizeText = (text: string): string =>
  text.replace(/\s+/g, " ").replace(/[\r\n\t]/g, "").trim();

/** 无实际业务语义的按钮文本，前台也不需要记录 */
const NOISE_LABELS = new Set([
  "取消", "关闭", "返回", "确定", "确认", "搜索",
  "重置", "展开", "收起", "上一页", "下一页",
  "提交", "保存", "新建", "编辑", "删除", // 这些由语义化日志覆盖
]);

const PAGE_NAME_MAP: Record<string, string> = {
  "/": "前台工作台",
  "/todo": "待办事项",
  "/businesstrip": "出差申请",
  "/leave": "请假申请",
  "/out": "外出申请",
  "/absence": "考勤管理",
  "/requisition": "领用申请",
  "/purchase": "采购申请",
  "/supplies-purchase": "办公用品采购",
  "/procurement": "物资申请",
  "/contacts": "通讯录",
  "/leader-schedule": "领导日程",
  "/schedule-list": "日程列表",
  "/login": "前台登录",
  "/admin/login": "管理后台登录",
  "/admin": "管理后台",
  "/h5/login": "移动端登录",
  "/h5/official-document": "移动端公文",
};

const resolvePageName = (pathname: string): string => {
  // 精确匹配
  if (PAGE_NAME_MAP[pathname]) return PAGE_NAME_MAP[pathname];
  // 前缀匹配（取最长匹配）
  const sorted = Object.keys(PAGE_NAME_MAP).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(key) && key !== "/") return PAGE_NAME_MAP[key];
  }
  return PAGE_NAME_MAP["/"] || pathname;
};

const resolveModule = (pathname: string): string => {
  if (pathname.startsWith("/admin/login")) return AUDIT_MODULES.AUTH;
  if (pathname.startsWith("/admin")) return AUDIT_MODULES.SYSTEM;
  if (pathname === "/") return AUDIT_MODULES.WORKBENCH;
  if (pathname.startsWith("/todo")) return AUDIT_MODULES.TODO;
  if (pathname.startsWith("/businesstrip")) return AUDIT_MODULES.ABSENCE;
  if (pathname.startsWith("/leave")) return AUDIT_MODULES.LEAVE;
  if (pathname.startsWith("/out") || pathname.startsWith("/absence")) return AUDIT_MODULES.ABSENCE;
  if (
    pathname.startsWith("/requisition") ||
    pathname.startsWith("/purchase") ||
    pathname.startsWith("/supplies-purchase") ||
    pathname.startsWith("/procurement")
  ) {
    return AUDIT_MODULES.SUPPLY;
  }
  if (pathname.startsWith("/contacts")) return AUDIT_MODULES.CONTACT;
  if (pathname.startsWith("/leader-schedule")) return AUDIT_MODULES.LEADER_SCHEDULE;
  if (pathname.startsWith("/schedule-list")) return AUDIT_MODULES.SCHEDULE;
  if (pathname.startsWith("/h5")) return AUDIT_MODULES.MOBILE_DOC;
  if (pathname.includes("login")) return AUDIT_MODULES.AUTH;
  return AUDIT_MODULES.SYSTEM;
};

const useOperationTracker = () => {
  const { pathname } = useLocation();
  const dedupeRef = useRef<Record<string, number>>({});

  const emitWithDedupe = (key: string, payload: Parameters<typeof logAudit>[0]) => {
    const now = Date.now();
    const lastTs = dedupeRef.current[key] || 0;
    if (now - lastTs < DEDUPE_WINDOW_MS) return;

    dedupeRef.current[key] = now;
    void logAudit(payload);
  };

  useEffect(() => {
    const operatorId = getCurrentOperatorId();
    if (!operatorId) return;

    emitWithDedupe(`view:${pathname}`, {
      action: AUDIT_ACTIONS.PAGE_VIEW,
      module: resolveModule(pathname),
      target_type: "页面",
      target_name: resolvePageName(pathname),
      detail: { path: pathname, event: "route_change" },
    });
  }, [pathname]);

  // 不再自动捕获通用点击和表单提交——所有增删改查由各业务组件的语义化 logAudit 覆盖
  // useOperationTracker 仅负责页面访问记录
};

export default useOperationTracker;
