import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, ShoppingCart, BookUser } from "lucide-react";

const QuickLinks = () => {
  const openInNewWindow = (path: string) => {
    window.open(path, "_blank");
  };

  const modules = [
    {
      id: 1,
      name: "出差申请",
      color: "bg-primary",
      icon: Briefcase,
      onClick: () => openInNewWindow("/businesstrip"),
    },
    {
      id: 2,
      name: "请假申请",
      color: "bg-orange-500",
      icon: CalendarOff,
      onClick: () => openInNewWindow("/leave"),
    },
    {
      id: 3,
      name: "外出申请",
      color: "bg-purple-500",
      icon: LogOutIcon,
      onClick: () => openInNewWindow("/out"),
    },
    {
      id: 4,
      name: "领用申请",
      color: "bg-emerald-500",
      icon: Package,
      onClick: () => openInNewWindow("/requisition"),
    },
    {
      id: 5,
      name: "采购申请",
      color: "bg-blue-500",
      icon: ShoppingCart,
      onClick: () => openInNewWindow("/purchase"),
    },
    {
      id: 6,
      name: "通讯录",
      color: "bg-cyan-500",
      icon: BookUser,
      onClick: () => openInNewWindow("/contacts"),
    },
    {
      id: 7,
      name: "领导日程",
      color: "bg-amber-500",
      icon: Star,
      onClick: () => openInNewWindow("/leader-schedule"),
    },
  ];

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">快捷入口</h2>
      </div>

      {/* 模块网格 */}
      <div className="p-4 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-4 w-full">
          {modules.map((module) => (
            <div
              key={module.id}
              className="app-icon cursor-pointer group"
              onClick={module.onClick}
            >
              <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform w-11 h-11`}>
                <module.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground text-center leading-tight">
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
