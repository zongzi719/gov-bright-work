import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Image, Bell, Utensils, BookUser, CalendarClock, Package, Calendar, Settings, Star, CalendarDays, ClipboardCheck, FileSearch, KeyRound, User, ExternalLink } from "lucide-react";
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
import AdminPasswordChangeDialog from "@/components/admin/AdminPasswordChangeDialog";
import AuditLogManagement from "@/components/admin/AuditLogManagement";
import SessionLockScreen from "@/components/admin/SessionLockScreen";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { isOfflineMode } from "@/lib/offlineApi";

const ADMIN_ROLE_IDS = ['admin', 'sys_admin', 'security_admin', 'audit_admin'];

const ROLE_LABELS: Record<string, string> = {
  admin: '超级管理员',
  sys_admin: '系统管理员',
  security_admin: '安全保密管理员',
  audit_admin: '安全审计员',
};

interface TabConfig {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const TAB_CONFIG: TabConfig[] = [
  { value: 'banners', label: '轮播图管理', icon: Image, roles: ['admin', 'sys_admin'] },
  { value: 'notices', label: '通知公告', icon: Bell, roles: ['admin', 'sys_admin'] },
  { value: 'menus', label: '食堂菜谱', icon: Utensils, roles: ['admin', 'sys_admin'] },
  { value: 'contacts', label: '通讯录', icon: BookUser, roles: ['admin', 'sys_admin'] },
  { value: 'absence', label: '外出管理', icon: CalendarClock, roles: ['admin', 'sys_admin'] },
  { value: 'leave-balance', label: '假期管理', icon: Calendar, roles: ['admin', 'sys_admin'] },
  { value: 'supplies', label: '办公用品', icon: Package, roles: ['admin', 'sys_admin'] },
  { value: 'schedules', label: '日程管理', icon: CalendarDays, roles: ['admin', 'sys_admin'] },
  { value: 'leader-schedule', label: '领导日程', icon: Star, roles: ['admin', 'sys_admin'] },
  { value: 'approval', label: '审批设置', icon: ClipboardCheck, roles: ['admin', 'security_admin'] },
  { value: 'system', label: '系统管理', icon: Settings, roles: ['admin', 'security_admin'] },
  { value: 'audit', label: '操作日志', icon: FileSearch, roles: ['admin', 'security_admin', 'audit_admin'] },
];

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (isOfflineMode()) {
      const storedAdmin = localStorage.getItem('adminUser');
      if (!storedAdmin) {
        navigate("/admin/login");
        return;
      }
      try {
        const adminUser = JSON.parse(storedAdmin);
        if (adminUser?.role === 'admin') {
          setUserRoles(['admin']);
          setUserName(adminUser.name || '管理员');
          setLoading(false);
          return;
        }
        if (adminUser?.roles && Array.isArray(adminUser.roles) && adminUser.roles.length > 0) {
          setUserRoles(adminUser.roles);
          setUserName(adminUser.name || '管理员');
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem('adminUser');
      }
      navigate("/admin/login");
      return;
    }

    // Online mode
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ADMIN_ROLE_IDS);

    if (!roleData?.length) {
      toast.error("您没有管理员权限");
      await supabase.auth.signOut();
      navigate("/admin/login");
      return;
    }

    let roles = roleData.map(r => r.role);

    // For non-admin roles, check if the role is active (blocking check)
    if (!roles.includes('admin')) {
      const { data: activeRoles } = await supabase
        .from("roles")
        .select("name")
        .in("name", roles)
        .eq("is_active", true);

      const activeRoleNames = activeRoles?.map(r => r.name) || [];
      roles = roles.filter(r => activeRoleNames.includes(r));

      if (!roles.length) {
        toast.error("您的管理员角色当前未激活，请联系超级管理员");
        await supabase.auth.signOut();
        navigate("/admin/login");
        return;
      }
    }

