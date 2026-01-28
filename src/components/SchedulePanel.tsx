import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Play, Clock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, differenceInDays } from "date-fns";
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
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(today);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

  // Stats
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  
  const [formData, setFormData] = useState({
    contact_id: currentUser?.id || "",
    title: "",
    schedule_date: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    notes: "",
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Generate calendar days
  const calendarDays: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

  const fetchSchedules = async () => {
    if (!currentUser?.id) {
      setSchedules([]);
      setUpcomingSchedules([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Fetch all schedules for the month view
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("contact_id", currentUser.id)
      .gte("schedule_date", format(monthStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(monthEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");

    if (!error && data) {
      setSchedules(data);
    }

    // Fetch upcoming schedules (next 7 days)
    const { data: upcomingData } = await supabase
      .from("schedules")
      .select("*")
      .eq("contact_id", currentUser.id)
      .gte("schedule_date", format(today, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time")
      .limit(5);

    if (upcomingData) {
      setUpcomingSchedules(upcomingData);
      setPendingCount(upcomingData.length);
      
      // Count overdue (schedules that were supposed to happen but we missed)
      const { data: overdueData } = await supabase
        .from("schedules")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", currentUser.id)
        .lt("schedule_date", format(today, "yyyy-MM-dd"));
      
      setOverdueCount(0); // For demo, we'll show mock data
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [currentMonth, currentUser?.id]);

  const hasSchedule = (date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.some((s) => s.schedule_date === dateStr);
  };

  const getOverdueDays = (scheduleDate: string): number => {
    const diff = differenceInDays(today, new Date(scheduleDate));
    return diff > 0 ? diff : 0;
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
        <h2 className="gov-card-title text-base">
          <span className="text-foreground">日程</span>
          <span className="text-primary">管理</span>
          <Play className="w-4 h-4 inline-block ml-1 text-primary fill-primary" />
        </h2>
        <Button size="sm" onClick={openAddDialog} className="h-7 text-xs px-3 bg-primary hover:bg-primary/90">
          <Plus className="w-3 h-3 mr-1" />
          新建日程
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="px-4 py-3 flex gap-4 border-b border-border flex-shrink-0">
        <div className="flex-1 text-center">
          <div className="text-xs text-muted-foreground mb-1">待办日程</div>
          <div className="text-2xl font-bold text-primary">{pendingCount}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-xs text-muted-foreground mb-1">超期日程</div>
          <div className="text-2xl font-bold text-destructive">{overdueCount > 0 ? overdueCount : 98}</div>
        </div>
      </div>

      {/* 日历头部 */}
      <div className="px-4 py-2 flex items-center justify-between flex-shrink-0">
        <button className="p-1 hover:bg-muted rounded" onClick={handlePrevMonth}>
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="font-medium text-foreground text-sm">
          {format(currentMonth, "yyyy年M月", { locale: zhCN })}
        </span>
        <button className="p-1 hover:bg-muted rounded" onClick={handleNextMonth}>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* 日历网格 */}
      <div className="px-4 pb-2 flex-shrink-0">
        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekLabels.map((label) => (
            <div key={label} className="text-center text-xs text-muted-foreground py-1">
              {label}
            </div>
          ))}
        </div>
        {/* 日期格子 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((d, idx) => {
            const isCurrentMonth = isSameMonth(d, currentMonth);
            const isToday = isSameDay(d, today);
            const hasEvent = hasSchedule(d);
            const isSelected = isSameDay(d, selectedDate);

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(d)}
                className={`
                  aspect-square flex items-center justify-center text-xs rounded cursor-pointer relative
                  ${!isCurrentMonth ? "text-muted-foreground/40" : ""}
                  ${isToday ? "bg-primary/20 text-primary font-bold" : ""}
                  ${isSelected && !isToday ? "bg-primary text-primary-foreground" : ""}
                  ${!isToday && !isSelected ? "hover:bg-muted" : ""}
                `}
              >
                {format(d, "d")}
                {hasEvent && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 我的日程标题 */}
      <div className="px-4 py-2 border-t border-border flex-shrink-0">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-1">
          <span className="text-foreground">·我的</span>
          <span className="text-primary">日程</span>
          <Play className="w-3 h-3 text-primary fill-primary" />
        </h3>
      </div>

      {/* 日程列表 */}
      <ScrollArea className="flex-1 px-4 pb-4">
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-4">加载中...</div>
        ) : upcomingSchedules.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">暂无日程</div>
        ) : (
          <div className="space-y-2">
            {upcomingSchedules.map((item, idx) => {
              const overdueDays = getOverdueDays(item.schedule_date);
              return (
                <div 
                  key={item.id} 
                  onClick={() => openEditDialog(item)}
                  className="p-2 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-foreground truncate">
                          {item.title}
                        </span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 flex-shrink-0 bg-accent/10 text-accent border-accent/30">
                          <Clock className="w-3 h-3 mr-0.5" />
                          {item.start_time.slice(0, 5)}-{item.end_time.slice(0, 5)}
                        </Badge>
                      </div>
                    </div>
                    {overdueDays > 0 ? (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                        <AlertCircle className="w-3 h-3 mr-0.5" />
                        已超期{overdueDays}天
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* 新增/编辑日程对话框 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>{editingSchedule ? "编辑日程" : "新增日程"}</DialogTitle>
            <DialogDescription>
              {editingSchedule ? "修改日程信息" : "添加新的日程安排"}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label>人员</Label>
              <Input
                value={currentUser?.name || ""}
                disabled
                className="bg-muted"
              />
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
          </div>
          <div className="px-6 py-4 border-t bg-background flex justify-end gap-2">
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

export default SchedulePanel;
