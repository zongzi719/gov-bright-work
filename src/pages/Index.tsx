import Header from "@/components/Header";
import WorkPanel from "@/components/WorkPanel";
import NoticeList from "@/components/NoticeList";
import QuickLinks from "@/components/QuickLinks";
import SchedulePanel from "@/components/SchedulePanel";
import CanteenMenu from "@/components/CanteenMenu";
import ExternalLinks from "@/components/ExternalLinks";
import { ScrollArea } from "@/components/ui/scroll-area";

const Index = () => {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主体内容区域 */}
      <main className="flex-1 p-2 md:p-3 overflow-hidden">
        {/* 移动端：垂直滚动布局 | 桌面端：三栏布局 */}
        
        {/* 桌面端三栏布局 - hidden on mobile */}
        <div className="hidden lg:grid h-full grid-cols-10 gap-3">
          {/* 左侧：工作事项 - 20% */}
          <div className="col-span-2 flex flex-col overflow-hidden">
            <WorkPanel />
          </div>

          {/* 中间：通知公告 + 快捷入口 - 50% */}
          <div className="col-span-5 flex flex-col gap-3 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
              <NoticeList />
            </div>
            <div className="flex-shrink-0">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="col-span-3 flex flex-col gap-3 overflow-hidden">
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

        {/* 移动端垂直布局 - visible only on mobile/tablet */}
        <ScrollArea className="lg:hidden h-full">
          <div className="flex flex-col gap-3 pb-4">
            {/* 快捷入口 - 移动端优先显示 */}
            <div className="flex-shrink-0">
              <QuickLinks />
            </div>

            {/* 待办事项 */}
            <div className="h-[320px] flex-shrink-0">
              <WorkPanel />
            </div>

            {/* 通知公告 */}
            <div className="h-[360px] flex-shrink-0">
              <NoticeList />
            </div>

            {/* 日程管理 */}
            <div className="h-[320px] flex-shrink-0">
              <SchedulePanel />
            </div>

            {/* 外部链接 */}
            <div className="flex-shrink-0">
              <ExternalLinks />
            </div>

            {/* 食堂菜谱 */}
            <div className="flex-shrink-0">
              <CanteenMenu />
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
};

export default Index;
