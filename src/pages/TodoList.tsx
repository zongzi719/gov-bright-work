import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { offlineApi, isOfflineMode } from "@/lib/offlineApi";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import TodoDetailDialog from "@/components/TodoDetailDialog";
import PageLayout from "@/components/PageLayout";

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
}

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
  external_approval: "外部审批",
};

const getApplicationLabel = (businessType: string, title: string): string => {
  if (businessType === "absence") {
    if (title.includes("外出")) {
      return "外出申请";
    }
    return "请假申请";
  }
  return businessTypeLabels[businessType] || "内部审批";
};

const TodoList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "pending";
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingItems, setPendingItems] = useState<TodoItem[]>([]);
  const [completedItems, setCompletedItems] = useState<TodoItem[]>([]);
  const [ccItems, setCCItems] = useState<TodoItem[]>([]);
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

  const fetchAllItems = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (isOfflineMode()) {
      // 离线模式：使用本地 API
      const [pendingRes, completedRes, ccRes] = await Promise.all([
        offlineApi.getTodoItemsWithInitiator(currentUser.id, 'pending'),
        offlineApi.getTodoItemsWithInitiator(currentUser.id, 'completed'),
        offlineApi.getTodoItemsWithInitiator(currentUser.id, 'cc'),
      ]);

      const pendingData = pendingRes.data || [];
      const filteredPending = pendingData.filter(
        (item) => !item.process_result || item.process_result !== "cc_notified"
      );
      setPendingItems(filteredPending as unknown as TodoItem[]);

      const completedData = completedRes.data || [];
      setCompletedItems(completedData as unknown as TodoItem[]);

      const ccData = ccRes.data || [];
      setCCItems(ccData as unknown as TodoItem[]);
    } else {
      // 在线模式：使用 Supabase
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
        .order("created_at", { ascending: false });

      const filteredPending = (pendingData || []).filter(
        (item) => !item.process_result || item.process_result !== "cc_notified"
      );
      setPendingItems(filteredPending as unknown as TodoItem[]);

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
        .order("processed_at", { ascending: false });

      setCompletedItems((completedData || []) as unknown as TodoItem[]);

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
        .order("created_at", { ascending: false });

      setCCItems((ccData || []) as unknown as TodoItem[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAllItems();
  }, [currentUser?.id]);

  // 获取待办项的显示标题：统一显示申请人姓名
  const getDisplayTitle = (item: TodoItem): string => {
    if (item.initiator?.name) {
      return item.initiator.name;
    }
    const match = item.title.match(/^([^-\s]+)/);
    return match ? match[1] : item.title;
  };

  const getSourceLabel = (item: TodoItem): string => {
    if (item.source_system) return item.source_system;
    return getApplicationLabel(item.business_type, item.title);
  };

  const isItemRead = (itemId: string): boolean => {
    try {
      const readItems = JSON.parse(localStorage.getItem("readTodoItems") || "[]");
      return readItems.includes(itemId);
    } catch {
      return false;
    }
  };

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

  const handleItemClick = (item: TodoItem) => {
    markAsRead(item.id);
    void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.TODO, target_type: '待办事项', target_id: item.id, target_name: item.title });
    
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

  const renderPendingItem = (item: TodoItem) => {
    const reason = getDisplayTitle(item);
    const sourceLabel = getSourceLabel(item);
    const isRead = isItemRead(item.id);

    return (
      <div
        key={item.id}
        className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
        onClick={() => handleItemClick(item)}
      >
        <h3 className="text-sm font-bold leading-tight mb-1 text-foreground">
          {reason}
        </h3>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span className="text-primary/80">{sourceLabel}</span>
          <span>·</span>
          <span>{item.initiator?.department || item.source_department || "未知部门"}</span>
          <span>·</span>
          <span>{format(parseTime(item.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</span>
        </div>
      </div>
    );
  };

  const renderCompletedItem = (item: TodoItem) => {
    const { label, color } = statusToDisplay(item.status, item.process_result);
    const reason = getDisplayTitle(item);
    const sourceLabel = getSourceLabel(item);

    return (
      <div
        key={item.id}
        className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold leading-tight text-foreground flex-1">
            {reason}
          </h3>
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${color}`}>{label}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span className="text-primary/80">{sourceLabel}</span>
          <span>·</span>
          <span>{item.initiator?.department || item.source_department || "未知部门"}</span>
          <span>·</span>
          <span>
            {item.processed_at
              ? format(parseTime(item.processed_at), "yyyy-MM-dd HH:mm", { locale: zhCN })
              : format(parseTime(item.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
          </span>
        </div>
      </div>
    );
  };

  const renderCCItem = (item: TodoItem) => {
    const isRead = item.status !== "pending";
    const reason = getDisplayTitle(item);
    const sourceLabel = getSourceLabel(item);

    return (
      <div
        key={item.id}
        className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`text-sm leading-tight flex-1 ${isRead ? "font-normal text-muted-foreground" : "font-semibold text-foreground"}`}>
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
          <span>{item.initiator?.department || item.source_department || "未知部门"}</span>
          <span>·</span>
          <span>{format(parseTime(item.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</span>
        </div>
      </div>
    );
  };

  const pendingCount = pendingItems.length;
  const completedCount = completedItems.length;
  const ccCount = ccItems.length;

  return (
    <PageLayout>
      <div className="flex-1 overflow-hidden bg-background">
        <div className="h-full max-w-4xl mx-auto">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-foreground">待办事项</h1>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
            <div className="flex items-center px-4 py-3 border-b border-border bg-card">
              <TabsList className="bg-muted p-1 gap-1">
                <TabsTrigger value="pending" className="px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold">
                  待办 ({pendingCount})
                </TabsTrigger>
                <TabsTrigger value="completed" className="px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold">
                  已办 ({completedCount})
                </TabsTrigger>
                <TabsTrigger value="cc" className="px-5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-bold">
                  抄送 ({ccCount})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* 待办列表 */}
            <TabsContent value="pending" className="flex-1 m-0 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  加载中...
                </div>
              ) : pendingItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  暂无待办事项
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="bg-card">
                    {pendingItems.map(renderPendingItem)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* 已办列表 */}
            <TabsContent value="completed" className="flex-1 m-0 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  加载中...
                </div>
              ) : completedItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  暂无已办事项
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="bg-card">
                    {completedItems.map(renderCompletedItem)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* 抄送列表 */}
            <TabsContent value="cc" className="flex-1 m-0 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  加载中...
                </div>
              ) : ccItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  暂无抄送
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="bg-card">
                    {ccItems.map(renderCCItem)}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todoItem={selectedTodo}
        onApprovalComplete={handleApprovalComplete}
      />
    </PageLayout>
  );
};

export default TodoList;
