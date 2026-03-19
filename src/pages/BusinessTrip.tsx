import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import { getAbsenceRecords, getContactsByIds } from "@/lib/dataAdapter";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";
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
  return_transport_type: string | null;
  estimated_cost: number | null;
  companions: string[] | null;
  departure_time: string | null;
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
  const [companionNames, setCompanionNames] = useState<Record<string, string>>({});

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

  // 当选中记录有同行人员时，获取同行人员姓名
  useEffect(() => {
    if (selectedRecord?.companions?.length) {
      const unknownIds = selectedRecord.companions.filter(id => !companionNames[id]);
      if (unknownIds.length > 0) {
        getContactsByIds(unknownIds).then(({ data }) => {
          if (data) {
            const nameMap: Record<string, string> = { ...companionNames };
            data.forEach((c: any) => { nameMap[c.id] = c.name; });
            setCompanionNames(nameMap);
          }
        });
      }
    }
  }, [selectedRecord]);

  const filteredRecords = records.filter(r =>
    r.destination?.includes(search) ||
    r.reason.includes(search)
  );

  // 转换为通用列表项格式
  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: record.destination || "出差申请",
    subtitle: record.reason,
    time: format(parseTime(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "天数", value: `${record.duration_days || "-"}天` },
      { label: "时间", value: `${format(parseTime(record.start_time), "MM/dd")} - ${record.end_time ? format(parseTime(record.end_time), "MM/dd") : ""}` },
    ],
  }));

  const handleItemClick = (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      setDetailOpen(true);
      void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.ABSENCE, target_type: '出差申请', target_id: record.id, target_name: record.reason });
    }
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      fetchRecords();
    }
  };

  // 详情字段
  const formatBusinessTripDateAmPm = (value: string | null | undefined) => {
    if (!value) return null;
    const hasTimezone = /Z$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value);
    const d = hasTimezone ? new Date(value) : parseTime(value);
    const year = hasTimezone ? d.getUTCFullYear() : d.getFullYear();
    const month = String((hasTimezone ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, "0");
    const day = String(hasTimezone ? d.getUTCDate() : d.getDate()).padStart(2, "0");
    const isAm = hasTimezone ? d.getUTCHours() < 12 : d.getHours() < 12;
    return `${year}-${month}-${day} ${isAm ? "上午" : "下午"}`;
  };

  const formatDateOnly = (value: string | null | undefined) => {
    if (!value) return null;
    try {
      return format(parseTime(value), "yyyy-MM-dd", { locale: zhCN });
    } catch {
      return value;
    }
  };

  const getCompanionNamesStr = (ids: string[] | null) => {
    if (!ids || ids.length === 0) return null;
    return ids.map(id => companionNames[id] || id).join("、");
  };

  const detailFields = selectedRecord ? [
    { label: "目的地", value: selectedRecord.destination },
    { label: "出差事由", value: selectedRecord.reason, fullWidth: true },
    { label: "计划开始时间", value: formatBusinessTripDateAmPm(selectedRecord.start_time) },
    { label: "计划结束时间", value: formatBusinessTripDateAmPm(selectedRecord.end_time) },
    { label: "出差时长", value: selectedRecord.duration_days ? `${selectedRecord.duration_days} 天` : null },
    { label: "", value: "", hidden: true },
    { label: "去程交通方式", value: selectedRecord.transport_type ? transportTypeLabels[selectedRecord.transport_type] || selectedRecord.transport_type : null },
    { label: "返程交通方式", value: selectedRecord.return_transport_type ? transportTypeLabels[selectedRecord.return_transport_type] || selectedRecord.return_transport_type : null },
    { label: "同行人员", value: getCompanionNamesStr(selectedRecord.companions) },
    { label: "出发时间", value: formatDateOnly(selectedRecord.departure_time) },
    { label: "预计费用", value: selectedRecord.estimated_cost ? `¥${selectedRecord.estimated_cost}` : null },
    { label: "备注", value: selectedRecord.notes, fullWidth: true },
    { label: "申请时间", value: format(parseTime(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
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
