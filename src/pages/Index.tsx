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
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体内容区域 */}
      <main className="p-4 flex flex-col gap-4">
        {/* 轮播图Banner */}
        <div className="flex-shrink-0">
          <BannerCarousel />
        </div>

        {/* 三栏布局 - 3:4:3 比例 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
          {/* 左侧：待办事项 - 30% */}
          <div className="lg:col-span-3">
            <TodoList />
          </div>

          {/* 中间：通知公告 + 单点登录 - 40% */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <NoticeList />
            <QuickLinks />
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <SchedulePanel />
            <ExternalLinks />
            <CanteenMenu />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
