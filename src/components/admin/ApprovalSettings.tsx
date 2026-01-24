import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, FileText, GitBranch, Cog } from "lucide-react";
import ApprovalBasicSettings from "./approval/ApprovalBasicSettings";
import ApprovalFormDesign from "./approval/ApprovalFormDesign";
import ApprovalProcessDesign from "./approval/ApprovalProcessDesign";
import ApprovalAdvancedSettings from "./approval/ApprovalAdvancedSettings";

const ApprovalSettings = () => {
  const [activeTab, setActiveTab] = useState("basic");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">审批流程设置</h2>
          <p className="text-muted-foreground">配置审批流程模板，支持内部审批和外部系统对接</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="gap-2">
            <Settings className="w-4 h-4" />
            基础设置
          </TabsTrigger>
          <TabsTrigger value="form" className="gap-2">
            <FileText className="w-4 h-4" />
            表单设计
          </TabsTrigger>
          <TabsTrigger value="process" className="gap-2">
            <GitBranch className="w-4 h-4" />
            流程设计
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <Cog className="w-4 h-4" />
            高级设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-6">
          <ApprovalBasicSettings />
        </TabsContent>

        <TabsContent value="form" className="mt-6">
          <ApprovalFormDesign />
        </TabsContent>

        <TabsContent value="process" className="mt-6">
          <ApprovalProcessDesign />
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <ApprovalAdvancedSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalSettings;
