import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

  // Get current user from localStorage
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

  // Fetch all items
  const fetchAllItems = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch pending items
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

    // Filter out CC items from pending
    const filteredPending = (pendingData || []).filter(
      (item) => !item.process_result || item.process_result !== "cc_notified"
    );
    setPendingItems(filteredPending as unknown as TodoItem[]);

    // Fetch completed items
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

    // Fetch CC items
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

    // 如果是外部系统的待办，跳转到外部链接
    if (item.action_url) {
      window.open(item.action_url, "_blank");
      return;
    }

    // 内部待办打开详情弹窗
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
        className={`relative px-5 py-4 cursor-pointer transition-all border-l-3 ${
          selectedId === item.id
            ? "bg-primary/5 border-l-primary"
            : "border-l-transparent hover:bg-muted/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-3">
          <div
            className={`status-dot mt-1.5 ${
              displayStatus === "urgent"
                ? "status-dot-urgent"
                : displayStatus === "normal"
                ? "status-dot-normal"
                : "status-dot-done"
            }`}
          />
          <div className="flex-1 min-w-0">
            <h3
              className={`text-sm font-medium leading-relaxed mb-1.5 ${
                selectedId === item.id ? "text-primary" : "text-foreground"
              }`}
            >
              {item.title}
            </h3>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>• 系统：{system}</span>
              <span>• 部门：{department}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              • 时间：{format(new Date(item.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
            </p>
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
        className={`relative px-5 py-4 cursor-pointer transition-all border-l-3 ${
          selectedId === item.id
            ? "bg-primary/5 border-l-primary"
            : "border-l-transparent hover:bg-muted/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-3">
          <div className="status-dot mt-1.5 status-dot-done" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-medium leading-relaxed mb-1.5 ${
                  selectedId === item.id ? "text-primary" : "text-foreground"
                }`}
              >
                {item.title}
              </h3>
              <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>{label}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>• 系统：{system}</span>
              <span>• 部门：{department}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              • 处理时间：
              {item.processed_at
                ? format(new Date(item.processed_at), "yyyy-MM-dd HH:mm", { locale: zhCN })
                : format(new Date(item.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
            </p>
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
        className={`relative px-5 py-4 cursor-pointer transition-all border-l-3 ${
          selectedId === item.id
            ? "bg-primary/5 border-l-primary"
            : "border-l-transparent hover:bg-muted/50"
        }`}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-start gap-3">
          <div className={`status-dot mt-1.5 ${isRead ? "status-dot-done" : "status-dot-normal"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-medium leading-relaxed mb-1.5 ${
                  selectedId === item.id ? "text-primary" : "text-foreground"
                }`}
              >
                {item.title.replace(/^\[抄送\]\s*/, "")}
              </h3>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  isRead ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                }`}
              >
                {isRead ? "已阅" : "未阅"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>• 系统：{system}</span>
              <span>• 部门：{department}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              • 时间：{format(new Date(item.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // 移除单独的 loading 状态返回，直接在主体中显示加载状态
  // 这样Tab标签始终可见，只是内容区域显示"加载中"

  return (
    <>
      <div className="gov-card h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* 标题栏 + Tab切换 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <TabsList className="bg-transparent gap-1 p-0 h-auto">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-1.5 text-sm"
              >
                待办事项
                {pendingCount > 0 && (
                  <span className="ml-1.5 gov-badge">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-1.5 text-sm"
              >
                已办理
              </TabsTrigger>
              <TabsTrigger
                value="cc"
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-3 py-1.5 text-sm"
              >
                抄送
                {ccUnreadCount > 0 && (
                  <span className="ml-1.5 gov-badge">{ccUnreadCount}</span>
                )}
              </TabsTrigger>
            </TabsList>
            <button className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
              更多
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 待办事项列表 */}
          <TabsContent value="pending" className="flex-1 overflow-y-auto m-0">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                加载中...
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                暂无待办事项
              </div>
            ) : (
              pendingItems.map(renderPendingItem)
            )}
          </TabsContent>

          {/* 已办理列表 */}
          <TabsContent value="completed" className="flex-1 overflow-y-auto m-0">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                加载中...
              </div>
            ) : completedItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                暂无已办理事项
              </div>
            ) : (
              completedItems.map(renderCompletedItem)
            )}
          </TabsContent>

          {/* 抄送列表 */}
          <TabsContent value="cc" className="flex-1 overflow-y-auto m-0">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                加载中...
              </div>
            ) : ccItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                暂无抄送
              </div>
            ) : (
              ccItems.map(renderCCItem)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 详情弹窗 */}
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
