import { useState, useEffect } from "react";
import { Briefcase, CalendarOff, LogOut as LogOutIcon, Package, Star, CalendarIcon, ChevronLeft, ChevronRight, ShoppingCart, BookUser } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import BusinessTripForm from "@/components/forms/BusinessTripForm";
import LeaveForm from "@/components/forms/LeaveForm";
import OutForm from "@/components/forms/OutForm";
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
  const { startApproval, getBusinessTypeLabel } = useApprovalWorkflow();

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

  // 请假申请 Dialog State
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // 外出申请 Dialog State
  const [outDialogOpen, setOutDialogOpen] = useState(false);

  // Supply Requisition Dialog State
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [supplyForm, setSupplyForm] = useState({
    supply_id: "",
    quantity: 1,
    requisition_date: new Date(),
  });

  // Purchase Request Dialog State
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supply_id: "",
    quantity: 1,
    reason: "",
    purchase_date: new Date(),
    unit_price: 0,
  });

  // Contacts Dialog State
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; department: string | null; position: string | null; mobile: string | null; status: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

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

  // Submit handlers for absence forms moved to dedicated components

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

    // 1. 创建业务记录
    const { data: record, error } = await supabase.from("supply_requisitions").insert({
      supply_id: supplyForm.supply_id,
      quantity: supplyForm.quantity,
      requisition_by: currentUser?.name || "",
      requisition_date: format(supplyForm.requisition_date, "yyyy-MM-dd"),
    }).select("id").single();

    if (error || !record) {
      toast.error("提交领用申请失败");
      console.error(error);
      return;
    }

    // 2. 启动审批工作流
    const approvalResult = await startApproval({
      businessType: "supply_requisition",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `领用申请 - ${supply?.name || "办公用品"}`,
      formData: {
        supply_id: supplyForm.supply_id,
        supply_name: supply?.name,
        quantity: supplyForm.quantity,
        requisition_date: format(supplyForm.requisition_date, "yyyy-MM-dd"),
      },
    });

    if (approvalResult.success) {
      toast.success("领用申请已提交");
      setSupplyDialogOpen(false);
      setSupplyForm({ supply_id: "", quantity: 1, requisition_date: new Date() });
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
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

    const supply = supplies.find((s) => s.id === purchaseForm.supply_id);
    const totalAmount = purchaseForm.quantity * purchaseForm.unit_price;

    // 1. 创建业务记录
    const { data: record, error } = await supabase.from("purchase_requests").insert({
      supply_id: purchaseForm.supply_id,
      quantity: purchaseForm.quantity,
      reason: purchaseForm.reason.trim() || null,
      requested_by: currentUser?.name || "",
      purchase_date: format(purchaseForm.purchase_date, "yyyy-MM-dd"),
      unit_price: purchaseForm.unit_price,
      total_amount: totalAmount,
    }).select("id").single();

    if (error || !record) {
      toast.error("提交采购申请失败");
      console.error(error);
      return;
    }

    // 2. 启动审批工作流
    const approvalResult = await startApproval({
      businessType: "purchase_request",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `采购申请 - ${supply?.name || "办公用品"}`,
      formData: {
        supply_id: purchaseForm.supply_id,
        supply_name: supply?.name,
        quantity: purchaseForm.quantity,
        reason: purchaseForm.reason,
        purchase_date: format(purchaseForm.purchase_date, "yyyy-MM-dd"),
        unit_price: purchaseForm.unit_price,
        total_amount: totalAmount,
      },
    });

    if (approvalResult.success) {
      toast.success("采购申请已提交");
      setPurchaseDialogOpen(false);
      setPurchaseForm({ supply_id: "", quantity: 1, reason: "", purchase_date: new Date(), unit_price: 0 });
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
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

  // Fetch contacts for directory
  const fetchContacts = async () => {
    setContactsLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department, position, mobile, status")
      .eq("is_active", true)
      .order("sort_order");
    
    if (data) {
      setContacts(data);
    }
    setContactsLoading(false);
  };

  const openContactsDialog = async () => {
    setContactsDialogOpen(true);
    await fetchContacts();
  };

  const contactStatusLabels: Record<string, { label: string; color: string }> = {
    on_duty: { label: "在职", color: "bg-green-100 text-green-700" },
    out: { label: "外出", color: "bg-purple-100 text-purple-700" },
    leave: { label: "请假", color: "bg-orange-100 text-orange-700" },
    business_trip: { label: "出差", color: "bg-blue-100 text-blue-700" },
    meeting: { label: "会议", color: "bg-amber-100 text-amber-700" },
  };

  const filteredContacts = contacts.filter(c => 
    c.name.includes(contactSearch) || 
    c.department?.includes(contactSearch) || 
    c.position?.includes(contactSearch)
  );

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
      name: "通讯录",
      color: "bg-cyan-500",
      icon: BookUser,
      onClick: openContactsDialog,
    },
    {
      id: 7,
      name: "领导日程",
      color: "bg-amber-500",
      icon: Star,
      onClick: openLeaderScheduleDialog,
    },
  ];

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">快捷入口</h2>
      </div>

      {/* 模块网格 */}
      <div className="p-4 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-4 w-full">
          {modules.map((module) => (
            <div
              key={module.id}
              className="app-icon cursor-pointer group"
              onClick={module.onClick}
            >
              <div className={`app-icon-box ${module.color} group-hover:scale-105 transition-transform w-11 h-11`}>
                <module.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground text-center leading-tight">
                {module.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 出差申请对话框 */}
      <BusinessTripForm
        open={businessTripDialogOpen}
        onOpenChange={setBusinessTripDialogOpen}
        currentUser={currentUser}
      />

      {/* 请假申请对话框 */}
      <LeaveForm
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        currentUser={currentUser}
      />

      {/* 外出申请对话框 */}
      <OutForm
        open={outDialogOpen}
        onOpenChange={setOutDialogOpen}
        currentUser={currentUser}
      />

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
                <Label>领用日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !supplyForm.requisition_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {supplyForm.requisition_date
                        ? format(supplyForm.requisition_date, "yyyy-MM-dd", { locale: zhCN })
                        : "选择日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={supplyForm.requisition_date}
                      onSelect={(date) => setSupplyForm({ ...supplyForm, requisition_date: date || new Date() })}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>领用人</Label>
              <Input value={currentUser?.name || ""} disabled className="bg-muted" />
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
                <Label>采购日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !purchaseForm.purchase_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {purchaseForm.purchase_date
                        ? format(purchaseForm.purchase_date, "yyyy-MM-dd", { locale: zhCN })
                        : "选择日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={purchaseForm.purchase_date}
                      onSelect={(date) => setPurchaseForm({ ...purchaseForm, purchase_date: date || new Date() })}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>采购单价 (元) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseForm.unit_price}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>采购总额 (元)</Label>
                <Input 
                  value={(purchaseForm.quantity * purchaseForm.unit_price).toFixed(2)} 
                  disabled 
                  className="bg-muted" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>申请人</Label>
              <Input value={currentUser?.name || ""} disabled className="bg-muted" />
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

      {/* 通讯录对话框 */}
      <Dialog open={contactsDialogOpen} onOpenChange={setContactsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>通讯录</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Input
              placeholder="搜索姓名、部门或职位..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            
            {contactsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无联系人</div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredContacts.map((contact) => {
                    const statusInfo = contactStatusLabels[contact.status] || contactStatusLabels.on_duty;
                    return (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {contact.department && <span>{contact.department}</span>}
                            {contact.position && <span> · {contact.position}</span>}
                          </div>
                        </div>
                        {contact.mobile && (
                          <a
                            href={`tel:${contact.mobile}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {contact.mobile}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickLinks;
