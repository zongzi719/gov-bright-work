import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import MyLeaveBalance from "@/components/MyLeaveBalance";
import { getAbsenceRecords } from "@/lib/dataAdapter";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";
import LeaveForm from "@/components/forms/LeaveForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AbsenceRecord {
  id: string;
  reason: string;
  leave_type: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  duration_days: number | null;
  duration_hours: number | null;
  handover_person_id: string | null;
  handover_notes: string | null;
  handover_person_name?: string | null;
  medical_certificate_url?: string | null;
  notes: string | null;
  created_at: string;
  contacts: {
    name: string;
    department: string | null;
  } | null;
  handover_person: {
    name: string;
  } | null;
}

const leaveTypeLabels: Record<string, string> = {
  annual: "年假",
  sick: "病假",
  personal: "事假",
  paternity: "陪产假",
  bereavement: "丧假",
  maternity: "产假",
  nursing: "哺乳假",
  marriage: "婚假",
  compensatory: "调休",
};

const Leave = () => {
  const [records, setRecords] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AbsenceRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) return JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse frontendUser", e);
    }
    return null;
  };

  const currentUser = getCurrentUser();

  const fetchRecords = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    const { data, error } = await getAbsenceRecords({
      contact_id: currentUser.id,
      type: "leave"
    });

    if (!error && data) {
      setRecords(data as AbsenceRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.id]);

  const filteredRecords = records.filter(r =>
    r.reason.includes(search) ||
    (r.leave_type && leaveTypeLabels[r.leave_type]?.includes(search))
  );

  // 转换为通用列表项格式
  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: record.leave_type ? leaveTypeLabels[record.leave_type] || record.leave_type : "请假申请",
    subtitle: record.reason,
    time: format(parseTime(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "时长", value: record.duration_hours ? `${record.duration_hours}小时` : `${record.duration_days || "-"}天` },
      { label: "时间", value: `${format(parseTime(record.start_time), "MM/dd")} - ${record.end_time ? format(parseTime(record.end_time), "MM/dd") : ""}` },
    ],
  }));

  const handleItemClick = (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      setDetailOpen(true);
      void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.LEAVE, target_type: '请假申请', target_id: record.id, target_name: record.reason });
    }
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      fetchRecords();
    }
  };

  // 详情字段
  const detailFields = selectedRecord ? [
    { label: "请假类型", value: selectedRecord.leave_type ? leaveTypeLabels[selectedRecord.leave_type] || selectedRecord.leave_type : null },
    { label: "请假时长", value: selectedRecord.duration_hours 
      ? `${selectedRecord.duration_hours} 小时（${selectedRecord.duration_days || (selectedRecord.duration_hours / 8)} 天）` 
      : (selectedRecord.duration_days ? `${selectedRecord.duration_days} 天` : null) },
    { label: "开始日期", value: format(parseTime(selectedRecord.start_time), "yyyy-MM-dd", { locale: zhCN }) },
    { label: "结束日期", value: selectedRecord.end_time ? format(parseTime(selectedRecord.end_time), "yyyy-MM-dd", { locale: zhCN }) : null },
    { label: "请假事由", value: selectedRecord.reason, fullWidth: true },
    { label: "工作交接人", value: selectedRecord.handover_person?.name || selectedRecord.handover_person_name },
    { label: "工作交接说明", value: selectedRecord.handover_notes },
    ...(selectedRecord.leave_type === "sick" && selectedRecord.medical_certificate_url ? [{
      label: "诊断证明书",
      value: (
        <img
          src={selectedRecord.medical_certificate_url}
          alt="诊断证明书"
          className="max-h-48 rounded-md border cursor-pointer"
          onClick={() => window.open(selectedRecord.medical_certificate_url!, '_blank')}
        />
      ),
      fullWidth: true,
    }] : []),
    { label: "备注", value: selectedRecord.notes, fullWidth: true },
    { label: "申请时间", value: format(parseTime(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  return (
    <PageLayout>
      <Tabs defaultValue="apply" className="space-y-4">
        <TabsList>
          <TabsTrigger value="apply">我要请假</TabsTrigger>
          <TabsTrigger value="balance">余额明细</TabsTrigger>
        </TabsList>

        <TabsContent value="apply">
          <ApplicationList
            title="请假申请"
            items={listItems}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            onAddClick={() => setFormOpen(true)}
            onItemClick={handleItemClick}
            searchPlaceholder="搜索请假类型或事由..."
            emptyText="暂无请假记录"
          />
        </TabsContent>

        <TabsContent value="balance">
          {currentUser?.id && <MyLeaveBalance contactId={currentUser.id} />}
        </TabsContent>
      </Tabs>

      <LeaveForm
        open={formOpen}
        onOpenChange={handleFormClose}
        currentUser={currentUser}
      />

      <ApplicationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="请假详情"
        status={selectedRecord?.status}
        fields={detailFields}
        businessId={selectedRecord?.id}
        businessType="leave"
      />
    </PageLayout>
  );
};

export default Leave;