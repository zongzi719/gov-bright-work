import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  security_level: string;
}

const securityLevelRank: Record<string, number> = {
  '一般': 1,
  '秘密': 2,
  '机密': 3,
};

const NoticeList = () => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const storedUser = localStorage.getItem("frontendUser");
    let userSecurityLevel = "一般";
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        userSecurityLevel = user.security_level || "一般";
      } catch {
        // ignore
      }
    }

    const userRank = securityLevelRank[userSecurityLevel] || 1;

    const { data, error } = await supabase
      .from("notices")
      .select("id, title, department, content, created_at, is_pinned, security_level")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      const filteredNotices = data.filter((notice) => {
        const noticeRank = securityLevelRank[notice.security_level] || 1;
        return noticeRank <= userRank;
      });
      setNotices(filteredNotices.slice(0, 10));
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleNoticeClick = (notice: NoticeItem) => {
    setSelectedNotice(notice);
    setDialogOpen(true);
  };

  return (
    <div className="gov-card h-full flex flex-col overflow-hidden">
      {/* 紧凑型标题栏 */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border flex-shrink-0">
        <h2 className="text-xs font-semibold text-foreground">通知公告</h2>
        <button className="text-[10px] text-muted-foreground hover:text-primary flex items-center transition-colors">
          更多
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* 紧凑型通知列表 */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="px-2 py-3 text-center text-muted-foreground text-xs">加载中...</div>
        ) : notices.length === 0 ? (
          <div className="px-2 py-3 text-center text-muted-foreground text-xs">暂无通知公告</div>
        ) : (
          <div className="divide-y divide-border/50">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="px-2 py-1.5 flex items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors group"
                onClick={() => handleNoticeClick(notice)}
              >
                {/* 左侧标签区 - 紧凑 */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {notice.is_pinned && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 rounded">
                      顶
                    </Badge>
                  )}
                  <Badge 
                    variant={notice.security_level === '机密' ? 'destructive' : notice.security_level === '秘密' ? 'secondary' : 'outline'} 
                    className="text-[10px] px-1 py-0 h-4 rounded"
                  >
                    {notice.security_level?.charAt(0) || '普'}
                  </Badge>
                </div>
                {/* 标题 - 左对齐 */}
                <span className="text-xs text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                  {notice.title}
                </span>
                {/* 时间 - 右对齐 */}
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatDate(notice.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

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
              <span>发布时间：{selectedNotice ? new Date(selectedNotice.created_at).toLocaleDateString("zh-CN") : ""}</span>
              {selectedNotice?.is_pinned && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">置顶</Badge>
              )}
              <Badge 
                variant={selectedNotice?.security_level === '机密' ? 'destructive' : selectedNotice?.security_level === '秘密' ? 'secondary' : 'outline'} 
                className="text-xs px-1.5 py-0"
              >
                {selectedNotice?.security_level || '一般'}
              </Badge>
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
