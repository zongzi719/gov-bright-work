import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, addDays, isSameMonth, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Calendar, List, MapPin, Clock } from "lucide-react";
import { normalizeDate, normalizeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageLayout from "@/components/PageLayout";
import * as dataAdapter from "@/lib/dataAdapter";
import { toast } from "sonner";

interface Schedule {
  id: string;
  contact_id: string;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  contact?: { id: string; name: string; department: string | null; organization?: { name: string } | null };
}

const ScheduleList = () => {
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) return JSON.parse(userStr);
    } catch (e) { console.error(e); }
    return null;
  };

  const currentUser = getCurrentUser();
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    schedule_date: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    notes: "",
  });

  const fetchSchedules = async () => {
    if (!currentUser?.id) { setSchedules([]); setLoading(false); return; }
    setLoading(true);
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const { data, error } = await dataAdapter.getSchedules({
      contact_id: currentUser.id,
      start_date: start,
      end_date: end,
    });
    if (!error && data) setSchedules(data as Schedule[]);
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, [currentMonth, currentUser?.id]);

  const getSchedulesForDay = (date: Date): Schedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter((s) => normalizeDate(s.schedule_date) === dateStr);
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays: Date[] = [];
  for (let i = 0; i < 42; i++) calendarDays.push(addDays(calendarStart, i));

  const selectedDateSchedules = getSchedulesForDay(selectedDate);

  // All schedules sorted for list view
  const allSchedulesSorted = [...schedules].sort((a, b) => {
    const dateA = a.schedule_date + a.start_time;
    const dateB = b.schedule_date + b.start_time;
    return dateA.localeCompare(dateB);
  });

  const resetForm = () => {
    setFormData({ title: "", schedule_date: "", start_time: "09:00", end_time: "10:00", location: "", notes: "" });
    setEditingSchedule(null);
  };

  const openAddDialog = () => { resetForm(); setFormData(f => ({ ...f, schedule_date: format(selectedDate, "yyyy-MM-dd") })); setDialogOpen(true); };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      title: schedule.title,
      schedule_date: schedule.schedule_date.includes("T") ? format(new Date(schedule.schedule_date), "yyyy-MM-dd") : schedule.schedule_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      location: schedule.location || "",
      notes: schedule.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!currentUser?.id || !formData.title || !formData.schedule_date) { toast.error("请填写必填项"); return; }
    setSubmitting(true);
    try {
      const payload = {
        contact_id: currentUser.id,
        title: formData.title,
        schedule_date: formData.schedule_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        location: formData.location || null,
        notes: formData.notes || null,
      };
      if (editingSchedule) {
        const { error } = await dataAdapter.updateSchedule(editingSchedule.id, payload);
        if (error) toast.error("修改失败"); else { toast.success("已修改"); setDialogOpen(false); resetForm(); fetchSchedules(); }
      } else {
        const { error } = await dataAdapter.createSchedule(payload);
        if (error) toast.error("添加失败"); else { toast.success("已添加"); setDialogOpen(false); resetForm(); fetchSchedules(); }
      }
    } finally { setSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    const { error } = await dataAdapter.deleteSchedule(scheduleToDelete.id);
    if (error) toast.error("删除失败"); else { toast.success("已删除"); fetchSchedules(); }
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  };

  const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">我的日程</h1>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list")}>
              <TabsList className="h-8">
                <TabsTrigger value="calendar" className="text-xs px-3 h-7"><Calendar className="w-3.5 h-3.5 mr-1" />日历</TabsTrigger>
                <TabsTrigger value="list" className="text-xs px-3 h-7"><List className="w-3.5 h-3.5 mr-1" />列表</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={openAddDialog}><Plus className="w-4 h-4 mr-1" />新增日程</Button>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="font-semibold text-foreground">{format(currentMonth, "yyyy年M月", { locale: zhCN })}</span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekLabels.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const daySchedules = getSchedulesForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelectedDay = isSameDay(day, selectedDate);
                  const isTodayDay = isSameDay(day, today);
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={`relative min-h-[60px] p-1 rounded-md cursor-pointer transition-colors border ${
                        isSelectedDay
                          ? "border-primary bg-primary/5"
                          : isTodayDay
                            ? "border-primary/30 bg-primary/5"
                            : "border-transparent hover:bg-muted/50"
                      } ${!isCurrentMonth ? "opacity-30" : ""}`}
                    >
                      <div className={`text-xs text-right ${isTodayDay ? "text-primary font-bold" : "text-foreground"}`}>
                        {format(day, "d")}
                      </div>
                      {daySchedules.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {daySchedules.slice(0, 2).map((s) => (
                            <div key={s.id} className="text-[10px] bg-primary/10 text-primary rounded px-1 truncate">
                              {s.title}
                            </div>
                          ))}
                          {daySchedules.length > 2 && (
                            <div className="text-[10px] text-muted-foreground text-center">+{daySchedules.length - 2}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected day detail */}
            <div className="bg-card border border-border rounded-lg p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground text-sm">
                  {format(selectedDate, "M月d日 EEEE", { locale: zhCN })}
                </h3>
                <Button variant="ghost" size="sm" onClick={openAddDialog}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="text-sm text-muted-foreground text-center py-8">加载中...</div>
                ) : selectedDateSchedules.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">当日暂无日程</div>
                ) : (
                  <div className="space-y-2">
                    {selectedDateSchedules.map((item) => (
                      <div key={item.id} className="border border-border rounded-md p-3 hover:bg-muted/30 transition-colors group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground truncate">{item.title}</div>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</span>
                            </div>
                            {item.location && (
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" /><span className="truncate">{item.location}</span>
                              </div>
                            )}
                            {item.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.notes}</div>}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(item)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setScheduleToDelete(item); setDeleteDialogOpen(true); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        ) : (
          /* List view */
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="font-semibold text-foreground">{format(currentMonth, "yyyy年M月", { locale: zhCN })}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="w-4 h-4" /></Button>
              </div>
              <span className="text-sm text-muted-foreground">共 {allSchedulesSorted.length} 条日程</span>
            </div>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">加载中...</div>
            ) : allSchedulesSorted.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">本月暂无日程</div>
            ) : (
              <div className="divide-y divide-border">
                {allSchedulesSorted.map((item) => {
                  const dateStr = item.schedule_date.includes("T")
                    ? format(new Date(item.schedule_date), "MM-dd EEEE", { locale: zhCN })
                    : format(new Date(item.schedule_date + "T00:00:00"), "MM-dd EEEE", { locale: zhCN });
                  return (
                    <div key={item.id} className="flex items-center px-4 py-3 hover:bg-muted/30 transition-colors group">
                      <div className="w-28 flex-shrink-0 text-sm text-muted-foreground">{dateStr}</div>
                      <div className="w-24 flex-shrink-0 text-sm text-primary font-medium">
                        {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {item.location && <span className="text-xs text-muted-foreground ml-2">📍 {item.location}</span>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setScheduleToDelete(item); setDeleteDialogOpen(true); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "编辑日程" : "新增日程"}</DialogTitle>
            <DialogDescription>{editingSchedule ? "修改日程信息" : "添加新的日程安排"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>日程标题 *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="输入日程标题" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>日期 *</Label>
                <Input type="date" value={formData.schedule_date} onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>地点</Label>
                <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="输入地点" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="输入备注" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "保存中..." : "保存"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除日程「{scheduleToDelete?.title}」吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default ScheduleList;
