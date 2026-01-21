import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw, ChevronLeft, ChevronRight, Trash2, Edit, Shield } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";
import LeaderSchedulePermissions from "./LeaderSchedulePermissions";

interface Leader {
  id: string;
  name: string;
  position: string | null;
}

interface Schedule {
  id: string;
  leader_id: string;
  title: string;
  location: string | null;
  schedule_date: string;
  start_time: string;
  end_time: string;
  schedule_type: string;
  notes: string | null;
  leader?: Leader;
}

const scheduleTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  internal_meeting: { bg: "bg-blue-600", text: "text-white", label: "内部会议" },
  party_activity: { bg: "bg-red-700", text: "text-white", label: "党政重要活动" },
  research_trip: { bg: "bg-amber-500", text: "text-white", label: "调研/外出" },
};

const timeSlots = Array.from({ length: 10 }, (_, i) => {
  const hour = 8 + i;
  return `${hour.toString().padStart(2, "0")}:00`;
});

const LeaderScheduleManagement = () => {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [activeTab, setActiveTab] = useState("schedule");

  // 表单状态
  const [formData, setFormData] = useState({
    leader_id: "",
    title: "",
    location: "",
    schedule_date: "",
    start_time: "09:00",
    end_time: "10:00",
    schedule_type: "internal_meeting",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchLeaders(), fetchSchedules()]);
    setLoading(false);
  };

  const fetchLeaders = async () => {
    // 获取领导（假设职位包含"长"、"书记"、"主任"等的为领导）
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, position")
      .eq("is_active", true)
      .or("position.ilike.%长%,position.ilike.%书记%,position.ilike.%主任%,position.ilike.%处长%")
      .order("sort_order");

    if (error) {
      console.error("获取领导列表失败:", error);
      return;
    }
    setLeaders(data || []);
  };

  const fetchSchedules = async () => {
    const weekEnd = addDays(currentWeekStart, 6);
    
    const { data, error } = await supabase
      .from("leader_schedules")
      .select(`
        *,
        leader:contacts!leader_id(id, name, position)
      `)
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(weekEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");

    if (error) {
      console.error("获取日程失败:", error);
      return;
    }
    setSchedules(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.leader_id || !formData.title || !formData.schedule_date) {
      toast.error("请填写必填项");
      return;
    }

    const scheduleData = {
      leader_id: formData.leader_id,
      title: formData.title,
      location: formData.location || null,
      schedule_date: formData.schedule_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      schedule_type: formData.schedule_type,
      notes: formData.notes || null,
    };

    let error;
    if (editingSchedule) {
      const result = await supabase
        .from("leader_schedules")
        .update(scheduleData)
        .eq("id", editingSchedule.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("leader_schedules")
        .insert(scheduleData);
      error = result.error;
    }

    if (error) {
      toast.error(editingSchedule ? "更新失败" : "添加失败");
      console.error(error);
      return;
    }

    toast.success(editingSchedule ? "日程已更新" : "日程已添加");
    setDialogOpen(false);
    resetForm();
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条日程吗？")) return;

    const { error } = await supabase
      .from("leader_schedules")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("日程已删除");
    fetchSchedules();
  };

  const resetForm = () => {
    setFormData({
      leader_id: "",
      title: "",
      location: "",
      schedule_date: "",
      start_time: "09:00",
      end_time: "10:00",
      schedule_type: "internal_meeting",
      notes: "",
    });
    setEditingSchedule(null);
  };

  const openEditDialog = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      leader_id: schedule.leader_id,
      title: schedule.title,
      location: schedule.location || "",
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      schedule_type: schedule.schedule_type,
      notes: schedule.notes || "",
    });
    setDialogOpen(true);
  };

  // 获取一周的日期
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  // 获取某个领导某天的日程
  const getSchedulesForLeaderAndDay = (leaderId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter(s => s.leader_id === leaderId && s.schedule_date === dateStr);
  };

  // 计算日程块的位置和宽度
  const getScheduleStyle = (schedule: Schedule) => {
    const [startHour, startMin] = schedule.start_time.split(":").map(Number);
    const [endHour, endMin] = schedule.end_time.split(":").map(Number);
    
    const startOffset = (startHour - 8) + startMin / 60;
    const duration = (endHour - startHour) + (endMin - startMin) / 60;
    
    const left = `${(startOffset / 10) * 100}%`;
    const width = `${(duration / 10) * 100}%`;
    
    return { left, width };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>领导日程管理</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="schedule">日程管理</TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="w-4 h-4" />
              权限管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            {/* 图例和工具栏 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {Object.entries(scheduleTypeColors).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${value.bg}`}></div>
                    <span className="text-sm text-muted-foreground">{value.label}</span>
                  </div>
                ))}
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    添加日程
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingSchedule ? "编辑日程" : "添加日程"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>领导 *</Label>
                      <Select value={formData.leader_id} onValueChange={(v) => setFormData({ ...formData, leader_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择领导" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaders.map((leader) => (
                            <SelectItem key={leader.id} value={leader.id}>
                              {leader.name} - {leader.position}
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
                        <Label>类型</Label>
                        <Select value={formData.schedule_type} onValueChange={(v) => setFormData({ ...formData, schedule_type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="internal_meeting">内部会议</SelectItem>
                            <SelectItem value="party_activity">党政重要活动</SelectItem>
                            <SelectItem value="research_trip">调研/外出</SelectItem>
                          </SelectContent>
                        </Select>
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
                      <Label>地点</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="输入地点"
                      />
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                      <Button onClick={handleSubmit}>{editingSchedule ? "更新" : "添加"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* 周导航 */}
            <div className="flex items-center justify-between mb-4 px-2">
              <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一周
              </Button>
              <span className="font-medium">
                {format(currentWeekStart, "yyyy年MM月dd日", { locale: zhCN })} - {format(addDays(currentWeekStart, 6), "MM月dd日", { locale: zhCN })}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                下一周
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : leaders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无领导数据，请先在通讯录中添加领导信息
              </div>
            ) : (
              /* 日程表格 */
              <div className="border rounded-lg overflow-hidden">
                {/* 表头 - 日期 */}
                <div className="grid bg-red-800 text-white" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                  <div className="p-2 border-r border-red-700 text-center font-medium">姓名</div>
                  {weekDays.map((day, idx) => (
                    <div key={idx} className="p-2 border-r border-red-700 last:border-r-0 text-center">
                      <div className="font-medium">{weekDayNames[idx]}</div>
                      <div className="text-sm opacity-80">{format(day, "MM/dd")}</div>
                    </div>
                  ))}
                </div>

                {/* 表头 - 上午/下午 */}
                <div className="grid bg-muted border-b" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                  <div className="p-1 border-r text-center text-xs text-muted-foreground"></div>
                  {weekDays.map((_, idx) => (
                    <div key={idx} className="grid grid-cols-2 border-r last:border-r-0">
                      <div className="p-1 text-center text-xs border-r">上午</div>
                      <div className="p-1 text-center text-xs">下午</div>
                    </div>
                  ))}
                </div>

                {/* 领导日程行 */}
                {leaders.map((leader) => (
                  <div key={leader.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                    <div className="p-2 border-r bg-muted/50 flex items-center justify-center">
                      <span className="font-medium text-sm">{leader.name}</span>
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const daySchedules = getSchedulesForLeaderAndDay(leader.id, day);
                      return (
                        <div key={dayIdx} className="relative border-r last:border-r-0 min-h-[60px] p-1">
                          {/* 时间分隔线 */}
                          <div className="absolute inset-0 grid grid-cols-10">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div key={i} className="border-r border-dashed border-muted-foreground/20 last:border-r-0"></div>
                            ))}
                          </div>
                          {/* 日程块 */}
                          <div className="relative z-10 space-y-1">
                            {daySchedules.map((schedule) => {
                              const colors = scheduleTypeColors[schedule.schedule_type] || scheduleTypeColors.internal_meeting;
                              return (
                                <div
                                  key={schedule.id}
                                  className={`group ${colors.bg} ${colors.text} rounded px-1 py-0.5 text-xs cursor-pointer relative`}
                                  onClick={() => openEditDialog(schedule)}
                                >
                                  <div className="font-medium truncate">{schedule.title}</div>
                                  <div className="opacity-80 text-[10px]">
                                    {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
                                  </div>
                                  <button
                                    className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(schedule.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="permissions">
            <LeaderSchedulePermissions leaders={leaders} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default LeaderScheduleManagement;
