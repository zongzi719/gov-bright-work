import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface BannerItem {
  id: string;
  image: string;
  title: string;
}

const defaultBanners: BannerItem[] = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=400&fit=crop",
    title: "深入学习贯彻党的二十大精神，奋力开创高质量发展新局面",
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=400&fit=crop",
    title: "全面推进数字政府建设，提升政务服务效能",
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&h=400&fit=crop",
    title: "坚持以人民为中心，持续优化营商环境",
  },
];

const BannerCarousel = () => {
  const [banners, setBanners] = useState<BannerItem[]>(defaultBanners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // 从数据库获取启用的Banner
  useEffect(() => {
    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("id, image_url, title")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data && data.length > 0) {
        setBanners(data.map(b => ({
          id: b.id,
          image: b.image_url,
          title: b.title
        })));
      }
    };
    fetchBanners();
  }, []);

  // 自动轮播
  useEffect(() => {
    if (isHovered || banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, isHovered]);

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const showControls = banners.length > 1;

  return (
    <div 
      className="relative w-full h-[190px] md:h-[270px] overflow-hidden rounded-lg shadow-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 轮播图片 */}
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <img
            src={banner.image}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
          {/* 渐变遮罩和标题 */}
          <div className="carousel-overlay absolute inset-0 flex items-end">
            <p className="text-white text-lg md:text-xl font-bold px-6 pb-6 leading-relaxed max-w-4xl">
              {banner.title}
            </p>
          </div>
        </div>
      ))}

      {/* 左右箭头 - 仅多张图时显示 */}
      {showControls && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full transition-opacity ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
            onClick={goToPrev}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full transition-opacity ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
            onClick={goToNext}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </>
      )}

      {/* 底部指示器 - 仅多张图时显示 */}
      {showControls && (
        <div className="absolute bottom-4 right-6 z-20 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`w-8 h-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-white"
                  : "bg-white/40 hover:bg-white/60"
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;
