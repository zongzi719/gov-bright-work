import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import { getAbsenceRecords } from "@/lib/dataAdapter";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";
import OutForm from "@/components/forms/OutForm";

interface AbsenceRecord {
  id: string;
  reason: string;
  out_type: string | null;
  out_location: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  duration_hours: number | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  contacts: {
    name: string;
    department: string | null;
  } | null;
}

const outTypeLabels: Record<string, string> = {
  meeting: "外出开会",
  errand: "外出办事",
  other: "其他",
};

const Out = () => {
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
      type: "out"
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
    r.out_location?.includes(search) ||
    r.reason.includes(search) ||
    (r.out_type && outTypeLabels[r.out_type]?.includes(search))
  );

  // 转换为通用列表项格式
  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: record.out_type ? outTypeLabels[record.out_type] || record.out_type : "外出申请",
    subtitle: record.out_location ? `${record.out_location} - ${record.reason}` : record.reason,
    time: format(parseTime(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "时长", value: `${record.duration_hours || "-"}小时` },
      { label: "时间", value: format(parseTime(record.start_time), "MM/dd HH:mm") },
    ],
  }));

  const handleItemClick = (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      setDetailOpen(true);
      void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.ABSENCE, target_type: '外出申请', target_id: record.id, target_name: record.reason });
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
    { label: "外出类型", value: selectedRecord.out_type ? outTypeLabels[selectedRecord.out_type] || selectedRecord.out_type : null },
    { label: "外出时长", value: selectedRecord.duration_hours ? `${selectedRecord.duration_hours} 小时` : null },
    { label: "开始时间", value: format(parseTime(selectedRecord.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
    { label: "预计返回", value: selectedRecord.end_time ? format(parseTime(selectedRecord.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) : null },
    { label: "往返地点", value: selectedRecord.out_location },
    { label: "联系电话", value: selectedRecord.contact_phone },
    { label: "外出事由", value: selectedRecord.reason, fullWidth: true },
    { label: "备注", value: selectedRecord.notes, fullWidth: true },
    { label: "申请时间", value: format(parseTime(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  return (
    <PageLayout>
      <ApplicationList
        title="外出申请"
        items={listItems}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onAddClick={() => setFormOpen(true)}
        onItemClick={handleItemClick}
        searchPlaceholder="搜索外出类型、地点或事由..."
        emptyText="暂无外出记录"
      />

      <OutForm
        open={formOpen}
        onOpenChange={handleFormClose}
        currentUser={currentUser}
      />

      <ApplicationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="外出详情"
        status={selectedRecord?.status}
        fields={detailFields}
        businessId={selectedRecord?.id}
        businessType="out"
      />
    </PageLayout>
  );
};

export default Out;