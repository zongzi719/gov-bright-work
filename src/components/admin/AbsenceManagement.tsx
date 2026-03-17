import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, CalendarOff, LogOut, FileText } from "lucide-react";
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
}

// 内置模板编码
const BUILTIN_CODES = [
  "PROC_MKSAQYT6", "PROC_MKTO1ET3", "PROC_MKUK42R1",
  "PROC_MKXWIEG6", "PROC_MKXVX9VE", "PROC_MKYO60ON",
];

const AbsenceManagement = () => {
  const [activeTab, setActiveTab] = useState("business-trip");
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    try {
      const { data, error } = await dataAdapter.getApprovalTemplatesByBusinessTypes([
        "business_trip", "leave", "out", "absence"
      ]);
      if (error || !data) return;
      const custom = (data as (CustomTemplate & { is_active: boolean })[]).filter(
        t => !BUILTIN_CODES.includes(t.code)
      );
      setCustomTemplates(custom);
    } catch (e) {
      console.error("加载自定义模板失败:", e);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full max-w-2xl`} style={{ gridTemplateColumns: `repeat(${3 + customTemplates.length}, minmax(0, 1fr))` }}>
          <TabsTrigger value="business-trip" className="gap-2">
            <Briefcase className="w-4 h-4" />
            出差申请
          </TabsTrigger>
          <TabsTrigger value="leave-request" className="gap-2">
            <CalendarOff className="w-4 h-4" />
            请假申请
          </TabsTrigger>
          <TabsTrigger value="out-request" className="gap-2">
            <LogOut className="w-4 h-4" />
            外出申请
          </TabsTrigger>
          {customTemplates.map(t => (
            <TabsTrigger key={t.id} value={`custom-${t.id}`} className="gap-2">
              {t.icon ? <span>{t.icon}</span> : <FileText className="w-4 h-4" />}
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="business-trip" className="mt-4">
          <BusinessTripManagement />
        </TabsContent>

        <TabsContent value="leave-request" className="mt-4">
          <LeaveManagement />
        </TabsContent>

        <TabsContent value="out-request" className="mt-4">
          <OutManagement />
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
