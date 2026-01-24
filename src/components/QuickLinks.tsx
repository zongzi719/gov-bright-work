import { useState, useEffect } from "react";
import { LogOut, Package, Calendar, Plus, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  department: string | null;
  organization?: { name: string } | null;
}

interface OfficeSupply {
  id: string;
  name: string;
  specification: string | null;
  unit: string;
  current_stock: number;
  is_active: boolean;
}

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

type AbsenceType = "out" | "leave" | "business_trip";

const scheduleTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  internal_meeting: { bg: "bg-blue-600", text: "text-white", label: "内部会议" },
  party_activity: { bg: "bg-red-700", text: "text-white", label: "党政重要活动" },
  research_trip: { bg: "bg-amber-500", text: "text-white", label: "调研/外出" },
};

const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const QuickLinks = () => {
  // Absence Dialog State
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [absenceForm, setAbsenceForm] = useState({
    contact_id: "",
    type: "out" as AbsenceType,
    reason: "",
    start_time: undefined as Date | undefined,
    end_time: undefined as Date | undefined,
    notes: "",
  });

  // Supply Dialog State
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [supplyForm, setSupplyForm] = useState({
    supply_id: "",
    quantity: 1,
    requisition_by: "",
  });

  // Leader Schedule Dialog State
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Week days array
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Fetch contacts for absence form
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

  // Fetch supplies for requisition form
  const fetchSupplies = async () => {
    const { data, error } = await supabase
      .from("office_supplies")
      .select("*")
      .eq("is_active", true)
      .order("name");
    
    if (!error && data) {
      setSupplies(data);
    }
  };

  // Fetch leaders
  const fetchLeaders = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, position")
      .eq("is_active", true)
      .or("position.ilike.%长%,position.ilike.%书记%,position.ilike.%主任%,position.ilike.%处长%")
      .order("sort_order");
    
    if (data) {
      setLeaders(data);
    }
  };

  // Fetch schedules for current week
  const fetchSchedules = async () => {
    setScheduleLoading(true);
    const weekEnd = addDays(currentWeekStart, 6);
    const { data } = await supabase
      .from("leader_schedules")
      .select("*, leader:contacts(id, name, position)")
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(weekEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");
    
    if (data) {
      setSchedules(data as Schedule[]);
    }
    setScheduleLoading(false);
  };

  // Get schedules for a specific leader and day
  const getSchedulesForLeaderAndDay = (leaderId: string, date: Date): Schedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return schedules.filter(
      (s) => s.leader_id === leaderId && s.schedule_date === dateStr
    );
  };

  // Submit absence record
  const handleAbsenceSubmit = async () => {
    if (!absenceForm.contact_id || !absenceForm.reason || !absenceForm.start_time) {
      toast.error("请填写必填项");
      return;
    }

    const { error } = await supabase.from("absence_records").insert({
      contact_id: absenceForm.contact_id,
      type: absenceForm.type,
      reason: absenceForm.reason,
      start_time: absenceForm.start_time.toISOString(),
      end_time: absenceForm.end_time?.toISOString() || null,
      notes: absenceForm.notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("添加记录失败");
      console.error(error);
    } else {
      toast.success("外出记录已提交，等待审批");
      setAbsenceDialogOpen(false);
      setAbsenceForm({
        contact_id: "",
        type: "out",
        reason: "",
        start_time: undefined,
        end_time: undefined,
        notes: "",
      });
    }
  };

  // Submit supply requisition
  const handleSupplySubmit = async () => {
    if (!supplyForm.supply_id) {
      toast.error("请选择办公用品");
      return;
    }
    if (!supplyForm.requisition_by.trim()) {
      toast.error("请输入领用人");
      return;
    }
    if (supplyForm.quantity < 1) {
      toast.error("数量必须大于0");
      return;
    }

    const supply = supplies.find((s) => s.id === supplyForm.supply_id);
    if (supply && supplyForm.quantity > supply.current_stock) {
      toast.error(`库存不足，当前库存: ${supply.current_stock}`);
      return;
    }

    const { error } = await supabase.from("supply_requisitions").insert({
      supply_id: supplyForm.supply_id,
      quantity: supplyForm.quantity,
      requisition_by: supplyForm.requisition_by.trim(),
    });

    if (error) {
      toast.error("提交领用申请失败");
    } else {
      toast.success("领用申请已提交");
      setSupplyDialogOpen(false);
      setSupplyForm({
        supply_id: "",
        quantity: 1,
        requisition_by: "",
      });
    }
  };

  // Open dialogs with data fetch
  const openAbsenceDialog = () => {
    fetchContacts();
    setAbsenceDialogOpen(true);
  };

  const openSupplyDialog = () => {
    fetchSupplies();
    setSupplyDialogOpen(true);
  };

  const openScheduleDialog = async () => {
    setScheduleDialogOpen(true);
    await Promise.all([fetchLeaders(), fetchSchedules()]);
  };

  // Handle week navigation
  const handlePrevWeek = async () => {
    const newStart = subWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newStart);
  };

  const handleNextWeek = async () => {
    const newStart = addWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newStart);
  };

  // Fetch schedules when week changes
  useEffect(() => {
    if (scheduleDialogOpen) {
      fetchSchedules();
    }
  }, [currentWeekStart, scheduleDialogOpen]);

  const modules = [
    {
      id: 1,
      name: "外出管理",
      shortName: "外",
      color: "bg-primary",
      icon: LogOut,
      onClick: openAbsenceDialog,
    },
    {
      id: 2,
      name: "办公用品",
      shortName: "品",
      color: "bg-emerald-500",
      icon: Package,
      onClick: openSupplyDialog,
    },
    {
      id: 3,
      name: "领导日程",
      shortName: "程",
      color: "bg-blue-500",
      icon: Calendar,
      onClick: openScheduleDialog,
    },
  ];

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">快捷入口</h2>
      </div>

      {/* 模块网格 */}
      <div className="p-5 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-6 w-full max-w-xs">
          {modules.map((module) => (
            <div
              key={module.id}
              className="app-icon cursor-pointer group"
              onClick={module.onClick}
            >
              <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform`}>
                <module.icon className="w-5 h-5" />
              </div>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {module.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 外出管理对话框 - 与后台一致 */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增外出/请假记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>人员 *</Label>
              <Select
                value={absenceForm.contact_id}
                onValueChange={(value) => setAbsenceForm({ ...absenceForm, contact_id: value })}
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
              <Label>类型 *</Label>
              <Select
                value={absenceForm.type}
                onValueChange={(value: AbsenceType) => setAbsenceForm({ ...absenceForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">外出</SelectItem>
                  <SelectItem value="business_trip">出差</SelectItem>
                  <SelectItem value="leave">请假</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>事由 *</Label>
              <Textarea
                value={absenceForm.reason}
                onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                placeholder="请输入事由"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !absenceForm.start_time && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {absenceForm.start_time
                        ? format(absenceForm.start_time, "yyyy-MM-dd", { locale: zhCN })
                        : "选择日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={absenceForm.start_time}
                      onSelect={(date) => setAbsenceForm({ ...absenceForm, start_time: date })}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>结束时间</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !absenceForm.end_time && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {absenceForm.end_time
                        ? format(absenceForm.end_time, "yyyy-MM-dd", { locale: zhCN })
                        : "选择日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={absenceForm.end_time}
                      onSelect={(date) => setAbsenceForm({ ...absenceForm, end_time: date })}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                value={absenceForm.notes}
                onChange={(e) => setAbsenceForm({ ...absenceForm, notes: e.target.value })}
                placeholder="可选备注"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAbsenceDialogOpen(false);
                  setAbsenceForm({
                    contact_id: "",
                    type: "out",
                    reason: "",
                    start_time: undefined,
                    end_time: undefined,
                    notes: "",
                  });
                }}
              >
                取消
              </Button>
              <Button onClick={handleAbsenceSubmit}>提交</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 办公用品领用对话框 - 与后台一致 */}
      <Dialog open={supplyDialogOpen} onOpenChange={setSupplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建领用申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>办公用品 *</Label>
              <Select
                value={supplyForm.supply_id}
                onValueChange={(value) => setSupplyForm({ ...supplyForm, supply_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择办公用品" />
                </SelectTrigger>
                <SelectContent>
                  {supplies
                    .filter((s) => s.is_active && s.current_stock > 0)
                    .map((supply) => (
                      <SelectItem key={supply.id} value={supply.id}>
                        {supply.name}
                        {supply.specification ? ` (${supply.specification})` : ""} - 库存: {supply.current_stock}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>领用数量 *</Label>
                <Input
                  type="number"
                  min={1}
                  value={supplyForm.quantity}
                  onChange={(e) => setSupplyForm({ ...supplyForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>领用人 *</Label>
                <Input
                  value={supplyForm.requisition_by}
                  onChange={(e) => setSupplyForm({ ...supplyForm, requisition_by: e.target.value })}
                  placeholder="输入领用人姓名"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSupplyDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSupplySubmit}>提交申请</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 领导日程查看对话框 - 与后台样式一致 */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>领导日程</DialogTitle>
          </DialogHeader>
          
          {/* 周导航 - 与后台一致 */}
          <div className="flex items-center justify-between mb-4 px-2">
            <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一周
            </Button>
            <span className="font-medium">
              {format(currentWeekStart, "yyyy年MM月dd日", { locale: zhCN })} - {format(addDays(currentWeekStart, 6), "MM月dd日", { locale: zhCN })}
            </span>
            <Button variant="ghost" size="sm" onClick={handleNextWeek}>
              下一周
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {scheduleLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无领导数据
            </div>
          ) : (
            /* 日程表格 - 与后台一致 */
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
                                className={`${colors.bg} ${colors.text} rounded px-1 py-0.5 text-xs`}
                              >
                                <div className="font-medium truncate">{schedule.title}</div>
                                <div className="opacity-80 text-[10px]">
                                  {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
                                </div>
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickLinks;
