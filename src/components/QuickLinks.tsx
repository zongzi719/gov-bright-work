import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, ShoppingCart, BookUser, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as dataAdapter from "@/lib/dataAdapter";

// 内置模块的模板编码（这些模块已有专属页面，不需要动态表单入口）
const BUILTIN_TEMPLATE_CODES = [
  "PROC_MKSAQYT6", // 出差申请
  "PROC_MKTO1ET3", // 请假申请
  "PROC_MKUK42R1", // 外出申请
  "PROC_MKXWIEG6", // 物品领用
  "PROC_MKXVX9VE", // 政府采购申请
  "PROC_MKYO60ON", // 办公采购
];

// 内置模块对应的 business_type，用于匹配模板的可见性设置
const BASE_MODULE_BUSINESS_TYPES: Record<string, string> = {
  "1": "business_trip",
  "2": "leave",
  "3": "out",
  "4": "supply_requisition",
  "5": "purchase_request",
  "6": "supply_purchase",
};

interface CustomTemplate {
  id: string;
  name: string;
  icon: string;
  business_type: string;
  is_active: boolean;
  show_in_nav: boolean;
  code: string;
  nav_visible_scope?: string;
  nav_visible_org_ids?: string[];
  nav_visible_role_names?: string[];
  nav_visible_user_ids?: string[];
}

const QuickLinks = () => {
  const navigate = useNavigate();
  const [hasLeaderSchedulePermission, setHasLeaderSchedulePermission] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<CustomTemplate[]>([]);
  const [userRoleNames, setUserRoleNames] = useState<string[]>([]);

  useEffect(() => {
    checkLeaderSchedulePermission();
    loadTemplates();
    loadUserRoles();
  }, []);

  const getCurrentUser = () => {
    try {
      const storedUser = localStorage.getItem("frontendUser");
      if (!storedUser) return null;
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  };
  const loadUserRoles = async () => {
    const user = getCurrentUser();
    if (!user?.id) return;
    try {
      const { data } = await dataAdapter.getUserRoles(user.id);
      if (data) {
        setUserRoleNames((data as any[]).map(r => r.role));
      }
    } catch {
      // ignore
    }
  };

  const checkLeaderSchedulePermission = async () => {
    try {
      const user = getCurrentUser();
      if (!user?.id) {
        setHasLeaderSchedulePermission(false);
        return;
      }

      if (user.is_leader) {
        setHasLeaderSchedulePermission(true);
        return;
      }

      const { data, error } = await dataAdapter.checkLeaderSchedulePermission(user.id);

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

  const loadTemplates = async () => {
    try {
      const { data, error } = await dataAdapter.getApprovalTemplates();
      if (error || !data) return;

      const templates = data as CustomTemplate[];
      setAllTemplates(templates);

      // 只显示启用了"显示在首页导航"且非内置模板的自定义流程
      const custom = templates.filter(
        t => t.is_active && t.show_in_nav && !BUILTIN_TEMPLATE_CODES.includes(t.code)
      );
      setCustomTemplates(custom);
    } catch (e) {
      console.error("加载自定义审批模板失败:", e);
    }
  };

  // 通用可见性检查
  const checkVisibility = (scope: string, tpl: CustomTemplate): boolean => {
    const user = getCurrentUser();
    if (!user) return true;

    if (scope === "all") return true;
    if (scope === "leader_only") return !!user.is_leader;
    if (scope === "specific_orgs") {
      const orgIds = tpl.nav_visible_org_ids || [];
      return orgIds.length === 0 || orgIds.includes(user.organization_id);
    }
    if (scope === "specific_roles") {
      const roleNames = tpl.nav_visible_role_names || [];
      return roleNames.length === 0 || roleNames.some(r => userRoleNames.includes(r));
    }
    if (scope === "specific_users") {
      const userIds = tpl.nav_visible_user_ids || [];
      return userIds.length === 0 || userIds.includes(user.id);
    }
    return true;
  };

  // 检查模块是否对当前用户可见
  const isModuleVisible = (businessType: string): boolean => {
    const template = allTemplates.find(t => t.business_type === businessType && t.is_active);
    if (!template) return true;
    return checkVisibility(template.nav_visible_scope || "all", template);
  };

  // 检查自定义模块是否对当前用户可见
  const isCustomModuleVisible = (template: CustomTemplate): boolean => {
    return checkVisibility(template.nav_visible_scope || "all", template);
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

  // 过滤基础模块（通讯录和领导日程不受模板控制）
  const visibleBaseModules = baseModules.filter(m => {
    const bt = BASE_MODULE_BUSINESS_TYPES[m.id];
    if (!bt) return true; // 通讯录等没有业务类型的模块始终显示
    return isModuleVisible(bt);
  });

  // 过滤自定义模块
  const visibleCustomModules = customTemplates
    .filter(t => isCustomModuleVisible(t))
    .map(t => ({
      id: `custom-${t.id}`,
      name: t.name,
      color: "bg-indigo-500",
      icon: FileText,
      path: `/approval/${t.id}`,
      emoji: t.icon,
    }));

  const allModules = [
    ...visibleBaseModules,
    ...(hasLeaderSchedulePermission ? [leaderScheduleModule] : []),
    ...visibleCustomModules,
  ];

  return (
    <div className="gov-card h-full flex flex-col">
      <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
        <h2 className="gov-card-title text-sm md:text-base">应用导航</h2>
      </div>

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
