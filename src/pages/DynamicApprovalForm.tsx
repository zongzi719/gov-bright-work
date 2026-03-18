import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CalendarIcon, Send } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as dataAdapter from "@/lib/dataAdapter";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApprovalTimeline from "@/components/admin/ApprovalTimeline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { allStatusConfig as statusConfig } from "@/lib/statusLabels";

interface FormField {
  id: string;
  template_id: string;
  field_type: string;
  field_name: string;
  field_label: string;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  field_options: string[] | null;
  col_span: number;
}

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string;
  business_type: string;
  is_active: boolean;
}

interface SubmissionRecord {
  id: string;
  business_id: string;
  business_type: string;
  status: string;
  form_data: Record<string, any>;
  created_at: string;
  template_id: string;
}

const buildInitialFormData = (loadedFields: FormField[], currentUser: any) => {
  const initialData: Record<string, any> = {};

  loadedFields.forEach((field) => {
    if (field.field_type === "user") {
      initialData[field.field_name] = currentUser?.name || "";
    } else if (field.field_type === "date") {
      initialData[field.field_name] = format(new Date(), "yyyy-MM-dd");
    } else if (field.field_type === "number" || field.field_type === "money") {
      initialData[field.field_name] = "";
    } else if (field.field_type === "checkbox") {
      initialData[field.field_name] = [];
    } else {
      initialData[field.field_name] = "";
    }
  });

  return initialData;
};

