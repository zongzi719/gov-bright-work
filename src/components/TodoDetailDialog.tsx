import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import {
  User,
  UserCheck,
  Send,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface TodoItem {
  id: string;
  title: string;
  business_type: string;
  business_id: string | null;
  approval_instance_id: string | null;
  status: string;
  created_at: string;
}

interface TodoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todoItem: TodoItem | null;
  onApprovalComplete?: () => void;
}

interface ApprovalNode {
  id: string;
  node_type: string;
  node_name: string;
  approver_type: string;
  approver_ids: string[] | null;
  field_permissions: Record<string, string> | null;
  approval_mode?: string;
}

interface ApprovalRecord {
  id: string;
  node_index: number;
  node_name: string;
  node_type: string;
  approver_id: string;
  status: string;
  comment: string | null;
  processed_at: string | null;
  approver?: {
    name: string;
    department: string | null;
  };
}

interface ApprovalInstance {
  id: string;
  status: string;
  current_node_index: number;
  form_data: Record<string, any> | null;
  version_id: string;
  initiator?: {
    name: string;
    department: string | null;
  };
  created_at: string;
}

interface FormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  col_span: number;
}

const nodeTypeIcons: Record<string, any> = {
  initiator: User,
  approver: UserCheck,
  cc: Send,
};

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-yellow-100 text-yellow-800", label: "待处理", icon: Clock },
  approved: { color: "bg-green-100 text-green-800", label: "已同意", icon: CheckCircle },
  rejected: { color: "bg-red-100 text-red-800", label: "已拒绝", icon: XCircle },
  processing: { color: "bg-blue-100 text-blue-800", label: "处理中", icon: Clock },
};

