import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Schedule {
  id: string;
  contact_id: string;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
}

const SchedulePanel = () => {
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (e) {
      console.error("Failed to parse frontendUser", e);
    }
    return null;
  };

  const currentUser = getCurrentUser();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  
  const [formData, setFormData] = useState({
    contact_id: currentUser?.id || "",
    title: "",
    schedule_date: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    notes: "",
  });

  const today = new Date();

  // 生成月历日期
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

  const fetchSchedules = async () => {
    if (!currentUser?.id) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("contact_id", currentUser.id)
      .gte("schedule_date", format(monthStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(monthEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");

    if (!error && data) {
      setSchedules(data as Schedule[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [currentMonth, currentUser?.id]);

  const getSchedulesForDay = (date: Date): Schedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter((s) => s.schedule_date === dateStr);
  };

  const hasSchedule = (date: Date): boolean => {
    return getSchedulesForDay(date).length > 0;
  };

  const isToday = (date: Date): boolean => {
    return isSameDay(date, today);
  };

  const isSelected = (date: Date): boolean => {
    return isSameDay(date, selectedDate);
  };

  const selectedDateSchedules = getSchedulesForDay(selectedDate);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const resetForm = () => {
    setFormData({
      contact_id: currentUser?.id || "",
      title: "",
      schedule_date: "",
      start_time: "09:00",
      end_time: "10:00",
      location: "",
      notes: "",
    });
    setEditingSchedule(null);
  };

  const openAddDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, schedule_date: format(selectedDate, "yyyy-MM-dd") }));
    setDialogOpen(true);
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      contact_id: schedule.contact_id,
      title: schedule.title,
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      location: schedule.location || "",
      notes: schedule.notes || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    
    const contactId = currentUser?.id;
    if (!contactId || !formData.title || !formData.schedule_date) {
      toast.error("请填写必填项（日程标题和日期）");
      return;
    }

    setSubmitting(true);
    
    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from("schedules")
          .update({
            title: formData.title,
            schedule_date: formData.schedule_date,
            start_time: formData.start_time,
            end_time: formData.end_time,
            location: formData.location || null,
            notes: formData.notes || null,
          })
          .eq("id", editingSchedule.id);

        if (error) {
          toast.error("修改日程失败");
          console.error(error);
        } else {
          toast.success("日程已修改");
          closeDialog();
          fetchSchedules();
        }
      } else {
        const { error } = await supabase.from("schedules").insert({
          contact_id: contactId,
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
          closeDialog();
          fetchSchedules();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (schedule: Schedule, e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", scheduleToDelete.id);

    if (error) {
      toast.error("删除日程失败");
      console.error(error);
    } else {
      toast.success("日程已删除");
      fetchSchedules();
    }
    
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  };

  return (
    <div className="gov-card h-full flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="gov-card-title text-base">日程管理</h2>
        <Button 
          size="sm" 
          onClick={openAddDialog} 
          className="h-7 text-xs gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          新建日程
        </Button>
      </div>

      <div className="p-3 flex-1 flex flex-col overflow-hidden">
        {/* 统计数字 */}
        <div className="grid grid-cols-2 gap-3 mb-3 flex-shrink-0">
          <div className="text-center p-2 bg-primary/5 rounded-lg">
            <div className="text-xl font-bold text-primary">{pendingSchedulesCount(schedules)}</div>
            <div className="text-xs text-muted-foreground">待办日程</div>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <div className="text-xl font-bold text-orange-500">{overdueSchedulesCount(schedules, today)}</div>
            <div className="text-xs text-muted-foreground">超期日程</div>
          </div>
        </div>

        {/* 月历头部 */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <button className="p-1 hover:bg-muted rounded" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="font-medium text-sm text-foreground">
            {format(currentMonth, "yyyy年M月", { locale: zhCN })}
          </span>
          <button className="p-1 hover:bg-muted rounded" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-0.5 mb-1 flex-shrink-0">
          {weekLabels.map((label) => (
            <div key={label} className="text-center text-xs text-muted-foreground py-1">
              {label}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-0.5 flex-shrink-0">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const dayHasSchedule = hasSchedule(day);
            
            return (
              <div
                key={idx}
                onClick={() => handleDateClick(day)}
                className={`
                  aspect-square flex items-center justify-center text-xs cursor-pointer rounded relative
                  ${!isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}
                  ${isToday(day) ? "bg-primary text-white font-bold" : ""}
                  ${isSelected(day) && !isToday(day) ? "ring-1 ring-primary" : ""}
                  ${!isToday(day) && !isSelected(day) ? "hover:bg-muted" : ""}
                `}
              >
                {format(day, "d")}
                {dayHasSchedule && !isToday(day) && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* 我的日程标题 */}
        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-foreground">
            我的日程
          </span>
          <span className="text-xs text-muted-foreground">
            {format(selectedDate, "M月d日", { locale: zhCN })}
          </span>
        </div>

        {/* 日程列表 */}
        <ScrollArea className="flex-1 mt-2">
          {loading ? (
            <div className="text-xs text-muted-foreground text-center py-4">加载中...</div>
          ) : selectedDateSchedules.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">暂无日程</div>
          ) : (
            <div className="space-y-1.5">
              {selectedDateSchedules.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => openEditDialog(item)}
                  className="flex items-start gap-2 text-sm group hover:bg-muted/50 rounded px-2 py-1.5 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-sm truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="text-primary">{item.start_time.slice(0, 5)}-{item.end_time.slice(0, 5)}</span>
                      {item.location && <span> · {item.location}</span>}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(item);
                      }}
                      className="p-1 hover:bg-primary/10 rounded"
                    >
                      <Pencil className="w-3 h-3 text-primary" />
                    </button>
                    <button
                      onClick={(e) => openDeleteDialog(item, e)}
                      className="p-1 hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* 新增/编辑日程对话框 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "编辑日程" : "新增日程"}</DialogTitle>
            <DialogDescription>
              {editingSchedule ? "修改日程信息" : "添加新的日程安排"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (editingSchedule ? "保存中..." : "添加中...") : (editingSchedule ? "保存" : "添加")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除日程「{scheduleToDelete?.title}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// 计算待办日程数量
const pendingSchedulesCount = (schedules: Schedule[]) => {
  const today = format(new Date(), "yyyy-MM-dd");
  return schedules.filter(s => s.schedule_date >= today).length;
};

// 计算超期日程数量
const overdueSchedulesCount = (schedules: Schedule[], today: Date) => {
  const todayStr = format(today, "yyyy-MM-dd");
  return schedules.filter(s => s.schedule_date < todayStr).length;
};

export default SchedulePanel;
