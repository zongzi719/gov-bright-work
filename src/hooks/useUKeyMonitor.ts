import { useEffect, useRef } from "react";
import { useFrontendAuth } from "./useFrontendAuth";
import { isOfflineMode } from "@/lib/offlineApi";
import { toast } from "@/hooks/use-toast";

const WS_URL = "ws://127.0.0.1:30318/";
const POLL_INTERVAL = 5000; // 5秒轮询
const MAX_FAILURES = 3; // 连续3次失败触发退出

/**
 * 监控 UKey 是否在位，拔出后自动退出登录
 * 仅在离线模式且用户已登录时启用
 */
export const useUKeyMonitor = () => {
  const { user, logout } = useFrontendAuth();
  const failCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggedOutRef = useRef(false);

  useEffect(() => {
    // 仅离线模式 + 已登录用户才启用监控
    if (!isOfflineMode() || !user?.id) return;

    loggedOutRef.current = false;
    failCountRef.current = 0;

    const checkUKey = () => {
      if (loggedOutRef.current) return;

      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          ws.close();
          handleFailure();
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          // 连接成功，重置失败计数
          failCountRef.current = 0;
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          handleFailure();
        };
      } catch {
        handleFailure();
      }
    };

    const handleFailure = () => {
      if (loggedOutRef.current) return;
      failCountRef.current += 1;
      console.log(`[UKey Monitor] 检测失败 ${failCountRef.current}/${MAX_FAILURES}`);

      if (failCountRef.current >= MAX_FAILURES) {
        loggedOutRef.current = true;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        toast({
          title: "安全提示",
          description: "检测到 UKey 已拔出，系统已自动退出登录",
          variant: "destructive",
        });
        logout();
      }
    };

    // 启动轮询
    timerRef.current = setInterval(checkUKey, POLL_INTERVAL);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user?.id, logout]);
};
