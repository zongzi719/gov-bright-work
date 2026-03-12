import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { LogIn, Shield } from "lucide-react";
import { offlineApi, isOfflineMode } from "@/lib/offlineApi";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

const WS_URL = "ws://127.0.0.1:30318/";
const WS_TIMEOUT = 15000; // 15秒超时

/**
 * 通过 WebSocket 连接本地安全客户端获取 SSO 票据
 * 协议：发送含 challenge 的 XML，接收含 tokeninfo 的 XML 响应
 */
function getTicketViaWebSocket(challenge: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      reject(new Error("无法连接本地安全客户端，请确认客户端已启动"));
      return;
    }

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("连接安全客户端超时，请检查客户端是否正常运行"));
    }, WS_TIMEOUT);

    ws.onopen = () => {
      console.log("[SSO WebSocket] 已连接安全客户端");
      const requestXml = `<?xml version="1.0" encoding="UTF-8"?><getsignandtokenreq version="1"><challenge>${challenge}</challenge></getsignandtokenreq>`;
      ws.send(requestXml);
      console.log("[SSO WebSocket] 已发送 challenge");
    };

    ws.onmessage = (evt) => {
      clearTimeout(timer);
      const responseXml = evt.data as string;
      console.log("[SSO WebSocket] 收到响应:", responseXml.substring(0, 200));

      // 解析 <result> 值
      const resultMatch = responseXml.match(/<result>(\d+)<\/result>/);
      const result = resultMatch ? resultMatch[1] : "";

      if (result !== "0") {
        // 失败：提取错误信息
        const errorMatch = responseXml.match(/<errorinfo>([\s\S]*?)<\/errorinfo>/);
        const errorMsg = errorMatch ? errorMatch[1] : "未知错误";
        ws.close();
        reject(new Error(`安全客户端返回错误: ${errorMsg}`));
        return;
      }

      // 成功：提取 tokeninfo 作为 identityticket
      const tokenMatch = responseXml.match(/<tokeninfo>([\s\S]*?)<\/tokeninfo>/);
      if (!tokenMatch || !tokenMatch[1]) {
        ws.close();
        reject(new Error("安全客户端返回的票据数据为空"));
        return;
      }

      console.log("[SSO WebSocket] 获取票据成功, 长度:", tokenMatch[1].length);
      ws.close();
      resolve(tokenMatch[1]);
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      console.error("[SSO WebSocket] 连接错误:", err);
      reject(new Error("无法连接本地安全客户端，请确认客户端已启动并运行在端口 30318"));
    };

    ws.onclose = () => {
      clearTimeout(timer);
    };
  });
}

