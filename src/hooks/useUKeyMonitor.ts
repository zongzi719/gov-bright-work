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
    // 仅离线模式 + 已登录用户 + SSO登录方式 才启用监控
    const loginMethod = localStorage.getItem("loginMethod");
    if (!isOfflineMode() || !user?.id || loginMethod !== "sso") return;

    loggedOutRef.current = false;
    failCountRef.current = 0;

    const checkUKey = () => {
      if (loggedOutRef.current) return;

      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          ws.close();
          handleFailure();
        }, 4000);

        ws.onopen = () => {
          // 连接成功后，发送探测请求检查 UKey 是否在位
          const probeXml = `<?xml version="1.0" encoding="UTF-8"?><getsignandtokenreq version="1"><challenge>ukey_probe_${Date.now()}</challenge></getsignandtokenreq>`;
          ws.send(probeXml);
        };

        ws.onmessage = (evt) => {
          clearTimeout(timeout);
          const response = evt.data as string;
          const resultMatch = response.match(/<result>(\d+)<\/result>/);
          const result = resultMatch ? resultMatch[1] : "";

          if (result === "0") {
            // UKey 在位，重置失败计数
            failCountRef.current = 0;
            console.log("[UKey Monitor] UKey 在位，状态正常");
          } else {
            // UKey 不在位（安全客户端返回错误码）
            console.log("[UKey Monitor] UKey 不在位，result:", result);
            handleFailure();
          }
          ws.close();
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
        // 清除登录状态，跳转到 /misslogin 页面
        localStorage.removeItem("frontendUser");
        localStorage.removeItem("loginMethod");
        window.location.href = "/#/misslogin";
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
