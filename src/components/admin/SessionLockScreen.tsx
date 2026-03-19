import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isOfflineMode } from "@/lib/offlineApi";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";

const LOCK_STORAGE_KEY = "admin_session_locked";

interface SessionLockScreenProps {
  userName: string;
  timeoutMinutes?: number;
  onUnlock: () => void;
  onForceLogout: () => void;
}

const SessionLockScreen = ({ userName, timeoutMinutes = 15, onUnlock, onForceLogout }: SessionLockScreenProps) => {
  // Initialize locked state from sessionStorage so refresh doesn't bypass lock
  const [locked, setLocked] = useState(() => sessionStorage.getItem(LOCK_STORAGE_KEY) === "true");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Persist locked state to sessionStorage
  useEffect(() => {
    if (locked) {
      sessionStorage.setItem(LOCK_STORAGE_KEY, "true");
    } else {
      sessionStorage.removeItem(LOCK_STORAGE_KEY);
    }
  }, [locked]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Listen for user activity
  useEffect(() => {
    if (locked) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    // Check idle every 30 seconds
    timerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle > timeoutMinutes * 60 * 1000) {
        setLocked(true);
        logAudit({
          action: '会话锁定',
          module: AUDIT_MODULES.AUTH,
          detail: { reason: `空闲${timeoutMinutes}分钟自动锁定` },
        });
      }
    }, 30000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [locked, timeoutMinutes, resetTimer]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    try {
      if (isOfflineMode()) {
        // Offline: verify via API
        const storedAdmin = localStorage.getItem('adminUser');
        if (storedAdmin) {
          const adminUser = JSON.parse(storedAdmin);
          const baseUrl = typeof window !== 'undefined' && (window as any).GOV_CONFIG?.API_BASE_URL
            ? (window as any).GOV_CONFIG.API_BASE_URL : 'http://localhost:3001';
          const res = await fetch(`${baseUrl}/api/admin/verify-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: adminUser.email || adminUser.account, password }),
          });
          if (res.ok) {
            setLocked(false);
            setPassword("");
            resetTimer();
            onUnlock();
            logAudit({ action: '解锁会话', module: AUDIT_MODULES.AUTH });
            return;
          }
        }
        toast.error("密码验证失败");
      } else {
        // Online: re-authenticate via Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          toast.error("无法获取当前用户信息");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });
        if (error) {
          toast.error("密码验证失败");
          return;
        }
        setLocked(false);
        setPassword("");
        resetTimer();
        onUnlock();
        logAudit({ action: '解锁会话', module: AUDIT_MODULES.AUTH });
      }
    } catch {
      toast.error("验证失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogout = () => {
    sessionStorage.removeItem(LOCK_STORAGE_KEY);
    onForceLogout();
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-card border rounded-xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">屏幕已锁定</h2>
            <p className="text-sm text-muted-foreground mt-1">
              因长时间未操作，请重新验证身份
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{userName}</span>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <Label>请输入密码</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入登录密码解锁"
                autoFocus
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? "验证中..." : "解锁"}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={handleForceLogout}>
              切换账号登录
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SessionLockScreen;
