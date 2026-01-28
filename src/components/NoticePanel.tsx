import { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NoticeItem {
  id: string;
  title: string;
  department: string;
  content: string | null;
  created_at: string;
  is_pinned: boolean;
  security_level: string;
}

interface BannerItem {
  id: string;
  title: string;
  image_url: string;
}

const securityLevelRank: Record<string, number> = {
  一般: 1,
  秘密: 2,
  机密: 3,
};

const NoticePanel = () => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto rotate banner
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const fetchData = async () => {
    // Fetch banners
    const { data: bannerData } = await supabase
      .from("banners")
      .select("id, title, image_url")
      .eq("is_active", true)
      .order("sort_order")
      .limit(5);

    if (bannerData) {
      setBanners(bannerData);
    }

    // Fetch notices
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
      setNotices(filteredNotices.slice(0, 8));
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

  const getTagStyle = (notice: NoticeItem) => {
    if (notice.is_pinned) return "gov-tag gov-tag-red";
    if (notice.security_level === "机密") return "gov-tag gov-tag-red";
    if (notice.security_level === "秘密") return "gov-tag gov-tag-orange";
    return "gov-tag gov-tag-blue";
  };

  const getTagText = (notice: NoticeItem) => {
    if (notice.is_pinned) return "置顶";
    return notice.security_level === "一般" ? "通知" : notice.security_level;
  };

  const handlePrevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <div className="gov-card h-full flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="gov-card-title text-base">信息服务</h2>
        </div>
        <button className="view-more-btn">
          查看全部
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 内容区域 - 公告列表 */}
      <div className="flex-1 px-4 py-2 overflow-hidden">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="py-4 text-center text-muted-foreground text-sm">加载中...</div>
          ) : notices.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-sm">暂无通知公告</div>
          ) : (
            <div className="space-y-1.5">
              {notices.map((notice) => (
                <div key={notice.id} className="notice-item group" onClick={() => handleNoticeClick(notice)}>
                  <span className={getTagStyle(notice)}>{getTagText(notice)}</span>
                  <span className="flex-1 text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {notice.title}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(notice.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 详情弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold pr-6">{selectedNotice?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>发布单位：{selectedNotice?.department}</span>
              <span>
                发布时间：{selectedNotice ? new Date(selectedNotice.created_at).toLocaleDateString("zh-CN") : ""}
              </span>
              {selectedNotice?.is_pinned && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  置顶
                </Badge>
              )}
              <Badge
                variant={
                  selectedNotice?.security_level === "机密"
                    ? "destructive"
                    : selectedNotice?.security_level === "秘密"
                      ? "secondary"
                      : "outline"
                }
                className="text-xs px-1.5 py-0"
              >
                {selectedNotice?.security_level || "一般"}
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

export default NoticePanel;
