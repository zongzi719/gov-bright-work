import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface NoticeItem {
  id: string;
  title: string;
  department: string;
  content: string | null;
  created_at: string;
  is_pinned: boolean;
  security_level: string;
}

interface NoticeImage {
  id: string;
  image_url: string;
  title: string;
}

const securityLevelRank: Record<string, number> = {
  '一般': 1,
  '秘密': 2,
  '机密': 3,
};

const NoticeList = () => {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [images, setImages] = useState<NoticeImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // 自动轮播
  useEffect(() => {
    if (images.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length, isHovered]);

  const fetchData = async () => {
    await Promise.all([fetchNotices(), fetchImages()]);
    setLoading(false);
  };

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from("notice_images")
      .select("id, image_url, title")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!error && data) {
      setImages(data);
    }
  };

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
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleNoticeClick = (notice: NoticeItem) => {
    setSelectedNotice(notice);
    setDialogOpen(true);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const hasImages = images.length > 0;

  return (
    <div className="gov-card h-full flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
        <h2 className="gov-card-title text-base">通知公告</h2>
        <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          更多
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* 主内容区：左侧轮播图 + 右侧列表 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 左侧轮播图 */}
        {hasImages && (
          <div 
            className="w-[240px] max-w-[40%] flex-shrink-0 relative group bg-muted"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {images.map((image, index) => (
              <div
                key={image.id}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  index === currentImageIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                <img
                  src={image.image_url}
                  alt={image.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            
            {/* 轮播控制按钮 */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={goToPrevImage}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={goToNextImage}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                {/* 底部指示器 */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        index === currentImageIndex
                          ? "bg-white"
                          : "bg-white/50 hover:bg-white/70"
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 右侧通知列表 */}
        <ScrollArea className="flex-1 border-l border-border">
          {loading ? (
            <div className="px-4 py-4 text-center text-muted-foreground text-sm">加载中...</div>
          ) : notices.length === 0 ? (
            <div className="px-4 py-4 text-center text-muted-foreground text-sm">暂无通知公告</div>
          ) : (
            <div className="divide-y divide-border">
              {notices.map((notice, index) => (
                <div
                  key={notice.id}
                  className="px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => handleNoticeClick(notice)}
                >
                  {/* 标题行 */}
                  <div className="flex items-start gap-1.5 mb-0.5">
                    {notice.is_pinned && (
                      <Badge variant="destructive" className="flex-shrink-0 text-xs px-1 py-0 h-4 mt-0.5">
                        顶
                      </Badge>
                    )}
                    <span className="text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
                      {notice.title}
                    </span>
                  </div>
                  {/* 信息行：发布单位 + 密级 + 日期 */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-0 flex-wrap">
                    <span className="flex-shrink-0">发布单位：{notice.department}</span>
                    <Badge 
                      variant={notice.security_level === '机密' ? 'destructive' : notice.security_level === '秘密' ? 'secondary' : 'outline'} 
                      className="text-xs px-1 py-0 h-4 flex-shrink-0"
                    >
                      {notice.security_level || '一般'}
                    </Badge>
                    <span className="flex-shrink-0 ml-auto">{formatDate(notice.created_at)}</span>
                  </div>
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
