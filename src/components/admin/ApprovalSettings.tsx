import { useState, useEffect } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import * as dataAdapter from "@/lib/dataAdapter";
import { isOfflineMode } from "@/lib/offlineApi";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ArrowLeft, Copy, Eye, FileQuestion, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ApprovalBasicSettings from "./approval/ApprovalBasicSettings";
import ApprovalFormDesign from "./approval/ApprovalFormDesign";
import ApprovalProcessDesign from "./approval/ApprovalProcessDesign";
import ApprovalAdvancedSettings from "./approval/ApprovalAdvancedSettings";

interface ApprovalTemplate {
  id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string;
  business_type: string;
  category: string;
  is_active: boolean;
  show_in_nav: boolean;
  created_at: string;
}

const businessTypeLabels: Record<string, string> = {
  business_trip: "出差申请",
  leave: "请假申请",
  out: "外出申请",
  supply_requisition: "物品领用",
  purchase_request: "采购申请",
  supply_purchase: "办公采购",
  external_approval: "外部审批",
};

// 已有业务表单配置
const existingForms = [
  { 
    id: "business_trip", 
    name: "出差申请", 
    icon: "🚗", 
    description: "员工出差申请流程",
    business_type: "business_trip"
  },
  { 
    id: "leave", 
    name: "请假申请", 
    icon: "🏖️", 
    description: "员工请假申请流程",
    business_type: "leave"
  },
  { 
    id: "out", 
    name: "外出申请", 
    icon: "🚶", 
    description: "员工临时外出申请流程",
    business_type: "out"
  },
  { 
    id: "supply_requisition", 
    name: "物品领用", 
    icon: "📦", 
    description: "办公用品领用申请流程",
    business_type: "supply_requisition"
  },
  { 
    id: "purchase_request", 
    name: "采购申请", 
    icon: "💰", 
    description: "办公用品采购申请流程",
    business_type: "purchase_request"
  },
  { 
    id: "supply_purchase", 
    name: "办公采购", 
    icon: "🛒", 
    description: "处室办公用品采购申请流程",
    business_type: "supply_purchase"
  },
];

