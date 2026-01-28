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
      path: "/absence?tab=business-trip",
    },
    {
      id: 2,
      name: "请假申请",
      color: "bg-orange-500",
      icon: CalendarOff,
      path: "/absence?tab=leave",
    },
    {
      id: 3,
      name: "外出申请",
      color: "bg-purple-500",
      icon: LogOutIcon,
      path: "/absence?tab=out",
    },
    {
      id: 4,
      name: "领用申请",
      color: "bg-emerald-500",
      icon: Package,
      path: "/procurement?tab=requisition",
    },
    {
      id: 5,
      name: "采购申请",
      color: "bg-blue-500",
      icon: ShoppingCart,
      path: "/procurement?tab=purchase",
    },
    {
      id: 6,
      name: "办公采购",
      color: "bg-teal-500",
      icon: Package,
      path: "/procurement?tab=supplies-purchase",
    },
    {
      id: 7,
      name: "通讯录",
      color: "bg-cyan-500",
      icon: BookUser,
      path: "/contacts",
    },
  ];

  const leaderScheduleModule = {
    id: 8,
    name: "领导日程",
    color: "bg-amber-500",
    icon: Star,
    path: "/leader-schedule",
  };

  // 根据权限决定是否显示领导日程模块
  const modules = hasLeaderSchedulePermission ? [...baseModules, leaderScheduleModule] : baseModules;

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">应用导航</h2>
      </div>

      {/* 模块网格 */}
      <div className="p-4 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-6 w-full">
          {modules.map((module) => (
            <div key={module.id} className="app-icon cursor-pointer group" onClick={() => navigate(module.path)}>
              <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform w-14 h-14`}>
                <module.icon className="w-7 h-7" />
              </div>
              <span className="text-base text-muted-foreground text-center leading-tight">{module.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickLinks;
