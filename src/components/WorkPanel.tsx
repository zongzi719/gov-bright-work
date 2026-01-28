import { useState, useEffect } from "react";
import { ChevronRight, FileText } from "lucide-react";
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

const businessTypeLabels: Record<string, string> = {
  business_trip: "出差申请",
  absence: "请假/外出",
  supply_requisition: "领用申请",
  purchase_request: "采购申请",
  external_approval: "外部审批",
};

// 图标组件
const TodoIcon = ({ type }: { type: string }) => {
  const colors: Record<string, string> = {
    business_trip: "bg-blue-500",
    absence: "bg-orange-500",
    supply_requisition: "bg-green-500",
    purchase_request: "bg-purple-500",
    external_approval: "bg-gray-500",
  };
  
  return (
    <div className={`w-10 h-10 rounded-lg ${colors[type] || "bg-primary"} flex items-center justify-center flex-shrink-0`}>
      <FileText className="w-5 h-5 text-white" />
    </div>
  );
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

  const renderTodoItem = (item: TodoItem, showStatus = false) => {
    const { system } = getDisplayInfo(item);
    const statusLabel = item.status === "approved" ? "已同意" : item.status === "rejected" ? "已驳回" : "已处理";

    return (
      <div
        key={item.id}
        className={`todo-item ${selectedId === item.id ? "bg-primary/5" : ""}`}
        onClick={() => handleItemClick(item)}
      >
        <TodoIcon type={item.business_type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground line-clamp-2 flex-1">
              {item.title}
            </h3>
            {item.priority === "urgent" && (
              <span className="gov-badge text-[10px] px-1.5 flex-shrink-0">急</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="text-primary">● {system}</span>
            <span>·</span>
            <span>{item.initiator?.name || "未知"}</span>
            <span>·</span>
            <span>{format(new Date(item.created_at), "yyyy-MM-dd", { locale: zhCN })}</span>
            {showStatus && (
              <>
                <span>·</span>
                <span className={item.status === "approved" ? "text-green-600" : item.status === "rejected" ? "text-red-600" : "text-muted-foreground"}>
                  {statusLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCCItem = (item: TodoItem) => {
    const isRead = item.status !== "pending";
    const { system } = getDisplayInfo(item);

    return (
      <div
        key={item.id}
        className={`todo-item ${selectedId === item.id ? "bg-primary/5" : ""}`}
        onClick={() => handleItemClick(item)}
      >
        <TodoIcon type={item.business_type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground line-clamp-2 flex-1">
              {item.title.replace(/^\[抄送\]\s*/, "")}
            </h3>
            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${isRead ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {isRead ? "已阅" : "未阅"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="text-primary">● {system}</span>
            <span>·</span>
            <span>{item.initiator?.name || "未知"}</span>
            <span>·</span>
            <span>{format(new Date(item.created_at), "yyyy-MM-dd", { locale: zhCN })}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="gov-card h-full flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* 标题栏 + Tab切换 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="gov-card-title text-base">待办事项</h2>
              {pendingCount > 0 && (
                <span className="gov-badge">{pendingCount > 99 ? "99+" : pendingCount}</span>
              )}
            </div>
            <button className="view-more-btn">
              全部应用
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Tab栏 */}
          <div className="px-4 py-2 border-b border-border flex-shrink-0">
            <TabsList className="bg-transparent gap-1 p-0 h-auto">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-sm rounded"
              >
                待办
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-sm rounded"
              >
                已办
              </TabsTrigger>
              <TabsTrigger
                value="cc"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-sm rounded"
              >
                抄送
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
                <div className="divide-y divide-border/50">
                  {pendingItems.map((item) => renderTodoItem(item))}
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
                <div className="divide-y divide-border/50">
                  {completedItems.map((item) => renderTodoItem(item, true))}
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
                <div className="divide-y divide-border/50">
                  {ccItems.map(renderCCItem)}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* 底部查看更多 */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          <button className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
            查看更多 &gt;
          </button>
        </div>
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
