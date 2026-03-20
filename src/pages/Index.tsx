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
        
        {/* 桌面端三栏布局 - 兼容旧版浏览器，避免 CSS Grid 导致内容被 hidden */}
        <div className="hidden lg:flex h-full">
          {/* 左侧：工作事项 - 20% */}
          <div className="w-1/5 flex flex-col overflow-hidden mr-3">
            <WorkPanel />
          </div>

          {/* 中间：通知公告 + 快捷入口 - 50% */}
          <div className="w-1/2 flex flex-col overflow-hidden mr-3">
            <div className="flex-1 min-h-0 overflow-hidden mb-3">
              <NoticeList />
            </div>
            <div className="flex-shrink-0">
              <QuickLinks />
            </div>
          </div>

          {/* 右侧：日程管理 + 常用链接 + 食堂菜谱 - 30% */}
          <div className="w-[30%] flex flex-col overflow-hidden">
            {/* 日程管理占据约55%高度 */}
            <div style={{ flex: '0 0 55%' }} className="min-h-0 overflow-hidden mb-2">
              <SchedulePanel />
            </div>
            {/* 外部链接 - 限制最大高度，超出可滚动 */}
            <div className="flex-shrink-0 mb-2 overflow-auto" style={{ maxHeight: '120px' }}>
              <ExternalLinks />
            </div>
            {/* 食堂菜谱 - 填充剩余空间 */}
            <div className="flex-1 min-h-0 overflow-hidden">
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
