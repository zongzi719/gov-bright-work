import Header from "@/components/Header";
import WorkPanel from "@/components/WorkPanel";
import NoticeList from "@/components/NoticeList";
import QuickLinks from "@/components/QuickLinks";
import SchedulePanel from "@/components/SchedulePanel";

const Index = () => {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体内容区域 - 自适应填充剩余空间 */}
      <main className="flex-1 p-4 overflow-hidden">
        {/* 三栏布局 - 参考图比例 */}
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 左侧：工作事项（待办/已办理/抄送）- 约25% */}
          <div className="lg:col-span-3 flex flex-col overflow-hidden">
            <WorkPanel />
          </div>

          {/* 中间：信息服务 + 全部应用 - 约50% */}
          <div className="lg:col-span-6 flex flex-col gap-4 overflow-hidden">
            {/* 信息服务/通知公告 */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <NoticeList />
            </div>
            {/* 全部应用 */}
            <div className="flex-shrink-0">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧：日程管理 - 约25% */}
          <div className="lg:col-span-3 flex flex-col overflow-hidden">
            <SchedulePanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
