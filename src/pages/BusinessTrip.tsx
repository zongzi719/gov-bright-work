import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import { getAbsenceRecords } from "@/lib/dataAdapter";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import BusinessTripForm from "@/components/forms/BusinessTripForm";

interface AbsenceRecord {
  id: string;
  reason: string;
  destination: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  duration_days: number | null;
  transport_type: string | null;
  estimated_cost: number | null;
  companions: string[] | null;
  notes: string | null;
  created_at: string;
  contacts: {
    name: string;
    department: string | null;
  } | null;
}

const transportTypeLabels: Record<string, string> = {
  plane: "飞机",
  train: "火车/高铁",
  car: "汽车/自驾",
  other: "其他",
};

const BusinessTrip = () => {
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
      type: "business_trip"
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
    r.destination?.includes(search) ||
    r.reason.includes(search)
  );

  // 转换为通用列表项格式
  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: record.destination || "出差申请",
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
    { label: "目的地", value: selectedRecord.destination },
    { label: "出差天数", value: selectedRecord.duration_days ? `${selectedRecord.duration_days} 天` : null },
    { label: "开始时间", value: format(new Date(selectedRecord.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
    { label: "结束时间", value: selectedRecord.end_time ? format(new Date(selectedRecord.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) : null },
    { label: "交通方式", value: selectedRecord.transport_type ? transportTypeLabels[selectedRecord.transport_type] || selectedRecord.transport_type : null },
    { label: "预计费用", value: selectedRecord.estimated_cost ? `¥${selectedRecord.estimated_cost}` : null },
    { label: "出差事由", value: selectedRecord.reason, fullWidth: true },
    { label: "备注", value: selectedRecord.notes, fullWidth: true },
    { label: "申请时间", value: format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  return (
    <PageLayout>
      <ApplicationList
        title="出差申请"
        items={listItems}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onAddClick={() => setFormOpen(true)}
        onItemClick={handleItemClick}
        searchPlaceholder="搜索目的地或事由..."
        emptyText="暂无出差记录"
      />

      <BusinessTripForm
        open={formOpen}
        onOpenChange={handleFormClose}
        currentUser={currentUser}
      />

      <ApplicationDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="出差详情"
        status={selectedRecord?.status}
        fields={detailFields}
        businessId={selectedRecord?.id}
        businessType="business_trip"
      />
    </PageLayout>
  );
};

export default BusinessTrip;