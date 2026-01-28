import { useEffect, useState } from "react";
import { ChevronRight, Play } from "lucide-react";
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

interface BannerItem {
  id: string;
  title: string;
  image_url: string;
}

const securityLevelRank: Record<string, number> = {
  '一般': 1,
  '秘密': 2,
  '机密': 3,
};

const NoticeList = () => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

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

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const getTypeLabel = (notice: NoticeItem) => {
    if (notice.is_pinned) return { label: "置顶", variant: "destructive" as const };
    if (notice.security_level === "机密") return { label: "要闻", variant: "destructive" as const };
    if (notice.security_level === "秘密") return { label: "要闻", variant: "secondary" as const };
    return { label: "通知", variant: "outline" as const };
  };

  return (
    <div className="gov-card h-full flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="gov-card-title text-base">
          <span className="text-foreground">信息</span>
          <span className="text-primary">服务</span>
          <Play className="w-4 h-4 inline-block ml-1 text-primary fill-primary" />
        </h2>
        <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          查看全部
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* 左侧：轮播图 */}
        {banners.length > 0 && (
          <div className="lg:w-1/2 p-3 flex-shrink-0">
            <div className="relative w-full h-full min-h-[200px] rounded-lg overflow-hidden bg-muted">
              {banners.map((banner, idx) => (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    idx === activeBanner ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                  {/* 底部标题遮罩 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <h3 className="text-white font-medium text-sm line-clamp-2">
                      {banner.title}
                    </h3>
                  </div>
                </div>
              ))}
              {/* 轮播指示器 */}
              {banners.length > 1 && (
                <div className="absolute bottom-2 right-3 flex gap-1">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveBanner(idx)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === activeBanner ? "bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 右侧：通知列表 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="px-4 py-4 text-center text-muted-foreground text-sm">加载中...</div>
            ) : notices.length === 0 ? (
              <div className="px-4 py-4 text-center text-muted-foreground text-sm">暂无通知公告</div>
            ) : (
              <div className="p-2">
                {notices.map((notice) => {
                  const typeInfo = getTypeLabel(notice);
                  return (
                    <div
                      key={notice.id}
                      className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-muted/50 rounded transition-colors group"
                      onClick={() => handleNoticeClick(notice)}
                    >
                      <Badge 
                        variant={typeInfo.variant}
                        className="flex-shrink-0 text-xs px-1.5 py-0 h-5 min-w-[36px] justify-center"
                      >
                        {typeInfo.label}
                      </Badge>
                      <span className="text-sm text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                        {notice.title}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(notice.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
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
