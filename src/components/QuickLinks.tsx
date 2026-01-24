import { useState, useEffect } from "react";
import { LogOut, Package, Calendar, Plus, Eye } from "lucide-react";
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
import { format, startOfWeek, addDays } from "date-fns";
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

const absenceTypeLabels: Record<AbsenceType, string> = {
  out: "外出",
  leave: "请假",
  business_trip: "出差",
};

const scheduleTypeLabels: Record<string, string> = {
  internal_meeting: "内部会议",
  party_activity: "党政活动",
  research_trip: "调研/外出",
};

const QuickLinks = () => {
  // Absence Dialog State
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [absenceForm, setAbsenceForm] = useState({
    contact_id: "",
    type: "out" as AbsenceType,
    reason: "",
    start_time: null as Date | null,
    end_time: null as Date | null,
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

  // Fetch leaders and schedules
  const fetchLeadersAndSchedules = async () => {
    // Fetch leaders
    const { data: leadersData } = await supabase
      .from("contacts")
      .select("id, name, position")
      .eq("is_active", true)
      .or("position.ilike.%主任%,position.ilike.%局长%,position.ilike.%书记%,position.ilike.%领导%")
      .order("sort_order");
    
    if (leadersData) {
      setLeaders(leadersData);
    }

    // Fetch schedules for current week
    const weekEnd = addDays(currentWeekStart, 6);
    const { data: schedulesData } = await supabase
      .from("leader_schedules")
      .select("*, leader:contacts(id, name, position)")
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(weekEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");
    
    if (schedulesData) {
      setSchedules(schedulesData as Schedule[]);
    }
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
        start_time: null,
        end_time: null,
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

  const openScheduleDialog = () => {
    fetchLeadersAndSchedules();
    setScheduleDialogOpen(true);
  };

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

      {/* 外出管理对话框 */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新增外出记录
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>人员 *</Label>
              <Select
                value={absenceForm.contact_id}
                onValueChange={(v) => setAbsenceForm({ ...absenceForm, contact_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择人员" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {c.organization?.name || c.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>类型 *</Label>
              <Select
                value={absenceForm.type}
                onValueChange={(v) => setAbsenceForm({ ...absenceForm, type: v as AbsenceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(absenceTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>事由 *</Label>
              <Textarea
                value={absenceForm.reason}
                onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                placeholder="请输入外出事由"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {absenceForm.start_time
                        ? format(absenceForm.start_time, "MM/dd HH:mm")
                        : "选择时间"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={absenceForm.start_time || undefined}
                      onSelect={(d) => setAbsenceForm({ ...absenceForm, start_time: d || null })}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      {absenceForm.end_time
                        ? format(absenceForm.end_time, "MM/dd HH:mm")
                        : "选择时间"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={absenceForm.end_time || undefined}
                      onSelect={(d) => setAbsenceForm({ ...absenceForm, end_time: d || null })}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAbsenceDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAbsenceSubmit}>提交</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 办公用品领用对话框 */}
      <Dialog open={supplyDialogOpen} onOpenChange={setSupplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              领用办公用品
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>办公用品 *</Label>
              <Select
                value={supplyForm.supply_id}
                onValueChange={(v) => setSupplyForm({ ...supplyForm, supply_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择用品" />
                </SelectTrigger>
                <SelectContent>
                  {supplies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.specification ? `(${s.specification})` : ""} - 库存: {s.current_stock}{s.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>数量 *</Label>
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
                placeholder="请输入领用人姓名"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSupplyDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSupplySubmit}>提交</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 领导日程查看对话框 */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              领导日程 - {format(currentWeekStart, "M月d日", { locale: zhCN })} 至 {format(addDays(currentWeekStart, 6), "M月d日", { locale: zhCN })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Week Navigation */}
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStart = addDays(currentWeekStart, -7);
                  setCurrentWeekStart(newStart);
                  setTimeout(fetchLeadersAndSchedules, 0);
                }}
              >
                上一周
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = startOfWeek(new Date(), { weekStartsOn: 1 });
                  setCurrentWeekStart(today);
                  setTimeout(fetchLeadersAndSchedules, 0);
                }}
              >
                本周
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStart = addDays(currentWeekStart, 7);
                  setCurrentWeekStart(newStart);
                  setTimeout(fetchLeadersAndSchedules, 0);
                }}
              >
                下一周
              </Button>
            </div>

            {/* Schedule List */}
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                本周暂无日程安排
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{schedule.leader?.name}</span>
                          <span className={cn(
                            "px-2 py-0.5 text-xs rounded-full",
                            schedule.schedule_type === "party_activity" 
                              ? "bg-red-100 text-red-700"
                              : schedule.schedule_type === "research_trip"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          )}>
                            {scheduleTypeLabels[schedule.schedule_type] || schedule.schedule_type}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {schedule.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(schedule.schedule_date), "M月d日 EEEE", { locale: zhCN })} {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                          {schedule.location && ` · ${schedule.location}`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickLinks;
