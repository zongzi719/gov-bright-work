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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInHours, differenceInDays } from "date-fns";
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
}

interface LeaveFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; name: string } | null;
}

const leaveTypes = [
  { value: "annual", label: "年假" },
  { value: "sick", label: "病假" },
  { value: "personal", label: "事假" },
];

const LeaveForm = ({ open, onOpenChange, currentUser }: LeaveFormProps) => {
  const { startApproval } = useApprovalWorkflow();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [form, setForm] = useState({
    leave_type: "",
    reason: "",
    start_time: undefined as Date | undefined,
    end_time: undefined as Date | undefined,
    handover_person_id: "",
    handover_notes: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && currentUser?.id) {
      fetchContacts();
      fetchLeaveBalance();
    }
  }, [open, currentUser?.id]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setContacts(data);
  };

  const fetchLeaveBalance = async () => {
    if (!currentUser?.id) return;
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("contact_id", currentUser.id)
      .eq("year", currentYear)
      .maybeSingle();
    if (data) setLeaveBalance(data);
  };

  const calculateDuration = () => {
    if (!form.start_time || !form.end_time) return null;
    const hours = differenceInHours(form.end_time, form.start_time);
    const days = differenceInDays(form.end_time, form.start_time);
    return { hours, days: days > 0 ? days : (hours > 0 ? 1 : 0) };
  };

  const duration = calculateDuration();

  const getLeaveRemaining = (type: string) => {
    if (!leaveBalance) return null;
    switch (type) {
      case "annual":
        return leaveBalance.annual_leave_total - leaveBalance.annual_leave_used;
      case "sick":
        return leaveBalance.sick_leave_total - leaveBalance.sick_leave_used;
      case "personal":
        return leaveBalance.personal_leave_total - leaveBalance.personal_leave_used;
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!currentUser?.id || !form.leave_type || !form.reason || !form.start_time || !form.end_time) {
      toast.error("请填写必填项");
      return;
    }

    // 检查假期余额
    const remaining = getLeaveRemaining(form.leave_type);
    const requestedDays = duration?.days || 0;
    if (remaining !== null && requestedDays > remaining) {
      toast.error(`${leaveTypes.find(t => t.value === form.leave_type)?.label}剩余 ${remaining} 天，不足 ${requestedDays} 天`);
      return;
    }

    setSubmitting(true);

    try {
      const durationData = calculateDuration();
      
      const { data: record, error } = await supabase.from("absence_records").insert({
        contact_id: currentUser.id,
        type: "leave",
        leave_type: form.leave_type,
        reason: form.reason,
        start_time: form.start_time.toISOString(),
        end_time: form.end_time.toISOString(),
        handover_person_id: form.handover_person_id || null,
        handover_notes: form.handover_notes || null,
        duration_hours: durationData?.hours || null,
        duration_days: durationData?.days || null,
        notes: form.notes || null,
        status: "pending",
      } as any).select("id").single();

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
        title: `${leaveTypeLabel}申请 - ${durationData?.days || 1}天`,
        formData: {
          leave_type: form.leave_type,
          reason: form.reason,
          start_time: form.start_time.toISOString(),
          end_time: form.end_time.toISOString(),
          handover_person_id: form.handover_person_id,
          handover_notes: form.handover_notes,
          notes: form.notes,
          duration_days: durationData?.days,
        },
      });

      if (approvalResult.success) {
        toast.success("请假申请已提交，等待审批");
        onOpenChange(false);
        setForm({
          leave_type: "",
          reason: "",
          start_time: undefined,
          end_time: undefined,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>请假申请</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
                {leaveTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                    {leaveBalance && (
                      <span className="text-muted-foreground ml-2">
                        (剩余 {getLeaveRemaining(t.value)} 天)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.leave_type && leaveBalance && (
              <div className="text-sm text-muted-foreground">
                可用余额：{getLeaveRemaining(form.leave_type)} 天
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

          {/* 时间选择 */}
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
                  <Calendar
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
              <Label>结束时间 *</Label>
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
                  <Calendar
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

          {/* 时长显示 */}
          {duration && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              请假时长：<span className="font-medium text-foreground">{duration.days} 天</span>
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

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "提交中..." : "提交申请"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveForm;
