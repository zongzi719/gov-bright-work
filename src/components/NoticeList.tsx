import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NoticeItem {
  id: string;
  title: string;
  department: string;
  content: string | null;
  created_at: string;
  is_pinned: boolean;
}

const NoticeList = () => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const { data, error } = await supabase
      .from("notices")
      .select("id, title, department, content, created_at, is_pinned")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setNotices(data);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-");
  };

  const handleNoticeClick = (notice: NoticeItem) => {
    setSelectedNotice(notice);
    setDialogOpen(true);
  };

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">通知公告</h2>
        <button className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          更多
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 通知列表 */}
      <div className="divide-y divide-border flex-1 overflow-auto">
        {loading ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">加载中...</div>
        ) : notices.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">暂无通知公告</div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className="px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => handleNoticeClick(notice)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {notice.is_pinned && (
                  <Badge variant="destructive" className="flex-shrink-0 text-xs px-1.5 py-0">
                    置顶
                  </Badge>
                )}
                <span className="text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {notice.title}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                <span className="whitespace-nowrap">{notice.department}</span>
                <span className="w-20 text-right">{formatDate(notice.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 详情弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold pr-6">
              {selectedNotice?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>发布单位：{selectedNotice?.department}</span>
              <span>发布时间：{selectedNotice ? formatDate(selectedNotice.created_at) : ""}</span>
              {selectedNotice?.is_pinned && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">置顶</Badge>
              )}
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {selectedNotice?.content || "暂无详细内容"}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NoticeList;
