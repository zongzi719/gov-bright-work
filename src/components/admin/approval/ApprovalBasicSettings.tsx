import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string;
  business_type: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

interface ApprovalBasicSettingsProps {
  template: ApprovalTemplate | null;
  isCreating: boolean;
  onTemplateCreated: (template: ApprovalTemplate) => void;
  onTemplateUpdated: (template: ApprovalTemplate) => void;
}

const categoryOptions = [
  { value: "外出管理", label: "外出管理" },
  { value: "办公用品", label: "办公用品" },
];

const ApprovalBasicSettings = ({ 
  template, 
  isCreating, 
  onTemplateCreated,
  onTemplateUpdated 
}: ApprovalBasicSettingsProps) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    category: "外出管理",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        code: template.code,
        description: template.description || "",
        category: template.category || "外出管理",
        is_active: template.is_active,
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        category: "外出管理",
        is_active: true,
      });
    }
  }, [template]);

  const generateCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `PROC_${timestamp}`;
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("请填写审批名称");
      return;
    }

    setSaving(true);

    if (template) {
      // 更新
      const { data, error } = await supabase
        .from("approval_templates" as any)
        .update({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          is_active: formData.is_active,
        })
        .eq("id", template.id)
        .select()
        .single();

      if (error) {
        toast.error("更新失败");
        setSaving(false);
        return;
      }
      toast.success("保存成功");
      onTemplateUpdated(data as unknown as ApprovalTemplate);
    } else {
      // 创建
      const code = generateCode();
      const { data, error } = await supabase
        .from("approval_templates" as any)
        .insert({
          name: formData.name,
          code,
          description: formData.description,
          category: formData.category,
          is_active: formData.is_active,
        })
        .select()
        .single();

      if (error) {
        toast.error("创建失败");
        setSaving(false);
        return;
      }
      toast.success("创建成功，可以继续配置表单和流程");
      onTemplateCreated(data as unknown as ApprovalTemplate);
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!template) return;

    const { error } = await supabase
      .from("approval_templates" as any)
      .delete()
      .eq("id", template.id);

    if (error) {
      toast.error("删除失败");
      return;
    }
    toast.success("删除成功");
    // 触发返回列表
    window.history.back();
  };

  const handleCopyCode = () => {
    if (template?.code) {
      navigator.clipboard.writeText(template.code);
      toast.success("流程编码已复制");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>基础信息</CardTitle>
        <CardDescription>配置审批模板的基本信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>审批名称 *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="如：出差申请、物品领用"
          />
        </div>

        <div>
          <Label>分组</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            选择该审批模板所属的功能分组
          </p>
        </div>

        {template && (
          <div>
            <Label>流程编码</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">
                {template.code}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              流程编码在创建后不可修改，用于API调用
            </p>
          </div>
        )}


        <div>
          <Label>描述</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="审批流程的用途说明"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>启用状态</Label>
            <p className="text-xs text-muted-foreground">停用后，该审批模板将不可用</p>
          </div>
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          {template && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除模板
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    删除后将无法恢复，相关的表单字段和流程节点也会被删除。确定要删除吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>确认删除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex-1" />
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : template ? "保存修改" : "创建模板"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApprovalBasicSettings;
