interface AppItem {
  id: number;
  name: string;
  shortName: string;
  color: string;
}

const apps: AppItem[] = [
  { id: 1, name: "OA办公系统", shortName: "OA", color: "bg-primary" },
  { id: 2, name: "财务管理系统", shortName: "财", color: "bg-emerald-500" },
  { id: 3, name: "人力资源系统", shortName: "人", color: "bg-blue-500" },
  { id: 4, name: "档案管理系统", shortName: "档", color: "bg-purple-500" },
  { id: 5, name: "会议预约系统", shortName: "会", color: "bg-cyan-500" },
  { id: 6, name: "资产管理系统", shortName: "资", color: "bg-orange-500" },
  { id: 7, name: "车辆调度系统", shortName: "车", color: "bg-teal-500" },
  { id: 8, name: "培训学习平台", shortName: "培", color: "bg-pink-500" },
];

const QuickLinks = () => {
  return (
    <div className="gov-card">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">单点登录</h2>
      </div>

      {/* 应用网格 */}
      <div className="p-5">
        <div className="grid grid-cols-4 gap-4">
          {apps.map((app) => (
            <div key={app.id} className="app-icon">
              <div className={`app-icon-box ${app.color}`}>
                {app.shortName}
              </div>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {app.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickLinks;
