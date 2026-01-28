import { useState, useEffect } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  absence: "请假/外出",
  supply_requisition: "领用申请",
  purchase_request: "采购申请",
  external_approval: "外部审批",
};

const WorkPanel = () => {
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
      .order("processed_at", { ascending: false })
      .limit(20);

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
      .order("created_at", { ascending: false })
      .limit(20);

    setCCItems((ccData || []) as unknown as TodoItem[]);

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
    const initiator = item.initiator?.name || "未知";
    return { system, initiator };
  };

  const renderPendingItem = (item: TodoItem) => {
    const { system, initiator } = getDisplayInfo(item);
    const isUrgent = item.priority === "urgent";

    return (
      <div
        key={item.id}
        className={`relative p-3 cursor-pointer transition-all border-l-4 bg-card hover:shadow-md ${
          selectedId === item.id
            ? "border-l-primary bg-primary/5"
            : isUrgent
            ? "border-l-destructive"
            : "border-l-accent"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isUrgent ? "bg-destructive/10" : "bg-primary/10"
          }`}>
            <FileText className={`w-5 h-5 ${isUrgent ? "text-destructive" : "text-primary"}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-foreground line-clamp-1 flex-1">
                {item.title}
              </h3>
              {isUrgent && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
                  急
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-primary">• {system}</span>
              <span>{initiator} · {format(new Date(item.created_at), "yyyy-MM-dd", { locale: zhCN })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompletedItem = (item: TodoItem) => {
    const { label, color } = statusToDisplay(item.status, item.process_result);
    const { system, initiator } = getDisplayInfo(item);

    return (
      <div
        key={item.id}
        className={`relative p-3 cursor-pointer transition-all border-l-4 border-l-muted bg-card hover:shadow-md ${
          selectedId === item.id ? "bg-primary/5" : ""
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-foreground line-clamp-1 flex-1">
                {item.title}
              </h3>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${color}`}>{label}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>• {system}</span>
              <span>
                {initiator} · {item.processed_at
                  ? format(new Date(item.processed_at), "yyyy-MM-dd", { locale: zhCN })
                  : format(new Date(item.created_at), "yyyy-MM-dd", { locale: zhCN })}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCCItem = (item: TodoItem) => {
    const isRead = item.status !== "pending";
    const { system, initiator } = getDisplayInfo(item);

    return (
      <div
        key={item.id}
        className={`relative p-3 cursor-pointer transition-all border-l-4 bg-card hover:shadow-md ${
          selectedId === item.id
            ? "border-l-primary bg-primary/5"
            : isRead
            ? "border-l-muted"
            : "border-l-accent"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isRead ? "bg-muted" : "bg-accent/10"
          }`}>
            <FileText className={`w-5 h-5 ${isRead ? "text-muted-foreground" : "text-accent"}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium text-foreground line-clamp-1 flex-1">
                {item.title.replace(/^\[抄送\]\s*/, "")}
              </h3>
              <span
                className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                  isRead ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                }`}
              >
                {isRead ? "已阅" : "未阅"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>• {system}</span>
              <span>{initiator} · {format(new Date(item.created_at), "yyyy-MM-dd", { locale: zhCN })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="gov-card h-full flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="gov-card-title text-base">待办事项</h2>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-sm px-2 py-0.5 rounded-full">
                {pendingCount > 99 ? "99+" : pendingCount}
              </Badge>
            )}
          </div>
          <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors font-medium">
            全部应用
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          {/* Tab切换 */}
          <div className="px-4 py-2 border-b border-border flex-shrink-0">
            <TabsList className="bg-transparent gap-1 p-0 h-auto w-full justify-start">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-sm rounded-md"
              >
                待办
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-sm rounded-md"
              >
                已办
              </TabsTrigger>
              <TabsTrigger
                value="cc"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-sm rounded-md"
              >
                抄送
                {ccUnreadCount > 0 && (
                  <span className="ml-1 text-xs bg-accent text-accent-foreground px-1.5 rounded-full">
                    {ccUnreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
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
                <div className="space-y-2 p-3">
                  {pendingItems.map(renderPendingItem)}
                </div>
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
                <div className="space-y-2 p-3">
                  {completedItems.map(renderCompletedItem)}
                </div>
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
                <div className="space-y-2 p-3">
                  {ccItems.map(renderCCItem)}
                </div>
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
