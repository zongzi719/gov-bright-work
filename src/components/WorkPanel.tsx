import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
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
    const department = item.source_department || item.initiator?.department || "未知部门";
    return { system, department };
  };

  const renderPendingItem = (item: TodoItem) => {
    const displayStatus = priorityToStatus(item.priority, item.status);
    const { system, department } = getDisplayInfo(item);

    return (
      <div
        key={item.id}
        className={`relative px-3 py-2 cursor-pointer transition-all border-l-2 ${
          selectedId === item.id
            ? "bg-primary/5 border-l-primary"
            : "border-l-transparent hover:bg-muted/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-2">
          <div
            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
              displayStatus === "urgent"
                ? "bg-destructive"
                : displayStatus === "normal"
                ? "bg-primary"
                : "bg-muted-foreground"
            }`}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium leading-tight mb-1 text-foreground line-clamp-1">
              {item.title}
            </h3>
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{system}</span>
              <span>·</span>
              <span>{department}</span>
              <span>·</span>
              <span>{format(new Date(item.created_at), "MM-dd HH:mm", { locale: zhCN })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompletedItem = (item: TodoItem) => {
    const { label, color } = statusToDisplay(item.status, item.process_result);
    const { system, department } = getDisplayInfo(item);

    return (
      <div
        key={item.id}
        className={`relative px-3 py-2 cursor-pointer transition-all border-l-2 ${
          selectedId === item.id
            ? "bg-primary/5 border-l-primary"
            : "border-l-transparent hover:bg-muted/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium leading-tight text-foreground line-clamp-1 flex-1">
                {item.title}
              </h3>
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${color}`}>{label}</span>
            </div>
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{system}</span>
              <span>·</span>
              <span>{department}</span>
              <span>·</span>
              <span>
                {item.processed_at
                  ? format(new Date(item.processed_at), "MM-dd HH:mm", { locale: zhCN })
                  : format(new Date(item.created_at), "MM-dd HH:mm", { locale: zhCN })}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCCItem = (item: TodoItem) => {
    const isRead = item.status !== "pending";
    const { system, department } = getDisplayInfo(item);

    return (
      <div
        key={item.id}
        className={`relative px-3 py-2 cursor-pointer transition-all border-l-2 ${
          selectedId === item.id
            ? "bg-primary/5 border-l-primary"
            : "border-l-transparent hover:bg-muted/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isRead ? "bg-muted-foreground" : "bg-primary"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-medium leading-tight text-foreground line-clamp-1 flex-1">
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
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{system}</span>
              <span>·</span>
              <span>{department}</span>
              <span>·</span>
              <span>{format(new Date(item.created_at), "MM-dd HH:mm", { locale: zhCN })}</span>
            </div>
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
          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <TabsList className="bg-transparent gap-0.5 p-0 h-auto">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 py-1 text-sm"
              >
                待办
                {pendingCount > 0 && (
                  <span className="ml-1 gov-badge text-xs px-1">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 py-1 text-sm"
              >
                已办
              </TabsTrigger>
              <TabsTrigger
                value="cc"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-2 py-1 text-sm"
              >
                抄送
                {ccUnreadCount > 0 && (
                  <span className="ml-1 gov-badge text-xs px-1">{ccUnreadCount}</span>
                )}
              </TabsTrigger>
            </TabsList>
            <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
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