    // Read stored session info for display name
    const storedSession = localStorage.getItem('adminSession');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        setUserName(session.name || user.email || '管理员');
      } catch {
        setUserName(user.email || '管理员');
      }
    } else {
      setUserName(user.email || '管理员');
    }

    setUserRoles(roles);
    setLoading(false);
  };

  const handleLogout = async () => {
    await logAudit({ action: AUDIT_ACTIONS.LOGOUT, module: AUDIT_MODULES.AUTH });
    if (isOfflineMode()) {
      localStorage.removeItem('adminUser');
    } else {
      await supabase.auth.signOut();
      localStorage.removeItem('adminSession');
    }
    toast.success("已退出登录");
    navigate("/admin/login");
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    if (isOfflineMode()) {
      toast.error("离线模式暂不支持修改密码");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("密码修改失败：" + error.message);
      return;
    }

    await logAudit({ action: AUDIT_ACTIONS.PASSWORD_CHANGE, module: AUDIT_MODULES.AUTH });
    toast.success("密码修改成功，请重新登录");
    setPasswordDialogOpen(false);
    await supabase.auth.signOut();
    localStorage.removeItem('adminSession');
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!userRoles.length) {
    return null;
  }

  const allowedTabs = TAB_CONFIG.filter(tab =>
    tab.roles.some(role => userRoles.includes(role))
  );

  const defaultTab = allowedTabs[0]?.value || 'banners';

  const roleLabel = userRoles.map(r => ROLE_LABELS[r]).filter(Boolean).join('、') || '管理员';

  const renderTabContent = (value: string) => {
    switch (value) {
      case 'banners': return <BannerManagement />;
      case 'notices': return (
        <div className="space-y-4">
          <NoticeImageManagement />
          <NoticeManagement />
        </div>
      );
      case 'menus': return <MenuManagement />;
      case 'contacts': return <ContactManagement />;
      case 'absence': return <AbsenceManagement />;
      case 'leave-balance': return <LeaveBalanceManagement />;
      case 'supplies': return <SupplyManagement />;
      case 'schedules': return <ScheduleManagement />;
      case 'leader-schedule': return <LeaderScheduleManagement />;
      case 'approval': return <ApprovalSettings />;
      case 'system': return <SystemManagement />;
      case 'audit': return <AuditLogManagement />;
      default: return null;
    }
  };

  return (
    <div className="h-screen bg-muted flex flex-col overflow-hidden">
      {/* 顶部导航 */}
      <header className="bg-primary text-primary-foreground shadow-md flex-shrink-0">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-foreground/20 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold">管</span>
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">内容管理后台</h1>
              <p className="text-[10px] text-primary-foreground/70">
                政府一体化工作平台
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 用户信息 */}
            <div className="flex items-center gap-2 text-primary-foreground/90">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{userName}</span>
              <span className="text-xs text-primary-foreground/60 border border-primary-foreground/30 rounded px-1.5 py-0.5">
                {roleLabel}
              </span>
            </div>

            <div className="w-px h-5 bg-primary-foreground/30" />

            {/* 修改密码 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPasswordDialogOpen(true)}
              className="text-primary-foreground hover:bg-primary-foreground/10 h-8"
            >
              <KeyRound className="w-4 h-4 mr-1" />
              修改密码
            </Button>

            {/* 退出登录 */}
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
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
          <div className="bg-muted px-4 py-2 flex-shrink-0 border-b">
            <div className="container mx-auto">
              <TabsList className="bg-card border h-9">
                {allowedTabs.map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-3">
              {allowedTabs.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="mt-0">
                  {renderTabContent(tab.value)}
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      </main>

      {/* 修改密码对话框 */}
      <AdminPasswordChangeDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={handlePasswordChange}
      />

      {/* 会话超时锁屏 */}
      <SessionLockScreen
        userName={userName}
        timeoutMinutes={15}
        onUnlock={() => {}}
        onForceLogout={handleLogout}
      />
    </div>
  );
};

export default Admin;
