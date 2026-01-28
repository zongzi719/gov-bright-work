import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, ShoppingCart, BookUser, FileText, Users, Newspaper, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

      if (user.is_leader) {
        setHasLeaderSchedulePermission(true);
        return;
      }

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

  const baseModules = [
    {
      id: 1,
      name: "出差申请",
      color: "bg-primary",
      icon: Briefcase,
      path: "/businesstrip",
    },
    {
      id: 2,
      name: "请假申请",
      color: "bg-orange-500",
      icon: CalendarOff,
      path: "/leave",
    },
    {
      id: 3,
      name: "外出申请",
      color: "bg-purple-500",
      icon: LogOutIcon,
      path: "/out",
    },
    {
      id: 4,
      name: "领用申请",
      color: "bg-emerald-500",
      icon: Package,
      path: "/requisition",
    },
    {
      id: 5,
      name: "采购申请",
      color: "bg-blue-500",
      icon: ShoppingCart,
      path: "/purchase",
    },
    {
      id: 6,
      name: "通讯录",
      color: "bg-cyan-500",
      icon: BookUser,
      path: "/contacts",
    },
  ];

  const leaderScheduleModule = {
    id: 7,
    name: "领导日程",
    color: "bg-amber-500",
    icon: Star,
    path: "/leader-schedule",
  };

  // 额外的系统应用（占位）
  const additionalModules = [
    { id: 8, name: "公文管理", color: "bg-rose-500", icon: FileText, path: "#" },
    { id: 9, name: "会议管理", color: "bg-indigo-500", icon: Users, path: "#" },
    { id: 10, name: "信息发布", color: "bg-teal-500", icon: Newspaper, path: "#" },
    { id: 11, name: "系统设置", color: "bg-slate-500", icon: Settings, path: "#" },
  ];

  // 根据权限决定是否显示领导日程模块
  const coreModules = hasLeaderSchedulePermission 
    ? [...baseModules, leaderScheduleModule] 
    : baseModules;

  // 合并所有模块，确保显示8个（4x2网格）
  const allModules = [...coreModules, ...additionalModules].slice(0, 8);

  return (
    <div className="gov-card flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">全部应用</h2>
      </div>

      {/* 模块网格 - 4x2 */}
      <div className="p-6">
        <div className="grid grid-cols-4 gap-x-8 gap-y-6">
          {allModules.map((module) => (
            <div
              key={module.id}
              className="app-icon"
              onClick={() => module.path !== "#" && navigate(module.path)}
            >
              <div className={`app-icon-box ${module.color}`}>
                <module.icon className="w-6 h-6" />
              </div>
              <span className="text-sm text-muted-foreground text-center">
                {module.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickLinks;
