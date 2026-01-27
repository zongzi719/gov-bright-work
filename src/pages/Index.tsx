import Header from "@/components/Header";
import WorkPanel from "@/components/WorkPanel";
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
      <main className="pb-3 pt-3 flex flex-col gap-3">

        {/* 三栏布局 - 3:4:3 比例 */}
        <div className="px-3 grid grid-cols-1 lg:grid-cols-10 gap-3">
          {/* 左侧：工作事项（待办/已办理/抄送）- 30% */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <WorkPanel />
          </div>

          {/* 中间：通知公告 + 单点登录 - 40% */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <NoticeList />
            <QuickLinks />
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="lg:col-span-3 flex flex-col gap-3">
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
