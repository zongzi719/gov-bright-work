import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NoticeItem {
  id: number;
  title: string;
  department: string;
  date: string;
  tag?: string;
}

const notices: NoticeItem[] = [
  {
    id: 1,
    title: "关于2025年工作总结报送的通知",
    department: "综合科",
    date: "2025-12-28",
    tag: "置顶",
  },
  {
    id: 2,
    title: "关于开展节前安全大检查的通知",
    department: "安保部",
    date: "2025-12-25",
  },
  {
    id: 3,
    title: "关于更新办公系统操作手册的通知",
    department: "信息科",
    date: "2025-12-20",
  },
  {
    id: 4,
    title: "关于组织参加消防安全培训的通知",
    department: "安保部",
    date: "2025-12-18",
  },
  {
    id: 5,
    title: "关于调整办公区域供暖时间的通知",
    department: "行政部",
    date: "2025-12-15",
  },
];

const NoticeList = () => {
  return (
    <div className="gov-card">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">通知公告</h2>
        <button className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          更多
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 通知列表 */}
      <div className="divide-y divide-border">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {notice.tag && (
                <Badge variant="destructive" className="flex-shrink-0 text-xs px-1.5 py-0">
                  {notice.tag}
                </Badge>
              )}
              <span className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {notice.title}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
              <span>发布单位：{notice.department}</span>
              <span className="w-20 text-right">{notice.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NoticeList;
