import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as dataAdapter from "@/lib/dataAdapter";
import { isOfflineMode } from "@/lib/offlineApi";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

// 解析本地时间字符串，避免UTC偏移
const parseLocalTime = (value: string): Date => {
  const cleaned = value.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const parts = cleaned.split(/[- :]/);
  if (parts.length >= 5) {
    return new Date(
      parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]),
      parseInt(parts[3]), parseInt(parts[4]), parseInt(parts[5] || '0')
    );
  }
  return new Date(value);
};
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import TodoDetailDialog from "./TodoDetailDialog";

interface TodoItem {
  id: string;
  title: string;
  source_system: string | null;
  source_department: string | null;
  created_at: string;
  priority: "urgent" | "normal" | "low";
  status: string;
  business_type: string;
  business_id: string | null;
  action_url: string | null;
  approval_instance_id: string | null;
  assignee_id: string;
  process_result: string | null;
  processed_at: string | null;
  initiator?: {
    name: string;
    department: string | null;
  } | null;
  // 丰富的请假信息
  _absenceInfo?: {
    leaveType: string | null;
    reason: string;
    applicantName: string;
  };
}

const priorityToStatus = (priority: string, status: string): "urgent" | "normal" | "done" => {
  if (status === "approved" || status === "rejected" || status === "completed") {
    return "done";
  }
  return priority === "urgent" ? "urgent" : "normal";
};

const statusToDisplay = (status: string, processResult: string | null): { label: string; color: string } => {
  if (processResult === "cc_notified") {
    return { label: "已阅", color: "bg-blue-100 text-blue-700" };
  }
  switch (status) {
    case "approved":
      return { label: "已同意", color: "bg-green-100 text-green-700" };
    case "rejected":
      return { label: "已驳回", color: "bg-red-100 text-red-700" };
    case "completed":
      return { label: "已完成", color: "bg-green-100 text-green-700" };
    default:
      return { label: "已处理", color: "bg-gray-100 text-gray-700" };
  }
};

const businessTypeLabels: Record<string, string> = {
  business_trip: "出差申请",
  absence: "请假申请",
  leave: "请假申请",
  supply_requisition: "领用申请",
  purchase_request: "采购申请",
  supply_purchase: "办公用品采购",
  external_approval: "外部审批",
};

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

// 根据业务类型和标题智能判断具体申请类型
const getApplicationLabel = (businessType: string, title: string): string => {
  if (businessType === "absence") {
    // 根据标题关键词区分请假和外出
    if (title.includes("外出")) {
      return "外出申请";
    }
    return "请假申请";
  }
  return businessTypeLabels[businessType] || "内部审批";
};

const WorkPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingItems, setPendingItems] = useState<TodoItem[]>([]);
  const [completedItems, setCompletedItems] = useState<TodoItem[]>([]);
  const [ccItems, setCCItems] = useState<TodoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);

  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (e) {
      console.error("Failed to parse frontendUser", e);
    }
    return null;
  };

  const currentUser = getCurrentUser();

  // 为待办项添加请假详细信息（类型、申请人、事由）
  const enrichWithAbsenceInfo = async (items: TodoItem[]): Promise<TodoItem[]> => {
    // 找出所有请假/外出申请的 business_id
    const absenceBusinessIds = items
      .filter((item) => 
        (item.business_type === "absence" || item.business_type === "leave") && 
        item.business_id
      )
      .map((item) => item.business_id as string);
    
    if (absenceBusinessIds.length === 0) return items;
    
    // 批量获取 absence_records 信息
    const { data: absenceRecords } = await dataAdapter.getAbsenceRecordsByIds(absenceBusinessIds);
    
    if (!absenceRecords || absenceRecords.length === 0) return items;
    
    // 构建映射
    const absenceMap = new Map<string, { leaveType: string | null; reason: string; applicantName: string; type: string }>();
    absenceRecords.forEach((record: any) => {
      absenceMap.set(record.id, {
        leaveType: record.leave_type,
        reason: record.reason,
        applicantName: record.contacts?.name || "未知",
        type: record.type,
      });
    });
    
    return items.map((item) => {
      if ((item.business_type === "absence" || item.business_type === "leave") && item.business_id) {
        const info = absenceMap.get(item.business_id);
        if (info && info.type === "leave") {
          return { ...item, _absenceInfo: { leaveType: info.leaveType, reason: info.reason, applicantName: info.applicantName } };
        }
      }
      return item;
    });
  };

  const fetchAllItems = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 使用统一的 dataAdapter
    const [pendingRes, completedRes, ccRes] = await Promise.all([
      dataAdapter.getTodoItems({
        assignee_id: currentUser.id,
        status: ["pending", "processing"],
        limit: 20,
      }),
      dataAdapter.getTodoItems({
        assignee_id: currentUser.id,
        status: ["approved", "rejected", "completed"],
        process_result_ne: "cc_notified",
        limit: 20,
      }),
      // CC items need special handling - get all then filter
      dataAdapter.getTodoItems({
        assignee_id: currentUser.id,
        limit: 50,
      }),
    ]);

    const pendingData = pendingRes.data || [];
    const filteredPending = pendingData.filter(
      (item: any) => !item.process_result || item.process_result !== "cc_notified"
    );
    const enrichedPending = await enrichWithAbsenceInfo(filteredPending as unknown as TodoItem[]);
    setPendingItems(enrichedPending);

    const completedData = completedRes.data || [];
    const enrichedCompleted = await enrichWithAbsenceInfo(completedData as unknown as TodoItem[]);
    setCompletedItems(enrichedCompleted);

    // Filter CC items from the full list
    const allData = ccRes.data || [];
    const ccData = allData.filter((item: any) => item.process_result === "cc_notified");
    const enrichedCC = await enrichWithAbsenceInfo(ccData as unknown as TodoItem[]);
    setCCItems(enrichedCC);

    setLoading(false);
  };

  useEffect(() => {
    fetchAllItems();
  }, [currentUser?.id]);

  const pendingCount = pendingItems.filter((item) => item.status === "pending").length;
  const ccUnreadCount = ccItems.filter((item) => item.status === "pending").length;

  const handleItemClick = (item: TodoItem) => {
    setSelectedId(item.id);

    if (item.action_url) {
      window.open(item.action_url, "_blank");
      return;
    }

    if (item.approval_instance_id) {
      setSelectedTodo(item);
      setDetailOpen(true);
    }
  };

  const handleApprovalComplete = () => {
    fetchAllItems();
  };

  const getDisplayInfo = (item: TodoItem) => {
    const system = item.source_system || businessTypeLabels[item.business_type] || "内部系统";
    const department = item.source_department || item.initiator?.department || "未知部门";
    return { system, department };
  };

  // 获取待办项的显示标题
  const getDisplayTitle = (item: TodoItem): string => {
    // 请假申请：显示"请假类型 + 申请人 + 事由"
    if (item._absenceInfo) {
      const leaveTypeName = item._absenceInfo.leaveType 
        ? leaveTypeLabels[item._absenceInfo.leaveType] || item._absenceInfo.leaveType
        : "请假";
      return `${leaveTypeName} ${item._absenceInfo.applicantName} ${item._absenceInfo.reason}`;
    }
    // 其他类型：从标题提取事由
    const match = item.title.match(/^[^-]+\s*-\s*(.+)$/);
    return match ? match[1] : item.title;
  };

  // 获取应用来源标签
  const getSourceLabel = (item: TodoItem): string => {
    if (item.source_system) return item.source_system;
    return getApplicationLabel(item.business_type, item.title);
  };

  // 检查待办是否已读（已被点击过）
  const isItemRead = (itemId: string): boolean => {
    try {
      const readItems = JSON.parse(localStorage.getItem("readTodoItems") || "[]");
      return readItems.includes(itemId);
    } catch {
      return false;
    }
  };

  // 标记待办为已读
  const markAsRead = (itemId: string) => {
    try {
      const readItems = JSON.parse(localStorage.getItem("readTodoItems") || "[]");
      if (!readItems.includes(itemId)) {
        readItems.push(itemId);
        localStorage.setItem("readTodoItems", JSON.stringify(readItems));
      }
    } catch {
      localStorage.setItem("readTodoItems", JSON.stringify([itemId]));
    }
  };

  const renderPendingItem = (item: TodoItem) => {
    const displayStatus = priorityToStatus(item.priority, item.status);
    const displayTitle = getDisplayTitle(item);
    const sourceLabel = getSourceLabel(item);
    const isRead = isItemRead(item.id);
    const initiatorDept = item.initiator?.department || "未知部门";

    return (
      <div
        key={item.id}
        className={`relative mx-2 my-1.5 px-3 py-2.5 cursor-pointer transition-all rounded-lg border ${
          selectedId === item.id
            ? "bg-primary/5 border-primary/30 shadow-sm"
            : "bg-card border-border hover:bg-muted/50 hover:border-primary/20"
        }`}
        onClick={() => {
          markAsRead(item.id);
          handleItemClick(item);
        }}
      >
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm leading-tight mb-1.5 line-clamp-1 ${
            isRead ? "font-normal text-muted-foreground" : "font-semibold text-foreground"
          }`}>
            {displayTitle}
          </h3>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span className="text-primary/80">{sourceLabel}</span>
            <span>·</span>
            <span>{initiatorDept}</span>
            <span>·</span>
            <span>{format(parseLocalTime(item.created_at), "MM-dd HH:mm", { locale: zhCN })}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCompletedItem = (item: TodoItem) => {
    const { label, color } = statusToDisplay(item.status, item.process_result);
    const displayTitle = getDisplayTitle(item);
    const sourceLabel = getSourceLabel(item);
    const initiatorDept = item.initiator?.department || "未知部门";

    return (
      <div
        key={item.id}
        className={`relative mx-2 my-1.5 px-3 py-2.5 cursor-pointer transition-all rounded-lg border ${
          selectedId === item.id
            ? "bg-primary/5 border-primary/30 shadow-sm"
            : "bg-card border-border hover:bg-muted/50 hover:border-primary/20"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-normal leading-tight text-muted-foreground line-clamp-1 flex-1">
              {displayTitle}
            </h3>
            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${color}`}>{label}</span>
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span className="text-primary/80">{sourceLabel}</span>
            <span>·</span>
            <span>{initiatorDept}</span>
            <span>·</span>
            <span>
              {item.processed_at
                ? format(parseLocalTime(item.processed_at), "MM-dd HH:mm", { locale: zhCN })
                : format(parseLocalTime(item.created_at), "MM-dd HH:mm", { locale: zhCN })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderCCItem = (item: TodoItem) => {
    const isRead = item.status !== "pending";
    // 抄送项：先处理标题去掉抄送前缀
    const ccItem = { ...item, title: item.title.replace(/^\[抄送\]\s*/, "") };
    const displayTitle = getDisplayTitle(ccItem);
    const sourceLabel = getSourceLabel(item);
    const initiatorDept = item.initiator?.department || "未知部门";

    return (
      <div
        key={item.id}
        className={`relative mx-2 my-1.5 px-3 py-2.5 cursor-pointer transition-all rounded-lg border ${
          selectedId === item.id
            ? "bg-primary/5 border-primary/30 shadow-sm"
            : "bg-card border-border hover:bg-muted/50 hover:border-primary/20"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className={`text-sm leading-tight line-clamp-1 flex-1 ${isRead ? "font-normal text-muted-foreground" : "font-semibold text-foreground"}`}>
              {displayTitle}
            </h3>
            <span
              className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                isRead ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              }`}
            >
              {isRead ? "已阅" : "未阅"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span className="text-primary/80">{sourceLabel}</span>
            <span>·</span>
            <span>{initiatorDept}</span>
            <span>·</span>
            <span>{format(parseLocalTime(item.created_at), "MM-dd HH:mm", { locale: zhCN })}</span>
          </div>
        </div>
      </div>
    );
  };

  // 无数据时压缩显示高度
  const getEmptyHeight = () => {
    if (activeTab === "pending" && pendingItems.length === 0) return "h-20";
    if (activeTab === "completed" && completedItems.length === 0) return "h-20";
    if (activeTab === "cc" && ccItems.length === 0) return "h-20";
    return "h-32";
  };

  return (
    <>
      <div className="gov-card h-full flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* 标题栏 + Tab切换 */}
          <div className="flex items-center justify-between px-2 md:px-3 py-2 border-b border-border flex-shrink-0">
            <TabsList className="bg-transparent gap-0.5 p-0 h-auto">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1.5 md:px-2 py-1 text-xs md:text-sm"
              >
                待办
                {pendingCount > 0 && (
                  <span className="ml-1 gov-badge text-[10px] md:text-xs px-1">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1.5 md:px-2 py-1 text-xs md:text-sm"
              >
                已办
              </TabsTrigger>
              <TabsTrigger
                value="cc"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1.5 md:px-2 py-1 text-xs md:text-sm"
              >
                抄送
                {ccUnreadCount > 0 && (
                  <span className="ml-1 gov-badge text-[10px] md:text-xs px-1">{ccUnreadCount}</span>
                )}
              </TabsTrigger>
            </TabsList>
            <button 
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors"
              onClick={() => navigate(`/todo?tab=${activeTab}`)}
            >
              更多
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* 待办事项列表 */}
          <TabsContent value="pending" className="flex-1 m-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                暂无待办事项
              </div>
            ) : (
              <ScrollArea className="h-full">
                {pendingItems.map(renderPendingItem)}
              </ScrollArea>
            )}
          </TabsContent>

          {/* 已办理列表 */}
          <TabsContent value="completed" className="flex-1 m-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : completedItems.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                暂无已办理事项
              </div>
            ) : (
              <ScrollArea className="h-full">
                {completedItems.map(renderCompletedItem)}
              </ScrollArea>
            )}
          </TabsContent>

          {/* 抄送列表 */}
          <TabsContent value="cc" className="flex-1 m-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : ccItems.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                暂无抄送
              </div>
            ) : (
              <ScrollArea className="h-full">
                {ccItems.map(renderCCItem)}
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todoItem={selectedTodo}
        onApprovalComplete={handleApprovalComplete}
      />
    </>
  );
};

export default WorkPanel;
