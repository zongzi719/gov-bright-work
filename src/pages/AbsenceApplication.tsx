import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, CalendarOff, LogOut } from "lucide-react";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import ApplicationDetailDialog from "@/components/ApplicationDetailDialog";
import * as dataAdapter from "@/lib/dataAdapter";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";
import BusinessTripForm from "@/components/forms/BusinessTripForm";
import LeaveForm from "@/components/forms/LeaveForm";
import OutForm from "@/components/forms/OutForm";

// 出差记录
interface BusinessTripRecord {
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
}

// 请假记录
interface LeaveRecord {
  id: string;
  reason: string;
  leave_type: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  duration_days: number | null;
  duration_hours: number | null;
  handover_notes: string | null;
  notes: string | null;
  created_at: string;
  handover_person: { name: string } | null;
  handover_person_name?: string | null;
}

// 外出记录
interface OutRecord {
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
}

const transportTypeLabels: Record<string, string> = {
  plane: "飞机",
  train: "火车/高铁",
  car: "汽车/自驾",
  other: "其他",
};

const leaveTypeLabels: Record<string, string> = {
  annual: "年假",
  sick: "病假",
  personal: "事假",
  paternity: "陪产假",
  bereavement: "丧假",
  maternity: "生育假",
  family_visit: "探亲假",
  marriage: "婚假",
  compensatory: "调休",
};

const outTypeLabels: Record<string, string> = {
  meeting: "外出开会",
  errand: "外出办事",
  other: "其他",
};