const Login = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [autoSsoAttempted, setAutoSsoAttempted] = useState(false);
  const [autoSsoChecking, setAutoSsoChecking] = useState(() => isOfflineMode());
  const ssoTriggeredRef = useRef(false);

  // 保存用户信息并跳转
  const saveUserAndRedirect = (userData: any) => {
    localStorage.setItem("frontendUser", JSON.stringify(userData));
    toast({
      title: "登录成功",
      description: `欢迎回来，${userData.name}`,
    });
    navigate("/");
  };

  // 检测本地 UKey 是否已插入（通过 WebSocket 快速探测）
  const checkUKeyPresence = (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(WS_URL);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 3000); // 3秒快速超时

        ws.onopen = () => {
          clearTimeout(timer);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  };

  // 页面加载时自动尝试 SSO 登录（离线模式下）
  useEffect(() => {
    if (!isOfflineMode() || ssoTriggeredRef.current) return;
    ssoTriggeredRef.current = true;

    const autoLogin = async () => {
      try {
        const hasKey = await checkUKeyPresence();
        if (hasKey) {
          console.log("[SSO] 检测到 UKey，自动触发单点登录...");
          setAutoSsoChecking(false);
          // 延迟一帧确保状态更新后再触发
          setTimeout(() => handleSsoLogin(), 0);
        } else {
          console.log("[SSO] 未检测到 UKey，显示登录页面");
          setAutoSsoChecking(false);
          setAutoSsoAttempted(true);
        }
      } catch {
        setAutoSsoChecking(false);
        setAutoSsoAttempted(true);
      }
    };

    autoLogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // SSO 单点登录
  const handleSsoLogin = async () => {
    setSsoLoading(true);
    try {
      // 第1步：获取随机数
      const challengeResult = await offlineApi.ssoGetChallenge();
      if (challengeResult.error || !challengeResult.data) {
        throw new Error(challengeResult.error?.message || "获取随机数失败");
      }

      // 响应格式: { code: 0, data: "challenge_string" }
      const challenge = typeof challengeResult.data === 'object' 
        ? (challengeResult.data as any).data || (challengeResult.data as any).challenge
        : challengeResult.data;

      if (!challenge) {
        throw new Error("获取随机数失败：返回数据为空");
      }

      console.log("[SSO] 获取随机数成功:", challenge);

      // 第2步：WebSocket 连接本地安全客户端获取票据
      console.log("[SSO] 正在通过 WebSocket 连接本地安全客户端...");
      const identityticket = await getTicketViaWebSocket(challenge);

      // 第3步：验证票据
      const verifyResult = await offlineApi.ssoVerifyTicket(challenge, identityticket);
      if (verifyResult.error || !verifyResult.data) {
        throw new Error(verifyResult.error?.message || "票据验证失败");
      }

      const responseData = verifyResult.data as any;
      const isSuccess = responseData?.success === true || responseData?.code === 0;
      const user = responseData?.user || responseData?.data?.user;

      if (!isSuccess || !user) {
        throw new Error(responseData?.error || responseData?.message || "SSO 验证失败");
      }

      // SSO 登录标记登录方式
      localStorage.setItem("loginMethod", "sso");
      saveUserAndRedirect({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        position: user.position,
        department: user.department,
        organization: user.organization,
        organization_id: user.organization_id,
        security_level: user.security_level || "一般",
        is_leader: user.is_leader || false,
      });
    } catch (err: any) {
      console.error("[SSO] 登录失败:", err);
      toast({
        title: "SSO 登录失败",
        description: err.message || "请确认安全客户端已启动",
        variant: "destructive",
      });
    } finally {
      setSsoLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mobile.trim() || !password.trim()) {
      toast({
        title: "请填写完整信息",
        description: "手机号和密码不能为空",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let userData: any = null;

      if (isOfflineMode()) {
        const { data, error } = await offlineApi.login(mobile.trim(), password);
        if (error || !data || data.length === 0) {
          toast({ title: "登录失败", description: error?.message || "手机号或密码错误", variant: "destructive" });
          return;
        }
        const user = data[0];
        userData = {
          id: user.id, name: user.name, mobile: user.mobile,
          position: user.position, department: user.department,
          organization: user.organization_name, organization_id: user.organization_id,
          security_level: user.security_level || "一般", is_leader: user.is_leader || false,
        };
      } else {
        const { data, error } = await supabase.rpc("verify_contact_login", {
          p_mobile: mobile.trim(), p_password: password,
        });
        if (error) { toast({ title: "登录失败", description: "系统错误，请稍后重试", variant: "destructive" }); return; }
        if (!data || data.length === 0) { toast({ title: "登录失败", description: "手机号或密码错误", variant: "destructive" }); return; }
        const user = data[0];
        const { data: contactData } = await supabase.from("contacts").select("is_leader").eq("id", user.contact_id).single();
        userData = {
          id: user.contact_id, name: user.contact_name, mobile: user.contact_mobile,
          position: user.contact_position, department: user.contact_department,
          organization: user.organization_name, organization_id: user.contact_organization_id,
          security_level: user.contact_security_level || "一般", is_leader: contactData?.is_leader || false,
        };
      }

      // 账号密码登录标记登录方式
      localStorage.setItem("loginMethod", "password");
      saveUserAndRedirect(userData);
    } catch (err) {
      console.error("Login error:", err);
      toast({ title: "登录失败", description: "系统错误，请稍后重试", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 自动 SSO 检测中，显示加载页面
  if (autoSsoChecking || (ssoLoading && !autoSsoAttempted)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl">党政办公平台</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {autoSsoChecking ? "正在检测安全客户端..." : "正在进行身份认证，请稍候..."}
            </p>
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary text-2xl font-bold">政</span>
          </div>
          <CardTitle className="text-2xl">党政办公平台</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* SSO 单点登录按钮 - 仅离线模式显示 */}
          {isOfflineMode() && (
            <>
              <Button
                type="button"
                variant="default"
                className="w-full h-12 text-base"
                disabled={ssoLoading}
                onClick={handleSsoLogin}
              >
                {ssoLoading ? (
                  "SSO 登录中..."
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
                    信任体系单点登录
                  </>
                )}
              </Button>
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                  或使用账号密码
                </span>
              </div>
            </>
          )}

          {/* 账号密码登录 */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mobile">账号</Label>
              <Input
                id="mobile" type="tel" placeholder="请输入账号"
                value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password" type="password" placeholder="请输入密码"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
              />
            </div>
            <Button type="submit" variant={isOfflineMode() ? "outline" : "default"} className="w-full" disabled={loading}>
              {loading ? "登录中..." : (<><LogIn className="w-4 h-4 mr-2" />登录</>)}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">默认密码：123456</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
