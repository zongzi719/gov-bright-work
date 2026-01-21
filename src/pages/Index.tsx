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

      {/* 主体内容区域 - 填充屏幕 */}
      <main className="h-[calc(100vh-64px)] p-4 overflow-hidden">
        {/* 轮播图Banner - 已注释
        <BannerCarousel />
        */}

        {/* 三栏布局 - 3:4:3 比例 */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 h-full">
          {/* 左侧：待办事项 - 30% */}
          <div className="lg:col-span-3 h-full">
            <TodoList />
          </div>

          {/* 中间：通知公告 + 单点登录 - 40% */}
          <div className="lg:col-span-4 flex flex-col gap-4 h-full">
            <div className="flex-[3]">
              <NoticeList />
            </div>
            <div className="flex-[2]">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="lg:col-span-3 flex flex-col gap-4 h-full">
            <div className="flex-[4]">
              <SchedulePanel />
            </div>
            <div className="flex-[1]">
              <ExternalLinks />
            </div>
            <div className="flex-[3]">
              <CanteenMenu />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
