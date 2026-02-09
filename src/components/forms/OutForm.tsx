import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock } from "lucide-react";
import * as dataAdapter from "@/lib/dataAdapter";
import { toast } from "sonner";
import { format, differenceInHours, set } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";

interface OutFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: { id: string; name: string; mobile?: string } | null;
}

const outTypes = [
  { value: "meeting", label: "外出开会" },
  { value: "client", label: "拜访客户" },
  { value: "errand", label: "外出办事" },
  { value: "other", label: "其他" },
];

const timeOptions = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return [
    { value: `${hour}:00`, label: `${hour}:00` },
    { value: `${hour}:30`, label: `${hour}:30` },
  ];
}).flat();

const OutForm = ({ open, onOpenChange, currentUser }: OutFormProps) => {
  const { startApproval } = useApprovalWorkflow();
  const [form, setForm] = useState({
    out_type: "",
    out_location: "",
    reason: "",
    start_date: undefined as Date | undefined,
    start_time: "09:00",
    end_date: undefined as Date | undefined,
    end_time: "18:00",
    contact_phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const calculateDuration = () => {
    if (!form.start_date || !form.end_date) return null;
    const [startHour, startMin] = form.start_time.split(":").map(Number);
    const [endHour, endMin] = form.end_time.split(":").map(Number);
    
    const startDateTime = set(form.start_date, { hours: startHour, minutes: startMin });
    const endDateTime = set(form.end_date, { hours: endHour, minutes: endMin });
    
    const hours = differenceInHours(endDateTime, startDateTime);
    return { hours: hours > 0 ? hours : 0 };
  };

  const duration = calculateDuration();

  const getFullDateTime = (date: Date | undefined, time: string) => {
    if (!date) return null;
    const [hour, min] = time.split(":").map(Number);
    return set(date, { hours: hour, minutes: min });
  };

  const handleSubmit = async () => {
    if (!currentUser?.id || !form.out_type || !form.out_location || !form.reason || !form.start_date) {
      toast.error("请填写必填项");
      return;
    }

    setSubmitting(true);

    try {
      const startDateTime = getFullDateTime(form.start_date, form.start_time);
      const endDateTime = getFullDateTime(form.end_date || form.start_date, form.end_time);
      const durationData = calculateDuration();
      
      // 使用本地时间格式化，避免 toISOString() 转换为 UTC 导致时间偏差
      const formatLocalDateTime = (date: Date | null) => {
        if (!date) return null;
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
        type: "out",
        out_type: form.out_type,
        out_location: form.out_location,
        reason: form.reason,
        start_time: formatLocalDateTime(startDateTime) || "",
        end_time: formatLocalDateTime(endDateTime),
        contact_phone: form.contact_phone || null,
        duration_hours: durationData?.hours || null,
        notes: form.notes || null,
        status: "pending",
      });

      if (error || !record) {
        toast.error("提交失败");
        console.error(error);
        return;
      }

      const outTypeLabel = outTypes.find(t => t.value === form.out_type)?.label || "外出";
      const approvalResult = await startApproval({
        businessType: "out",
        businessId: record.id,
        initiatorId: currentUser.id,
        initiatorName: currentUser.name || "未知用户",
        title: `${outTypeLabel} - ${form.out_location}`,
        formData: {
          out_type: form.out_type,
          out_location: form.out_location,
          reason: form.reason,
          start_time: formatLocalDateTime(startDateTime),
          end_time: formatLocalDateTime(endDateTime),
          contact_phone: form.contact_phone,
          notes: form.notes,
        },
      });

      if (approvalResult.success) {
        toast.success("外出申请已提交，等待审批");
        onOpenChange(false);
        setForm({
          out_type: "",
          out_location: "",
          reason: "",
          start_date: undefined,
          start_time: "09:00",
          end_date: undefined,
          end_time: "18:00",
          contact_phone: "",
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
          <DialogTitle>外出申请</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* 申请人 */}
          <div className="space-y-2">
            <Label>申请人</Label>
            <Input value={currentUser?.name || ""} disabled className="bg-muted" />
          </div>

          {/* 外出类型 */}
          <div className="space-y-2">
            <Label>外出类型 *</Label>
            <Select value={form.out_type} onValueChange={(v) => setForm({ ...form, out_type: v })}>
              <SelectTrigger>
                <SelectValue placeholder="请选择外出类型" />
              </SelectTrigger>
              <SelectContent>
                {outTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 往返地点 */}
          <div className="space-y-2">
            <Label>往返地点 *</Label>
            <Input
              value={form.out_location}
              onChange={(e) => setForm({ ...form, out_location: e.target.value })}
              placeholder="请输入往返地点"
            />
          </div>

          {/* 外出事由 */}
          <div className="space-y-2">
            <Label>外出事由 *</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明外出事由"
              rows={3}
            />
          </div>

          {/* 开始时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>开始日期 *</Label>
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
                      setForm({ ...form, start_date: date, end_date: date });
                      setStartDateOpen(false);
                    }}
                    locale={zhCN}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>开始时间</Label>
              <Select value={form.start_time} onValueChange={(v) => setForm({ ...form, start_time: v })}>
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 结束时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>结束日期</Label>
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
                    disabled={(date) => form.start_date ? date < form.start_date : false}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>预计返回时间</Label>
              <Select value={form.end_time} onValueChange={(v) => setForm({ ...form, end_time: v })}>
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 时长显示 */}
          {duration && duration.hours > 0 && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              预计外出时长：<span className="font-medium text-foreground">{duration.hours} 小时</span>
            </div>
          )}

          {/* 联系电话 */}
          <div className="space-y-2">
            <Label>外出期间联系电话</Label>
            <Input
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              placeholder={currentUser?.mobile || "请输入联系电话"}
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "提交申请"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutForm;
