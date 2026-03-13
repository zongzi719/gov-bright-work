import { useState, useEffect } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import * as dataAdapter from "@/lib/dataAdapter";
import { toast } from "sonner";
import { format, differenceInCalendarDays, isBefore, startOfDay } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Contact {
  id: string;
  name: string;
  department: string | null;
}

interface BusinessTripFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; name: string } | null;
}

const transportTypes = [
  { value: "plane", label: "飞机" },
  { value: "train", label: "火车/高铁" },
  { value: "car", label: "汽车/自驾" },
  { value: "other", label: "其他" },
];

type TimeOfDay = "am" | "pm";

const BusinessTripForm = ({ open, onOpenChange, currentUser }: BusinessTripFormProps) => {
  const { startApproval } = useApprovalWorkflow();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({
    reason: "",
    destination: "",
    start_date: undefined as Date | undefined,
    start_time_of_day: "am" as TimeOfDay,
    end_date: undefined as Date | undefined,
    end_time_of_day: "pm" as TimeOfDay,
    transport_type: "",
    companions: [] as string[],
    estimated_cost: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    const { data } = await dataAdapter.getContacts({ is_active: true });
    if (data) setContacts(data);
  };

  // 计算半天数
  const calculateDuration = () => {
    if (!form.start_date || !form.end_date) return null;
    
    const daysDiff = differenceInCalendarDays(form.end_date, form.start_date);
    if (daysDiff < 0) return null;
    
    // 计算半天数
    let halfDays = daysDiff * 2;
    
    // 开始时间是下午，减0.5天
    if (form.start_time_of_day === "pm") {
      halfDays -= 1;
    }
    // 结束时间是上午，减0.5天
    if (form.end_time_of_day === "am") {
      halfDays -= 1;
    }
    // 加1（包含当天）
    halfDays += 2;
    
    // 最少半天
    if (halfDays < 1) halfDays = 1;
    
    const days = halfDays / 2;
    return { halfDays, days };
  };

  const duration = calculateDuration();

  // 验证结束日期
  const isEndDateValid = () => {
    if (!form.start_date || !form.end_date) return true;
    
    // 如果结束日期在开始日期之前，无效
    if (isBefore(startOfDay(form.end_date), startOfDay(form.start_date))) {
      return false;
    }
    
    // 如果同一天，检查上午/下午
    if (differenceInCalendarDays(form.end_date, form.start_date) === 0) {
      if (form.start_time_of_day === "pm" && form.end_time_of_day === "am") {
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!currentUser?.id || !form.reason || !form.destination || !form.start_date || !form.end_date) {
      toast.error("请填写必填项");
      return;
    }

    if (!isEndDateValid()) {
      toast.error("结束时间必须在开始时间之后");
      return;
    }

    setSubmitting(true);

    try {
      const durationData = calculateDuration();
      
      // 构建实际的开始和结束时间
      const startHour = form.start_time_of_day === "am" ? 9 : 14;
      const endHour = form.end_time_of_day === "am" ? 12 : 18;
      
      const startTime = new Date(form.start_date);
      startTime.setHours(startHour, 0, 0, 0);
      
      const endTime = new Date(form.end_date);
      endTime.setHours(endHour, 0, 0, 0);
      
      // 使用本地时间格式化，避免 toISOString() 转换为 UTC 导致时间偏差
      const formatLocalDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = "00";
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };
      
      const { data: record, error } = await dataAdapter.createAbsenceRecord({
        contact_id: currentUser.id,
        type: "business_trip",
        reason: form.reason,
        destination: form.destination,
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
        transport_type: form.transport_type || null,
        companions: form.companions.length > 0 ? form.companions : null,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
        duration_hours: durationData ? durationData.halfDays * 4 : null,
        duration_days: durationData?.days || null,
        notes: form.notes || null,
        status: "pending",
      });

      if (error || !record) {
        toast.error("提交失败");
        console.error(error);
        return;
      }

      const approvalResult = await startApproval({
        businessType: "business_trip",
        businessId: record.id,
        initiatorId: currentUser.id,
        initiatorName: currentUser.name || "未知用户",
        title: `出差申请 - ${form.destination}`,
        formData: {
          reason: form.reason,
          destination: form.destination,
          start_time: formatLocalDateTime(startTime),
          end_time: formatLocalDateTime(endTime),
          start_time_of_day: form.start_time_of_day,
          end_time_of_day: form.end_time_of_day,
          transport_type: form.transport_type,
          companions: form.companions,
          estimated_cost: form.estimated_cost,
          notes: form.notes,
        },
      });

      if (approvalResult.success) {
        toast.success("出差申请已提交，等待审批");
        onOpenChange(false);
        setForm({
          reason: "",
          destination: "",
          start_date: undefined,
          start_time_of_day: "am",
          end_date: undefined,
          end_time_of_day: "pm",
          transport_type: "",
          companions: [],
          estimated_cost: "",
          notes: "",
        });
      } else {
        toast.error(approvalResult.error || "启动审批流程失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCompanion = (contactId: string) => {
    if (!form.companions.includes(contactId)) {
      setForm({ ...form, companions: [...form.companions, contactId] });
    }
  };

  const handleRemoveCompanion = (contactId: string) => {
    setForm({ ...form, companions: form.companions.filter(id => id !== contactId) });
  };

  const getContactName = (id: string) => {
    return contacts.find(c => c.id === id)?.name || id;
  };

  const formatDuration = (days: number) => {
    if (days === 0.5) return "半天";
    if (days % 1 === 0.5) return `${Math.floor(days)}天半`;
    return `${days}天`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0" aria-describedby={undefined}>
        {/* 固定顶部标题 */}
        <DialogHeader className="px-6 py-4 border-b bg-background">
          <DialogTitle>出差申请</DialogTitle>
        </DialogHeader>
        
        {/* 可滚动内容区域 */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* 申请人 */}
          <div className="space-y-2">
            <Label>申请人</Label>
            <Input value={currentUser?.name || ""} disabled className="bg-muted" />
          </div>

          {/* 出差目的地 */}
          <div className="space-y-2">
            <Label>出差目的地 *</Label>
            <Input
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="请输入出差目的地，如：北京市"
            />
          </div>

          {/* 出差事由 */}
          <div className="space-y-2">
            <Label>出差事由 *</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明出差事由"
              rows={3}
            />
          </div>

          {/* 开始时间选择 */}
          <div className="space-y-2">
            <Label>开始时间 *</Label>
            <div className="flex gap-2">
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
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
              <RadioGroup
                value={form.start_time_of_day}
                onValueChange={(v) => setForm({ ...form, start_time_of_day: v as TimeOfDay })}
                className="flex gap-2"
              >
                <div className="flex items-center">
                  <RadioGroupItem value="am" id="start-am" className="sr-only" />
                  <Label
                    htmlFor="start-am"
                    className={cn(
                      "px-3 py-2 rounded-md border cursor-pointer transition-colors",
                      form.start_time_of_day === "am"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                  >
                    上午
                  </Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem value="pm" id="start-pm" className="sr-only" />
                  <Label
                    htmlFor="start-pm"
                    className={cn(
                      "px-3 py-2 rounded-md border cursor-pointer transition-colors",
                      form.start_time_of_day === "pm"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                  >
                    下午
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* 结束时间选择 */}
          <div className="space-y-2">
            <Label>结束时间 *</Label>
            <div className="flex gap-2">
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !form.end_date && "text-muted-foreground",
                      !isEndDateValid() && "border-destructive text-destructive"
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
                    disabled={(date) => form.start_date ? isBefore(date, startOfDay(form.start_date)) : false}
                    locale={zhCN}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <RadioGroup
                value={form.end_time_of_day}
                onValueChange={(v) => setForm({ ...form, end_time_of_day: v as TimeOfDay })}
                className="flex gap-2"
              >
                <div className="flex items-center">
                  <RadioGroupItem value="am" id="end-am" className="sr-only" />
                  <Label
                    htmlFor="end-am"
                    className={cn(
                      "px-3 py-2 rounded-md border cursor-pointer transition-colors",
                      form.end_time_of_day === "am"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                  >
                    上午
                  </Label>
                </div>
                <div className="flex items-center">
                  <RadioGroupItem value="pm" id="end-pm" className="sr-only" />
                  <Label
                    htmlFor="end-pm"
                    className={cn(
                      "px-3 py-2 rounded-md border cursor-pointer transition-colors",
                      form.end_time_of_day === "pm"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                  >
                    下午
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {!isEndDateValid() && (
              <p className="text-sm text-destructive">结束时间必须在开始时间之后</p>
            )}
          </div>

          {/* 时长显示 */}
          {duration && isEndDateValid() && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              预计出差时长：<span className="font-medium text-foreground">{formatDuration(duration.days)}</span>
            </div>
          )}

          {/* 交通方式 */}
          <div className="space-y-2">
            <Label>交通方式</Label>
            <Select value={form.transport_type} onValueChange={(v) => setForm({ ...form, transport_type: v })}>
              <SelectTrigger>
                <SelectValue placeholder="请选择交通方式" />
              </SelectTrigger>
              <SelectContent>
                {transportTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 同行人员 */}
          <div className="space-y-2">
            <Label>同行人员</Label>
            <Select onValueChange={handleAddCompanion} value="">
              <SelectTrigger>
                <SelectValue placeholder="选择同行人员" />
              </SelectTrigger>
              <SelectContent>
                {contacts
                  .filter(c => c.id !== currentUser?.id && !form.companions.includes(c.id))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.department ? `(${c.department})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {form.companions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.companions.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {getContactName(id)}
                    <button
                      type="button"
                      onClick={() => handleRemoveCompanion(id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                      aria-label={`移除 ${getContactName(id)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 预计费用 */}
          <div className="space-y-2">
            <Label>预计费用（元）</Label>
            <Input
              type="number"
              value={form.estimated_cost}
              onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
              placeholder="请输入预计出差费用"
            />
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label>备注说明</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="如有其他需要说明的事项，请在此填写"
              rows={2}
            />
          </div>
        </div>

        {/* 固定底部操作按钮 */}
        <div className="px-6 py-4 border-t bg-background flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "提交申请"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessTripForm;
