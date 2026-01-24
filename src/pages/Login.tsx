import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
      // Query contacts table for matching mobile and password
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, mobile, position, department, organization:organizations(name)")
        .eq("mobile", mobile.trim())
        .eq("password_hash", password)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        toast({
          title: "登录失败",
          description: "手机号或密码错误",
          variant: "destructive",
        });
        return;
      }

      // Store user info in localStorage for session
      const userInfo = {
        id: data.id,
        name: data.name,
        mobile: data.mobile,
        position: data.position,
        department: data.department,
        organization: data.organization?.name,
      };
      localStorage.setItem("frontendUser", JSON.stringify(userInfo));

      toast({
        title: "登录成功",
        description: `欢迎回来，${data.name}`,
      });

      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      toast({
        title: "登录失败",
        description: "系统错误，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary text-2xl font-bold">政</span>
          </div>
          <CardTitle className="text-2xl">一体化政务工作平台</CardTitle>
          <CardDescription>请使用您的手机号登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mobile">手机号</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="请输入手机号"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                disabled={loading}
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
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "登录中..."
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </>
              )}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            默认密码：123456
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
