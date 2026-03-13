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

const resolveModule = (pathname: string): string => {
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
      target_name: pathname,
      detail: { path: pathname, event: "route_change" },
    });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleClick = (event: MouseEvent) => {
      if (!getCurrentOperatorId()) return;

      // 管理后台页面已有语义化日志，跳过通用点击捕捉避免冗余
      if (pathname.startsWith("/admin")) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // 仅捕获带 data-audit-action 的显式标记元素，跳过普通按钮/链接
      const clickable = target.closest<HTMLElement>("[data-audit-action]");
      if (!clickable || clickable.getAttribute("data-audit-ignore") === "true") return;

      const label = normalizeText(clickable.getAttribute("data-audit-action") || "");

      if (!label || label.length > 40 || NOISE_LABELS.has(label)) return;

      emitWithDedupe(`click:${pathname}:${label}`, {
        action: AUDIT_ACTIONS.UI_CLICK,
        module: resolveModule(pathname),
        target_type: "界面操作",
        target_name: label,
        detail: { path: pathname, event: "click" },
      });
    };

    const handleSubmit = (event: Event) => {
      if (!getCurrentOperatorId()) return;

      const form = event.target as HTMLFormElement | null;
      if (!form || form.getAttribute("data-audit-ignore") === "true") return;

      const submitter = (event as SubmitEvent).submitter as HTMLElement | null;
      const label = normalizeText(
        submitter?.textContent || form.getAttribute("aria-label") || form.getAttribute("id") || "表单提交",
      );

      emitWithDedupe(`submit:${pathname}:${label}`, {
        action: AUDIT_ACTIONS.FORM_SUBMIT,
        module: resolveModule(pathname),
        target_type: "表单",
        target_name: label,
        detail: { path: pathname, event: "submit" },
      });
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [pathname]);
};

export default useOperationTracker;
