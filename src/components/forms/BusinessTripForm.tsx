import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import { Badge } from "@/components/ui/badge";

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

const BusinessTripForm = ({ open, onOpenChange, currentUser }: BusinessTripFormProps) => {
  const { startApproval } = useApprovalWorkflow();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({
    reason: "",
    destination: "",
    start_time: undefined as Date | undefined,
    end_time: undefined as Date | undefined,
    transport_type: "",
    companions: [] as string[],
    estimated_cost: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setContacts(data);
  };

  const calculateDuration = () => {
    if (!form.start_time || !form.end_time) return null;
    const hours = differenceInHours(form.end_time, form.start_time);
    const days = differenceInDays(form.end_time, form.start_time);
    return { hours, days: days > 0 ? days : (hours > 0 ? 1 : 0) };
  };

  const duration = calculateDuration();

  const handleSubmit = async () => {
    if (!currentUser?.id || !form.reason || !form.destination || !form.start_time) {
      toast.error("请填写必填项");
      return;
    }

    setSubmitting(true);

    try {
      const durationData = calculateDuration();
      
      const { data: record, error } = await supabase.from("absence_records").insert({
        contact_id: currentUser.id,
        type: "business_trip",
        reason: form.reason,
        destination: form.destination,
        start_time: form.start_time.toISOString(),
        end_time: form.end_time?.toISOString() || null,
        transport_type: form.transport_type || null,
        companions: form.companions.length > 0 ? form.companions : null,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
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

      const approvalResult = await startApproval({
        businessType: "business_trip",
        businessId: record.id,
        initiatorId: currentUser.id,
        initiatorName: currentUser.name || "未知用户",
        title: `出差申请 - ${form.destination}`,
        formData: {
          reason: form.reason,
          destination: form.destination,
          start_time: form.start_time.toISOString(),
          end_time: form.end_time?.toISOString() || null,
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
          start_time: undefined,
          end_time: undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>出差申请</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
              预计出差时长：<span className="font-medium text-foreground">{duration.days} 天</span>
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
            <Select onValueChange={handleAddCompanion}>
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
                  <Badge key={id} variant="secondary" className="gap-1">
                    {getContactName(id)}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveCompanion(id)}
                    />
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

export default BusinessTripForm;
