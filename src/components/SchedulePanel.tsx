import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useState } from "react";

interface ScheduleItem {
  time: string;
  title: string;
  location: string;
}

const schedules: ScheduleItem[] = [
  { time: "09:30", title: "部门周例会", location: "会议室A" },
  { time: "14:00", title: "年度工作总结评审会", location: "大会议室" },
  { time: "16:00", title: "安全检查部署会", location: "小会议室" },
];

const SchedulePanel = () => {
  const [currentDate] = useState(new Date());
  const today = currentDate.getDate();
  
  // 生成日历数据（简化版，显示两周）
  const generateCalendarDays = () => {
    const days: number[] = [];
    const startDay = 8; // 从8号开始显示
    for (let i = 0; i < 14; i++) {
      days.push(startDay + i);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const eventDays = [12, 15, 18]; // 有日程的日期

  return (
    <div className="gov-card">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">日程管理</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* 日历头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">2026年1月</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-muted rounded">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm text-muted-foreground px-2">近两周</span>
            <button className="p-1 hover:bg-muted rounded">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => (
            <div
              key={day}
              className={`calendar-day ${
                day === today ? "calendar-day-today" : ""
              } ${eventDays.includes(day) && day !== today ? "calendar-day-event" : ""}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 今日日程 */}
        <div className="space-y-2.5">
          {schedules.map((item, index) => (
            <div key={index} className="flex items-start gap-3 text-sm">
              <span className="text-primary font-medium w-12 flex-shrink-0">
                {item.time}
              </span>
              <span className="text-foreground">
                {item.title} - {item.location}
              </span>
            </div>
          ))}
        </div>

        {/* 快捷链接 */}
        <div className="pt-4 border-t border-border">
          <a
            href="#"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded font-medium">
              人民网
            </span>
            人民网资料库
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SchedulePanel;
