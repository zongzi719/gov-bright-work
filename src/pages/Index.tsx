import Header from "@/components/Header";
import WorkPanel from "@/components/WorkPanel";
import NoticePanel from "@/components/NoticePanel";
import QuickLinks from "@/components/QuickLinks";
import SchedulePanel from "@/components/SchedulePanel";
import ExternalLinks from "@/components/ExternalLinks";
import CanteenMenu from "@/components/CanteenMenu";

const Index = () => {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体内容区域 - 三栏布局 3:5:2 */}
      <main className="flex-1 p-4 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-10 gap-4">
          {/* 左侧栏：待办事项 - 25% */}
          <div className="lg:col-span-2 flex flex-col overflow-hidden">
            <WorkPanel />
          </div>

          {/* 中间主区域：通知公告 + 快捷入口 - 45% */}
          <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
            {/* 通知公告 - 占主要空间 */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <NoticePanel />
            </div>
            {/* 快捷入口 */}
            <div className="flex-shrink-0">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧栏：日程管理 + 人民网 + 食堂菜谱 - 30% */}
          <div className="lg:col-span-4 flex flex-col gap-5 overflow-hidden">
            {/* 日程管理 - 确保足够高度显示日程列表 */}
            <div className="flex-1 min-h-[420px] overflow-hidden">
              <SchedulePanel />
            </div>
            {/* 人民网资料库 */}
            <div className="flex-shrink-0">
              <ExternalLinks />
            </div>
            {/* 食堂菜谱 */}
            <div className="flex-shrink-0">
              <CanteenMenu />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
