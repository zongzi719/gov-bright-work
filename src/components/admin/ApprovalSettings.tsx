import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Settings, FileText, GitBranch, Cog, Plus, ArrowLeft, Copy, Eye } from "lucide-react";
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
  is_active: boolean;
  created_at: string;
}

const businessTypeLabels: Record<string, string> = {
  absence: "外出/请假",
  supply_requisition: "物品领用",
  purchase_request: "采购申请",
  external_approval: "外部审批",
};

const ApprovalSettings = () => {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ApprovalTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

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

  const handleToggleActive = async (template: ApprovalTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success("流程编码已复制");
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setIsCreating(true);
    setActiveTab("basic");
  };

  const handleViewDetail = (template: ApprovalTemplate) => {
    setSelectedTemplate(template);
    setIsCreating(false);
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
            <TabsTrigger value="basic" className="gap-2">
              <Settings className="w-4 h-4" />
              基础设置
            </TabsTrigger>
            <TabsTrigger value="form" className="gap-2" disabled={isCreating && !selectedTemplate}>
              <FileText className="w-4 h-4" />
              表单设计
            </TabsTrigger>
            <TabsTrigger value="process" className="gap-2" disabled={isCreating && !selectedTemplate}>
              <GitBranch className="w-4 h-4" />
              流程设计
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2" disabled={isCreating && !selectedTemplate}>
              <Cog className="w-4 h-4" />
              高级设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6">
            <ApprovalBasicSettings 
              template={selectedTemplate} 
              isCreating={isCreating}
              onTemplateCreated={handleTemplateCreated}
              onTemplateUpdated={(updated) => setSelectedTemplate(updated)}
            />
          </TabsContent>

          <TabsContent value="form" className="mt-6">
            {selectedTemplate && <ApprovalFormDesign templateId={selectedTemplate.id} />}
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
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          新建模板
        </Button>
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
    </div>
  );
};

export default ApprovalSettings;
