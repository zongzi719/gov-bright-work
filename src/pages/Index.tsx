import Header from "@/components/Header";
import BannerCarousel from "@/components/BannerCarousel";
import TodoList from "@/components/TodoList";
import NoticeList from "@/components/NoticeList";
import QuickLinks from "@/components/QuickLinks";
import SchedulePanel from "@/components/SchedulePanel";
import CanteenMenu from "@/components/CanteenMenu";
import ExternalLinks from "@/components/ExternalLinks";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体内容区域 */}
      <main className="max-w-[1920px] mx-auto p-6 space-y-6">
        {/* 轮播图Banner - 已注释
        <BannerCarousel />
        */}

        {/* 三栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧：待办事项 - 25% */}
          <div className="lg:col-span-1">
            <TodoList />
          </div>

          {/* 中间：通知公告 + 单点登录 - 50% */}
          <div className="lg:col-span-2 space-y-6">
            <NoticeList />
            <QuickLinks />
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 25% */}
          <div className="lg:col-span-1 space-y-6">
            <SchedulePanel />
            <ExternalLinks />
            <CanteenMenu />
          </div>
        </div>
      </main>

      {/* 底部版权 */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border mt-6">
        <p>© 2026 一体化政务工作平台 版权所有</p>
      </footer>
    </div>
  );
};

export default Index;
