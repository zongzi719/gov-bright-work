import { LogOut, Bell, Key, Home } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useFrontendAuth } from "@/hooks/useFrontendAuth";
import { useState, useEffect } from "react";
import PasswordChangeDialog from "./PasswordChangeDialog";
import { supabase } from "@/integrations/supabase/client";
import { offlineApi, isOfflineMode } from "@/lib/offlineApi";
import partyEmblem from "@/assets/party-emblem.png";
import { useUKeyMonitor } from "@/hooks/useUKeyMonitor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  // 监控 UKey 拔出自动退出（仅离线模式生效）
  useUKeyMonitor();
  const [headerBgUrl, setHeaderBgUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useFrontendAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [todoCount, setTodoCount] = useState(0);

  const today = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 星期${weekDays[today.getDay()]}`;

  // Fetch header background image
  useEffect(() => {
    const fetchHeaderBg = async () => {
      if (isOfflineMode()) {
        // 离线模式
        const { data, error } = await offlineApi.getBanners();
        if (!error && data && data.length > 0) {
          setHeaderBgUrl(data[0].image_url);
        }
      } else {
        // 在线模式
        const { data, error } = await supabase
          .from("banners")
          .select("image_url")
          .eq("is_active", true)
          .order("sort_order")
          .limit(1)
          .single();

        if (!error && data?.image_url) {
          setHeaderBgUrl(data.image_url);
        }
      }
    };

    fetchHeaderBg();
  }, []);

  // Fetch pending todo count for current user (with 30s polling + event-driven refresh)
  useEffect(() => {
    if (!user?.id) return;

    const fetchTodoCount = async () => {
      if (isOfflineMode()) {
        const { data, error } = await offlineApi.getTodoCount(user.id);
        if (!error && data) {
          setTodoCount(data.count);
        }
      } else {
        const { count, error } = await supabase
          .from("todo_items")
          .select("*", { count: "exact", head: true })
          .eq("assignee_id", user.id)
          .in("status", ["pending", "processing"]);

        if (!error && count !== null) {
          setTodoCount(count);
        }
      }
    };

    // 初次加载
    fetchTodoCount();

    // 30秒轮询
    const interval = setInterval(fetchTodoCount, 30000);

    // 监听审批操作事件，立即刷新
    const handleRefresh = () => fetchTodoCount();
    window.addEventListener("todo-count-refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("todo-count-refresh", handleRefresh);
    };
  }, [user?.id]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  const handleLogout = () => {
    logout();
    toast({
      title: "已退出登录",
    });
  };

  // Get first character of name for avatar
  const avatarChar = user?.name?.charAt(0) || "用";

  const headerStyle = headerBgUrl
    ? {
        backgroundImage: `linear-gradient(to right, rgba(var(--primary-rgb), 0.85), rgba(var(--primary-rgb), 0.7)), url(${headerBgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {};

  return (
    <>
      <header className="bg-header-gradient shadow-header sticky top-0 z-50" style={headerStyle}>
        <div className="max-w-[1920px] mx-auto px-3 md:px-4 h-12 flex items-center justify-between">
          {/* 左侧：平台名称 */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 flex-shrink-0">
              <img src={partyEmblem} alt="党徽" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-base md:text-xl font-bold text-white tracking-wide truncate">党政办公平台</h1>
          </div>

          {/* 右侧：日期、用户信息、退出 */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* 日期显示 - 仅桌面端 */}
            <span className="text-white/90 text-sm hidden lg:block">{dateString}</span>

            {/* 返回工作台 - 仅在非首页显示 */}
            {location.pathname !== "/" && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 w-7 h-7 md:w-8 md:h-8"
                onClick={() => navigate("/")}
                title="返回工作台"
              >
                <Home className="w-4 h-4" />
              </Button>
            )}

            {/* 消息通知 */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative text-white hover:bg-white/10 w-7 h-7 md:w-8 md:h-8"
              onClick={() => navigate("/todo?tab=pending")}
              title="待办事项"
            >
              <Bell className="w-4 h-4" />
              {todoCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 bg-accent text-[10px] text-white rounded-full flex items-center justify-center font-medium">
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
            </Button>

            {/* 用户信息 - 下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 md:gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="w-7 h-7 border-2 border-white/30">
                    <AvatarFallback className="bg-white text-primary font-bold text-xs">{avatarChar}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-white font-medium text-sm leading-tight">{user?.name || "用户"}</p>
                    <p className="text-white/70 text-xs">
                      {user?.department || user?.organization || "未设置部门"}
                      {user?.position && ` · ${user.position}`}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                  <Key className="w-4 h-4 mr-2" />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* 修改密码弹窗 */}
      {user && <PasswordChangeDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} userId={user.id} />}
    </>
  );
};

export default Header;
