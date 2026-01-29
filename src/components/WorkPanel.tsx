import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
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
  _outReason?: string; // 外出申请的事由
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
  supply_requisition: "领用申请",
  purchase_request: "采购申请",
  supply_purchase: "办公用品采购",
  external_approval: "外部审批",
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

  // 获取外出申请的事由
  const fetchOutReasons = async (businessIds: string[]): Promise<Record<string, string>> => {
    if (businessIds.length === 0) return {};
    
    const { data } = await supabase
      .from("absence_records")
      .select("id, reason, out_location")
      .eq("type", "out")
      .in("id", businessIds);
    
    const reasonMap: Record<string, string> = {};
    (data || []).forEach((record) => {
      // 外出事由优先，如果没有则用往返地点
      reasonMap[record.id] = record.reason || record.out_location || "";
    });
    return reasonMap;
  };

  // 为待办项添加外出事由
  const enrichWithOutReasons = async (items: TodoItem[]): Promise<TodoItem[]> => {
    // 找出所有外出申请的 business_id
    const outBusinessIds = items
      .filter((item) => item.business_type === "absence" && item.title.includes("外出") && item.business_id)
      .map((item) => item.business_id as string);
    
    if (outBusinessIds.length === 0) return items;
    
    const reasonMap = await fetchOutReasons(outBusinessIds);
    
    return items.map((item) => {
      if (item.business_type === "absence" && item.title.includes("外出") && item.business_id) {
        const reason = reasonMap[item.business_id];
        if (reason) {
          // 用外出事由替换原标题中的内容
          return { ...item, _outReason: reason } as TodoItem & { _outReason?: string };
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

    const { data: pendingData } = await supabase
      .from("todo_items")
      .select(`
        id, title, source_system, source_department, created_at, priority, status,
        business_type, business_id, action_url, approval_instance_id, assignee_id,
        process_result, processed_at,
        initiator:contacts!todo_items_initiator_id_fkey(name, department)
      `)
      .eq("assignee_id", currentUser.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(20);

    const filteredPending = (pendingData || []).filter(
      (item) => !item.process_result || item.process_result !== "cc_notified"
    );
    const enrichedPending = await enrichWithOutReasons(filteredPending as unknown as TodoItem[]);
    setPendingItems(enrichedPending);

    const { data: completedData } = await supabase
      .from("todo_items")
      .select(`
        id, title, source_system, source_department, created_at, priority, status,
        business_type, business_id, action_url, approval_instance_id, assignee_id,
        process_result, processed_at,
        initiator:contacts!todo_items_initiator_id_fkey(name, department)
      `)
      .eq("assignee_id", currentUser.id)
      .in("status", ["approved", "rejected", "completed"])
      .neq("process_result", "cc_notified")
      .order("processed_at", { ascending: false })
      .limit(20);

    const enrichedCompleted = await enrichWithOutReasons((completedData || []) as unknown as TodoItem[]);
    setCompletedItems(enrichedCompleted);

    const { data: ccData } = await supabase
      .from("todo_items")
      .select(`
        id, title, source_system, source_department, created_at, priority, status,
        business_type, business_id, action_url, approval_instance_id, assignee_id,
        process_result, processed_at,
        initiator:contacts!todo_items_initiator_id_fkey(name, department)
      `)
      .eq("assignee_id", currentUser.id)
      .eq("process_result", "cc_notified")
      .order("created_at", { ascending: false })
      .limit(20);

    const enrichedCC = await enrichWithOutReasons((ccData || []) as unknown as TodoItem[]);
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

  // 从标题中提取事由（去掉"xxx申请 - "前缀），外出申请优先使用 _outReason
  const extractReason = (item: TodoItem): string => {
    // 如果是外出申请且有事由，直接使用事由
    if (item._outReason) {
      return item._outReason;
    }
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
    const reason = extractReason(item);
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
            {reason}
          </h3>
          <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span className="text-primary/80">{sourceLabel}</span>
            <span>·</span>
            <span>{initiatorDept}</span>
            <span>·</span>
            <span>{format(new Date(item.created_at), "MM-dd HH:mm", { locale: zhCN })}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCompletedItem = (item: TodoItem) => {
    const { label, color } = statusToDisplay(item.status, item.process_result);
    const reason = extractReason(item);
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
              {reason}
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
                ? format(new Date(item.processed_at), "MM-dd HH:mm", { locale: zhCN })
                : format(new Date(item.created_at), "MM-dd HH:mm", { locale: zhCN })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderCCItem = (item: TodoItem) => {
    const isRead = item.status !== "pending";
    // 抄送项：先处理标题去掉抄送前缀，再提取事由
    const ccItem = { ...item, title: item.title.replace(/^\[抄送\]\s*/, "") };
    const reason = extractReason(ccItem);
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
              {reason}
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
            <span>{format(new Date(item.created_at), "MM-dd HH:mm", { locale: zhCN })}</span>
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
