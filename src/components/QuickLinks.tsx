import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, ShoppingCart, BookUser, Play, MessageSquare, Globe, Building, Users, GraduationCap, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const QuickLinks = () => {
  const navigate = useNavigate();
  const [hasLeaderSchedulePermission, setHasLeaderSchedulePermission] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // 检查当前用户是否有领导日程权限
  useEffect(() => {
    checkLeaderSchedulePermission();
  }, []);

  const checkLeaderSchedulePermission = async () => {
    try {
      // 获取当前登录用户（前台用户基于contacts表）
      const storedUser = localStorage.getItem("frontendUser");
      if (!storedUser) {
        setHasLeaderSchedulePermission(false);
        return;
      }

      const user = JSON.parse(storedUser);
      const userId = user.id;
      
      if (!userId) {
        setHasLeaderSchedulePermission(false);
        return;
      }

      // 检查是否是领导（领导默认可以看领导日程）
      if (user.is_leader) {
        setHasLeaderSchedulePermission(true);
        return;
      }

      // 检查是否有领导日程查看权限
      const { data: permData, error } = await supabase
        .from("leader_schedule_permissions")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (error) {
        console.error("查询权限失败:", error);
        setHasLeaderSchedulePermission(false);
        return;
      }

      if (permData && permData.length > 0) {
        setHasLeaderSchedulePermission(true);
        return;
      }

      setHasLeaderSchedulePermission(false);
    } catch (e) {
      console.error("检查领导日程权限失败:", e);
      setHasLeaderSchedulePermission(false);
    }
  };

  // 个人应用 - 业务功能
  const personalModules = [
    { id: 1, name: "出差申请", color: "bg-primary", icon: Briefcase, path: "/businesstrip" },
    { id: 2, name: "请假申请", color: "bg-orange-500", icon: CalendarOff, path: "/leave" },
    { id: 3, name: "外出申请", color: "bg-purple-500", icon: LogOutIcon, path: "/out" },
    { id: 4, name: "领用申请", color: "bg-emerald-500", icon: Package, path: "/requisition" },
    { id: 5, name: "采购申请", color: "bg-blue-500", icon: ShoppingCart, path: "/purchase" },
    { id: 6, name: "通讯录", color: "bg-cyan-500", icon: BookUser, path: "/contacts" },
  ];

  // 公共应用
  const publicModules = [
    { id: 11, name: "即时通讯", color: "bg-primary", icon: MessageSquare, path: "#" },
    { id: 12, name: "门户网站", color: "bg-primary", icon: Globe, path: "#" },
    { id: 13, name: "业务办公系统", color: "bg-primary", icon: Building, path: "#" },
    { id: 14, name: "党务工作管理", color: "bg-primary", icon: Users, path: "#" },
    { id: 15, name: "干部学习管理", color: "bg-primary", icon: GraduationCap, path: "#" },
    { id: 16, name: "信息管理", color: "bg-primary", icon: FileText, path: "#" },
  ];

  // 领导日程模块
  const leaderScheduleModule = {
    id: 7,
    name: "领导日程",
    color: "bg-amber-500",
    icon: Star,
    path: "/leader-schedule",
  };

  // 全部应用
  const allModules = hasLeaderSchedulePermission 
    ? [...personalModules, leaderScheduleModule, ...publicModules]
    : [...personalModules, ...publicModules];

  const getModulesByTab = () => {
    switch (activeTab) {
      case "personal":
        return hasLeaderSchedulePermission 
          ? [...personalModules, leaderScheduleModule]
          : personalModules;
      case "public":
        return publicModules;
      case "collaborative":
        return [];
      default:
        return allModules;
    }
  };

  const currentModules = getModulesByTab();

  return (
    <div className="gov-card">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">
          <span className="text-foreground">全部</span>
          <span className="text-primary">应用</span>
          <Play className="w-4 h-4 inline-block ml-1 text-primary fill-primary" />
        </h2>
        
        {/* Tab切换 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-transparent gap-1 p-0 h-auto">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1 text-xs rounded"
            >
              全部应用
            </TabsTrigger>
            <TabsTrigger
              value="personal"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1 text-xs rounded"
            >
              个人应用
            </TabsTrigger>
            <TabsTrigger
              value="public"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1 text-xs rounded"
            >
              公共应用
            </TabsTrigger>
            <TabsTrigger
              value="collaborative"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-3 py-1 text-xs rounded"
            >
              协同应用
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 模块网格 */}
      <div className="p-4">
        {currentModules.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            暂无应用
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-4">
            {currentModules.map((module) => (
              <div
                key={module.id}
                className="flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50 hover:shadow-sm group"
                onClick={() => module.path !== "#" && navigate(module.path)}
              >
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${module.color} text-white group-hover:scale-105 transition-transform shadow-sm`}>
                  <module.icon className="w-6 h-6" />
                </div>
                <span className="text-xs text-muted-foreground text-center leading-tight group-hover:text-foreground transition-colors">
                  {module.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickLinks;
