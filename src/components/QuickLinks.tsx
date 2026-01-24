import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, CalendarIcon, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
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

interface LeaderSchedule {
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

const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const QuickLinks = () => {
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

  // 出差申请 Dialog State
  const [businessTripDialogOpen, setBusinessTripDialogOpen] = useState(false);
  const [businessTripForm, setBusinessTripForm] = useState({
    reason: "",
    start_time: undefined as Date | undefined,
    end_time: undefined as Date | undefined,
    notes: "",
  });

  // 请假申请 Dialog State
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    reason: "",
    start_time: undefined as Date | undefined,
    end_time: undefined as Date | undefined,
    notes: "",
  });

  // 外出申请 Dialog State
  const [outDialogOpen, setOutDialogOpen] = useState(false);
  const [outForm, setOutForm] = useState({
    reason: "",
    start_time: undefined as Date | undefined,
    end_time: undefined as Date | undefined,
    notes: "",
  });

  // Supply Requisition Dialog State
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [supplyForm, setSupplyForm] = useState({
    supply_id: "",
    quantity: 1,
  });

  // Purchase Request Dialog State
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supply_id: "",
    quantity: 1,
    reason: "",
  });

  // Leader Schedule Dialog State
  const [leaderScheduleDialogOpen, setLeaderScheduleDialogOpen] = useState(false);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leaderSchedules, setLeaderSchedules] = useState<LeaderSchedule[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [leaderScheduleLoading, setLeaderScheduleLoading] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Fetch supplies
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

  // Fetch leader schedules
  const fetchLeaderSchedules = async () => {
    setLeaderScheduleLoading(true);
    const weekEnd = addDays(currentWeekStart, 6);
    const { data } = await supabase
      .from("leader_schedules")
      .select("*, leader:contacts(id, name, position)")
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(weekEnd, "yyyy-MM-dd"))
      .order("schedule_date")
      .order("start_time");
    
    if (data) {
      setLeaderSchedules(data as LeaderSchedule[]);
    }
    setLeaderScheduleLoading(false);
  };

  const getSchedulesForLeaderAndDay = (leaderId: string, date: Date): LeaderSchedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return leaderSchedules.filter(
      (s) => s.leader_id === leaderId && s.schedule_date === dateStr
    );
  };

  // Submit handlers
  const handleBusinessTripSubmit = async () => {
    if (!currentUser?.id || !businessTripForm.reason || !businessTripForm.start_time) {
      toast.error("请填写必填项");
      return;
    }

    const { error } = await supabase.from("absence_records").insert({
      contact_id: currentUser.id,
      type: "business_trip",
      reason: businessTripForm.reason,
      start_time: businessTripForm.start_time.toISOString(),
      end_time: businessTripForm.end_time?.toISOString() || null,
      notes: businessTripForm.notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("提交失败");
      console.error(error);
    } else {
      toast.success("出差申请已提交，等待审批");
      setBusinessTripDialogOpen(false);
      setBusinessTripForm({ reason: "", start_time: undefined, end_time: undefined, notes: "" });
    }
  };

  const handleLeaveSubmit = async () => {
    if (!currentUser?.id || !leaveForm.reason || !leaveForm.start_time) {
      toast.error("请填写必填项");
      return;
    }

    const { error } = await supabase.from("absence_records").insert({
      contact_id: currentUser.id,
      type: "leave",
      reason: leaveForm.reason,
      start_time: leaveForm.start_time.toISOString(),
      end_time: leaveForm.end_time?.toISOString() || null,
      notes: leaveForm.notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("提交失败");
      console.error(error);
    } else {
      toast.success("请假申请已提交，等待审批");
      setLeaveDialogOpen(false);
      setLeaveForm({ reason: "", start_time: undefined, end_time: undefined, notes: "" });
    }
  };

  const handleOutSubmit = async () => {
    if (!currentUser?.id || !outForm.reason || !outForm.start_time) {
      toast.error("请填写必填项");
      return;
    }

    const { error } = await supabase.from("absence_records").insert({
      contact_id: currentUser.id,
      type: "out",
      reason: outForm.reason,
      start_time: outForm.start_time.toISOString(),
      end_time: outForm.end_time?.toISOString() || null,
      notes: outForm.notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("提交失败");
      console.error(error);
    } else {
      toast.success("外出申请已提交，等待审批");
      setOutDialogOpen(false);
      setOutForm({ reason: "", start_time: undefined, end_time: undefined, notes: "" });
    }
  };

  const handleSupplySubmit = async () => {
    if (!supplyForm.supply_id) {
      toast.error("请选择办公用品");
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
      requisition_by: currentUser?.name || "",
    });

    if (error) {
      toast.error("提交领用申请失败");
    } else {
      toast.success("领用申请已提交");
      setSupplyDialogOpen(false);
      setSupplyForm({ supply_id: "", quantity: 1 });
    }
  };

  const handlePurchaseSubmit = async () => {
    if (!purchaseForm.supply_id) {
      toast.error("请选择办公用品");
      return;
    }
    if (purchaseForm.quantity < 1) {
      toast.error("数量必须大于0");
      return;
    }

    const { error } = await supabase.from("purchase_requests").insert({
      supply_id: purchaseForm.supply_id,
      quantity: purchaseForm.quantity,
      reason: purchaseForm.reason.trim() || null,
      requested_by: currentUser?.name || "",
    });

    if (error) {
      toast.error("提交采购申请失败");
    } else {
      toast.success("采购申请已提交");
      setPurchaseDialogOpen(false);
      setPurchaseForm({ supply_id: "", quantity: 1, reason: "" });
    }
  };

  const openSupplyDialog = () => {
    fetchSupplies();
    setSupplyDialogOpen(true);
  };

  const openPurchaseDialog = () => {
    fetchSupplies();
    setPurchaseDialogOpen(true);
  };

  const openLeaderScheduleDialog = async () => {
    setLeaderScheduleDialogOpen(true);
    await Promise.all([fetchLeaders(), fetchLeaderSchedules()]);
  };

  const handlePrevWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  useEffect(() => {
    if (leaderScheduleDialogOpen) {
      fetchLeaderSchedules();
    }
  }, [currentWeekStart, leaderScheduleDialogOpen]);

  const modules = [
    {
      id: 1,
      name: "出差申请",
      color: "bg-primary",
      icon: Briefcase,
      onClick: () => setBusinessTripDialogOpen(true),
    },
    {
      id: 2,
      name: "请假申请",
      color: "bg-orange-500",
      icon: CalendarOff,
      onClick: () => setLeaveDialogOpen(true),
    },
    {
      id: 3,
      name: "外出申请",
      color: "bg-purple-500",
      icon: LogOutIcon,
      onClick: () => setOutDialogOpen(true),
    },
    {
      id: 4,
      name: "领用申请",
      color: "bg-emerald-500",
      icon: Package,
      onClick: openSupplyDialog,
    },
    {
      id: 5,
      name: "采购申请",
      color: "bg-blue-500",
      icon: ShoppingCart,
      onClick: openPurchaseDialog,
    },
    {
      id: 6,
      name: "领导日程",
      color: "bg-amber-500",
      icon: Star,
      onClick: openLeaderScheduleDialog,
    },
  ];

  // Reusable absence form dialog component
  const renderAbsenceDialog = (
    open: boolean,
    onOpenChange: (open: boolean) => void,
    title: string,
    form: { reason: string; start_time: Date | undefined; end_time: Date | undefined; notes: string },
    setForm: React.Dispatch<React.SetStateAction<{ reason: string; start_time: Date | undefined; end_time: Date | undefined; notes: string }>>,
    onSubmit: () => void
  ) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>申请人</Label>
            <Input value={currentUser?.name || ""} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>事由 *</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
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
                      !form.start_time && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.start_time
                      ? format(form.start_time, "yyyy-MM-dd", { locale: zhCN })
                      : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={form.start_time}
                    onSelect={(date) => setForm({ ...form, start_time: date })}
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
                      !form.end_time && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.end_time
                      ? format(form.end_time, "yyyy-MM-dd", { locale: zhCN })
                      : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={form.end_time}
                    onSelect={(date) => setForm({ ...form, end_time: date })}
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
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="可选备注"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={onSubmit}>提交</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">快捷入口</h2>
      </div>

      {/* 模块网格 */}
      <div className="p-5 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-4 w-full">
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

      {/* 出差申请对话框 */}
      {renderAbsenceDialog(
        businessTripDialogOpen,
        setBusinessTripDialogOpen,
        "出差申请",
        businessTripForm,
        setBusinessTripForm,
        handleBusinessTripSubmit
      )}

      {/* 请假申请对话框 */}
      {renderAbsenceDialog(
        leaveDialogOpen,
        setLeaveDialogOpen,
        "请假申请",
        leaveForm,
        setLeaveForm,
        handleLeaveSubmit
      )}

      {/* 外出申请对话框 */}
      {renderAbsenceDialog(
        outDialogOpen,
        setOutDialogOpen,
        "外出申请",
        outForm,
        setOutForm,
        handleOutSubmit
      )}

      {/* 办公用品领用对话框 */}
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
                <SelectContent position="popper" className="z-[9999]">
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
                <Label>领用人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
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

      {/* 采购申请对话框 */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建采购申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>办公用品 *</Label>
              <Select
                value={purchaseForm.supply_id}
                onValueChange={(value) => setPurchaseForm({ ...purchaseForm, supply_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择办公用品" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  {supplies
                    .filter((s) => s.is_active)
                    .map((supply) => (
                      <SelectItem key={supply.id} value={supply.id}>
                        {supply.name}
                        {supply.specification ? ` (${supply.specification})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>采购数量 *</Label>
                <Input
                  type="number"
                  min={1}
                  value={purchaseForm.quantity}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>申请人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>采购理由</Label>
              <Textarea
                value={purchaseForm.reason}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, reason: e.target.value })}
                placeholder="请输入采购理由"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handlePurchaseSubmit}>提交申请</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 领导日程查看对话框 */}
      <Dialog open={leaderScheduleDialogOpen} onOpenChange={setLeaderScheduleDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>领导日程</DialogTitle>
          </DialogHeader>
          
          {/* 周导航 */}
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

          {leaderScheduleLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无领导数据</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* 表头 - 日期 */}
              <div className="grid bg-primary text-primary-foreground" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                <div className="p-2 border-r border-primary-foreground/20 text-center font-medium">姓名</div>
                {weekDays.map((day, idx) => (
                  <div key={idx} className="p-2 border-r border-primary-foreground/20 last:border-r-0 text-center">
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
                        <div className="absolute inset-0 grid grid-cols-10">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="border-r border-dashed border-muted-foreground/20 last:border-r-0"></div>
                          ))}
                        </div>
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
