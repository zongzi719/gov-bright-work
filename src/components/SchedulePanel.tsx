import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as dataAdapter from "@/lib/dataAdapter";
import { toast } from "sonner";
import { format, startOfWeek, addDays, subWeeks, addWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";
import { normalizeDate, normalizeTime } from "@/lib/utils";

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
  const navigate = useNavigate();
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

  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
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
  // 两周视图：当前周 + 下一周
  const weekDays = Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));
  const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  const fetchSchedules = async () => {
    if (!currentUser?.id) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // 获取两周的数据
    const twoWeeksEnd = addDays(currentWeekStart, 13);
    const { data, error } = await dataAdapter.getSchedules({
      contact_id: currentUser.id,
      start_date: format(currentWeekStart, "yyyy-MM-dd"),
      end_date: format(twoWeeksEnd, "yyyy-MM-dd"),
    });

    if (!error && data) {
      setSchedules(data as Schedule[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, [currentWeekStart, currentUser?.id]);

  const getSchedulesForDay = (date: Date): Schedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter((s) => {
      // 兼容 "2026-03-11" 和 "2026-03-11T16:00:00.000Z" 两种格式
      const sDate = s.schedule_date.includes('T') 
        ? format(new Date(s.schedule_date), "yyyy-MM-dd")
        : s.schedule_date;
      return sDate === dateStr;
    });
  };

  const hasSchedule = (date: Date): boolean => {
    return getSchedulesForDay(date).length > 0;
  };

  const isToday = (date: Date): boolean => {
    return format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  };

  const isSelected = (date: Date): boolean => {
    return format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
  };

  const selectedDateSchedules = getSchedulesForDay(selectedDate);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  // 两周导航
  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 2));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 2));

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

  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return "";
    if (dateStr.includes('T') || dateStr.includes('Z')) {
      return format(new Date(dateStr), "yyyy-MM-dd");
    }
    return dateStr.substring(0, 10);
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      contact_id: schedule.contact_id,
      title: schedule.title,
      schedule_date: normalizeDate(schedule.schedule_date),
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
        const { error } = await dataAdapter.updateSchedule(editingSchedule.id, {
          title: formData.title,
          schedule_date: formData.schedule_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          location: formData.location || null,
          notes: formData.notes || null,
        });

        if (error) {
          toast.error("修改日程失败");
          console.error(error);
        } else {
          toast.success("日程已修改");
          closeDialog();
          fetchSchedules();
        }
      } else {
        const { error } = await dataAdapter.createSchedule({
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

    const { error } = await dataAdapter.deleteSchedule(scheduleToDelete.id);

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
      <div className="px-3 md:px-4 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="gov-card-title text-sm md:text-base">日程管理</h2>
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => navigate("/schedule-list")}
            className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer"
          >
            查看全部
          </button>
          <button 
            onClick={openAddDialog} 
            className="flex items-center justify-center rounded"
            style={{ 
              width: '28px', 
              height: '28px', 
              backgroundColor: '#3b82f6', 
              color: 'white',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-2 md:p-3 flex-1 flex flex-col overflow-hidden">
        {/* 日历头部 */}
        <div className="flex items-center justify-between flex-shrink-0">
          <span className="font-medium text-foreground text-sm">
            {format(currentWeekStart, "yyyy年M月", { locale: zhCN })}
          </span>
          <div className="flex items-center gap-1">
            <button 
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }} 
              onClick={handlePrevWeek}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: '#6b7280' }} />
            </button>
            <span style={{ fontSize: '12px', color: '#6b7280', padding: '0 4px' }}>两周</span>
            <button 
              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }} 
              onClick={handleNextWeek}
            >
              <ChevronRight className="w-4 h-4" style={{ color: '#6b7280' }} />
            </button>
          </div>
        </div>

        {/* 两周日期视图 */}
        <div className="mt-2 flex-shrink-0 space-y-1">
          {/* 第一周 */}
          <div className="grid grid-cols-7 gap-1">
            {weekLabels.map((label, idx) => (
              <div key={`week1-${label}`} className="text-center">
                <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                <div
                  onClick={() => handleDateClick(weekDays[idx])}
                  className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center cursor-pointer text-xs transition-all ${
                    isSelected(weekDays[idx])
                      ? "bg-primary text-primary-foreground"
                      : isToday(weekDays[idx])
                        ? "bg-primary/20 text-primary font-medium"
                        : hasSchedule(weekDays[idx])
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                  }`}
                >
                  {format(weekDays[idx], "d")}
                </div>
              </div>
            ))}
          </div>
          {/* 第二周 */}
          <div className="grid grid-cols-7 gap-1">
            {weekLabels.map((label, idx) => (
              <div key={`week2-${label}`} className="text-center">
                <div
                  onClick={() => handleDateClick(weekDays[idx + 7])}
                  className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center cursor-pointer text-xs transition-all ${
                    isSelected(weekDays[idx + 7])
                      ? "bg-primary text-primary-foreground"
                      : isToday(weekDays[idx + 7])
                        ? "bg-primary/20 text-primary font-medium"
                        : hasSchedule(weekDays[idx + 7])
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                  }`}
                >
                  {format(weekDays[idx + 7], "d")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 选中日期标题 - 紧凑 */}
        {/* <div className="mt-3 pt-2 flex-shrink-0 border-t border-border">
          <span className="text-xs font-medium text-muted-foreground">
            {format(selectedDate, "M月d日 EEEE", { locale: zhCN })}
          </span>
        </div> */}

        {/* 日程列表 - 可滚动 */}
        <ScrollArea className="flex-1 mt-2">
          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-4">加载中...</div>
          ) : selectedDateSchedules.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">暂无日程</div>
          ) : (
            <div className="space-y-1.5 pr-2">
              {selectedDateSchedules.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openEditDialog(item)}
                  className="flex items-center gap-2 text-sm group hover:bg-muted/50 rounded px-2 py-1.5 transition-colors cursor-pointer"
                >
                  <span className="text-primary font-medium w-12 flex-shrink-0 text-xs">
                    {item.start_time.slice(0, 5)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate text-sm">{item.title}</div>
                    {item.location && <div className="text-muted-foreground text-xs truncate">{item.location}</div>}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(item);
                      }}
                      className="p-1 hover:bg-primary/10 rounded"
                    >
                      <Pencil className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button onClick={(e) => openDeleteDialog(item, e)} className="p-1 hover:bg-destructive/10 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
        <DialogContent className="max-w-lg max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>{editingSchedule ? "编辑日程" : "新增日程"}</DialogTitle>
            <DialogDescription>{editingSchedule ? "修改日程信息" : "添加新的日程安排"}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label>人员</Label>
              <Input value={currentUser?.name || ""} disabled className="bg-muted" />
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
              {submitting ? (editingSchedule ? "保存中..." : "添加中...") : editingSchedule ? "保存" : "添加"}
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
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SchedulePanel;
