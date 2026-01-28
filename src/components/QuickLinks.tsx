import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, ShoppingCart, BookUser } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const QuickLinks = () => {
  const navigate = useNavigate();
  const [hasLeaderSchedulePermission, setHasLeaderSchedulePermission] = useState(false);

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
      const userId = user.id; // localStorage stores 'id' not 'contact_id'
      
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

  // 根据权限决定是否显示领导日程模块
  const modules = hasLeaderSchedulePermission 
    ? [...baseModules, leaderScheduleModule] 
    : baseModules;

  return (
    <div className="gov-card flex flex-col">
      {/* 标题栏 - 紧凑型 */}
      <div className="px-2 py-1.5 border-b border-border">
        <h2 className="gov-card-title text-base">快捷入口</h2>
      </div>

      {/* 模块网格 - 紧凑型 */}
      <div className="p-2">
        <div className="grid grid-cols-7 gap-2 w-full">
          {modules.map((module) => (
            <div
              key={module.id}
              className="flex flex-col items-center gap-1 p-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => navigate(module.path)}
            >
              <div className={`${module.color} group-hover:scale-105 transition-transform w-9 h-9 flex items-center justify-center rounded-lg text-white`}>
                <module.icon className="w-4 h-4" />
              </div>
              <span className="text-xs text-muted-foreground text-center leading-tight">
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