const TodoDetailDialog = ({ open, onOpenChange, todoItem, onApprovalComplete }: TodoDetailDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [instance, setInstance] = useState<ApprovalInstance | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [nodesSnapshot, setNodesSnapshot] = useState<ApprovalNode[]>([]);
  const [businessData, setBusinessData] = useState<Record<string, any>>({});

  // 获取当前用户
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

  useEffect(() => {
    if (open && todoItem?.approval_instance_id) {
      fetchApprovalDetails();
    }
  }, [open, todoItem?.approval_instance_id]);

  const fetchApprovalDetails = async () => {
    if (!todoItem?.approval_instance_id) return;
    
    setLoading(true);
    
    try {
      // 获取审批实例
      const { data: instanceData, error: instanceError } = await supabase
        .from("approval_instances")
        .select(`
          *,
          initiator:contacts!approval_instances_initiator_id_fkey(name, department)
        `)
        .eq("id", todoItem.approval_instance_id)
        .single();

      if (instanceError) throw instanceError;
      setInstance(instanceData as unknown as ApprovalInstance);

      // 获取版本快照中的节点
      if (instanceData?.version_id) {
        const { data: versionData } = await supabase
          .from("approval_process_versions")
          .select("nodes_snapshot")
          .eq("id", instanceData.version_id)
          .single();
        
        if (versionData?.nodes_snapshot) {
          setNodesSnapshot(versionData.nodes_snapshot as unknown as ApprovalNode[]);
        }
      }

      // 获取审批记录
      const { data: recordsData } = await supabase
        .from("approval_records")
        .select(`
          *,
          approver:contacts!approval_records_approver_id_fkey(name, department)
        `)
        .eq("instance_id", todoItem.approval_instance_id)
        .order("node_index", { ascending: true })
        .order("created_at", { ascending: true });

      setRecords((recordsData || []) as unknown as ApprovalRecord[]);

      // 获取表单字段
      if (instanceData?.template_id) {
        const { data: fieldsData } = await supabase
          .from("approval_form_fields")
          .select("*")
          .eq("template_id", instanceData.template_id)
          .order("sort_order", { ascending: true });

        setFormFields((fieldsData || []) as FormField[]);
      }

      // 获取业务数据
      if (todoItem.business_id && todoItem.business_type) {
        await fetchBusinessData(todoItem.business_type, todoItem.business_id);
      }

    } catch (error) {
      console.error("Failed to fetch approval details:", error);
      toast.error("加载审批详情失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessData = async (businessType: string, businessId: string) => {
    try {
      let data = null;
      
      if (businessType === "business_trip" || businessType === "leave" || businessType === "out") {
        const result = await supabase
          .from("absence_records")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        data = result.data;
      } else if (businessType === "supply_requisition") {
        const result = await supabase
          .from("supply_requisitions")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        data = result.data;
      } else if (businessType === "purchase_request") {
        const result = await supabase
          .from("purchase_requests")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        data = result.data;
      }

      if (data) {
        setBusinessData(data);
      }
    } catch (error) {
      console.error("Failed to fetch business data:", error);
    }
  };

  // 获取当前节点的字段权限
  const getCurrentNodePermissions = (): Record<string, string> => {
    if (!instance || nodesSnapshot.length === 0) return {};
    
    const currentNode = nodesSnapshot[instance.current_node_index];
    return currentNode?.field_permissions || {};
  };

  // 渲染表单字段
  const renderFormField = (field: FormField) => {
    const permissions = getCurrentNodePermissions();
    const permission = permissions[field.field_name] || "readonly";
    
    if (permission === "hidden") return null;

    const value = businessData[field.field_name] || instance?.form_data?.[field.field_name] || "";
    const isReadonly = permission === "readonly";

    // 格式化值
    let displayValue = value;
    if (field.field_type === "datetime" && value) {
      try {
        displayValue = format(new Date(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
      } catch (e) {
        displayValue = value;
      }
    }

    return (
      <div key={field.id} className={field.col_span === 2 ? "col-span-2" : "col-span-1"}>
        <Label className="text-sm text-muted-foreground">
          {field.is_required && <span className="text-destructive">*</span>}
          {field.field_label}
        </Label>
        <div className="mt-1">
          {isReadonly ? (
            <div className="px-3 py-2 bg-muted/50 rounded-md text-sm min-h-[40px] flex items-center">
              {displayValue || "-"}
            </div>
          ) : (
            <Input value={displayValue} readOnly />
          )}
        </div>
      </div>
    );
  };

  // 处理审批
  const handleApproval = async (action: "approved" | "rejected") => {
    if (!todoItem?.approval_instance_id || !currentUser?.id) return;

    setSubmitting(true);

    try {
      // 更新当前用户的审批记录
      const { error: recordError } = await supabase
        .from("approval_records")
        .update({
          status: action,
          comment: comment.trim() || null,
          processed_at: new Date().toISOString(),
        })
        .eq("instance_id", todoItem.approval_instance_id)
        .eq("approver_id", currentUser.id)
        .eq("status", "pending");

      if (recordError) throw recordError;

      // 更新待办状态
      const { error: todoError } = await supabase
        .from("todo_items")
        .update({
          status: action,
          process_result: action,
          process_notes: comment.trim() || null,
          processed_at: new Date().toISOString(),
          processed_by: currentUser.id,
        })
        .eq("id", todoItem.id);

      if (todoError) throw todoError;

      // TODO: 根据会签/或签逻辑推进流程到下一节点

      toast.success(action === "approved" ? "审批已通过" : "审批已拒绝");
      onOpenChange(false);
      onApprovalComplete?.();

    } catch (error) {
      console.error("Failed to submit approval:", error);
      toast.error("提交审批失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染流程时间线
  const renderTimeline = () => {
    // 构建时间线节点
    const timelineNodes: Array<{
      type: "initiator" | "approver" | "cc" | "end";
      name: string;
      status: "completed" | "current" | "pending";
      records: ApprovalRecord[];
      initiator?: { name: string; department: string | null };
    }> = [];

    // 发起人节点
    timelineNodes.push({
      type: "initiator",
      name: "发起人",
      status: "completed",
      records: [],
      initiator: instance?.initiator,
    });

    // 审批节点
    nodesSnapshot.forEach((node, index) => {
      const nodeRecords = records.filter(r => r.node_index === index);
      let status: "completed" | "current" | "pending" = "pending";
      
      if (instance) {
        if (index < instance.current_node_index) {
          status = "completed";
        } else if (index === instance.current_node_index) {
          status = "current";
        }
      }

      timelineNodes.push({
        type: node.node_type as any,
        name: node.node_name,
        status,
        records: nodeRecords,
      });
    });

    // 结束节点
    timelineNodes.push({
      type: "end",
      name: "结束",
      status: instance?.status === "approved" || instance?.status === "rejected" ? "completed" : "pending",
      records: [],
    });

    return (
      <div className="space-y-4">
        {timelineNodes.map((node, index) => {
          const Icon = nodeTypeIcons[node.type] || CheckCircle;
          const isLast = index === timelineNodes.length - 1;
          
          return (
            <div key={index} className="flex gap-4">
              {/* 时间线 */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  node.status === "completed" 
                    ? "bg-green-100 text-green-600" 
                    : node.status === "current"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-8 ${
                    node.status === "completed" ? "bg-green-300" : "bg-muted"
                  }`} />
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{node.name}</span>
                  {node.status === "current" && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                      当前节点
                    </Badge>
                  )}
                </div>

                {node.type === "initiator" && node.initiator && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {node.initiator.name} - {node.initiator.department}
                    <span className="ml-2 text-xs">
                      {instance?.created_at && format(new Date(instance.created_at), "MM-dd HH:mm", { locale: zhCN })}
                    </span>
                  </div>
                )}

                {node.records.map((record) => (
                  <div key={record.id} className="mt-2 p-2 bg-muted/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <span>{record.approver?.name}</span>
                      {record.status !== "pending" && (
                        <Badge className={statusConfig[record.status]?.color || ""}>
                          {statusConfig[record.status]?.label || record.status}
                        </Badge>
                      )}
                      {record.processed_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(record.processed_at), "MM-dd HH:mm", { locale: zhCN })}
                        </span>
                      )}
                    </div>
                    {record.comment && (
                      <div className="mt-1 text-muted-foreground">
                        {record.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 判断当前用户是否可以审批
  const canApprove = todoItem?.status === "pending";

  if (!todoItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{todoItem.title}</span>
            <Badge className={statusConfig[todoItem.status]?.color || ""}>
              {statusConfig[todoItem.status]?.label || todoItem.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="space-y-6">
            {/* 表单区域 */}
            <div>
              <h3 className="text-sm font-medium mb-4">申请信息</h3>
              <div className="grid grid-cols-2 gap-4">
                {formFields.map(renderFormField)}
              </div>
            </div>

            <Separator />

            {/* 审批流程 */}
            <div>
              <h3 className="text-sm font-medium mb-4">审批流程</h3>
              {renderTimeline()}
            </div>

            {/* 审批操作区 */}
            {canApprove && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label>审批意见</Label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="请输入审批意见（可选）"
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleApproval("rejected")}
                      disabled={submitting}
                      className="text-destructive border-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      拒绝
                    </Button>
                    <Button
                      onClick={() => handleApproval("approved")}
                      disabled={submitting}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      同意
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TodoDetailDialog;