const DynamicApprovalForm = () => {
  const { templateId: routeId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { startApproval } = useApprovalWorkflow();

  const [template, setTemplate] = useState<ApprovalTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // List & detail states
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SubmissionRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) return JSON.parse(userStr);
    } catch (e) { /* empty */ }
    return null;
  };

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (routeId) {
      void loadRouteData(routeId);
    }
  }, [routeId]);

  useEffect(() => {
    if (template?.id && currentUser?.id) {
      void fetchRecords();
    }
  }, [template?.id, currentUser?.id]);

  const applyTemplateContext = async (loadedTemplate: ApprovalTemplate, preselectedRecord?: SubmissionRecord | null) => {
    setTemplate(loadedTemplate);

    const { data: fieldsData } = await dataAdapter.getApprovalFormFields(loadedTemplate.id);
    const loadedFields = ((fieldsData as unknown as FormField[]) || []).sort((a, b) => a.sort_order - b.sort_order);
    setFields(loadedFields);
    setFormData(buildInitialFormData(loadedFields, currentUser));

    if (preselectedRecord) {
      setSelectedRecord(preselectedRecord);
      setDetailOpen(true);
    }
  };

  const loadRouteData = async (id: string) => {
    setLoading(true);

    try {
      const { data: templates } = await dataAdapter.getAllApprovalTemplates();
      const templateList = (templates as ApprovalTemplate[]) || [];
      const foundTemplate = templateList.find((item) => item.id === id);

      if (foundTemplate) {
        await applyTemplateContext(foundTemplate);
        return;
      }

      const { data: instanceData, error: instanceError } = await dataAdapter.getApprovalInstanceById(id);
      if (!instanceError && instanceData) {
        const relatedTemplate = templateList.find((item) => item.id === (instanceData as SubmissionRecord).template_id);
        if (relatedTemplate) {
          await applyTemplateContext(relatedTemplate, instanceData as SubmissionRecord);
          return;
        }
      }

      toast.error("审批记录或模板不存在");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    if (!template || !currentUser?.id) return;
    setRecordsLoading(true);
    
    // Query approval_instances for this template + current user
    const { data, error } = await dataAdapter.getApprovalInstancesByTemplate(template.id, currentUser.id);
    
    if (!error && data) {
      setRecords(data as SubmissionRecord[]);
    }
    setRecordsLoading(false);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    for (const field of fields) {
      if (field.is_required && field.field_type !== "user") {
        const val = formData[field.field_name];
        if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
          toast.error(`请填写 ${field.field_label}`);
          return;
        }
      }
    }

    setSubmitting(true);

    // Generate a business ID (use crypto for UUID)
    const businessId = crypto.randomUUID();

    // Build title from first meaningful field
    const titleField = fields.find(f => f.field_type === "text" && f.field_name !== "contact_id");
    const titleValue = titleField ? formData[titleField.field_name] : "";
    const title = `${template!.name} - ${titleValue || currentUser?.name || ""}`.substring(0, 60);

    // 先检查是否有已发布的审批流程版本
    const { data: versionData } = await dataAdapter.getApprovalProcessVersions(template!.id, true);
    if (!versionData || (Array.isArray(versionData) && versionData.length === 0) || (!Array.isArray(versionData) && !versionData?.id)) {
      setSubmitting(false);
      toast.error("该审批模板尚未发布流程版本，请在管理后台的审批设置中发布流程");
      return;
    }

    const approvalResult = await startApproval({
      businessType: template!.business_type,
      businessId,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title,
      formData,
      templateId: template!.id,
    });

    setSubmitting(false);

    if (approvalResult.success) {
      await logAudit({
        action: AUDIT_ACTIONS.CREATE,
        module: AUDIT_MODULES.APPROVAL,
        target_type: template!.name,
        target_id: businessId,
        target_name: title,
        detail: formData,
      });
      toast.success("申请已提交，审批流程已启动");
      setFormOpen(false);
      // 延迟刷新确保数据已写入
      setTimeout(() => void fetchRecords(), 300);
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  const handleOpenForm = () => {
    setFormData(buildInitialFormData(fields, currentUser));
    setFormOpen(true);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.field_name];

    switch (field.field_type) {
      case "user":
        return (
          <>
            <Label>{field.field_label}</Label>
            <Input value={currentUser?.name || ""} disabled className="bg-muted mt-1" />
          </>
        );

      case "text":
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              value={value || ""}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder || `请输入${field.field_label}`}
              className="mt-1"
            />
          </>
        );

      case "textarea":
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              value={value || ""}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder || `请输入${field.field_label}`}
              className="mt-1 min-h-[80px]"
            />
          </>
        );

      case "number":
      case "money":
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              type="number"
              value={value || ""}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder || `请输入${field.field_label}`}
              className="mt-1"
              step={field.field_type === "money" ? "0.01" : "1"}
            />
          </>
        );

      case "date": {
        const dateValue = value ? new Date(value) : undefined;
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !dateValue && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateValue ? format(dateValue, "yyyy-MM-dd", { locale: zhCN }) : field.placeholder || "请选择日期"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={(date) => {
                    if (date) handleFieldChange(field.field_name, format(date, "yyyy-MM-dd"));
                  }}
                  locale={zhCN}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </>
        );
      }

      case "datetime": {
        const dtValue = value ? new Date(value) : undefined;
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              type="datetime-local"
              value={value || ""}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              className="mt-1"
            />
          </>
        );
      }

      case "select":
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select value={value || ""} onValueChange={(v) => handleFieldChange(field.field_name, v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={field.placeholder || "请选择"} />
              </SelectTrigger>
              <SelectContent>
                {(field.field_options || []).map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        );

      case "radio":
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <RadioGroup value={value || ""} onValueChange={(v) => handleFieldChange(field.field_name, v)} className="mt-2 flex flex-wrap gap-4">
              {(field.field_options || []).map((opt) => (
                <div key={opt} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                  <Label htmlFor={`${field.id}-${opt}`} className="font-normal">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </>
        );

      case "checkbox":
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {(field.field_options || []).map((opt) => (
                <div key={opt} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${opt}`}
                    checked={(value || []).includes(opt)}
                    onCheckedChange={(checked) => {
                      const current = value || [];
                      handleFieldChange(
                        field.field_name,
                        checked ? [...current, opt] : current.filter((v: string) => v !== opt)
                      );
                    }}
                  />
                  <Label htmlFor={`${field.id}-${opt}`} className="font-normal">{opt}</Label>
                </div>
              ))}
            </div>
          </>
        );

      default:
        return (
          <>
            <Label>
              {field.field_label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              value={value || ""}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              placeholder={field.placeholder || ""}
              className="mt-1"
            />
          </>
        );
    }
  };

  if (loading || !template) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
      </PageLayout>
    );
  }

  // Build list items
  const filteredRecords = records.filter(r => {
    if (!search) return true;
    const fd = r.form_data || {};
    return Object.values(fd).some(v => String(v).includes(search));
  });

  const listItems: ApplicationItem[] = filteredRecords.map(record => {
    const fd = record.form_data || {};
    const firstField = fields[0];
    const subtitle = firstField ? String(fd[firstField.field_name] || "") : "";
    
    return {
      id: record.id,
      title: `${template.name}`,
      subtitle: subtitle || currentUser?.name || "",
      time: new Date(record.created_at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }),
      status: record.status,
      meta: fields.slice(0, 2).map(f => ({
        label: f.field_label,
        value: String(fd[f.field_name] || "-"),
      })),
    };
  });

  const handleItemClick = (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      setDetailOpen(true);
    }
  };

  return (
    <PageLayout>
      <ApplicationList
        title={template.name}
        items={listItems}
        loading={recordsLoading}
        search={search}
        onSearchChange={setSearch}
        onAddClick={handleOpenForm}
        onItemClick={handleItemClick}
        searchPlaceholder="搜索..."
        emptyText={`暂无${template.name}记录`}
      />

      {/* 新建表单对话框 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b bg-background flex-shrink-0">
            <DialogTitle>
              <span className="mr-2">{template.icon}</span>
              新建{template.name}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="px-6 py-4 flex-1 min-h-0">
            {fields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>该审批模板尚未配置表单字段</p>
                <p className="text-sm mt-1">请在管理后台的审批设置中配置表单</p>
              </div>
            ) : (
              <div className="flex flex-wrap -mx-2">
                {fields.map((field) => (
                  <div key={field.id} className={cn("px-2 mb-4", field.col_span === 2 || field.field_type === "textarea" ? "w-full" : "w-full md:w-1/2")}>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {fields.length > 0 && (
            <div className="px-6 py-4 border-t bg-background flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-primary">
                <Send className="w-4 h-4 mr-2" />
                {submitting ? "提交中..." : "提交申请"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b bg-background flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <span>{template.icon}</span>
              {template.name}详情
              {selectedRecord && (
                <Badge variant={selectedRecord.status === "approved" ? "default" : selectedRecord.status === "rejected" ? "destructive" : "secondary"}>
                  {statusConfig[selectedRecord.status]?.label || selectedRecord.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="px-6 py-4 flex-1 min-h-0">
            {selectedRecord && (
              <div className="space-y-4">
                {/* 表单数据展示 */}
                <div className="flex flex-wrap -mx-2">
                  {fields.map(field => {
                    const val = selectedRecord.form_data?.[field.field_name];
                    return (
                      <div key={field.id} className={cn("px-2 mb-4", field.col_span === 2 ? "w-full" : "w-full md:w-1/2")}>
                        <Label className="text-sm text-muted-foreground">{field.field_label}</Label>
                        <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md text-sm min-h-[40px] flex items-center">
                          {Array.isArray(val) ? val.join(", ") : (val || "-")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* 审批流程 */}
                <div>
                  <h4 className="font-medium mb-3">审批流程</h4>
                  <ApprovalTimeline
                    businessId={selectedRecord.business_id}
                    businessType={selectedRecord.business_type || template.business_type}
                    instanceId={selectedRecord.id}
                  />
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default DynamicApprovalForm;