const ApprovalSettings = () => {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "existing" | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await dataAdapter.getAllApprovalTemplates();

    if (error) {
      console.error("Error fetching templates:", error);
      toast.error("获取审批模板失败");
    } else {
      setTemplates((data as unknown as ApprovalTemplate[]) || []);
    }
    setLoading(false);
  };

  const handleSeedTemplates = async () => {
    setLoading(true);
    const { data, error } = await dataAdapter.seedApprovalTemplates();
    
    if (error) {
      toast.error("初始化模板失败");
    } else if (data && data.count > 0) {
      toast.success(`成功导入 ${data.count} 个审批模板`);
      fetchTemplates();
    } else {
      toast.info("所有模板已存在，无需导入");
    }
    setLoading(false);
  };

  const handleToggleActive = async (template: ApprovalTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await dataAdapter.updateApprovalTemplate(template.id, { 
      is_active: !template.is_active 
    });

    if (error) {
      toast.error("更新状态失败");
      return;
    }
    toast.success(template.is_active ? "已停用" : "已启用");
    await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_id: template.id, target_name: template.name, detail: { is_active: !template.is_active } });
    fetchTemplates();
  };

  const handleToggleShowInNav = async (template: ApprovalTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await dataAdapter.updateApprovalTemplate(template.id, { 
      show_in_nav: !template.show_in_nav 
    });

    if (error) {
      toast.error("更新失败");
      return;
    }
    toast.success(template.show_in_nav ? "已从首页导航移除" : "已添加到首页导航");
    fetchTemplates();
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success("流程编码已复制");
  };

  const handleCreateNew = () => {
    setShowCreateDialog(true);
    setCreateMode(null);
  };

  const handleCreateFromBlank = () => {
    setShowCreateDialog(false);
    setSelectedTemplate(null);
    setIsCreating(true);
    setActiveTab("basic");
  };

  const handleCreateFromExisting = async (form: typeof existingForms[0]) => {
    setShowCreateDialog(false);
    
    // 检查是否已存在该业务类型的模板
    const existingTemplate = templates.find(t => t.business_type === form.business_type);
    if (existingTemplate) {
      toast.error(`${form.name}的审批模板已存在，请直接编辑现有模板`);
      handleViewDetail(existingTemplate);
      return;
    }

    // 创建新模板并预填充信息
    const code = `PROC_${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await dataAdapter.createApprovalTemplate({
      name: form.name,
      code,
      description: form.description,
      icon: form.icon,
      business_type: form.business_type,
      is_active: true,
    });

    if (error) {
      toast.error("创建模板失败");
      return;
    }

    toast.success(`已创建${form.name}模板，请继续配置审批流程`);
    void logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_name: form.name, detail: { business_type: form.business_type, create_mode: 'from_existing' } });
    setSelectedTemplate(data as unknown as ApprovalTemplate);
    setIsCreating(false);
    setActiveTab("process"); // 直接跳到流程设计
  };

  const handleViewDetail = (template: ApprovalTemplate) => {
    setSelectedTemplate(template);
    setIsCreating(false);
    void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.APPROVAL, target_type: '审批模板', target_id: template.id, target_name: template.name });
    setActiveTab("basic");
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setIsCreating(false);
    fetchTemplates();
  };

  const handleTemplateCreated = (template: ApprovalTemplate) => {
    setSelectedTemplate(template);
    setIsCreating(false);
  };

  // 详情/编辑视图
  if (selectedTemplate || isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {isCreating ? "新建审批模板" : `编辑: ${selectedTemplate?.name}`}
            </h2>
            <p className="text-muted-foreground">
              {isCreating ? "创建新的审批流程模板" : `流程编码: ${selectedTemplate?.code}`}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">
              基础设置
            </TabsTrigger>
            <TabsTrigger value="form" disabled={isCreating && !selectedTemplate}>
              表单设计
            </TabsTrigger>
            <TabsTrigger value="process" disabled={isCreating && !selectedTemplate}>
              流程设计
            </TabsTrigger>
            <TabsTrigger value="advanced" disabled={isCreating && !selectedTemplate}>
              高级设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6">
            <ApprovalBasicSettings 
              template={selectedTemplate} 
              isCreating={isCreating}
              onTemplateCreated={handleTemplateCreated}
              onTemplateUpdated={(updated) => setSelectedTemplate({ ...selectedTemplate!, ...updated } as ApprovalTemplate)}
            />
          </TabsContent>

          <TabsContent value="form" className="mt-6">
            {selectedTemplate && (
              <ApprovalFormDesign 
                templateId={selectedTemplate.id} 
                businessType={selectedTemplate.business_type}
              />
            )}
          </TabsContent>

          <TabsContent value="process" className="mt-6">
            {selectedTemplate && <ApprovalProcessDesign templateId={selectedTemplate.id} />}
          </TabsContent>

          <TabsContent value="advanced" className="mt-6">
            {selectedTemplate && <ApprovalAdvancedSettings templateId={selectedTemplate.id} />}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // 列表视图
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">审批流程设置</h2>
          <p className="text-muted-foreground">配置审批流程模板，支持内部审批和外部系统对接</p>
        </div>
        <div className="flex gap-2">
          {isOfflineMode() && (
            <Button variant="outline" onClick={handleSeedTemplates} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              导入预设模板
            </Button>
          )}
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            新建模板
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>审批模板列表</CardTitle>
          <CardDescription>管理所有审批流程模板</CardDescription>
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
                  <TableHead>首页导航</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow 
                    key={template.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetail(template)}
                  >
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
                          onClick={(e) => handleCopyCode(template.code, e)}
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
                        onCheckedChange={() => {}}
                        onClick={(e) => handleToggleActive(template, e)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={template.show_in_nav}
                        onCheckedChange={() => {}}
                        onClick={(e) => handleToggleShowInNav(template, e)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(template);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建模板选择弹窗 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>新建审批模板</DialogTitle>
            <DialogDescription>
              选择创建方式开始配置审批流程
            </DialogDescription>
          </DialogHeader>

          {createMode === null ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              <Card 
                className="cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={() => setCreateMode("existing")}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <ClipboardList className="w-12 h-12 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">选择已有表单</h3>
                  <p className="text-sm text-muted-foreground">
                    基于现有业务模块创建审批流程，表单字段已预设
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={handleCreateFromBlank}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <FileQuestion className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">从空白创建</h3>
                  <p className="text-sm text-muted-foreground">
                    自定义审批模板，需要手动配置所有字段
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCreateMode(null)}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回
                </Button>
                <span className="text-sm text-muted-foreground">选择业务表单</span>
              </div>
              <div className="grid gap-3">
                {existingForms.map((form) => {
                  const isUsed = templates.some(t => t.business_type === form.business_type);
                  return (
                    <Card 
                      key={form.id}
                      className={`cursor-pointer transition-colors ${
                        isUsed 
                          ? "opacity-50 cursor-not-allowed" 
                          : "hover:border-primary hover:bg-muted/50"
                      }`}
                      onClick={() => !isUsed && handleCreateFromExisting(form)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <span className="text-3xl">{form.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-medium">{form.name}</h4>
                          <p className="text-sm text-muted-foreground">{form.description}</p>
                        </div>
                        {isUsed && (
                          <Badge variant="secondary">已创建</Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalSettings;