const AbsenceApplication = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "leave";
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Business Trip states
  const [tripRecords, setTripRecords] = useState<BusinessTripRecord[]>([]);
  const [tripLoading, setTripLoading] = useState(true);
  const [tripSearch, setTripSearch] = useState("");
  const [tripFormOpen, setTripFormOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<BusinessTripRecord | null>(null);
  const [tripDetailOpen, setTripDetailOpen] = useState(false);
  const [tripCompanionNames, setTripCompanionNames] = useState<Record<string, string>>({});
  // Leave states
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveSearch, setLeaveSearch] = useState("");
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [leaveDetailOpen, setLeaveDetailOpen] = useState(false);

  // Out states
  const [outRecords, setOutRecords] = useState<OutRecord[]>([]);
  const [outLoading, setOutLoading] = useState(true);
  const [outSearch, setOutSearch] = useState("");
  const [outFormOpen, setOutFormOpen] = useState(false);
  const [selectedOut, setSelectedOut] = useState<OutRecord | null>(null);
  const [outDetailOpen, setOutDetailOpen] = useState(false);

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

  // Fetch Business Trip records
  const fetchTripRecords = async () => {
    if (!currentUser?.id) return;
    setTripLoading(true);
    const { data } = await dataAdapter.getAbsenceRecords({
      contact_id: currentUser.id,
      type: "business_trip",
    });
    if (data) setTripRecords(data);
    setTripLoading(false);
  };

  // Fetch Leave records
  const fetchLeaveRecords = async () => {
    if (!currentUser?.id) return;
    setLeaveLoading(true);
    const { data } = await dataAdapter.getAbsenceRecords({
      contact_id: currentUser.id,
      type: "leave",
    });
    if (data) setLeaveRecords(data);
    setLeaveLoading(false);
  };

  // Fetch Out records
  const fetchOutRecords = async () => {
    if (!currentUser?.id) return;
    setOutLoading(true);
    const { data } = await dataAdapter.getAbsenceRecords({
      contact_id: currentUser.id,
      type: "out",
    });
    if (data) setOutRecords(data);
    setOutLoading(false);
  };

  useEffect(() => {
    fetchTripRecords();
    fetchLeaveRecords();
    fetchOutRecords();
  }, [currentUser?.id]);

  // Resolve companion names for selected trip
  useEffect(() => {
    if (selectedTrip?.companions?.length) {
      const unknownIds = selectedTrip.companions.filter(id => !tripCompanionNames[id]);
      if (unknownIds.length > 0) {
        dataAdapter.getContactsByIds(unknownIds).then(({ data }) => {
          if (data) {
            const nameMap: Record<string, string> = { ...tripCompanionNames };
            data.forEach((c: any) => { nameMap[c.id] = c.name; });
            setTripCompanionNames(nameMap);
          }
        });
      }
    }
  }, [selectedTrip]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["business-trip", "leave", "out"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  // Business Trip list items
  const tripListItems: ApplicationItem[] = tripRecords
    .filter(r => r.destination?.includes(tripSearch) || r.reason.includes(tripSearch))
    .map(record => ({
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

  // Leave list items
  const leaveListItems: ApplicationItem[] = leaveRecords
    .filter(r => r.reason.includes(leaveSearch) || (r.leave_type && leaveTypeLabels[r.leave_type]?.includes(leaveSearch)))
    .map(record => ({
      id: record.id,
      title: record.leave_type ? leaveTypeLabels[record.leave_type] || record.leave_type : "请假申请",
      subtitle: record.reason,
      time: format(parseTime(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
      status: record.status,
      meta: [
        { label: "天数", value: `${record.duration_days || "-"}天` },
        { label: "时间", value: `${format(parseTime(record.start_time), "MM/dd")} - ${record.end_time ? format(parseTime(record.end_time), "MM/dd") : ""}` },
      ],
    }));

  // Out list items
  const outListItems: ApplicationItem[] = outRecords
    .filter(r => r.out_location?.includes(outSearch) || r.reason.includes(outSearch) || (r.out_type && outTypeLabels[r.out_type]?.includes(outSearch)))
    .map(record => ({
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

  // Detail fields
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

  const getTripCompanionNames = (ids: string[] | null) => {
    if (!ids || ids.length === 0) return null;
    return ids.map(id => tripCompanionNames[id] || id).join("、");
  };

  const tripDetailFields = selectedTrip ? [
    { label: "目的地", value: selectedTrip.destination },
    { label: "出差事由", value: selectedTrip.reason, fullWidth: true },
    { label: "计划开始时间", value: formatBusinessTripDateAmPm(selectedTrip.start_time) },
    { label: "计划结束时间", value: formatBusinessTripDateAmPm(selectedTrip.end_time) },
    { label: "出差时长", value: selectedTrip.duration_days ? `${selectedTrip.duration_days} 天` : null },
    { label: "", value: "", spacer: true },
    { label: "去程交通方式", value: selectedTrip.transport_type ? transportTypeLabels[selectedTrip.transport_type] || selectedTrip.transport_type : null },
    { label: "返程交通方式", value: selectedTrip.return_transport_type ? transportTypeLabels[selectedTrip.return_transport_type] || selectedTrip.return_transport_type : null },
    { label: "同行人员", value: getTripCompanionNames(selectedTrip.companions) },
    { label: "出发时间", value: formatDateOnly(selectedTrip.departure_time) },
    { label: "预计费用", value: selectedTrip.estimated_cost ? `¥${selectedTrip.estimated_cost}` : null },
    { label: "备注", value: selectedTrip.notes, fullWidth: true },
    { label: "申请时间", value: format(parseTime(selectedTrip.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  const leaveDetailFields = selectedLeave ? [
    { label: "请假类型", value: selectedLeave.leave_type ? leaveTypeLabels[selectedLeave.leave_type] || selectedLeave.leave_type : null },
    { label: "请假天数", value: selectedLeave.duration_days ? `${selectedLeave.duration_days} 天` : null },
    { label: "开始时间", value: format(parseTime(selectedLeave.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
    { label: "结束时间", value: selectedLeave.end_time ? format(parseTime(selectedLeave.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) : null },
    { label: "请假事由", value: selectedLeave.reason, fullWidth: true },
    { label: "工作交接人", value: selectedLeave.handover_person?.name || selectedLeave.handover_person_name },
    { label: "工作交接说明", value: selectedLeave.handover_notes },
    { label: "备注", value: selectedLeave.notes, fullWidth: true },
    { label: "申请时间", value: format(parseTime(selectedLeave.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  const outDetailFields = selectedOut ? [
    { label: "外出类型", value: selectedOut.out_type ? outTypeLabels[selectedOut.out_type] || selectedOut.out_type : null },
    { label: "外出时长", value: selectedOut.duration_hours ? `${selectedOut.duration_hours} 小时` : null },
    { label: "开始时间", value: format(parseTime(selectedOut.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
    { label: "预计返回", value: selectedOut.end_time ? format(parseTime(selectedOut.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) : null },
    { label: "外出地点", value: selectedOut.out_location },
    { label: "联系电话", value: selectedOut.contact_phone },
    { label: "外出事由", value: selectedOut.reason, fullWidth: true },
    { label: "备注", value: selectedOut.notes, fullWidth: true },
    { label: "申请时间", value: format(parseTime(selectedOut.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN }) },
  ] : [];

  return (
    <PageLayout>
      <div className="gov-card h-full flex overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-row h-full w-full" orientation="vertical">
          {/* 左侧垂直标签栏 */}
          <div className="w-36 border-r border-border bg-muted/30 flex-shrink-0">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-1">
              <TabsTrigger 
                value="leave" 
                className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <CalendarOff className="w-4 h-4" />
                请假申请
              </TabsTrigger>
              <TabsTrigger 
                value="out" 
                className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <LogOut className="w-4 h-4" />
                外出申请
              </TabsTrigger>
              <TabsTrigger 
                value="business-trip" 
                className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Briefcase className="w-4 h-4" />
                出差申请
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === "leave" && (
              <div className="flex-1 overflow-auto">
                <ApplicationList
                  title="请假申请"
                  items={leaveListItems}
                  loading={leaveLoading}
                  search={leaveSearch}
                  onSearchChange={setLeaveSearch}
                  onAddClick={() => setLeaveFormOpen(true)}
                  onItemClick={(item) => {
                    const record = leaveRecords.find(r => r.id === item.id);
                    if (record) { setSelectedLeave(record); setLeaveDetailOpen(true); void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.LEAVE, target_type: '请假申请', target_id: record.id, target_name: record.reason }); }
                  }}
                  searchPlaceholder="搜索请假类型或事由..."
                  emptyText="暂无请假记录"
                  hideTitle
                />
              </div>
            )}

            {activeTab === "out" && (
              <div className="flex-1 overflow-auto">
                <ApplicationList
                  title="外出申请"
                  items={outListItems}
                  loading={outLoading}
                  search={outSearch}
                  onSearchChange={setOutSearch}
                  onAddClick={() => setOutFormOpen(true)}
                  onItemClick={(item) => {
                    const record = outRecords.find(r => r.id === item.id);
                    if (record) { setSelectedOut(record); setOutDetailOpen(true); void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.ABSENCE, target_type: '外出申请', target_id: record.id, target_name: record.reason }); }
                  }}
                  searchPlaceholder="搜索外出类型、地点或事由..."
                  emptyText="暂无外出记录"
                  hideTitle
                />
              </div>
            )}

            {activeTab === "business-trip" && (
              <div className="flex-1 overflow-auto">
                <ApplicationList
                  title="出差申请"
                  items={tripListItems}
                  loading={tripLoading}
                  search={tripSearch}
                  onSearchChange={setTripSearch}
                  onAddClick={() => setTripFormOpen(true)}
                  onItemClick={(item) => {
                    const record = tripRecords.find(r => r.id === item.id);
                    if (record) { setSelectedTrip(record); setTripDetailOpen(true); void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.ABSENCE, target_type: '出差申请', target_id: record.id, target_name: record.reason }); }
                  }}
                  searchPlaceholder="搜索目的地或事由..."
                  emptyText="暂无出差记录"
                  hideTitle
                />
              </div>
            )}
          </div>
        </Tabs>
      </div>

      {/* Forms */}
      <BusinessTripForm open={tripFormOpen} onOpenChange={(open) => { setTripFormOpen(open); if (!open) fetchTripRecords(); }} currentUser={currentUser} />
      <LeaveForm open={leaveFormOpen} onOpenChange={(open) => { setLeaveFormOpen(open); if (!open) fetchLeaveRecords(); }} currentUser={currentUser} />
      <OutForm open={outFormOpen} onOpenChange={(open) => { setOutFormOpen(open); if (!open) fetchOutRecords(); }} currentUser={currentUser} />

      {/* Detail Dialogs */}
      <ApplicationDetailDialog open={tripDetailOpen} onOpenChange={setTripDetailOpen} title="出差详情" status={selectedTrip?.status} fields={tripDetailFields} businessId={selectedTrip?.id} businessType="business_trip" />
      <ApplicationDetailDialog open={leaveDetailOpen} onOpenChange={setLeaveDetailOpen} title="请假详情" status={selectedLeave?.status} fields={leaveDetailFields} businessId={selectedLeave?.id} businessType="leave" />
      <ApplicationDetailDialog open={outDetailOpen} onOpenChange={setOutDetailOpen} title="外出详情" status={selectedOut?.status} fields={outDetailFields} businessId={selectedOut?.id} businessType="out" />
    </PageLayout>
  );
};

export default AbsenceApplication;
