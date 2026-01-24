import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fieldTypeConfig } from "./fieldConfig";
import type { FormField } from "./types";

interface FieldEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: FormField | null;
  initialType?: string;
  onSave: (fieldData: Partial<FormField>) => void;
}

const FieldEditDialog = ({ open, onOpenChange, field, initialType, onSave }: FieldEditDialogProps) => {
  const [fieldForm, setFieldForm] = useState({
    field_type: initialType || "text",
    field_name: "",
    field_label: "",
    placeholder: "",
    is_required: false,
    options: [] as string[],
    col_span: 2,
  });
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => {
    if (field) {
      setFieldForm({
        field_type: field.field_type,
        field_name: field.field_name,
        field_label: field.field_label,
        placeholder: field.placeholder || "",
        is_required: field.is_required,
        options: field.field_options || [],
        col_span: field.col_span || 2,
      });
    } else if (initialType) {
      const config = fieldTypeConfig[initialType as keyof typeof fieldTypeConfig];
      setFieldForm({
        field_type: initialType,
        field_name: "",
        field_label: "",
        placeholder: config?.placeholder || "",
        is_required: false,
        options: [],
        col_span: 2,
      });
    }
    setOptionInput("");
  }, [field, initialType, open]);

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

  const handleSave = () => {
    if (!fieldForm.field_label) {
      toast.error("请填写字段标题");
      return;
    }

    const needsOptions = ["select", "radio", "checkbox"].includes(fieldForm.field_type);
    if (needsOptions && fieldForm.options.length === 0) {
      toast.error("请添加至少一个选项");
      return;
    }

    onSave({
      field_type: fieldForm.field_type,
      field_name: fieldForm.field_name || `field_${Date.now().toString(36)}`,
      field_label: fieldForm.field_label,
      placeholder: fieldForm.placeholder,
      is_required: fieldForm.is_required,
      field_options: fieldForm.options.length > 0 ? fieldForm.options : null,
      col_span: fieldForm.col_span,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? "编辑字段" : "添加字段"}</DialogTitle>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>字段标题 *</Label>
              <Input
                value={fieldForm.field_label}
                onChange={(e) => setFieldForm({ ...fieldForm, field_label: e.target.value })}
                placeholder="如：出差事由"
              />
            </div>
            <div>
              <Label>占位宽度</Label>
              <Select
                value={fieldForm.col_span.toString()}
                onValueChange={(v) => setFieldForm({ ...fieldForm, col_span: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">半行（50%）</SelectItem>
                  <SelectItem value="2">整行（100%）</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            {field ? "保存" : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FieldEditDialog;
