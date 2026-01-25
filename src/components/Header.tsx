import { LogOut, Bell, Key } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
  const { user, loading, logout } = useFrontendAuth();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [todoCount, setTodoCount] = useState(0);
  
  const today = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 星期${weekDays[today.getDay()]}`;

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

  // Get first character of name for avatar
  const avatarChar = user?.name?.charAt(0) || "用";

  return (
    <>
      <header className="bg-header-gradient shadow-header sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* 左侧：平台名称 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xl font-bold">政</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              一体化政务工作平台
            </h1>
          </div>

          {/* 右侧：日期、用户信息、退出 */}
          <div className="flex items-center gap-6">
            {/* 日期显示 */}
            <span className="text-white/90 text-sm hidden md:block">
              {dateString}
            </span>

            {/* 消息通知 */}
            <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
              <Bell className="w-5 h-5" />
              {todoCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-accent text-xs text-white rounded-full flex items-center justify-center font-medium">
                  {todoCount > 99 ? "99+" : todoCount}
                </span>
              )}
            </Button>

            {/* 用户信息 - 下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                  <Avatar className="w-9 h-9 border-2 border-white/30">
                    <AvatarFallback className="bg-white text-primary font-bold text-sm">
                      {avatarChar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
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
