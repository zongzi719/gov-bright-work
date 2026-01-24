import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Webhook,
  Bell,
  Clock,
  Shield,
  RefreshCw,
  ExternalLink,
  Copy,
  Save
} from "lucide-react";
import { toast } from "sonner";

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  icon: string;
  callback_url: string | null;
  auto_approve_timeout: number | null;
  allow_withdraw: boolean;
  allow_transfer: boolean;
  notify_on_approve: boolean;
  notify_on_reject: boolean;
}

const ApprovalAdvancedSettings = () => {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [settings, setSettings] = useState<Partial<ApprovalTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setSettings({
          callback_url: template.callback_url || "",
          auto_approve_timeout: template.auto_approve_timeout || 0,
          allow_withdraw: template.allow_withdraw ?? true,
          allow_transfer: template.allow_transfer ?? false,
          notify_on_approve: template.notify_on_approve ?? true,
          notify_on_reject: template.notify_on_reject ?? true,
        });
      }
    }
  }, [selectedTemplateId, templates]);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("approval_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取模板列表失败");
      return;
    }
    setTemplates(data || []);
    if (data && data.length > 0) {
      setSelectedTemplateId(data[0].id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selectedTemplateId) return;

    setSaving(true);
    const { error } = await supabase
      .from("approval_templates")
      .update({
        callback_url: settings.callback_url || null,
        auto_approve_timeout: settings.auto_approve_timeout || null,
        allow_withdraw: settings.allow_withdraw,
        allow_transfer: settings.allow_transfer,
        notify_on_approve: settings.notify_on_approve,
        notify_on_reject: settings.notify_on_reject,
      })
      .eq("id", selectedTemplateId);

    if (error) {
      toast.error("保存失败");
    } else {
      toast.success("设置已保存");
      fetchTemplates();
    }
    setSaving(false);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  
  const apiEndpoint = `${window.location.origin}/api/approval/webhook/${selectedTemplate?.code || "PROCESS_CODE"}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

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
              <CardTitle>高级设置</CardTitle>
              <CardDescription>配置审批流程的高级功能和回调</CardDescription>
            </div>
            <div className="flex items-center gap-4">
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
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* 回调设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              回调设置
            </CardTitle>
            <CardDescription>配置审批状态变更时的回调通知</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>回调地址 (Callback URL)</Label>
              <Input
                value={settings.callback_url || ""}
                onChange={(e) => setSettings({ ...settings, callback_url: e.target.value })}
                placeholder="https://your-server.com/api/callback"
              />
              <p className="text-xs text-muted-foreground mt-1">
                审批通过/拒绝/撤回时，系统会向此地址发送 POST 请求
              </p>
            </div>

            <Separator />

            <div>
              <Label className="text-muted-foreground">API 接口</Label>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">接收外部系统推送的审批数据：</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded overflow-auto">
                      POST {apiEndpoint}
                    </code>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiEndpoint)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 通知设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-5 h-5" />
              通知设置
            </CardTitle>
            <CardDescription>配置审批相关的通知规则</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>审批通过时通知申请人</Label>
                <p className="text-xs text-muted-foreground">审批完成后发送通知</p>
              </div>
              <Switch
                checked={settings.notify_on_approve ?? true}
                onCheckedChange={(checked) => setSettings({ ...settings, notify_on_approve: checked })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>审批拒绝时通知申请人</Label>
                <p className="text-xs text-muted-foreground">审批被拒绝后发送通知</p>
              </div>
              <Switch
                checked={settings.notify_on_reject ?? true}
                onCheckedChange={(checked) => setSettings({ ...settings, notify_on_reject: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 流程控制 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-5 h-5" />
              流程控制
            </CardTitle>
            <CardDescription>配置审批流程的行为</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>允许撤回</Label>
                <p className="text-xs text-muted-foreground">申请人可以撤回待审批的申请</p>
              </div>
              <Switch
                checked={settings.allow_withdraw ?? true}
                onCheckedChange={(checked) => setSettings({ ...settings, allow_withdraw: checked })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>允许转交</Label>
                <p className="text-xs text-muted-foreground">审批人可以将审批转交给其他人</p>
              </div>
              <Switch
                checked={settings.allow_transfer ?? false}
                onCheckedChange={(checked) => setSettings({ ...settings, allow_transfer: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 超时设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5" />
              超时设置
            </CardTitle>
            <CardDescription>配置自动审批规则</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>自动审批超时（小时）</Label>
              <Input
                type="number"
                min="0"
                value={settings.auto_approve_timeout || ""}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  auto_approve_timeout: parseInt(e.target.value) || 0 
                })}
                placeholder="0 表示不自动审批"
              />
              <p className="text-xs text-muted-foreground mt-1">
                设置为 0 表示不启用自动审批，超时后自动通过
              </p>
            </div>

            {(settings.auto_approve_timeout ?? 0) > 0 && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  超过 {settings.auto_approve_timeout} 小时未处理将自动通过
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 文档说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            接口文档
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <h4>回调请求格式</h4>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
{`POST {callback_url}
Content-Type: application/json

{
  "event": "approval_completed", // 或 "approval_rejected", "approval_withdrawn"
  "process_code": "${selectedTemplate?.code || "PROCESS_CODE"}",
  "business_id": "业务数据ID",
  "status": "approved", // 或 "rejected", "withdrawn"
  "approver": {
    "id": "审批人ID",
    "name": "审批人姓名"
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "remarks": "审批备注"
}`}
            </pre>

            <h4 className="mt-4">推送待办接口</h4>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
{`POST ${apiEndpoint}
Content-Type: application/json

{
  "title": "待办标题",
  "description": "待办描述",
  "assignee_id": "处理人ID",
  "initiator_name": "发起人姓名",
  "source_system": "来源系统名称",
  "source_department": "来源部门",
  "action_url": "https://外部系统处理页面",
  "priority": "normal", // urgent, normal, low
  "due_date": "2024-01-01T00:00:00Z"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalAdvancedSettings;
