import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
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

const businessTypeLabels: Record<string, string> = {
  business_trip: "出差申请",
  absence: "请假/外出",
  supply_requisition: "领用申请",
  purchase_request: "采购申请",
  external_approval: "外部审批",
};

const TodoList = () => {
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
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

  // Fetch todo items for current user
  const fetchTodoItems = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("todo_items")
      .select(`
        id,
        title,
        source_system,
        source_department,
        created_at,
        priority,
        status,
        business_type,
        business_id,
        action_url,
        approval_instance_id,
        initiator:contacts!todo_items_initiator_id_fkey(name, department)
      `)
      .eq("assignee_id", currentUser.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Failed to fetch todo items:", error);
    } else if (data) {
      setTodoItems(data as unknown as TodoItem[]);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTodoItems();
  }, [currentUser?.id]);

  const unreadCount = todoItems.filter((item) => item.status === "pending").length;

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
    fetchTodoItems();
  };

  const getDisplayInfo = (item: TodoItem) => {
    const system = item.source_system || businessTypeLabels[item.business_type] || "内部系统";
    const department = item.source_department || item.initiator?.department || "未知部门";
    return { system, department };
  };

  if (loading) {
    return (
      <div className="gov-card h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="gov-card-title">待办事项</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="gov-card h-full flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="gov-card-title">待办事项</h2>
            {unreadCount > 0 && <span className="gov-badge">{unreadCount}</span>}
          </div>
          <button className="text-sm text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
            更多
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 待办列表 */}
        <div className="flex-1 overflow-y-auto">
          {todoItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              暂无待办事项
            </div>
          ) : (
            todoItems.map((item) => {
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
                    {/* 状态圆点 */}
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
            })
          )}
        </div>
      </div>

      {/* 待办详情弹窗 */}
      <TodoDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        todoItem={selectedTodo}
        onApprovalComplete={handleApprovalComplete}
      />
    </>
  );
};

export default TodoList;
