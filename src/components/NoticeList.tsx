import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { offlineApi, isOfflineMode } from "@/lib/offlineApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface NoticeItem {
  id: string;
  title: string;
  department: string;
  content: string | null;
  created_at: string;
  is_pinned: boolean;
  security_level: string;
  publish_scope?: string;
  publish_scope_ids?: string[];
}

interface NoticeImage {
  id: string;
  image_url: string;
  title: string;
}

const securityLevelRank: Record<string, number> = {
  '公开': 1,
  '一般': 1,
  '内部': 2,
  '秘密': 3,
  '机密': 4
};

const getDisplaySecurityLevel = (level: string | null | undefined): string => {
  if (!level || level === '一般') return '公开';
  return level;
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

  useEffect(() => {
    if (images.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length, isHovered]);

  const fetchData = async () => {
    await Promise.all([fetchNotices(), fetchImages()]);
    setLoading(false);
  };

  const fetchImages = async () => {
    try {
      let data: NoticeImage[] | null = null;
      let error: any = null;

      if (isOfflineMode()) {
        // 离线模式
        const result = await offlineApi.getNoticeImages();
        data = result.data;
        error = result.error;
      } else {
        // 在线模式
        const result = await supabase
          .from("notice_images")
          .select("id, image_url, title")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        data = result.data;
        error = result.error;
      }
      
      if (!error && data) {
        setImages(data);
      }
    } catch (err) {
      console.error('Fetch notice images error:', err);
      setImages([]);
    }
  };

  const fetchNotices = async () => {
    const storedUser = localStorage.getItem("frontendUser");
    let userSecurityLevel = "一般";
    let userOrgId: string | null = null;
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        userSecurityLevel = user.security_level || "一般";
        userOrgId = user.organization_id || null;
      } catch {
        // ignore
      }
    }

    const userRank = securityLevelRank[userSecurityLevel] || 1;

    let data: NoticeItem[] | null = null;
    let error: any = null;

    if (isOfflineMode()) {
      // 离线模式
      const result = await offlineApi.getNotices({ is_published: true });
      data = result.data;
      error = result.error;
    } else {
      // 在线模式
      const result = await supabase
        .from("notices")
        .select("id, title, department, content, created_at, is_pinned, security_level, publish_scope, publish_scope_ids")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      
      data = result.data;
      error = result.error;
    }

    if (!error && data) {
      const filteredNotices = data.filter(notice => {
        const noticeRank = securityLevelRank[notice.security_level] || 1;
        if (noticeRank > userRank) return false;
        
        const publishScope = notice.publish_scope || 'all';
        const publishScopeIds = notice.publish_scope_ids || [];
        
        if (publishScope === 'all') {
          return true;
        }
        
        if (publishScope === 'organization' && userOrgId) {
          return publishScopeIds.includes(userOrgId);
        }
        
        return false;
      });
      setNotices(filteredNotices.slice(0, 10));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const handleNoticeClick = (notice: NoticeItem) => {
    setSelectedNotice(notice);
    setDialogOpen(true);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
  };

  const goToNextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % images.length);
  };

  const hasImages = images.length > 0;

  return (
    <div className="gov-card h-full flex flex-col overflow-hidden">
      <div className="px-3 md:px-4 border-b border-border flex items-center justify-between flex-shrink-0 py-2 md:py-[12px]">
        <h2 className="gov-card-title text-sm md:text-base">通知公告</h2>
        <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
          更多
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 py-0">
        {hasImages && (
          <div 
            className="h-32 md:h-auto md:w-[240px] md:max-w-[40%] flex-shrink-0 relative group bg-muted m-2 md:ml-3 md:my-3 rounded overflow-hidden" 
            onMouseEnter={() => setIsHovered(true)} 
            onMouseLeave={() => setIsHovered(false)}
          >
            {images.map((image, index) => (
              <div 
                key={image.id} 
                className={`absolute inset-0 transition-opacity duration-500 ${index === currentImageIndex ? "opacity-100 z-10" : "opacity-0 z-0"}`}
              >
                <img src={image.image_url} alt={image.title} className="w-full h-full object-cover" />
              </div>
            ))}
            
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
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                  {images.map((_, index) => (
                    <button 
                      key={index} 
                      className={`w-1.5 h-1.5 rounded-full transition-all ${index === currentImageIndex ? "bg-white" : "bg-white/50 hover:bg-white/70"}`} 
                      onClick={() => setCurrentImageIndex(index)} 
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">加载中...</div>
          ) : notices.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">暂无通知公告</div>
          ) : (
            <div className="p-2 md:p-3">
              {notices.map((notice, index) => (
                <div 
                  key={notice.id} 
                  className={`px-2 md:px-3 py-2 md:py-2.5 cursor-pointer hover:bg-muted/50 transition-colors group rounded ${index !== notices.length - 1 ? 'border-b border-border' : ''}`} 
                  onClick={() => handleNoticeClick(notice)}
                >
                  <div className="flex items-start gap-1.5 mb-0.5">
                    <span className={`text-[10px] md:text-xs px-1 md:px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                      getDisplaySecurityLevel(notice.security_level) === '机密' ? 'bg-red-100 text-red-700' : 
                      getDisplaySecurityLevel(notice.security_level) === '秘密' ? 'bg-orange-100 text-orange-700' : 
                      getDisplaySecurityLevel(notice.security_level) === '内部' ? 'bg-blue-100 text-blue-700' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {getDisplaySecurityLevel(notice.security_level)}
                    </span>
                    {notice.is_pinned && (
                      <span className="flex-shrink-0 text-[10px] md:text-xs px-1 py-0 bg-red-100 text-red-700 rounded mt-0.5">
                        顶
                      </span>
                    )}
                    <span className="text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
                      {notice.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground pl-0">
                    <span className="flex-shrink-0 truncate">{notice.department}</span>
                    <span className="flex-shrink-0 ml-auto">{formatDate(notice.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

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
              {selectedNotice?.is_pinned && <Badge variant="destructive" className="text-xs px-1.5 py-0">置顶</Badge>}
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                getDisplaySecurityLevel(selectedNotice?.security_level) === '机密' ? 'bg-red-100 text-red-700' : 
                getDisplaySecurityLevel(selectedNotice?.security_level) === '秘密' ? 'bg-orange-100 text-orange-700' : 
                getDisplaySecurityLevel(selectedNotice?.security_level) === '内部' ? 'bg-blue-100 text-blue-700' : 
                'bg-gray-100 text-gray-500'
              }`}>
                {getDisplaySecurityLevel(selectedNotice?.security_level)}
              </span>
            </div>
            <div className="border-t border-border pt-4">
              {selectedNotice?.content ? (
                <div 
                  className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
                />
              ) : (
                <div className="text-sm text-muted-foreground">暂无详细内容</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NoticeList;
