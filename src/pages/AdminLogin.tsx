import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { isOfflineMode } from "@/lib/offlineApi";

const ADMIN_ROLE_IDS = ['admin', 'sys_admin', 'security_admin', 'audit_admin'];

const ROLE_LABELS: Record<string, string> = {
  admin: '超级管理员',
  sys_admin: '系统管理员',
  security_admin: '安全保密管理员',
  audit_admin: '安全审计员',
};

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).GOV_CONFIG?.API_BASE_URL) {
    return (window as any).GOV_CONFIG.API_BASE_URL;
  }
  return 'http://localhost:3001';
};

const AdminLogin = () => {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleOfflineLogin = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error("登录失败：" + (result.error || "账号或密码错误"));
        return;
      }

      localStorage.setItem('adminUser', JSON.stringify(result.admin));
      toast.success("登录成功");
      navigate("/admin");
    } catch (error) {
      console.error('Admin login error:', error);
      toast.error("登录失败：网络错误");
    }
  };

  const resolveEmail = async (input: string): Promise<string> => {
    // If it looks like an email already, use it directly
    if (input.includes('@')) return input;

    // If it's a phone number, look up the contact's email
    const { data } = await supabase
      .from("contacts")
      .select("email")
      .eq("mobile", input)
      .eq("is_active", true)
      .not("email", "is", null)
      .limit(1);

    if (data?.length && data[0].email) {
      return data[0].email;
    }

    // No email found, return input as-is (will fail auth gracefully)
    return input;
  };

  const handleOnlineLogin = async () => {
    // Resolve account to email (handles phone number lookup)
    const email = await resolveEmail(account);

    // Sign in via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("登录失败：账号或密码错误");
      return;
    }

    // Check admin roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .in("role", ADMIN_ROLE_IDS);

    if (!roleData?.length) {
      await supabase.auth.signOut();
      toast.error("您没有管理员权限");
      return;
    }

    let roles = roleData.map(r => r.role);

    // Check if admin role is still active
    if (roles.includes('admin')) {
      const { data: adminRole } = await supabase
        .from("roles")
        .select("is_active")
        .eq("name", "admin")
        .single();

      if (!adminRole?.is_active) {
        roles = roles.filter(r => r !== 'admin');
        if (!roles.length) {
          await supabase.auth.signOut();
          toast.error("超级管理员已停用，请使用三员账号登录");
          return;
        }
      }
    }

    const roleLabel = ROLE_LABELS[roles[0]] || '管理员';
    toast.success(`登录成功，当前身份：${roleLabel}`);
    navigate("/admin");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isOfflineMode()) {
        await handleOfflineLogin();
      } else {
        await handleOnlineLogin();
      }
    } catch {
      toast.error("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="gov-card">
          <div className="p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">管理后台</h1>
              <p className="text-sm text-muted-foreground mt-1">政府一体化工作平台</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account">账号（邮箱/手机号）</Label>
                <Input
                  id="account"
                  type="text"
                  placeholder="请输入邮箱或手机号"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "登录中..." : "登 录"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
