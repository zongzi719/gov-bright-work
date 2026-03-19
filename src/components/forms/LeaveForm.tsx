import { useState, useEffect, useRef } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Upload, X, FileImage } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as dataAdapter from "@/lib/dataAdapter";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import PersonPickerDialog from "@/components/PersonPickerDialog";

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

// 季节配置
type SeasonType = "winter" | "summer";

const seasonConfig = {
  winter: {
    label: "冬季",
    description: "10月1日 - 次年4月30日",
    morning: { start: "10:00", end: "14:00" },
    afternoon: { start: "15:30", end: "19:30" },
  },
  summer: {
    label: "夏季",
    description: "5月1日 - 9月30日",
    morning: { start: "10:00", end: "14:00" },
    afternoon: { start: "16:00", end: "20:00" },
  },
};

// 根据日期自动判断季节
const getSeasonByDate = (date: Date): SeasonType => {
  const month = date.getMonth() + 1; // 0-11 -> 1-12
  // 夏季：5月1日 - 9月30日
  if (month >= 5 && month <= 9) {
    return "summer";
  }
  // 冬季：10月1日 - 次年4月30日
  return "winter";
};

// 生成时间选项（每半小时一个选项）
const generateTimeOptions = (start: string, end: string): string[] => {
  const options: string[] = [];
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  for (let m = startMinutes; m <= endMinutes; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    options.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
  }
  return options;
};

// 获取指定季节的所有可选时间
const getSeasonTimeOptions = (season: SeasonType): string[] => {
  const config = seasonConfig[season];
  const morningOptions = generateTimeOptions(config.morning.start, config.morning.end);
  const afternoonOptions = generateTimeOptions(config.afternoon.start, config.afternoon.end);
  return [...morningOptions, ...afternoonOptions];
};

