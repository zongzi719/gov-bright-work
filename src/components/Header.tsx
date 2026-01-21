import { LogOut, Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const Header = () => {
  const navigate = useNavigate();
  const today = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 星期${weekDays[today.getDay()]}`;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "退出失败",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "已退出登录",
      });
      navigate("/admin/login");
    }
  };

  return (
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
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-xs text-white rounded-full flex items-center justify-center font-medium">
              5
            </span>
          </Button>

          {/* 用户信息 */}
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 border-2 border-white/30">
              <AvatarFallback className="bg-white text-primary font-bold text-sm">
                张
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <p className="text-white font-medium text-sm leading-tight">张伟</p>
              <p className="text-white/70 text-xs">综合办公室 · 科员</p>
            </div>
          </div>

          {/* 退出按钮 */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white/90 hover:text-white hover:bg-white/10 gap-1.5"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">退出</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
