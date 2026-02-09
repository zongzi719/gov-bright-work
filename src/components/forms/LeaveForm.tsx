import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import * as dataAdapter from "@/lib/dataAdapter";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";

interface Contact {
  id: string;
  name: string;
  department: string | null;
}

interface LeaveBalance {
  annual_leave_total: number;
  annual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  personal_leave_total: number;
  personal_leave_used: number;
  paternity_leave_total: number;
  paternity_leave_used: number;
  bereavement_leave_total: number;
  bereavement_leave_used: number;
  maternity_leave_total: number;
  maternity_leave_used: number;
  nursing_leave_total: number;
  nursing_leave_used: number;
  marriage_leave_total: number;
  marriage_leave_used: number;
  compensatory_leave_total: number;
  compensatory_leave_used: number;
}

interface LeaveFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; name: string } | null;
}

// 假期类型配置：unit 表示扣除单位（小时或天），1天 = 8小时
const leaveTypes = [
  { value: "sick", label: "病假", unit: "小时", description: "按小时请假" },
  { value: "paternity", label: "陪产假", unit: "天", description: "手动发放" },
  { value: "annual", label: "年假", unit: "小时", description: "每年1月1日自动发放，按工龄配额" },
  { value: "bereavement", label: "丧假", unit: "天", description: "手动发放" },
  { value: "maternity", label: "产假", unit: "天", description: "手动发放" },
  { value: "nursing", label: "哺乳假", unit: "小时", description: "手动发放" },
  { value: "marriage", label: "婚假", unit: "天", description: "手动发放" },
  { value: "compensatory", label: "调休", unit: "小时", description: "加班时长自动计入调休余额" },
  { value: "personal", label: "事假", unit: "天", description: "个人事务" },
];

