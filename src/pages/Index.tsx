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
      <main className="min-h-[calc(100vh-64px)] p-4 flex flex-col gap-4 overflow-auto">
        {/* 轮播图Banner */}
        <div className="flex-shrink-0">
          <BannerCarousel />
        </div>

        {/* 三栏布局 - 3:4:3 比例 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 flex-1 min-h-0">
          {/* 左侧：待办事项 - 30% */}
          <div className="lg:col-span-3 h-full">
            <TodoList />
          </div>

          {/* 中间：通知公告 + 单点登录 - 40% */}
          <div className="lg:col-span-4 flex flex-col gap-4 h-full">
            <div className="flex-1 min-h-0">
              <NoticeList />
            </div>
            <div className="flex-1 min-h-0">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="lg:col-span-3 flex flex-col gap-4 h-full">
            <div className="flex-1 min-h-0">
              <SchedulePanel />
            </div>
            <ExternalLinks />
            <div className="flex-1 min-h-0">
              <CanteenMenu />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
