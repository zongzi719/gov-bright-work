import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  // Get current user from localStorage
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

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // 编辑相关状态
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  
  // 删除确认相关状态
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
  // 显示近两周14天
  const weekDays = Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));
  // 星期标签
  const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  // 获取日程 - 只获取当前登录用户的日程
  const fetchSchedules = async () => {
    if (!currentUser?.id) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const twoWeeksEnd = addDays(currentWeekStart, 13);
    const { data, error } = await supabase
      .from("schedules")
      .select("*, contact:contacts(id, name, department)")
      .eq("contact_id", currentUser.id)
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(twoWeeksEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");

    if (!error && data) {
      setSchedules(data as Schedule[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [currentWeekStart, currentUser?.id]);

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

  // 检查是否是选中的日期
  const isSelected = (date: Date): boolean => {
    return format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
  };

  // 获取选中日期的日程
  const selectedDateSchedules = getSchedulesForDay(selectedDate);

  // 点击日期
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  // 周导航（两周）
  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 2));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 2));

  // 重置表单
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

  // 打开新增对话框
  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // 打开编辑对话框
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

  // 关闭对话框
  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  // 提交日程（新增或编辑）
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
        // 编辑模式
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
        // 新增模式
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

  // 打开删除确认对话框
  const openDeleteDialog = (schedule: Schedule, e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  // 确认删除日程
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
    <div className="gov-card min-h-[480px] flex flex-col">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="gov-card-title">日程管理</h2>
        <Button size="sm" variant="ghost" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {/* 日历头部 */}
        <div className="flex items-center justify-between flex-shrink-0">
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

        {/* 星期标签 - 两行日期 */}
        <div className="mt-4 flex-shrink-0">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekLabels.map((label) => (
              <div 
                key={label} 
                className="text-center text-xs text-muted-foreground py-1"
              >
                {label}
              </div>
            ))}
          </div>
          {/* 第一周 */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.slice(0, 7).map((day) => (
              <div
                key={format(day, "yyyy-MM-dd")}
                onClick={() => handleDateClick(day)}
                className={`calendar-day cursor-pointer transition-all ${
                  isSelected(day) ? "ring-2 ring-primary ring-offset-1" : ""
                } ${isToday(day) ? "calendar-day-today" : ""} ${
                  hasSchedule(day) && !isToday(day) && !isSelected(day) ? "calendar-day-event" : ""
                }`}
              >
                {format(day, "d")}
              </div>
            ))}
          </div>
          {/* 第二周 */}
          <div className="grid grid-cols-7 gap-1 mt-1">
            {weekDays.slice(7, 14).map((day) => (
              <div
                key={format(day, "yyyy-MM-dd")}
                onClick={() => handleDateClick(day)}
                className={`calendar-day cursor-pointer transition-all ${
                  isSelected(day) ? "ring-2 ring-primary ring-offset-1" : ""
                } ${isToday(day) ? "calendar-day-today" : ""} ${
                  hasSchedule(day) && !isToday(day) && !isSelected(day) ? "calendar-day-event" : ""
                }`}
              >
                {format(day, "d")}
              </div>
            ))}
          </div>
        </div>

        {/* 选中日期的标题 */}
        <div className="mt-5 mb-2 flex-shrink-0 border-t border-border pt-4">
          <span className="text-sm font-medium text-foreground">
            {format(selectedDate, "M月d日 EEEE", { locale: zhCN })} 日程
          </span>
        </div>

        {/* 选中日期的日程列表 */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[120px]">
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">加载中...</div>
          ) : selectedDateSchedules.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">该日暂无日程</div>
          ) : (
            selectedDateSchedules.map((item) => (
              <div 
                key={item.id} 
                onClick={() => openEditDialog(item)}
                className="flex items-start gap-3 text-sm group hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors cursor-pointer"
              >
                <span className="text-primary font-medium w-12 flex-shrink-0">
                  {item.start_time.slice(0, 5)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground line-clamp-2">
                    {item.title}
                  </div>
                  {item.location && (
                    <div className="text-muted-foreground text-xs mt-0.5 truncate">
                      {item.location}
                    </div>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(item);
                    }}
                    className="p-1 hover:bg-primary/10 rounded"
                    title="编辑日程"
                  >
                    <Pencil className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={(e) => openDeleteDialog(item, e)}
                    className="p-1 hover:bg-destructive/10 rounded"
                    title="删除日程"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialog}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (editingSchedule ? "保存中..." : "添加中...") : (editingSchedule ? "保存" : "添加")}
              </Button>
            </div>
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