// 工作时间选项（8:00-17:00，每小时一个选项）
const workHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const LeaveForm = ({ open, onOpenChange, currentUser }: LeaveFormProps) => {
  const { startApproval } = useApprovalWorkflow();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [form, setForm] = useState({
    leave_type: "",
    reason: "",
    start_date: undefined as Date | undefined,
    start_hour: "8", // 开始小时，默认8点
    end_date: undefined as Date | undefined,
    end_hour: "17", // 结束小时，默认17点
    handover_person_id: "",
    handover_notes: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  useEffect(() => {
    if (open && currentUser?.id) {
      fetchContacts();
      fetchLeaveBalance();
    }
  }, [open, currentUser?.id]);

  const fetchContacts = async () => {
    const { data } = await dataAdapter.getContacts({ is_active: true });
    if (data) setContacts(data);
  };

  const fetchLeaveBalance = async () => {
    if (!currentUser?.id) return;
    const currentYear = new Date().getFullYear();
    const { data } = await dataAdapter.getLeaveBalance(currentUser.id, currentYear);
    if (data) setLeaveBalance(data);
  };

  // 计算请假时长：总小时数和等效天数（1天=8小时）
  const calculateDuration = () => {
    if (!form.start_date || !form.end_date) return null;
    
    const startHour = parseInt(form.start_hour) || 8;
    const endHour = parseInt(form.end_hour) || 17;
    
    // 计算请假天数（包含首尾两天）
    const calendarDays = differenceInCalendarDays(form.end_date, form.start_date) + 1;
    if (calendarDays <= 0) return null;
    
    let totalHours = 0;
    
    if (calendarDays === 1) {
      // 同一天：结束小时 - 开始小时（去掉午休1小时：12-13点）
      let hours = endHour - startHour;
      // 如果跨越午休时间，减去1小时
      if (startHour < 13 && endHour > 12) {
        hours -= 1;
      }
      totalHours = Math.max(0, Math.min(hours, 8));
    } else {
      // 跨天计算
      // 第一天：从开始小时到17点
      let firstDayHours = 17 - startHour;
      if (startHour < 13) firstDayHours -= 1; // 减去午休
      firstDayHours = Math.max(0, Math.min(firstDayHours, 8));
      
      // 最后一天：从8点到结束小时
      let lastDayHours = endHour - 8;
      if (endHour > 12) lastDayHours -= 1; // 减去午休
      lastDayHours = Math.max(0, Math.min(lastDayHours, 8));
      
      // 中间天数：每天8小时
      const middleDays = calendarDays - 2;
      const middleHours = middleDays > 0 ? middleDays * 8 : 0;
      
      totalHours = firstDayHours + middleHours + lastDayHours;
    }
    
    // 等效天数（8小时=1天）
    const equivalentDays = totalHours / 8;
    
    return { 
      hours: totalHours, 
      days: equivalentDays, 
      calendarDays,
      startHour,
      endHour
    };
  };

  const duration = calculateDuration();

  const getLeaveRemaining = (type: string) => {
    if (!leaveBalance) return null;
    // 获取剩余额度（以小时计算的假种直接返回小时，以天计算的假种返回天）
    switch (type) {
      case "annual":
        return leaveBalance.annual_leave_total - leaveBalance.annual_leave_used;
      case "sick":
        return leaveBalance.sick_leave_total - leaveBalance.sick_leave_used;
      case "personal":
        return leaveBalance.personal_leave_total - leaveBalance.personal_leave_used;
      case "paternity":
        return (leaveBalance.paternity_leave_total || 0) - (leaveBalance.paternity_leave_used || 0);
      case "bereavement":
        return (leaveBalance.bereavement_leave_total || 0) - (leaveBalance.bereavement_leave_used || 0);
      case "maternity":
        return (leaveBalance.maternity_leave_total || 0) - (leaveBalance.maternity_leave_used || 0);
      case "nursing":
        return (leaveBalance.nursing_leave_total || 0) - (leaveBalance.nursing_leave_used || 0);
      case "marriage":
        return (leaveBalance.marriage_leave_total || 0) - (leaveBalance.marriage_leave_used || 0);
      case "compensatory":
        return (leaveBalance.compensatory_leave_total || 0) - (leaveBalance.compensatory_leave_used || 0);
      default:
        return null;
    }
  };

  const getLeaveUnit = (type: string) => {
    const config = leaveTypes.find(t => t.value === type);
    return config?.unit || "天";
  };

  // 检查假期余额是否足够
  const checkBalanceSufficient = () => {
    if (!form.leave_type || !duration) return true;
    
    const remaining = getLeaveRemaining(form.leave_type);
    if (remaining === null) return true;
    
    const unit = getLeaveUnit(form.leave_type);
    const requested = unit === "小时" ? duration.hours : duration.days;
    
    return requested <= remaining;
  };

  const handleSubmit = async () => {
    if (!currentUser?.id || !form.leave_type || !form.reason || !form.start_date || !form.end_date) {
      toast.error("请填写必填项");
      return;
    }

    if (!duration) {
      toast.error("请假时间无效");
      return;
    }

    // 检查假期余额
    const remaining = getLeaveRemaining(form.leave_type);
    const unit = getLeaveUnit(form.leave_type);
    const requested = unit === "小时" ? duration.hours : duration.days;
    
    if (remaining !== null && requested > remaining) {
      toast.error(`${leaveTypes.find(t => t.value === form.leave_type)?.label}剩余 ${remaining} ${unit}，不足 ${requested} ${unit}`);
      return;
    }

    setSubmitting(true);

    try {
      // 构造开始和结束的时间戳
      const startTime = new Date(form.start_date);
      startTime.setHours(parseInt(form.start_hour), 0, 0, 0);
      
      const endTime = new Date(form.end_date);
      endTime.setHours(parseInt(form.end_hour), 0, 0, 0);
      
      const { data: record, error } = await dataAdapter.createAbsenceRecord({
        contact_id: currentUser.id,
        type: "leave",
        leave_type: form.leave_type,
        reason: form.reason,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        handover_person_id: form.handover_person_id || null,
        handover_notes: form.handover_notes || null,
        duration_hours: duration.hours,
        duration_days: duration.days,
        notes: form.notes || null,
        status: "pending",
      });

      if (error || !record) {
        toast.error("提交失败");
        console.error(error);
        return;
      }

      const leaveTypeLabel = leaveTypes.find(t => t.value === form.leave_type)?.label || "请假";
      const approvalResult = await startApproval({
        businessType: "leave",
        businessId: record.id,
        initiatorId: currentUser.id,
        initiatorName: currentUser.name || "未知用户",
        title: `${leaveTypeLabel}申请 - ${duration.hours}小时`,
        formData: {
          leave_type: form.leave_type,
          reason: form.reason,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          handover_person_id: form.handover_person_id,
          handover_notes: form.handover_notes,
          notes: form.notes,
          duration_hours: duration.hours,
          duration_days: duration.days,
        },
      });

      if (approvalResult.success) {
        toast.success("请假申请已提交，等待审批");
        onOpenChange(false);
        setForm({
          leave_type: "",
          reason: "",
          start_date: undefined,
          start_hour: "8",
          end_date: undefined,
          end_hour: "17",
          handover_person_id: "",
          handover_notes: "",
          notes: "",
        });
      } else {
        toast.error(approvalResult.error || "启动审批流程失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0" aria-describedby={undefined}>
        <DialogHeader className="px-6 py-4 border-b bg-background">
          <DialogTitle>请假申请</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* 申请人 */}
          <div className="space-y-2">
            <Label>申请人</Label>
            <Input value={currentUser?.name || ""} disabled className="bg-muted" />
          </div>

          {/* 请假类型 */}
          <div className="space-y-2">
            <Label>请假类型 *</Label>
            <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
              <SelectTrigger>
                <SelectValue placeholder="请选择请假类型" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => {
                  const remaining = getLeaveRemaining(t.value);
                  const hasBalance = remaining !== null && remaining > 0;
                  return (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{t.label}</span>
                        {remaining !== null && (
                          <span className={`text-xs ${hasBalance ? 'text-muted-foreground' : 'text-destructive'}`}>
                            剩余{remaining}{t.unit}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {form.leave_type && leaveBalance && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>可用余额：{getLeaveRemaining(form.leave_type)} {getLeaveUnit(form.leave_type)}</span>
                <span className="text-xs">({leaveTypes.find(t => t.value === form.leave_type)?.description})</span>
              </div>
            )}
          </div>

          {/* 请假事由 */}
          <div className="space-y-2">
            <Label>请假事由 *</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明请假原因"
              rows={3}
            />
          </div>

          {/* 开始时间 */}
          <div className="space-y-2">
            <Label>开始时间 *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.start_date
                      ? format(form.start_date, "yyyy-MM-dd", { locale: zhCN })
                      : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.start_date}
                    onSelect={(date) => {
                      setForm({ ...form, start_date: date });
                      setStartDateOpen(false);
                    }}
                    locale={zhCN}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Select value={form.start_hour} onValueChange={(v) => setForm({ ...form, start_hour: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="开始时间" />
                </SelectTrigger>
                <SelectContent>
                  {workHours.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 结束时间 */}
          <div className="space-y-2">
            <Label>结束时间 *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.end_date
                      ? format(form.end_date, "yyyy-MM-dd", { locale: zhCN })
                      : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.end_date}
                    onSelect={(date) => {
                      setForm({ ...form, end_date: date });
                      setEndDateOpen(false);
                    }}
                    locale={zhCN}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Select value={form.end_hour} onValueChange={(v) => setForm({ ...form, end_hour: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="结束时间" />
                </SelectTrigger>
                <SelectContent>
                  {workHours.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 时长显示 */}
          {duration && (
            <div className="text-sm bg-muted/50 px-3 py-2 rounded-md space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">请假时段：</span>
                <span className="font-medium text-foreground">
                  {form.start_date && format(form.start_date, "MM-dd")} {duration.startHour}:00 ~ {form.end_date && format(form.end_date, "MM-dd")} {duration.endHour}:00
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">合计时长：</span>
                <span className="font-medium text-foreground text-primary">{duration.hours} 小时（{duration.days} 天）</span>
              </div>
              <div className="text-xs text-muted-foreground">
                工作时间 8:00-17:00，午休 12:00-13:00，每天最多8小时
              </div>
              {!checkBalanceSufficient() && (
                <div className="text-destructive text-xs mt-1">
                  ⚠️ 超出可用余额
                </div>
              )}
            </div>
          )}

          {/* 工作交接人 */}
          <div className="space-y-2">
            <Label>工作交接人</Label>
            <Select value={form.handover_person_id} onValueChange={(v) => setForm({ ...form, handover_person_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="请选择工作交接人" />
              </SelectTrigger>
              <SelectContent>
                {contacts
                  .filter(c => c.id !== currentUser?.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.department ? `(${c.department})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* 交接事项 */}
          <div className="space-y-2">
            <Label>交接事项说明</Label>
            <Textarea
              value={form.handover_notes}
              onChange={(e) => setForm({ ...form, handover_notes: e.target.value })}
              placeholder="请说明需要交接的工作事项"
              rows={2}
            />
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label>备注说明</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="其他需要说明的事项"
            />
          </div>
        </div>
        {/* 固定底部操作按钮 */}
        <div className="px-6 py-4 border-t bg-background flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !checkBalanceSufficient()}>
            {submitting ? "提交中..." : "提交申请"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveForm;
