import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string;
  business_type: string;
  is_active: boolean;
  created_at: string;
}

const businessTypeLabels: Record<string, string> = {
  absence: "外出/请假",
  supply_requisition: "物品领用",
  purchase_request: "采购申请",
  external_approval: "外部审批",
};

const iconOptions = [
  { value: "📋", label: "📋 表单" },
  { value: "🚗", label: "🚗 出差" },
  { value: "📦", label: "📦 物品" },
  { value: "💰", label: "💰 采购" },
  { value: "📝", label: "📝 申请" },
  { value: "🏖️", label: "🏖️ 请假" },
  { value: "🔧", label: "🔧 维修" },
];

const ApprovalBasicSettings = () => {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApprovalTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    icon: "📋",
    business_type: "absence",
    is_active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("approval_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching templates:", error);
      toast.error("获取审批模板失败");
    } else {
      setTemplates((data as unknown as ApprovalTemplate[]) || []);
    }
    setLoading(false);
  };

  const generateCode = (name: string) => {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `PROC_${timestamp}`;
  };

  const handleOpenDialog = (template?: ApprovalTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        code: template.code,
        description: template.description || "",
        icon: template.icon,
        business_type: template.business_type,
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        icon: "📋",
        business_type: "absence",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("请填写审批名称");
      return;
    }

    const code = formData.code || generateCode(formData.name);

    if (editingTemplate) {
      const { error } = await supabase
        .from("approval_templates" as any)
        .update({
          name: formData.name,
          description: formData.description,
          icon: formData.icon,
          business_type: formData.business_type,
          is_active: formData.is_active,
        })
        .eq("id", editingTemplate.id);

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
    } else {
      const { error } = await supabase
        .from("approval_templates" as any)
        .insert({
          name: formData.name,
          code,
          description: formData.description,
          icon: formData.icon,
          business_type: formData.business_type,
          is_active: formData.is_active,
        });

      if (error) {
        toast.error("创建失败");
        return;
      }
      toast.success("创建成功");
    }

    setDialogOpen(false);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个审批模板吗？")) return;

    const { error } = await supabase
      .from("approval_templates" as any)
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }
    toast.success("删除成功");
    fetchTemplates();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("流程编码已复制");
  };

  const handleToggleActive = async (template: ApprovalTemplate) => {
    const { error } = await supabase
      .from("approval_templates" as any)
      .update({ is_active: !template.is_active })
      .eq("id", template.id);

    if (error) {
      toast.error("更新状态失败");
      return;
    }
    toast.success(template.is_active ? "已停用" : "已启用");
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>审批模板管理</CardTitle>
              <CardDescription>创建和管理审批流程模板，每个模板对应一种审批类型</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              新建模板
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无审批模板，点击"新建模板"创建
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>图标</TableHead>
                  <TableHead>审批名称</TableHead>
                  <TableHead>流程编码</TableHead>
                  <TableHead>业务类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="text-2xl">{template.icon}</TableCell>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {template.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyCode(template.code)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {businessTypeLabels[template.business_type] || template.business_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => handleToggleActive(template)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(template)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "编辑审批模板" : "新建审批模板"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <Label>图标</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label>审批名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：出差申请、物品领用"
                />
              </div>
            </div>

            <div>
              <Label>业务类型</Label>
              <Select
                value={formData.business_type}
                onValueChange={(value) => setFormData({ ...formData, business_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absence">外出/请假</SelectItem>
                  <SelectItem value="supply_requisition">物品领用</SelectItem>
                  <SelectItem value="purchase_request">采购申请</SelectItem>
                  <SelectItem value="external_approval">外部审批</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="审批流程的用途说明"
                rows={3}
              />
            </div>

            {editingTemplate && (
              <div>
                <Label>流程编码</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">
                    {editingTemplate.code}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyCode(editingTemplate.code)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  流程编码在创建后不可修改，用于API调用
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>启用状态</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalBasicSettings;