const LeaveForm = ({ open, onOpenChange, currentUser }: LeaveFormProps) => {
  const { startApproval } = useApprovalWorkflow();
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [season, setSeason] = useState<SeasonType>(() => getSeasonByDate(new Date()));
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [handoverPersonName, setHandoverPersonName] = useState("");
  const [form, setForm] = useState({
    leave_type: "",
    reason: "",
    start_date: undefined as Date | undefined,
    start_hour: "10:00",
    end_date: undefined as Date | undefined,
    end_hour: "19:30",
    handover_person_id: "",
    handover_notes: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [medicalCertFile, setMedicalCertFile] = useState<File | null>(null);
  const [medicalCertPreview, setMedicalCertPreview] = useState<string | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 季节变化时更新默认结束时间
  useEffect(() => {
    const defaultEndHour = season === "winter" ? "19:30" : "20:00";
    setForm(prev => ({ ...prev, end_hour: defaultEndHour }));
  }, [season]);

  // 获取当前季节的时间选项
  const timeOptions = getSeasonTimeOptions(season);
  const currentSeasonConfig = seasonConfig[season];

  useEffect(() => {
    if (open && currentUser?.id) {
      fetchLeaveBalance();
      setHandoverPersonName("");
    }
  }, [open, currentUser?.id]);

  const fetchLeaveBalance = async () => {
    if (!currentUser?.id) return;
    const currentYear = new Date().getFullYear();
    const { data } = await dataAdapter.getLeaveBalance(currentUser.id, currentYear);
    if (data) setLeaveBalance(data);
  };

  // 解析时间字符串为小时和分钟
  const parseTimeString = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return { hours, minutes, totalMinutes: hours * 60 + minutes };
  };

  // 判断时间是否在上午时段
  const isInMorningPeriod = (totalMinutes: number): boolean => {
    const morningStart = parseTimeString(currentSeasonConfig.morning.start).totalMinutes;
    const morningEnd = parseTimeString(currentSeasonConfig.morning.end).totalMinutes;
    return totalMinutes >= morningStart && totalMinutes <= morningEnd;
  };

  // 判断时间是否在下午时段
  const isInAfternoonPeriod = (totalMinutes: number): boolean => {
    const afternoonStart = parseTimeString(currentSeasonConfig.afternoon.start).totalMinutes;
    const afternoonEnd = parseTimeString(currentSeasonConfig.afternoon.end).totalMinutes;
    return totalMinutes >= afternoonStart && totalMinutes <= afternoonEnd;
  };

  // 计算单天的工作时长（考虑上午和下午时段）
  const calculateSingleDayHours = (startMinutes: number, endMinutes: number): number => {
    const morningStart = parseTimeString(currentSeasonConfig.morning.start).totalMinutes;
    const morningEnd = parseTimeString(currentSeasonConfig.morning.end).totalMinutes;
    const afternoonStart = parseTimeString(currentSeasonConfig.afternoon.start).totalMinutes;
    const afternoonEnd = parseTimeString(currentSeasonConfig.afternoon.end).totalMinutes;
    
    let totalMinutes = 0;
    
    // 计算上午时段的时长
    if (startMinutes <= morningEnd && endMinutes >= morningStart) {
      const effectiveStart = Math.max(startMinutes, morningStart);
      const effectiveEnd = Math.min(endMinutes, morningEnd);
      if (effectiveEnd > effectiveStart) {
        totalMinutes += effectiveEnd - effectiveStart;
      }
    }
    
    // 计算下午时段的时长
    if (startMinutes <= afternoonEnd && endMinutes >= afternoonStart) {
      const effectiveStart = Math.max(startMinutes, afternoonStart);
      const effectiveEnd = Math.min(endMinutes, afternoonEnd);
      if (effectiveEnd > effectiveStart) {
        totalMinutes += effectiveEnd - effectiveStart;
      }
    }
    
    return totalMinutes / 60;
  };

  // 计算请假时长：总小时数和等效天数（1天=8小时）
  const calculateDuration = () => {
    if (!form.start_date || !form.end_date) return null;
    
    const startTime = parseTimeString(form.start_hour);
    const endTime = parseTimeString(form.end_hour);
    
    // 计算请假天数（包含首尾两天）
    const calendarDays = differenceInCalendarDays(form.end_date, form.start_date) + 1;
    if (calendarDays <= 0) return null;
    
    // 每天最多8小时
    const hoursPerDay = 8;
    let totalHours = 0;
    
    if (calendarDays === 1) {
      // 同一天：按实际工作时段计算
      totalHours = calculateSingleDayHours(startTime.totalMinutes, endTime.totalMinutes);
      totalHours = Math.min(totalHours, hoursPerDay);
    } else {
      // 跨天计算：
      // 第一天：从开始时间到当天结束
      const morningEnd = parseTimeString(currentSeasonConfig.morning.end).totalMinutes;
      const afternoonEnd = parseTimeString(currentSeasonConfig.afternoon.end).totalMinutes;
      const firstDayHours = calculateSingleDayHours(startTime.totalMinutes, afternoonEnd);
      
      // 最后一天：从当天开始到结束时间
      const morningStart = parseTimeString(currentSeasonConfig.morning.start).totalMinutes;
      const lastDayHours = calculateSingleDayHours(morningStart, endTime.totalMinutes);
      
      // 中间天数：每天8小时
      const middleDays = calendarDays - 2;
      const middleHours = middleDays > 0 ? middleDays * hoursPerDay : 0;
      
      totalHours = Math.min(firstDayHours, hoursPerDay) + middleHours + Math.min(lastDayHours, hoursPerDay);
    }
    
    // 四舍五入到0.5小时
    totalHours = Math.round(totalHours * 2) / 2;
    
    // 等效天数（8小时=1天）
    const equivalentDays = totalHours / 8;
    
    return { 
      hours: totalHours, 
      days: equivalentDays, 
      calendarDays,
      startTime: form.start_hour,
      endTime: form.end_hour
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

  const handleMedicalCertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error("仅支持 PNG、JPG、JPEG 格式的图片");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }
    setMedicalCertFile(file);
    setMedicalCertPreview(URL.createObjectURL(file));
  };

  const removeMedicalCert = () => {
    setMedicalCertFile(null);
    if (medicalCertPreview) URL.revokeObjectURL(medicalCertPreview);
    setMedicalCertPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadMedicalCert = async (): Promise<string | null> => {
    if (!medicalCertFile || !currentUser?.id) return null;
    setUploadingCert(true);
    try {
      const ext = medicalCertFile.name.split(".").pop() || "jpg";
      const filePath = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("medical-certificates").upload(filePath, medicalCertFile);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("medical-certificates").getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      console.error("上传诊断证明书失败:", err);
      toast.error("上传诊断证明书失败");
      return null;
    } finally {
      setUploadingCert(false);
    }
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

    // 病假必须上传诊断证明书
    if (form.leave_type === "sick" && !medicalCertFile) {
      toast.error("病假需上传医院开具的诊断证明书");
      return;
    }

    setSubmitting(true);

    try {
      // 解析时间字符串并构造时间戳
      const [startHours, startMinutes] = form.start_hour.split(":").map(Number);
      const [endHours, endMinutes] = form.end_hour.split(":").map(Number);
      
      const startTime = new Date(form.start_date);
      startTime.setHours(startHours, startMinutes, 0, 0);
      
      const endTime = new Date(form.end_date);
      endTime.setHours(endHours, endMinutes, 0, 0);
      
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
      
      // 上传诊断证明书（病假时）
      let medicalCertUrl: string | null = null;
      if (form.leave_type === "sick" && medicalCertFile) {
        medicalCertUrl = await uploadMedicalCert();
        if (!medicalCertUrl) {
          setSubmitting(false);
          return;
        }
      }

      const { data: record, error } = await dataAdapter.createAbsenceRecord({
        contact_id: currentUser.id,
        type: "leave",
        leave_type: form.leave_type,
        reason: form.reason,
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
        handover_person_id: form.handover_person_id || null,
        handover_notes: form.handover_notes || null,
        duration_hours: duration.hours,
        duration_days: duration.days,
        notes: form.notes || null,
        medical_certificate_url: medicalCertUrl,
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
          start_time: formatLocalDateTime(startTime),
          end_time: formatLocalDateTime(endTime),
          handover_person_id: form.handover_person_id,
          handover_person_name: handoverPersonName || null,
          handover_notes: form.handover_notes,
          notes: form.notes,
          duration_hours: duration.hours,
          duration_days: duration.days,
          medical_certificate_url: medicalCertUrl,
        },
      });

      if (approvalResult.success) {
        const leaveTypeName = leaveTypes.find(t => t.value === form.leave_type)?.label || form.leave_type;
        await logAudit({
          action: AUDIT_ACTIONS.CREATE,
          module: AUDIT_MODULES.LEAVE,
          target_type: '请假申请',
          target_id: record.id,
          target_name: `${leaveTypeName} ${duration.hours}小时`,
          detail: { leave_type: form.leave_type, duration_hours: duration.hours, duration_days: duration.days, reason: form.reason },
        });
        toast.success("请假申请已提交，等待审批");
        setForm({
          leave_type: "",
          reason: "",
          start_date: undefined,
          start_hour: "08:00",
          end_date: undefined,
          end_hour: "17:00",
          handover_person_id: "",
          handover_notes: "",
          notes: "",
        });
        removeMedicalCert();
        onOpenChange(false);
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
            <Label>请假类型 <span className="text-destructive">*</span></Label>
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

          {/* 诊断证明书上传（仅病假显示） */}
          {form.leave_type === "sick" && (
            <div className="space-y-2">
              <Label>上传诊断证明书 <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">病假需附带医院开具的3日以内疾病诊断证明书，仅支持 PNG、JPG、JPEG 格式</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                className="hidden"
                onChange={handleMedicalCertChange}
              />
              {medicalCertPreview ? (
                <div className="relative inline-block">
                  <img src={medicalCertPreview} alt="诊断证明书" className="max-h-40 rounded-md border" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={removeMedicalCert}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-20 border-dashed flex flex-col gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">点击上传诊断证明书</span>
                </Button>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>工作时间制度</Label>
            <Select value={season} onValueChange={(v: SeasonType) => setSeason(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="winter">
                  <div className="flex flex-col">
                    <span>冬季（10月1日 - 次年4月30日）</span>
                    <span className="text-xs text-muted-foreground">上午 10:00-14:00，下午 15:30-19:30</span>
                  </div>
                </SelectItem>
                <SelectItem value="summer">
                  <div className="flex flex-col">
                    <span>夏季（5月1日 - 9月30日）</span>
                    <span className="text-xs text-muted-foreground">上午 10:00-14:00，下午 16:00-20:00</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 请假事由 */}
          <div className="space-y-2">
            <Label>请假事由 <span className="text-destructive">*</span></Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="请详细说明请假原因"
              rows={3}
            />
          </div>

          {/* 开始时间 */}
          <div className="space-y-2">
            <Label>开始时间 <span className="text-destructive">*</span></Label>
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
                  <SelectValue placeholder="选择时间" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 结束时间 */}
          <div className="space-y-2">
            <Label>结束时间 <span className="text-destructive">*</span></Label>
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
                  <SelectValue placeholder="选择时间" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 时长显示 */}
          {duration && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">{duration.hours}</span>
                <span className="text-sm text-muted-foreground">小时</span>
                {duration.days > 0 && (
                  <span className="text-sm text-muted-foreground">（约 {duration.days.toFixed(1)} 天）</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                根据{seasonConfig[season].label}作息时间自动计算，每天最多8小时
              </div>
              {!checkBalanceSufficient() && (
                <div className="text-destructive text-xs font-medium">
                  ⚠️ 超出可用余额
                </div>
              )}
            </div>
          )}

          {/* 工作交接人 */}
          <div className="space-y-2">
            <Label>工作交接人</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 justify-start font-normal"
                onClick={() => setPersonPickerOpen(true)}
              >
                {handoverPersonName || (
                  <span className="text-muted-foreground">点击选择工作交接人</span>
                )}
              </Button>
              {form.handover_person_id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setForm({ ...form, handover_person_id: "" });
                    setHandoverPersonName("");
                  }}
                  className="text-muted-foreground"
                >
                  ×
                </Button>
              )}
            </div>
          </div>
          <PersonPickerDialog
            open={personPickerOpen}
            onOpenChange={setPersonPickerOpen}
            onSelect={(contact) => {
              setForm({ ...form, handover_person_id: contact.id });
              setHandoverPersonName(`${contact.name}${contact.department ? ` (${contact.department})` : ""}`);
            }}
            excludeIds={currentUser?.id ? [currentUser.id] : []}
            title="选择工作交接人"
          />

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
