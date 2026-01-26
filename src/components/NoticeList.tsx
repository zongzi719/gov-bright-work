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
  security_level: string;
}

// 密级等级映射，数值越大权限越高
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
    // 获取当前登录用户的密级
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

    // 获取用户密级对应的等级
    const userRank = securityLevelRank[userSecurityLevel] || 1;

    // 查询所有已发布的通知
    const { data, error } = await supabase
      .from("notices")
      .select("id, title, department, content, created_at, is_pinned, security_level")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      // 根据用户密级过滤通知：用户只能看到等级 <= 自己密级的通知
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">通知公告</h2>
        <button className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          更多
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 通知列表 */}
      <div className="divide-y divide-border flex-1 overflow-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">加载中...</div>
        ) : notices.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">暂无通知公告</div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => handleNoticeClick(notice)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {notice.is_pinned && (
                  <Badge variant="destructive" className="flex-shrink-0 text-sm px-2 py-0.5">
                    置顶
                  </Badge>
                )}
                <Badge 
                  variant={notice.security_level === '机密' ? 'destructive' : notice.security_level === '秘密' ? 'secondary' : 'outline'} 
                  className="flex-shrink-0 text-sm px-2 py-0.5"
                >
                  {notice.security_level || '一般'}
                </Badge>
                <span className="text-base text-foreground truncate group-hover:text-primary transition-colors">
                  {notice.title}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
                <span className="whitespace-nowrap">{notice.department}</span>
                <span className="w-24 text-right">{formatDate(notice.created_at)}</span>
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
