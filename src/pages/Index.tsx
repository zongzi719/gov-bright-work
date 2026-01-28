import Header from "@/components/Header";
import WorkPanel from "@/components/WorkPanel";
import NoticeList from "@/components/NoticeList";
import QuickLinks from "@/components/QuickLinks";
import SchedulePanel from "@/components/SchedulePanel";
import CanteenMenu from "@/components/CanteenMenu";
import ExternalLinks from "@/components/ExternalLinks";

const Index = () => {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体内容区域 - 紧凑间距 */}
      <main className="flex-1 p-2 overflow-hidden">
        {/* 三栏布局 - 3:4:3 比例，紧凑间距 */}
        <div className="h-full grid grid-cols-1 lg:grid-cols-10 gap-2">
          {/* 左侧：工作事项（待办/已办理/抄送）- 30% */}
          <div className="lg:col-span-3 flex flex-col overflow-hidden">
            <WorkPanel />
          </div>

          {/* 中间：通知公告 + 单点登录 - 40% */}
          <div className="lg:col-span-4 flex flex-col gap-2 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <NoticeList />
            </div>
            <div className="flex-shrink-0">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="lg:col-span-3 flex flex-col gap-2 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <SchedulePanel />
            </div>
            <div className="flex-shrink-0">
              <ExternalLinks />
            </div>
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
