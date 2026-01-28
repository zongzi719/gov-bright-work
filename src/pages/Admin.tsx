import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Image, Bell, Utensils, BookUser, CalendarClock, Package, Calendar, Settings, Star, CalendarDays, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import BannerManagement from "@/components/admin/BannerManagement";
import NoticeManagement from "@/components/admin/NoticeManagement";
import NoticeImageManagement from "@/components/admin/NoticeImageManagement";
import MenuManagement from "@/components/admin/MenuManagement";
import ContactManagement from "@/components/admin/ContactManagement";
import AbsenceManagement from "@/components/admin/AbsenceManagement";
import LeaveBalanceManagement from "@/components/admin/LeaveBalanceManagement";
import SupplyManagement from "@/components/admin/SupplyManagement";
import SystemManagement from "@/components/admin/SystemManagement";
import LeaderScheduleManagement from "@/components/admin/LeaderScheduleManagement";
import ScheduleManagement from "@/components/admin/ScheduleManagement";
import ApprovalSettings from "@/components/admin/ApprovalSettings";

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
    <div className="h-screen bg-muted flex flex-col overflow-hidden">
      {/* 顶部导航 - 固定 */}
      <header className="bg-primary text-primary-foreground shadow-md flex-shrink-0">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold">管</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">内容管理后台</h1>
              <p className="text-[10px] text-primary-foreground/70">政府一体化工作平台</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/10 h-8"
          >
            <LogOut className="w-4 h-4 mr-1" />
            退出登录
          </Button>
        </div>
      </header>

      {/* 主内容区 - 可滚动 */}
      <main className="flex-1 overflow-hidden">
        <Tabs defaultValue="banners" className="h-full flex flex-col">
          {/* 菜单栏 - 固定 */}
          <div className="bg-muted px-4 py-2 flex-shrink-0 border-b">
            <div className="container mx-auto">
              <TabsList className="bg-card border h-9">
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
                <TabsTrigger value="absence" className="gap-2">
                  <CalendarClock className="w-4 h-4" />
                  外出管理
                </TabsTrigger>
                <TabsTrigger value="leave-balance" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  假期管理
                </TabsTrigger>
                <TabsTrigger value="supplies" className="gap-2">
                  <Package className="w-4 h-4" />
                  办公用品
                </TabsTrigger>
                <TabsTrigger value="schedules" className="gap-2">
                  <CalendarDays className="w-4 h-4" />
                  日程管理
                </TabsTrigger>
                <TabsTrigger value="leader-schedule" className="gap-2">
                  <Star className="w-4 h-4" />
                  领导日程
                </TabsTrigger>
                <TabsTrigger value="approval" className="gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  审批设置
                </TabsTrigger>
                <TabsTrigger value="system" className="gap-2">
                  <Settings className="w-4 h-4" />
                  系统管理
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* 内容区 - 可滚动 */}
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-3">
              <TabsContent value="banners" className="mt-0">
                <BannerManagement />
              </TabsContent>

              <TabsContent value="notices" className="mt-0">
                <div className="space-y-4">
                  <NoticeImageManagement />
                  <NoticeManagement />
                </div>
              </TabsContent>

              <TabsContent value="menus" className="mt-0">
                <MenuManagement />
              </TabsContent>

              <TabsContent value="contacts" className="mt-0">
                <ContactManagement />
              </TabsContent>

              <TabsContent value="absence" className="mt-0">
                <AbsenceManagement />
              </TabsContent>

              <TabsContent value="leave-balance" className="mt-0">
                <LeaveBalanceManagement />
              </TabsContent>

              <TabsContent value="supplies" className="mt-0">
                <SupplyManagement />
              </TabsContent>

              <TabsContent value="schedules" className="mt-0">
                <ScheduleManagement />
              </TabsContent>

              <TabsContent value="leader-schedule" className="mt-0">
                <LeaderScheduleManagement />
              </TabsContent>

              <TabsContent value="approval" className="mt-0">
                <ApprovalSettings />
              </TabsContent>

              <TabsContent value="system" className="mt-0">
                <SystemManagement />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
