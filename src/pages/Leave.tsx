import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import LeaveForm from "@/components/forms/LeaveForm";

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
    const { data, error } = await supabase
      .from("absence_records")
      .select(`
        *,
        contacts:contacts!absence_records_contact_id_fkey (
          name,
          department
        ),
        handover_person:contacts!absence_records_handover_person_id_fkey (
          name
        )
      `)
      .eq("type", "leave")
      .eq("contact_id", currentUser.id)
      .order("created_at", { ascending: false });

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
    time: format(new Date(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "天数", value: `${record.duration_days || "-"}天` },
      { label: "时间", value: `${format(new Date(record.start_time), "MM/dd")} - ${record.end_time ? format(new Date(record.end_time), "MM/dd") : ""}` },
    ],
  }));

  const handleItemClick = (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      setDetailOpen(true);
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
    { label: "请假天数", value: selectedRecord.duration_days ? `${selectedRecord.duration_days} 天` : null },
    { label: "开始时间", value: format(new Date(selectedRecord.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
    { label: "结束时间", value: selectedRecord.end_time ? format(new Date(selectedRecord.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) : null },
    { label: "工作交接人", value: selectedRecord.handover_person?.name },
    { label: "交接事项", value: selectedRecord.handover_notes },
    { label: "请假事由", value: selectedRecord.reason, fullWidth: true },
    { label: "备注", value: selectedRecord.notes, fullWidth: true },
    { label: "申请时间", value: format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  return (
    <PageLayout>
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
        businessType="absence"
      />
    </PageLayout>
  );
};

export default Leave;
