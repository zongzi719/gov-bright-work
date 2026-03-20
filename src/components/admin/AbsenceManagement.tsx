import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import BusinessTripManagement from "./BusinessTripManagement";
import LeaveManagement from "./LeaveManagement";
import OutManagement from "./OutManagement";
import * as dataAdapter from "@/lib/dataAdapter";
import CustomTemplateRecords from "./CustomTemplateRecords";

interface CustomTemplate {
  id: string;
  name: string;
  icon: string;
  business_type: string;
  code: string;
  category?: string;
  is_active?: boolean;
}

// 内置模板编码
const BUILTIN_CODES = [
  "PROC_MKSAQYT6", "PROC_MKTO1ET3", "PROC_MKUK42R1",
  "PROC_MKXWIEG6", "PROC_MKXVX9VE", "PROC_MKYO60ON",
];

// 已有专属标签页的内置业务类型，不再作为自定义标签重复显示
const BUILTIN_BUSINESS_TYPES = ["business_trip", "leave", "out"];

const ABSENCE_GROUP_BUSINESS_TYPES = ["business_trip", "leave", "out", "absence"];

const AbsenceManagement = () => {
  const [activeTab, setActiveTab] = useState("leave-request");
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    try {
      const { data, error } = await dataAdapter.getAllApprovalTemplates();
      if (error || !data) return;

      const custom = (data as CustomTemplate[])
        .filter((template) => {
          if (!template.is_active || BUILTIN_CODES.includes(template.code)) return false;
          return template.category === "外出管理" || ABSENCE_GROUP_BUSINESS_TYPES.includes(template.business_type);
        })
        .map((template) => ({
          ...template,
          name: template.name?.trim() || template.code || "未命名流程",
          icon: template.icon || "📋",
        }));

      setCustomTemplates(custom);
    } catch (e) {
      console.error("加载自定义模板失败:", e);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full max-w-2xl`} style={{ gridTemplateColumns: `repeat(${3 + customTemplates.length}, minmax(0, 1fr))` }}>
          <TabsTrigger value="leave-request">
            请假申请
          </TabsTrigger>
          <TabsTrigger value="out-request">
            外出申请
          </TabsTrigger>
          <TabsTrigger value="business-trip">
            出差申请
          </TabsTrigger>
          {customTemplates.map(t => (
            <TabsTrigger key={t.id} value={`custom-${t.id}`}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="leave-request" className="mt-4">
          <LeaveManagement />
        </TabsContent>

        <TabsContent value="out-request" className="mt-4">
          <OutManagement />
        </TabsContent>

        <TabsContent value="business-trip" className="mt-4">
          <BusinessTripManagement />
        </TabsContent>

        {customTemplates.map(t => (
          <TabsContent key={t.id} value={`custom-${t.id}`} className="mt-4">
            <CustomTemplateRecords templateId={t.id} templateName={t.name} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AbsenceManagement;
