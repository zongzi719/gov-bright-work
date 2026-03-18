import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/offlineApi";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
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
import EmojiIconPicker from "./EmojiIconPicker";
import * as dataAdapter from "@/lib/dataAdapter";

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string;
  business_type: string;
  category: string;
  is_active: boolean;
  nav_visible_scope?: string;
  nav_visible_org_ids?: string[];
  created_at: string;
}

interface ApprovalBasicSettingsProps {
  template: ApprovalTemplate | null;
  isCreating: boolean;
  onTemplateCreated: (template: ApprovalTemplate) => void;
  onTemplateUpdated: (template: ApprovalTemplate) => void;
}

interface OrgOption {
  id: string;
  name: string;
}

const categoryOptions = [
  { value: "外出管理", label: "外出管理" },
  { value: "办公用品", label: "办公用品" },
];

const visibilityScopeOptions = [
  { value: "all", label: "所有人可见" },
  { value: "leader_only", label: "仅领导可见" },
  { value: "specific_orgs", label: "指定单位可见" },
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
    icon: "📋",
    category: "外出管理",
    is_active: true,
    nav_visible_scope: "all",
    nav_visible_org_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        code: template.code,
        description: template.description || "",
        icon: template.icon || "📋",
        category: template.category || "外出管理",
        is_active: template.is_active,
        nav_visible_scope: template.nav_visible_scope || "all",
        nav_visible_org_ids: template.nav_visible_org_ids || [],
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        icon: "📋",
        category: "外出管理",
        is_active: true,
        nav_visible_scope: "all",
        nav_visible_org_ids: [],
      });
    }
  }, [template]);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    const { data } = await dataAdapter.getOrganizations();
    if (data) {
      setOrganizations((data as any[]).map(o => ({ id: o.id, name: o.name })));
    }
  };

  const generateCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    return `PROC_${timestamp}`;
  };

  const getApiBaseUrl = (): string => {
    if (typeof window !== "undefined" && (window as any).GOV_CONFIG?.API_BASE_URL) {
      return (window as any).GOV_CONFIG.API_BASE_URL;
    }
    return "http://localhost:3001";
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("请填写审批名称");
      return;
    }

    setSaving(true);

    const updatePayload = {
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      category: formData.category,
      is_active: formData.is_active,
      nav_visible_scope: formData.nav_visible_scope,
      nav_visible_org_ids: formData.nav_visible_org_ids,
    };

    if (isOfflineMode()) {
      try {
        const baseUrl = getApiBaseUrl();
        if (template) {
          const response = await fetch(`${baseUrl}/api/approval-templates/${template.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });
          if (!response.ok) throw new Error('更新失败');
          const data = await response.json();
          toast.success("保存成功");
          void logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_id: template.id, target_name: formData.name });
          onTemplateUpdated(data as ApprovalTemplate);
        } else {
          const code = generateCode();
          const response = await fetch(`${baseUrl}/api/approval-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updatePayload, code }),
          });
          if (!response.ok) throw new Error('创建失败');
          const data = await response.json();
          toast.success("创建成功，可以继续配置表单和流程");
          void logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_name: formData.name });
          onTemplateCreated(data as ApprovalTemplate);
        }
      } catch {
        toast.error(template ? "更新失败" : "创建失败");
      }
      setSaving(false);
      return;
    }

    if (template) {
      const { data, error } = await supabase
        .from("approval_templates" as any)
        .update(updatePayload)
        .eq("id", template.id)
        .select()
        .single();

      if (error) {
        toast.error("更新失败");
        setSaving(false);
        return;
      }
      toast.success("保存成功");
      void logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_id: template.id, target_name: formData.name });
      onTemplateUpdated(data as unknown as ApprovalTemplate);
    } else {
      const code = generateCode();
      const { data, error } = await supabase
        .from("approval_templates" as any)
        .insert({ ...updatePayload, code })
        .select()
        .single();

      if (error) {
        toast.error("创建失败");
        setSaving(false);
        return;
      }
      toast.success("创建成功，可以继续配置表单和流程");
      void logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_name: formData.name });
      onTemplateCreated(data as unknown as ApprovalTemplate);
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!template) return;

    try {
      if (isOfflineMode()) {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/approval-templates/${template.id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('删除失败');
        toast.success("删除成功");
        void logAudit({ action: AUDIT_ACTIONS.DELETE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_id: template.id, target_name: template.name });
        window.history.back();
        return;
      }

      const { error } = await supabase
        .from("approval_templates" as any)
        .delete()
        .eq("id", template.id);

      if (error) {
        toast.error("删除失败");
        return;
      }
      toast.success("删除成功");
      void logAudit({ action: AUDIT_ACTIONS.DELETE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_id: template.id, target_name: template.name });
      window.history.back();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleCopyCode = () => {
    if (template?.code) {
      navigator.clipboard.writeText(template.code);
      toast.success("流程编码已复制");
    }
  };

  const toggleOrgId = (orgId: string) => {
    setFormData(prev => ({
      ...prev,
      nav_visible_org_ids: prev.nav_visible_org_ids.includes(orgId)
        ? prev.nav_visible_org_ids.filter(id => id !== orgId)
        : [...prev.nav_visible_org_ids, orgId],
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>基础信息</CardTitle>
        <CardDescription>配置审批模板的基本信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 图标选择 */}
        <div>
          <Label className="mb-2 block">图标</Label>
          <div className="flex items-center gap-4">
            <EmojiIconPicker
              value={formData.icon}
              onChange={(icon) => setFormData({ ...formData, icon })}
            />
            <p className="text-sm text-muted-foreground">
              点击选择图标，将显示在审批列表和首页导航中
            </p>
          </div>
        </div>

        <div>
          <Label>审批名称 <span className="text-destructive">*</span></Label>
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

        {/* 导航可见范围 */}
        <div className="border rounded-lg p-4 space-y-4">
          <div>
            <Label className="text-base font-semibold">首页导航可见范围</Label>
            <p className="text-xs text-muted-foreground mt-1">
              控制哪些用户可以在首页应用导航中看到此模块
            </p>
          </div>
          <Select
            value={formData.nav_visible_scope}
            onValueChange={(value) => setFormData({ ...formData, nav_visible_scope: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibilityScopeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {formData.nav_visible_scope === "specific_orgs" && (
            <div className="space-y-2">
              <Label>选择可见单位</Label>
              <div className="border rounded p-3 max-h-48 overflow-y-auto space-y-1">
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无单位数据</p>
                ) : (
                  organizations.map(org => (
                    <label key={org.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.nav_visible_org_ids.includes(org.id)}
                        onChange={() => toggleOrgId(org.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{org.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
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
