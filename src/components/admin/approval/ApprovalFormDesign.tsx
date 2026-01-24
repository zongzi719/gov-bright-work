import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Type, 
  AlignLeft, 
  Hash, 
  Calendar, 
  Image, 
  List, 
  CheckSquare,
  CircleDot,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  icon: string;
}

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
}

const fieldTypeConfig = {
  text: { icon: Type, label: "单行输入", placeholder: "请输入" },
  textarea: { icon: AlignLeft, label: "多行输入", placeholder: "请输入详细内容" },
  number: { icon: Hash, label: "数字", placeholder: "请输入数字" },
  money: { icon: DollarSign, label: "金额", placeholder: "请输入金额" },
  date: { icon: Calendar, label: "日期", placeholder: "请选择日期" },
  daterange: { icon: Calendar, label: "日期区间", placeholder: "请选择日期范围" },
  image: { icon: Image, label: "图片", placeholder: "请上传图片" },
  select: { icon: List, label: "下拉选择", placeholder: "请选择" },
  radio: { icon: CircleDot, label: "单选框", placeholder: "请选择" },
  checkbox: { icon: CheckSquare, label: "多选框", placeholder: "请选择" },
};

const ApprovalFormDesign = () => {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  
  const [fieldForm, setFieldForm] = useState({
    field_type: "text",
    field_name: "",
    field_label: "",
    placeholder: "",
    is_required: false,
    options: [] as string[],
  });
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      fetchFields();
    }
  }, [selectedTemplateId]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("approval_templates" as any)
      .select("id, name, code, icon")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取模板列表失败");
      return;
    }
    setTemplates((data as unknown as ApprovalTemplate[]) || []);
    if (data && data.length > 0) {
      setSelectedTemplateId((data as unknown as ApprovalTemplate[])[0].id);
    }
    setLoading(false);
  };

  const fetchFields = async () => {
    const { data, error } = await supabase
      .from("approval_form_fields" as any)
      .select("*")
      .eq("template_id", selectedTemplateId)
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("获取表单字段失败");
      return;
    }
    setFields((data as unknown as FormField[]) || []);
  };

  const handleOpenFieldDialog = (field?: FormField) => {
    if (field) {
      setEditingField(field);
      setFieldForm({
        field_type: field.field_type,
        field_name: field.field_name,
        field_label: field.field_label,
        placeholder: field.placeholder || "",
        is_required: field.is_required,
        options: field.field_options || [],
      });
    } else {
      setEditingField(null);
      setFieldForm({
        field_type: "text",
        field_name: "",
        field_label: "",
        placeholder: "",
        is_required: false,
        options: [],
      });
    }
    setOptionInput("");
    setFieldDialogOpen(true);
  };

  const handleAddOption = () => {
    if (!optionInput.trim()) return;
    if (fieldForm.options.includes(optionInput.trim())) {
      toast.error("选项已存在");
      return;
    }
    setFieldForm({
      ...fieldForm,
      options: [...fieldForm.options, optionInput.trim()],
    });
    setOptionInput("");
  };

  const handleRemoveOption = (index: number) => {
    setFieldForm({
      ...fieldForm,
      options: fieldForm.options.filter((_, i) => i !== index),
    });
  };

  const generateFieldName = () => {
    return `field_${Date.now().toString(36)}`;
  };

  const handleSaveField = async () => {
    if (!fieldForm.field_label) {
      toast.error("请填写字段标题");
      return;
    }

    const needsOptions = ["select", "radio", "checkbox"].includes(fieldForm.field_type);
    if (needsOptions && fieldForm.options.length === 0) {
      toast.error("请添加至少一个选项");
      return;
    }

    const fieldName = fieldForm.field_name || generateFieldName();

    if (editingField) {
      const { error } = await supabase
        .from("approval_form_fields" as any)
        .update({
          field_type: fieldForm.field_type,
          field_label: fieldForm.field_label,
          placeholder: fieldForm.placeholder,
          is_required: fieldForm.is_required,
          field_options: fieldForm.options,
        })
        .eq("id", editingField.id);

      if (error) {
        toast.error("更新字段失败");
        return;
      }
      toast.success("字段更新成功");
    } else {
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.sort_order)) : 0;
      
      const { error } = await supabase
        .from("approval_form_fields" as any)
        .insert({
          template_id: selectedTemplateId,
          field_type: fieldForm.field_type,
          field_name: fieldName,
          field_label: fieldForm.field_label,
          placeholder: fieldForm.placeholder,
          is_required: fieldForm.is_required,
          field_options: fieldForm.options,
          sort_order: maxOrder + 1,
        });

      if (error) {
        toast.error("添加字段失败");
        return;
      }
      toast.success("字段添加成功");
    }

    setFieldDialogOpen(false);
    fetchFields();
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("确定要删除这个字段吗？")) return;

    const { error } = await supabase
      .from("approval_form_fields" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除字段失败");
      return;
    }
    toast.success("字段已删除");
    fetchFields();
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          请先在"基础设置"中创建审批模板
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>表单设计</CardTitle>
              <CardDescription>为审批模板设计表单字段，支持多种控件类型</CardDescription>
            </div>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="选择审批模板" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.icon} {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        {/* 控件库 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">控件库</CardTitle>
            <CardDescription>点击添加到表单</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(fieldTypeConfig).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setFieldForm({
                      ...fieldForm,
                      field_type: type,
                      placeholder: config.placeholder,
                    });
                    handleOpenFieldDialog();
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* 表单预览 */}
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedTemplate?.icon} {selectedTemplate?.name}
                </CardTitle>
                <CardDescription>表单字段列表</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenFieldDialog()}>
                <Plus className="w-4 h-4 mr-1" />
                添加字段
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                暂无表单字段，从左侧控件库添加
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field) => {
                  const config = fieldTypeConfig[field.field_type as keyof typeof fieldTypeConfig];
                  const Icon = config?.icon || Type;
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{field.field_label}</span>
                          {field.is_required && (
                            <Badge variant="destructive" className="text-xs">必填</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {config?.label} · {field.field_name}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenFieldDialog(field)}
                        >
                          <Type className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteField(field.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 字段编辑弹窗 */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? "编辑字段" : "添加字段"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>控件类型</Label>
              <Select
                value={fieldForm.field_type}
                onValueChange={(value) => {
                  const config = fieldTypeConfig[value as keyof typeof fieldTypeConfig];
                  setFieldForm({
                    ...fieldForm,
                    field_type: value,
                    placeholder: config?.placeholder || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fieldTypeConfig).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>字段标题 *</Label>
              <Input
                value={fieldForm.field_label}
                onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })}
                placeholder="如：出差事由、申请数量"
              />
            </div>

            <div>
              <Label>提示文字</Label>
              <Input
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                placeholder="输入框中的提示文字"
              />
            </div>

            {["select", "radio", "checkbox"].includes(fieldForm.field_type) && (
              <div>
                <Label>选项列表</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={optionInput}
                      onChange={(e) => setOptionInput(e.target.value)}
                      placeholder="输入选项内容"
                      onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
                    />
                    <Button type="button" onClick={handleAddOption}>添加</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fieldForm.options.map((option, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {option}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() => handleRemoveOption(index)}
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>是否必填</Label>
              <Switch
                checked={fieldForm.is_required}
                onCheckedChange={(checked) => setFieldForm({ ...fieldForm, is_required: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveField}>
              {editingField ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalFormDesign;
