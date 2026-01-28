import { LogOut, Bell, Key, Home, Search, HelpCircle, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useFrontendAuth } from "@/hooks/useFrontendAuth";
import { useState, useEffect } from "react";
import PasswordChangeDialog from "./PasswordChangeDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useFrontendAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [todoCount, setTodoCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch pending todo count for current user
  useEffect(() => {
    const fetchTodoCount = async () => {
      if (!user?.id) return;
      
      const { count, error } = await supabase
        .from("todo_items")
        .select("*", { count: "exact", head: true })
        .eq("assignee_id", user.id)
        .in("status", ["pending", "processing"]);
      
      if (!error && count !== null) {
        setTodoCount(count);
      }
    };

    fetchTodoCount();
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      toast({
        title: "搜索功能",
        description: `搜索: ${searchQuery}`,
      });
    }
  };

  // Get first character of name for avatar
  const avatarChar = user?.name?.charAt(0) || "用";

  return (
    <>
      <header className="bg-header-gradient shadow-header sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 h-14 flex items-center justify-between">
          {/* 左侧：系统Logo和名称 */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg font-bold">政</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              一体化政务工作平台
            </h1>
          </div>

          {/* 右侧：搜索框、通知、用户信息 */}
          <div className="flex items-center gap-4">
            {/* 搜索框 */}
            <form onSubmit={handleSearch} className="relative hidden md:block">
              <Input
                type="text"
                placeholder="请输入搜索内容"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/60 pr-10 focus:bg-white/20"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Search className="w-4 h-4 text-white/70" />
              </button>
            </form>

            {/* 问题反馈 */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/10 gap-1.5 hidden sm:flex"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">问题反馈</span>
            </Button>

            {/* 帮助 */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10 w-9 h-9"
            >
              <HelpCircle className="w-4 h-4" />
            </Button>

            {/* 返回工作台 - 仅在非首页显示 */}
            {location.pathname !== "/" && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/10 w-9 h-9"
                onClick={() => navigate("/")}
                title="返回工作台"
              >
                <Home className="w-4 h-4" />
              </Button>
            )}

            {/* 消息通知 */}
            <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10 w-9 h-9">
              <Bell className="w-4 h-4" />
              {todoCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-orange-500 text-[10px] text-white rounded-full flex items-center justify-center font-medium">
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
            </Button>

            {/* 分隔线 */}
            <div className="w-px h-6 bg-white/20 hidden sm:block" />

            {/* 用户信息 - 下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer">
                  <Avatar className="w-8 h-8 border-2 border-white/30">
                    <AvatarFallback className="bg-white text-primary font-bold text-sm">
                      {avatarChar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-white font-medium text-sm leading-tight">
                      {user?.organization || "某单位"} · {user?.name || "用户"}
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
      {user && (
        <PasswordChangeDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          userId={user.id}
        />
      )}
    </>
  );
};

export default Header;
