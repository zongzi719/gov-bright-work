import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Image, Bell, Utensils, BookUser } from "lucide-react";
import { toast } from "sonner";
import BannerManagement from "@/components/admin/BannerManagement";
import NoticeManagement from "@/components/admin/NoticeManagement";
import MenuManagement from "@/components/admin/MenuManagement";
import ContactManagement from "@/components/admin/ContactManagement";

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/admin/login");
      return;
    }

    // 检查管理员权限
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      toast.error("您没有管理员权限");
      await supabase.auth.signOut();
      navigate("/admin/login");
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("已退出登录");
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* 顶部导航 */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold">管</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">内容管理后台</h1>
              <p className="text-xs text-primary-foreground/70">政府一体化工作平台</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="banners" className="space-y-6">
          <TabsList className="bg-card border">
            <TabsTrigger value="banners" className="gap-2">
              <Image className="w-4 h-4" />
              轮播图管理
            </TabsTrigger>
            <TabsTrigger value="notices" className="gap-2">
              <Bell className="w-4 h-4" />
              通知公告
            </TabsTrigger>
            <TabsTrigger value="menus" className="gap-2">
              <Utensils className="w-4 h-4" />
              食堂菜谱
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <BookUser className="w-4 h-4" />
              通讯录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="banners">
            <BannerManagement />
          </TabsContent>

          <TabsContent value="notices">
            <NoticeManagement />
          </TabsContent>

          <TabsContent value="menus">
            <MenuManagement />
          </TabsContent>

          <TabsContent value="contacts">
            <ContactManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
