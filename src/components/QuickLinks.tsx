import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, ShoppingCart, BookUser, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as dataAdapter from "@/lib/dataAdapter";

// 内置业务类型（已有硬编码页面的）
const BUILTIN_BUSINESS_TYPES = [
  "business_trip", "leave", "out", 
  "supply_requisition", "purchase_request", "supply_purchase",
  "absence", "external_approval",
];

interface CustomTemplate {
  id: string;
  name: string;
  icon: string;
  business_type: string;
  is_active: boolean;
}

const QuickLinks = () => {
  const navigate = useNavigate();
  const [hasLeaderSchedulePermission, setHasLeaderSchedulePermission] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);

  useEffect(() => {
    checkLeaderSchedulePermission();
    loadCustomTemplates();
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

      const { data, error } = await dataAdapter.checkLeaderSchedulePermission(userId);

      if (error) {
        console.error("查询权限失败:", error);
        setHasLeaderSchedulePermission(false);
        return;
      }

      if (data?.has_permission) {
        setHasLeaderSchedulePermission(true);
        return;
      }

      setHasLeaderSchedulePermission(false);
    } catch (e) {
      console.error("检查领导日程权限失败:", e);
      setHasLeaderSchedulePermission(false);
    }
  };

  const loadCustomTemplates = async () => {
    try {
      const { data, error } = await dataAdapter.getApprovalTemplates();
      if (error || !data) return;

      // Filter to only custom templates (not built-in types)
      const custom = (data as CustomTemplate[]).filter(
        t => t.is_active && !BUILTIN_BUSINESS_TYPES.includes(t.business_type)
      );
      setCustomTemplates(custom);
    } catch (e) {
      console.error("加载自定义审批模板失败:", e);
    }
  };

  const baseModules = [
    {
      id: "1",
      name: "出差申请",
      color: "bg-primary",
      icon: Briefcase,
      path: "/absence?tab=business-trip",
    },
    {
      id: "2",
      name: "请假申请",
      color: "bg-orange-500",
      icon: CalendarOff,
      path: "/absence?tab=leave",
    },
    {
      id: "3",
      name: "外出申请",
      color: "bg-purple-500",
      icon: LogOutIcon,
      path: "/absence?tab=out",
    },
    {
      id: "4",
      name: "领用申请",
      color: "bg-emerald-500",
      icon: Package,
      path: "/procurement?tab=requisition",
    },
    {
      id: "5",
      name: "采购申请",
      color: "bg-blue-500",
      icon: ShoppingCart,
      path: "/procurement?tab=purchase",
    },
    {
      id: "6",
      name: "办公采购",
      color: "bg-teal-500",
      icon: Package,
      path: "/procurement?tab=supplies-purchase",
    },
    {
      id: "7",
      name: "通讯录",
      color: "bg-cyan-500",
      icon: BookUser,
      path: "/contacts",
    },
  ];

  const leaderScheduleModule = {
    id: "8",
    name: "领导日程",
    color: "bg-amber-500",
    icon: Star,
    path: "/leader-schedule",
  };

  // 动态生成自定义模板入口
  const customModules = customTemplates.map(t => ({
    id: `custom-${t.id}`,
    name: t.name,
    color: "bg-indigo-500",
    icon: FileText,
    path: `/approval/${t.id}`,
    emoji: t.icon,
  }));

  const allModules = [
    ...baseModules,
    ...(hasLeaderSchedulePermission ? [leaderScheduleModule] : []),
    ...customModules,
  ];

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
        <h2 className="gov-card-title text-sm md:text-base">应用导航</h2>
      </div>

      {/* 模块网格 */}
      <div className="p-3 md:p-4 flex-1 flex items-center justify-center">
        <div className="w-full flex flex-wrap -mx-1.5 md:-mx-2">
          {allModules.map((module) => (
            <div key={module.id} className="w-1/4 px-1.5 md:px-2 mb-3 md:mb-4">
              <div className="app-icon cursor-pointer group h-full" onClick={() => navigate(module.path)}>
                {'emoji' in module && (module as any).emoji ? (
                  <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform w-10 h-10 md:w-14 md:h-14 text-lg md:text-2xl`}>
                    {String((module as any).emoji)}
                  </div>
                ) : 'icon' in module && module.icon ? (
                  <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform w-10 h-10 md:w-14 md:h-14`}>
                    <module.icon className="w-5 h-5 md:w-7 md:h-7" />
                  </div>
                ) : (
                  <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform w-10 h-10 md:w-14 md:h-14`}>
                    <FileText className="w-5 h-5 md:w-7 md:h-7" />
                  </div>
                )}
                <span className="text-xs md:text-base text-muted-foreground text-center leading-tight">{module.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickLinks;
