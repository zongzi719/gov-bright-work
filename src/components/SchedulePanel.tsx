import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, addDays, subWeeks, addWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Contact {
  id: string;
  name: string;
  department: string | null;
  organization?: { name: string } | null;
}

interface Schedule {
  id: string;
  contact_id: string;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  contact?: Contact;
}

const SchedulePanel = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [formData, setFormData] = useState({
    contact_id: "",
    title: "",
    schedule_date: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    notes: "",
  });

  const today = new Date();
  const weekDays = Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  // 获取日程
  const fetchSchedules = async () => {
    setLoading(true);
    const weekEnd = addDays(currentWeekStart, 13);
    const { data, error } = await supabase
      .from("schedules")
      .select("*, contact:contacts(id, name, department)")
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(weekEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");

    if (!error && data) {
      setSchedules(data as Schedule[]);
    }
    setLoading(false);
  };

  // 获取通讯录人员
  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, department, organization:organizations(name)")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setContacts(data);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [currentWeekStart]);

  // 获取某天的日程
  const getSchedulesForDay = (date: Date): Schedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter((s) => s.schedule_date === dateStr);
  };

  // 检查日期是否有日程
  const hasSchedule = (date: Date): boolean => {
    return getSchedulesForDay(date).length > 0;
  };

  // 检查是否是今天
  const isToday = (date: Date): boolean => {
    return format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  };

  // 获取今日日程
  const todaySchedules = getSchedulesForDay(today);

  // 周导航
  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 2));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 2));

  // 打开新增对话框
  const openDialog = () => {
    fetchContacts();
    setDialogOpen(true);
  };

  // 提交日程
  const handleSubmit = async () => {
    if (!formData.contact_id || !formData.title || !formData.schedule_date) {
      toast.error("请填写必填项");
      return;
    }

    const { error } = await supabase.from("schedules").insert({
      contact_id: formData.contact_id,
      title: formData.title,
      schedule_date: formData.schedule_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      location: formData.location || null,
      notes: formData.notes || null,
    });

    if (error) {
      toast.error("添加日程失败");
      console.error(error);
    } else {
      toast.success("日程已添加");
      setDialogOpen(false);
      setFormData({
        contact_id: "",
        title: "",
        schedule_date: "",
        start_time: "09:00",
        end_time: "10:00",
        location: "",
        notes: "",
      });
      fetchSchedules();
    }
  };

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="gov-card-title">日程管理</h2>
        <Button size="sm" variant="ghost" onClick={openDialog}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 space-y-5 flex-1 overflow-auto">
        {/* 日历头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">
              {format(currentWeekStart, "yyyy年M月", { locale: zhCN })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-muted rounded" onClick={handlePrevWeek}>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm text-muted-foreground px-2">近两周</span>
            <button className="p-1 hover:bg-muted rounded" onClick={handleNextWeek}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={format(day, "yyyy-MM-dd")}
              className={`calendar-day ${
                isToday(day) ? "calendar-day-today" : ""
              } ${hasSchedule(day) && !isToday(day) ? "calendar-day-event" : ""}`}
            >
              {format(day, "d")}
            </div>
          ))}
        </div>

        {/* 今日日程 */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">加载中...</div>
          ) : todaySchedules.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">今日暂无日程</div>
          ) : (
            todaySchedules.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <span className="text-primary font-medium w-12 flex-shrink-0">
                  {item.start_time.slice(0, 5)}
                </span>
                <span className="text-foreground">
                  {item.title}
                  {item.location && ` - ${item.location}`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 新增日程对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增日程</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>人员 *</Label>
              <Select
                value={formData.contact_id}
                onValueChange={(v) => setFormData({ ...formData, contact_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择人员" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.organization?.name && ` - ${contact.organization.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>日程标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="输入日程标题"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>日期 *</Label>
                <Input
                  type="date"
                  value={formData.schedule_date}
                  onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>地点</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="输入地点"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="输入备注"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>添加</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePanel;
