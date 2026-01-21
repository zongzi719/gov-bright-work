import { useState } from "react";
import { ChevronRight } from "lucide-react";

interface TodoItem {
  id: number;
  title: string;
  system: string;
  department: string;
  time: string;
  status: "urgent" | "normal" | "done";
}

const todoItems: TodoItem[] = [
  {
    id: 1,
    title: "关于2025年度工作总结的审批",
    system: "OA办公系统",
    department: "办公室",
    time: "2026-01-12 09:30",
    status: "urgent",
  },
  {
    id: 2,
    title: "关于开展安全检查的通知传阅",
    system: "公文系统",
    department: "安保部",
    time: "2026-01-11 14:20",
    status: "urgent",
  },
  {
    id: 3,
    title: "周工作例会会议纪要确认",
    system: "会议系统",
    department: "综合科",
    time: "2026-01-10 16:15",
    status: "normal",
  },
  {
    id: 4,
    title: "12月办公经费报销审核",
    system: "财务系统",
    department: "财务部",
    time: "2026-01-09 10:00",
    status: "normal",
  },
  {
    id: 5,
    title: "2026年人员考勤统计确认",
    system: "人力系统",
    department: "人事部",
    time: "2026-01-08 11:20",
    status: "normal",
  },
  {
    id: 6,
    title: "2025年档案归档审核",
    system: "档案系统",
    department: "档案科",
    time: "2026-01-07 09:15",
    status: "done",
  },
  {
    id: 7,
    title: "办公设备盘点确认",
    system: "资产系统",
    department: "行政部",
    time: "2026-01-06 14:30",
    status: "urgent",
  },
];

const TodoList = () => {
  const [selectedId, setSelectedId] = useState<number>(1);
  const unreadCount = todoItems.filter((item) => item.status !== "done").length;

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="gov-card-title">待办事项</h2>
          <span className="gov-badge">{unreadCount}</span>
        </div>
        <button className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          更多
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 待办列表 */}
      <div className="flex-1 overflow-y-auto">
        {todoItems.map((item) => (
          <div
            key={item.id}
            className={`relative px-5 py-4 cursor-pointer transition-all border-l-3 ${
              selectedId === item.id
                ? "bg-primary/5 border-l-primary"
                : "border-l-transparent hover:bg-muted/50"
            }`}
            onClick={() => setSelectedId(item.id)}
          >
            <div className="flex items-start gap-3">
              {/* 状态圆点 */}
              <div
                className={`status-dot mt-1.5 ${
                  item.status === "urgent"
                    ? "status-dot-urgent"
                    : item.status === "normal"
                    ? "status-dot-normal"
                    : "status-dot-done"
                }`}
              />
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-sm font-medium leading-relaxed mb-1.5 ${
                    selectedId === item.id ? "text-primary" : "text-foreground"
                  }`}
                >
                  {item.title}
                </h3>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>• 系统：{item.system}</span>
                  <span>• 部门：{item.department}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  • 时间：{item.time}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodoList;
