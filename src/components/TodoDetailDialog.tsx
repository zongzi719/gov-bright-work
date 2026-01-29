import { useState, useEffect, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { useApprovalProgression } from "@/hooks/useApprovalProgression";
import BusinessDataRenderer from "@/components/todo/BusinessDataRenderer";

interface TodoItem {
  id: string;
  title: string;
  business_type: string;
  business_id: string | null;
  approval_instance_id: string | null;
  status: string;
  created_at: string;
  assignee_id: string;
  initiator_id?: string | null;
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
  condition_expression?: any;
  children?: ApprovalNode[];
  sort_order?: number;
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
  created_at: string;
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
  initiator_id?: string;
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

interface ContactInfo {
  id: string;
  name: string;
  department: string | null;
}

const nodeTypeIcons: Record<string, any> = {
  initiator: User,
  approver: UserCheck,
  cc: Send,
  resubmit: RotateCcw,
  end: CheckCircle,
};

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-yellow-100 text-yellow-800", label: "待处理", icon: Clock },
  approved: { color: "bg-green-100 text-green-800", label: "已同意", icon: CheckCircle },
  rejected: { color: "bg-red-100 text-red-800", label: "已驳回", icon: XCircle },
  completed: { color: "bg-blue-100 text-blue-800", label: "已抄送", icon: Send },
  returned_to_initiator: { color: "bg-orange-100 text-orange-800", label: "已退回发起人", icon: RotateCcw },
  returned_restart: { color: "bg-orange-100 text-orange-800", label: "已退回(重审)", icon: RotateCcw },
  returned_to_previous: { color: "bg-orange-100 text-orange-800", label: "已退回上一节点", icon: RotateCcw },
  processing: { color: "bg-blue-100 text-blue-800", label: "处理中", icon: Clock },
  cc_notified: { color: "bg-blue-100 text-blue-800", label: "已抄送", icon: Send },
};

type ReturnType = "return_to_initiator" | "return_restart" | "return_to_previous";

const TodoDetailDialog = ({ open, onOpenChange, todoItem, onApprovalComplete }: TodoDetailDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [instance, setInstance] = useState<ApprovalInstance | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [nodesSnapshot, setNodesSnapshot] = useState<ApprovalNode[]>([]);
  const [businessData, setBusinessData] = useState<Record<string, any>>({});
  const [approverContacts, setApproverContacts] = useState<Map<string, ContactInfo>>(new Map());
  const [versionNumber, setVersionNumber] = useState<number>(1);

  const { 
    advanceToNextNode, 
    getInitiatorInfo, 
    returnToInitiatorCurrentNode, 
    returnToInitiatorRestart, 
    returnToPreviousNode,
    withdrawApplication,
    checkCanWithdraw,
    flattenNodesForExecution,
    resubmitAfterReturn,
  } = useApprovalProgression();

  // 可编辑表单数据（用于被退回后修改）
  const [editableFormData, setEditableFormData] = useState<Record<string, any>>({});

  const [canWithdraw, setCanWithdraw] = useState(false);

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
      // 如果是抄送待办，自动标记为已阅
      markCCAsRead();
    }
  }, [open, todoItem?.approval_instance_id]);

  // 标记抄送为已阅
  const markCCAsRead = async () => {
    if (!todoItem || !currentUser?.id) return;
    
    // 检查是否是抄送待办（通过标题前缀或process_result判断）
    const isCCItem = todoItem.title?.startsWith("[抄送]");
    if (!isCCItem) return;
    
    // 检查待办状态是否为pending（未阅）
    if (todoItem.status !== "pending") return;
    
    console.log("Marking CC item as read:", todoItem.id);
    
    try {
      // 更新待办状态为已完成
      await supabase
        .from("todo_items")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: currentUser.id,
          process_notes: "已阅",
        })
        .eq("id", todoItem.id);
      
      // 更新审批记录状态为已阅
      if (todoItem.approval_instance_id) {
        await supabase
          .from("approval_records")
          .update({
            status: "approved",
            processed_at: new Date().toISOString(),
            comment: "已阅",
          })
          .eq("instance_id", todoItem.approval_instance_id)
          .eq("approver_id", currentUser.id)
          .eq("node_type", "cc")
          .eq("status", "pending");
      }
      
      console.log("CC item marked as read successfully");
      // 通知父组件刷新列表
      onApprovalComplete?.();
    } catch (error) {
      console.error("Failed to mark CC as read:", error);
    }
  };

  // 检查是否可以撤回 - 在 instance 加载后单独检查
  useEffect(() => {
    if (open && todoItem?.approval_instance_id && instance && currentUser?.id) {
      if (instance.initiator_id === currentUser.id) {
        checkCanWithdraw(todoItem.approval_instance_id, currentUser.id).then(setCanWithdraw);
      } else {
        setCanWithdraw(false);
      }
    }
  }, [open, todoItem?.approval_instance_id, instance, currentUser?.id]);

  // 收集所有审批人ID
  const collectApproverIds = (nodes: ApprovalNode[]): string[] => {
    const ids: string[] = [];
    const traverse = (nodeList: ApprovalNode[]) => {
      nodeList.forEach(node => {
        if (node.approver_ids) {
          ids.push(...node.approver_ids);
        }
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return [...new Set(ids)];
  };

  // 获取审批人信息
  const fetchApproverContacts = async (approverIds: string[]) => {
    if (approverIds.length === 0) return;
    
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department")
      .in("id", approverIds);
    
    if (data) {
      const contactMap = new Map<string, ContactInfo>();
      data.forEach(c => contactMap.set(c.id, c));
      setApproverContacts(contactMap);
    }
  };

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
      setVersionNumber(instanceData?.version_number || 1);

      // 获取版本快照中的节点
      let nodes: ApprovalNode[] = [];
      if (instanceData?.version_id) {
        const { data: versionData } = await supabase
          .from("approval_process_versions")
          .select("nodes_snapshot")
          .eq("id", instanceData.version_id)
          .single();
        
        if (versionData?.nodes_snapshot) {
          nodes = versionData.nodes_snapshot as unknown as ApprovalNode[];
          setNodesSnapshot(nodes);
          
          // 获取所有审批人信息
          const approverIds = collectApproverIds(nodes);
          await fetchApproverContacts(approverIds);
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
      
      if (businessType === "business_trip" || businessType === "leave" || businessType === "out" || businessType === "absence") {
        const result = await supabase
          .from("absence_records")
          .select("*, contacts!absence_records_contact_id_fkey(id, name, department)")
          .eq("id", businessId)
          .maybeSingle();
        data = result.data;
      } else if (businessType === "supply_requisition") {
        // 领用申请 - 获取主表和明细表数据
        const result = await supabase
          .from("supply_requisitions")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        
        // 获取领用明细
        const { data: itemsData } = await supabase
          .from("supply_requisition_items")
          .select("*, supply:office_supplies(name, specification, unit)")
          .eq("requisition_id", businessId);
        
        if (result.data) {
          data = { ...result.data, items: itemsData || [] };
        }
      } else if (businessType === "purchase_request") {
        // 采购申请 - 获取主表和明细表数据
        const result = await supabase
          .from("purchase_requests")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        
        // 获取采购明细
        const { data: itemsData } = await supabase
          .from("purchase_request_items")
          .select("*, supply:office_supplies(name, specification, unit)")
          .eq("request_id", businessId);
        
        if (result.data) {
          data = { ...result.data, items: itemsData || [] };
        }
      } else if (businessType === "supply_purchase") {
        // 办公用品采购 - 获取主表和明细表数据
        const result = await supabase
          .from("supply_purchases")
          .select("*")
          .eq("id", businessId)
          .maybeSingle();
        
        // 获取采购明细
        const { data: itemsData } = await supabase
          .from("supply_purchase_items")
          .select("*")
          .eq("purchase_id", businessId);
        
        if (result.data) {
          data = { ...result.data, items: itemsData || [] };
        }
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

  // 获取申请人显示名称
  const getApplicantName = (fieldName: string, value: any): string => {
    // 如果是申请人字段(contact_id)，从businessData中获取关联的联系人名称
    if ((fieldName === "contact_id" || fieldName === "申请人") && businessData?.contacts) {
      return businessData.contacts.name || value;
    }
    // 如果是文本型的申请人字段
    if (fieldName === "requisition_by" || fieldName === "requested_by") {
      // 这些字段直接存的是名称
      return value;
    }
    return value;
  };

  // 渲染表单字段
  const renderFormField = (field: FormField) => {
    // 如果是被退回需要修改的状态，发起人可以编辑表单
    const canEditForm = isReturnedForModification;
    
    const permissions = getCurrentNodePermissions();
    let permission = permissions[field.field_name] || "readonly";
    
    // 如果是被退回状态且是发起人，允许编辑（除了申请人字段）
    if (canEditForm && field.field_name !== "contact_id" && field.field_label !== "申请人") {
      permission = "editable";
    }
    
    if (permission === "hidden") return null;

    let value = editableFormData[field.field_name] ?? businessData[field.field_name] ?? instance?.form_data?.[field.field_name] ?? "";
    const isEditable = permission === "editable" && canEditForm;

    // 格式化值
    let displayValue = value;
    
    // 处理申请人字段 - 显示名称而不是UUID
    if (field.field_name === "contact_id" || field.field_label === "申请人") {
      displayValue = getApplicantName(field.field_name, value);
    } else if (field.field_type === "datetime" && value) {
      try {
        displayValue = format(new Date(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
      } catch (e) {
        displayValue = value;
      }
    }

    // 处理可编辑字段的值变更
    const handleFieldChange = (newValue: string) => {
      setEditableFormData(prev => ({
        ...prev,
        [field.field_name]: newValue
      }));
    };

    return (
      <div key={field.id} className={field.col_span === 2 ? "col-span-2" : "col-span-1"}>
        <Label className="text-sm text-muted-foreground">
          {field.is_required && <span className="text-destructive">*</span>}
          {field.field_label}
        </Label>
        <div className="mt-1">
          {isEditable ? (
            field.field_type === "textarea" ? (
              <Textarea
                value={editableFormData[field.field_name] ?? value}
                onChange={(e) => handleFieldChange(e.target.value)}
                className="min-h-[80px]"
              />
            ) : (
              <Input
                value={editableFormData[field.field_name] ?? value}
                onChange={(e) => handleFieldChange(e.target.value)}
              />
            )
          ) : (
            <div className="px-3 py-2 bg-muted/50 rounded-md text-sm min-h-[40px] flex items-center">
              {displayValue || "-"}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 评估条件表达式，决定走哪个分支
  const evaluateCondition = (condition: any, formData: Record<string, any>): boolean => {
    // 如果没有条件表达式，或者没有groups，或者groups为空，则默认匹配
    if (!condition) return true;
    
    const groups = condition.groups || condition.condition_groups;
    if (!groups || groups.length === 0) return true;
    
    try {
      // 组之间是 OR 关系
      return groups.some((group: any) => {
        const conditions = group.conditions || [];
        if (conditions.length === 0) return true;
        
        // 条件之间是 AND 关系
        return conditions.every((cond: any) => {
          const field = cond.field;
          let value = formData[field];
          const targetValue = cond.value;
          
          // 特殊处理申请人字段 - 可能存储为 contact_id
          if (field === "contact_id" || field === "申请人" || field === "applicant") {
            value = formData["contact_id"] || formData["申请人"] || formData["applicant"] || value;
          }
          
          console.log(`[TodoDetailDialog] Evaluating condition: field=${field}, operator=${cond.operator}, value=${value}, target=${targetValue}`);
          
          switch (cond.operator) {
            case "equals":
            case "等于":
              return value === targetValue;
            case "not_equals":
            case "不等于":
              return value !== targetValue;
            case "contains":
            case "包含":
              return String(value || "").includes(String(targetValue || ""));
            case "greater_than":
            case "大于":
              return Number(value) > Number(targetValue);
            case "less_than":
            case "小于":
              return Number(value) < Number(targetValue);
            case "is_empty":
            case "为空":
              return !value || value === "";
            case "not_empty":
            case "不为空":
              return value && value !== "";
            default:
              return true;
          }
        });
      });
    } catch (e) {
      console.error("Error evaluating condition:", e);
      return true;
    }
  };

  // 扁平化节点列表，处理条件分支 - 使用与管理后台一致的逻辑
  const flattenNodesForDisplay = (nodes: ApprovalNode[], formData: Record<string, any>, initiatorId?: string): ApprovalNode[] => {
    const result: ApprovalNode[] = [];
    
    // 将 initiator_id 注入到 formData 中用于条件评估
    const enrichedFormData = {
      ...formData,
      contact_id: initiatorId || formData.contact_id,
    };
    
    console.log("[TodoDetailDialog] Flattening nodes with enrichedFormData:", enrichedFormData);
    
    // 构建节点ID到节点的映射
    const nodeMap = new Map<string, ApprovalNode>();
    nodes.forEach(node => nodeMap.set(node.id, node));
    
    // 找出所有属于某个分支的子节点ID
    const branchChildIds = new Set<string>();
    nodes.forEach(node => {
      if (node.node_type === "condition_branch" && node.condition_expression?.child_nodes) {
        node.condition_expression.child_nodes.forEach((id: string) => branchChildIds.add(id));
      }
    });
    
    // 找出所有分支节点的ID（属于条件节点的分支）
    const branchNodeIds = new Set<string>();
    nodes.forEach(node => {
      if (node.node_type === "condition" && node.condition_expression?.branches) {
        node.condition_expression.branches.forEach((id: string) => branchNodeIds.add(id));
      }
    });
    
    // 按 sort_order 排序主流程节点（不属于任何分支内部的节点）
    const mainNodes = nodes
      .filter(n => !branchChildIds.has(n.id) && !branchNodeIds.has(n.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    const processNode = (node: ApprovalNode) => {
      console.log(`[TodoDetailDialog] Processing node: ${node.node_name}, type: ${node.node_type}`);
      
      if (node.node_type === "condition") {
        // 条件节点 - 获取其分支并评估
        const branchIds = node.condition_expression?.branches || [];
        const branches = branchIds.map((id: string) => nodeMap.get(id)).filter(Boolean) as ApprovalNode[];
        
        console.log(`[TodoDetailDialog] Condition node has ${branches.length} branches`);
        
        // 按 sort_order 排序分支
        branches.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        let matchedBranch: ApprovalNode | null = null;
        for (const branch of branches) {
          // 分支的 condition_expression.condition_groups 包含该分支的条件
          const branchCondition = branch.condition_expression;
          const matches = evaluateCondition(branchCondition, enrichedFormData);
          console.log(`[TodoDetailDialog] Branch ${branch.node_name} conditions:`, branch.condition_expression?.condition_groups);
          console.log(`[TodoDetailDialog] Branch ${branch.node_name} matches: ${matches}`);
          
          if (matches) {
            matchedBranch = branch;
            break; // 只走第一个匹配的分支
          }
        }
        
        // 如果找到匹配的分支，处理其子节点
        if (matchedBranch) {
          console.log(`[TodoDetailDialog] Using matched branch: ${matchedBranch.node_name}`);
          const childIds = matchedBranch.condition_expression?.child_nodes || [];
          const childNodes = childIds.map((id: string) => nodeMap.get(id)).filter(Boolean) as ApprovalNode[];
          childNodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          
          // 递归处理子节点
          childNodes.forEach(child => processNode(child));
        }
      } else if (node.node_type === "condition_branch") {
        // 分支节点本身不加入结果（不应该在主流程中单独出现）
      } else {
        // 普通节点（approver, cc 等）- 加入结果
        result.push(node);
      }
    };
    
    // 处理主流程节点
    mainNodes.forEach(node => processNode(node));
    
    console.log(`[TodoDetailDialog] Final execution path has ${result.length} nodes:`, result.map(n => n.node_name));
    return result;
  };

  // 获取审批人名称列表
  const getApproverNames = (approverIds: string[] | null): string => {
    if (!approverIds || approverIds.length === 0) return "";
    return approverIds
      .map(id => approverContacts.get(id)?.name || "")
      .filter(Boolean)
      .join("、");
  };

  // 处理审批通过
  const handleApprove = async () => {
    if (!todoItem?.approval_instance_id || !currentUser?.id || !instance) return;

    setSubmitting(true);

    try {
      // 获取当前节点名称（从扁平化的节点列表中根据current_node_index获取）
      const formData = { ...businessData, ...instance?.form_data };
      // 传递 initiator_id 以确保条件评估与推进逻辑一致
      const flatNodes = flattenNodesForDisplay(nodesSnapshot, formData, instance.initiator_id);
      const currentNodeIndex = instance.current_node_index;
      const currentNode = flatNodes[currentNodeIndex];
      const currentNodeName = currentNode?.node_name || "";

      // 更新当前用户的审批记录
      const { error: recordError } = await supabase
        .from("approval_records")
        .update({
          status: "approved",
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
          status: "approved",
          process_result: "approved",
          process_notes: comment.trim() || null,
          processed_at: new Date().toISOString(),
          processed_by: currentUser.id,
        })
        .eq("id", todoItem.id);

      if (todoError) throw todoError;

      // 获取发起人信息
      const initiatorInfo = await getInitiatorInfo(instance.initiator_id || "");
      const initiatorName = initiatorInfo?.name || "未知";

      // 推进审批流程到下一节点
      const progressResult = await advanceToNextNode(
        todoItem.approval_instance_id,
        todoItem.business_id || "",
        todoItem.business_type,
        instance.initiator_id || "",
        initiatorName,
        todoItem.title,
        nodesSnapshot,
        formData,
        versionNumber,
        currentNodeName
      );

      if (!progressResult.success) {
        console.error("Failed to advance workflow:", progressResult.error);
      }

      if (progressResult.completed) {
        toast.success("审批流程已完成");
      } else {
        toast.success("审批已通过");
      }
      
      onOpenChange(false);
      onApprovalComplete?.();

    } catch (error) {
      console.error("Failed to submit approval:", error);
      toast.error("提交审批失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 处理退回
  const handleReturn = async (returnType: ReturnType) => {
    if (!todoItem?.approval_instance_id || !currentUser?.id || !instance) return;

    setSubmitting(true);

    try {
      const formData = { ...businessData, ...instance?.form_data };
      let result: { success: boolean; error?: string };
      let toastMessage = "";

      switch (returnType) {
        case "return_to_initiator":
          result = await returnToInitiatorCurrentNode(
            todoItem.approval_instance_id,
            todoItem.business_id || "",
            todoItem.business_type,
            instance.initiator_id || "",
            todoItem.title,
            versionNumber,
            instance.current_node_index,
            comment.trim()
          );
          toastMessage = "已退回发起人，发起人修改后由当前节点继续审批";
          break;
        case "return_restart":
          result = await returnToInitiatorRestart(
            todoItem.approval_instance_id,
            todoItem.business_id || "",
            todoItem.business_type,
            instance.initiator_id || "",
            todoItem.title,
            versionNumber,
            comment.trim()
          );
          toastMessage = "已退回发起人，发起人修改后需重新走完整审批流程";
          break;
        case "return_to_previous":
          const initiatorInfo = await getInitiatorInfo(instance.initiator_id || "");
          result = await returnToPreviousNode(
            todoItem.approval_instance_id,
            todoItem.business_id || "",
            todoItem.business_type,
            instance.initiator_id || "",
            initiatorInfo?.name || "未知",
            todoItem.title,
            nodesSnapshot,
            formData,
            versionNumber,
            instance.current_node_index,
            comment.trim()
          );
          toastMessage = "已退回至上一节点";
          break;
        default:
          result = { success: false, error: "未知退回类型" };
      }

      if (!result.success) {
        throw new Error(result.error || "退回失败");
      }

      // 更新当前用户的审批记录
      await supabase
        .from("approval_records")
        .update({
          status: "rejected",
          comment: `[${toastMessage}] ${comment.trim() || ""}`,
          processed_at: new Date().toISOString(),
        })
        .eq("instance_id", todoItem.approval_instance_id)
        .eq("approver_id", currentUser.id)
        .eq("status", "pending");

      // 更新待办状态
      await supabase
        .from("todo_items")
        .update({
          status: "rejected",
          process_result: returnType,
          process_notes: `[${toastMessage}] ${comment.trim() || ""}`,
          processed_at: new Date().toISOString(),
          processed_by: currentUser.id,
        })
        .eq("id", todoItem.id);

      toast.success(toastMessage);
      onOpenChange(false);
      onApprovalComplete?.();

    } catch (error) {
      console.error("Failed to return approval:", error);
      toast.error(error instanceof Error ? error.message : "退回失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 处理撤回（发起人）
  const handleWithdraw = async () => {
    if (!todoItem?.approval_instance_id || !currentUser?.id) return;

    setSubmitting(true);

    try {
      const result = await withdrawApplication(
        todoItem.approval_instance_id,
        instance?.initiator_id || "",
        currentUser.id
      );

      if (!result.success) {
        toast.error(result.error || "撤回失败");
        return;
      }

      toast.success("申请已撤回");
      onOpenChange(false);
      onApprovalComplete?.();

    } catch (error) {
      console.error("Failed to withdraw application:", error);
      toast.error("撤回失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 处理重新提交（被退回后）
  const handleResubmit = async () => {
    if (!todoItem?.approval_instance_id || !currentUser?.id || !instance) return;

    setSubmitting(true);

    try {
      // 获取发起人信息
      const initiatorInfo = await getInitiatorInfo(instance.initiator_id || "");
      const initiatorName = initiatorInfo?.name || "未知";

      // 合并表单数据
      const formData = { ...businessData, ...instance.form_data, ...editableFormData };

      const result = await resubmitAfterReturn(
        todoItem.approval_instance_id,
        todoItem.business_id || "",
        todoItem.business_type,
        instance.initiator_id || "",
        initiatorName,
        todoItem.title,
        nodesSnapshot,
        formData,
        versionNumber,
        todoItem.id
      );

      if (!result.success) {
        toast.error(result.error || "重新提交失败");
        return;
      }

      toast.success("已重新提交，等待审批");
      onOpenChange(false);
      onApprovalComplete?.();

    } catch (error) {
      console.error("Failed to resubmit application:", error);
      toast.error("重新提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染流程时间线 - 按时间顺序混合显示记录和待处理节点
  const renderTimeline = () => {
    // 获取表单数据用于条件判断，注入 initiator_id 作为 contact_id
    const formData = { ...businessData, ...instance?.form_data };
    
    // 扁平化节点（跳过条件分支节点，只保留审批人和抄送人）- 使用与管理后台一致的逻辑
    const displayNodes = flattenNodesForDisplay(nodesSnapshot, formData, instance?.initiator_id);
    
    // 定义时间线项类型
    type TimelineItem = {
      type: "initiator" | "record" | "node" | "resubmit" | "end";
      node?: ApprovalNode;
      record?: ApprovalRecord;
      name: string;
      approverNames: string;
      approvalMode?: string;
      status: "completed" | "current" | "pending" | "rejected" | "end_completed" | "end_rejected";
      initiator?: { name: string; department: string | null };
      resubmitTime?: string;
      timestamp: number;
    };
    
    const timelineItems: TimelineItem[] = [];
    
    // 发起人节点
    timelineItems.push({
      type: "initiator",
      name: "发起人",
      approverNames: "",
      status: "completed",
      initiator: instance?.initiator,
      timestamp: new Date(instance?.created_at || 0).getTime(),
    });
    
    // 创建节点名称到节点信息的映射
    const nodeMap = new Map<string, { node: ApprovalNode; index: number; approverNames: string }>();
    displayNodes.forEach((node, index) => {
      const approverNames = getApproverNames(node.approver_ids);
      nodeMap.set(node.node_name, { node, index, approverNames });
    });
    
    // 获取每个节点的所有记录
    const nodeRecordsMap = new Map<string, ApprovalRecord[]>();
    displayNodes.forEach(node => {
      const nodeRecords = records
        .filter(r => r.node_name === node.node_name)
        .sort((a, b) => new Date(a.processed_at || a.created_at || 0).getTime() - 
                        new Date(b.processed_at || b.created_at || 0).getTime());
      nodeRecordsMap.set(node.node_name, nodeRecords);
    });
    
    // 检查是否是"退回发起人-重审"场景且发起人尚未重新提交
    const returnInfo = (instance?.form_data as any)?._return_info;
    const isAwaitingResubmit = returnInfo && (returnInfo.type === "return_restart" || returnInfo.type === "return_current_node");
    
    // 检测重新提交事件（只有"退回发起人"才需要发起人重新提交，"退回至上一节点"不需要）
    // 场景1：退回发起人当前节点继续审批（return_current_node）- 发起人修改后同节点继续审批
    // 场景2：退回发起人重新审批（return_restart）- 发起人修改后从头开始审批
    // 注意："退回至上一节点"（return_to_previous）不需要发起人重新提交！
    const resubmitEvents: { afterRecord: ApprovalRecord; beforeRecord?: ApprovalRecord; time: string; isRestartType?: boolean }[] = [];
    
    records.forEach(rejectedRecord => {
      if (rejectedRecord.status !== "rejected" && rejectedRecord.status !== "returned_to_initiator") return;
      
      // 检查是否是"退回至上一节点" - 这种情况不需要发起人重新提交
      const isReturnToPrevious = rejectedRecord.comment?.includes("退回至上一节点") || 
                                  rejectedRecord.comment?.includes("return_to_previous");
      if (isReturnToPrevious) {
        return; // 跳过，不生成重新提交事件
      }
      
      // 检查是否是"退回发起人当前节点继续"
      const isReturnCurrentNode = rejectedRecord.comment?.includes("当前节点继续") || 
                                   rejectedRecord.comment?.includes("return_current_node");
      
      // 检查是否是"退回发起人重新审批"
      const isReturnRestart = rejectedRecord.comment?.includes("重新走完整") || 
                              rejectedRecord.comment?.includes("重审") ||
                              rejectedRecord.comment?.includes("return_restart");
      
      if (isReturnCurrentNode) {
        // 场景1：同节点同审批人有后续的已处理记录
        const laterRecord = records.find(r => 
          r.node_name === rejectedRecord.node_name &&
          r.approver_id === rejectedRecord.approver_id &&
          r.status !== "pending" && // 必须是已处理的记录
          new Date(r.created_at || 0).getTime() > new Date(rejectedRecord.created_at || 0).getTime()
        );
        if (laterRecord) {
          resubmitEvents.push({
            afterRecord: rejectedRecord,
            beforeRecord: laterRecord,
            time: laterRecord.created_at,
          });
        }
      } else if (isReturnRestart) {
        // 场景2：退回发起人重新审批，检查第一个节点是否有后续记录（pending 或 已处理都算）
        // 关键：即使是 pending 状态也说明发起人已经重新提交了
        const firstNodeRecords = records.filter(r => 
          r.node_index === 0 &&
          new Date(r.created_at || 0).getTime() > new Date(rejectedRecord.processed_at || rejectedRecord.created_at || 0).getTime()
        );
        
        // 只要有记录（不管是pending还是已处理），就说明发起人重新提交了
        if (firstNodeRecords.length > 0) {
          // 取最早的那条记录作为"发起人重新提交"的时间点
          const firstNodeRecord = firstNodeRecords.sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          )[0];
          
          resubmitEvents.push({
            afterRecord: rejectedRecord,
            beforeRecord: firstNodeRecord,
            time: firstNodeRecord.created_at,
            isRestartType: true,
          });
        }
      }
    });
    
    // 跟踪哪些节点已经有了已处理的记录
    const processedNodeNames = new Set<string>();
    const addedResubmitEvents = new Set<string>();
    
    // 按时间顺序处理所有已处理的记录
    const processedRecords = records
      .filter(r => r.status !== "pending" && r.processed_at)
      .sort((a, b) => new Date(a.processed_at || 0).getTime() - new Date(b.processed_at || 0).getTime());
    
    // 先处理那些 beforeRecord 是 pending 状态的重新提交事件（这些事件不会被 processedRecords 循环捕获）
    resubmitEvents.forEach(resubmitEvent => {
      if (resubmitEvent.beforeRecord?.status === "pending" && !addedResubmitEvents.has(resubmitEvent.afterRecord.id)) {
        addedResubmitEvents.add(resubmitEvent.afterRecord.id);
        timelineItems.push({
          type: "resubmit",
          name: "发起人重新提交",
          approverNames: "",
          status: "completed",
          initiator: instance?.initiator,
          resubmitTime: resubmitEvent.time,
          timestamp: new Date(resubmitEvent.time).getTime() - 1,
        });
      }
    });
    
    processedRecords.forEach(record => {
      const nodeInfo = nodeMap.get(record.node_name);
      if (!nodeInfo) return;
      
      // 检查是否需要在此记录前插入重新提交事件
      const resubmitEvent = resubmitEvents.find(e => 
        e.beforeRecord?.id === record.id && !addedResubmitEvents.has(e.afterRecord.id)
      );
      if (resubmitEvent) {
        addedResubmitEvents.add(resubmitEvent.afterRecord.id);
        timelineItems.push({
          type: "resubmit",
          name: "发起人重新提交",
          approverNames: "",
          status: "completed",
          initiator: instance?.initiator,
          resubmitTime: resubmitEvent.time,
          timestamp: new Date(resubmitEvent.time).getTime() - 1,
        });
      }
      
      processedNodeNames.add(record.node_name);
      
      // 判断该记录的状态
      let recordStatus: "completed" | "rejected" = "completed";
      if (record.status === "rejected" || record.status === "returned_to_initiator" || 
          record.status === "returned_restart" || record.status === "returned_to_previous") {
        recordStatus = "rejected";
      }
      
      timelineItems.push({
        type: "record",
        node: nodeInfo.node,
        record,
        name: nodeInfo.node.node_name,
        approverNames: nodeInfo.approverNames,
        approvalMode: nodeInfo.node.approval_mode,
        status: recordStatus,
        timestamp: new Date(record.processed_at || 0).getTime(),
      });
    });
    
    // 添加未处理的节点（当前节点和等待中的节点）
    const currentNodeIndex = instance?.current_node_index || 0;
    
    displayNodes.forEach((node, index) => {
      const nodeRecords = nodeRecordsMap.get(node.node_name) || [];
      const nodeInfo = nodeMap.get(node.node_name);
      if (!nodeInfo) return;
      
      // 获取每个审批人的最新记录
      const latestRecordsByApprover = new Map<string, ApprovalRecord>();
      for (const record of nodeRecords) {
        const existing = latestRecordsByApprover.get(record.approver_id);
        if (!existing || new Date(record.created_at || 0) > new Date(existing.created_at || 0)) {
          latestRecordsByApprover.set(record.approver_id, record);
        }
      }
      
      const latestRecords = Array.from(latestRecordsByApprover.values());
      const pendingRecords = latestRecords.filter(r => r.status === "pending");
      
      // 如果该节点有待处理的记录，添加到时间线
      if (pendingRecords.length > 0) {
        timelineItems.push({
          type: "node",
          node,
          name: node.node_name,
          approverNames: nodeInfo.approverNames,
          approvalMode: node.approval_mode,
          // 关键修复：如果发起人尚未重新提交，显示为"等待中"而不是"当前节点"
          status: isAwaitingResubmit ? "pending" : "current",
          timestamp: Date.now() + index,
        });
        
        // 如果用户已重新提交（有 pending 记录），需要显示后续所有节点
        if (!isAwaitingResubmit) {
          // 添加当前节点后面的所有等待节点
          displayNodes.slice(index + 1).forEach((futureNode, futureIdx) => {
            const futureNodeInfo = nodeMap.get(futureNode.node_name);
            if (!futureNodeInfo) return;
            
            // 关键修复：检查是否已作为"等待中"节点添加（不要被历史 record 记录阻止）
            // 因为历史记录是作为 type: "record" 添加的，而等待节点是 type: "node"
            const alreadyAddedAsNode = timelineItems.some(
              item => item.node?.node_name === futureNode.node_name && item.type === "node"
            );
            if (!alreadyAddedAsNode) {
              timelineItems.push({
                type: "node",
                node: futureNode,
                name: futureNode.node_name,
                approverNames: futureNodeInfo.approverNames,
                approvalMode: futureNode.approval_mode,
                status: "pending",
                timestamp: Date.now() + 1000 + index + futureIdx + 1,
              });
            }
          });
        }
      } else if (index >= currentNodeIndex && !processedNodeNames.has(node.node_name)) {
        // 如果节点索引 >= 当前节点索引，说明是后续待处理节点
        // 关键修复：检查是否已被添加为等待节点（避免重复）
        const alreadyAddedAsNode = timelineItems.some(
          item => item.node?.node_name === node.node_name && item.type === "node"
        );
        if (!alreadyAddedAsNode) {
          timelineItems.push({
            type: "node",
            node,
            name: node.node_name,
            approverNames: nodeInfo.approverNames,
            approvalMode: node.approval_mode,
            status: "pending",
            timestamp: Date.now() + 1000 + index,
          });
        }
      } else if (isAwaitingResubmit && index < displayNodes.length) {
        // 退回重审场景且发起人尚未重新提交：显示所有后续节点为等待状态
        const alreadyInTimeline = timelineItems.some(
          item => item.node?.node_name === node.node_name && item.type === "record"
        );
        // 如果该节点索引 >= 当前退回的节点（退回后需要重新审批的节点）
        if (!alreadyInTimeline || (index > 0 && index >= currentNodeIndex)) {
          // 避免重复添加
          const alreadyAdded = timelineItems.some(
            item => item.node?.node_name === node.node_name && item.type === "node"
          );
          if (!alreadyAdded && !pendingRecords.length) {
            timelineItems.push({
              type: "node",
              node,
              name: node.node_name,
              approverNames: nodeInfo.approverNames,
              approvalMode: node.approval_mode,
              status: "pending",
              timestamp: Date.now() + 1000 + index,
            });
          }
        }
      }
    });
    
    // 按时间戳排序
    timelineItems.sort((a, b) => a.timestamp - b.timestamp);
    
    // 计算结束节点状态 - 优先使用审批实例的最终状态
    const instanceApproved = instance?.status === "approved";
    const instanceRejected = instance?.status === "rejected";
    
    const endStatus: "completed" | "rejected" | "pending" = 
      instanceApproved ? "completed" : 
      instanceRejected ? "rejected" : 
      "pending";
    
    // 添加结束节点
    timelineItems.push({
      type: "end",
      name: "结束",
      approverNames: "",
      status: endStatus,
      timestamp: Number.MAX_SAFE_INTEGER,
    });

    return (
      <div className="space-y-4">
        {timelineItems.map((item, index) => {
          const Icon = nodeTypeIcons[item.type] || (item.node ? nodeTypeIcons[item.node.node_type] : CheckCircle);
          const isLast = index === timelineItems.length - 1;
          
          // 确定图标背景色
          let iconBgClass = "bg-muted text-muted-foreground";
          if (item.status === "completed") {
            iconBgClass = "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
          } else if (item.status === "rejected") {
            iconBgClass = "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
          } else if (item.status === "current") {
            iconBgClass = "bg-primary/10 text-primary";
          }
          
          return (
            <div key={index} className="flex gap-4">
              {/* 时间线 */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBgClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-8 ${
                    item.status === "completed" ? "bg-green-300 dark:bg-green-700" : "bg-muted"
                  }`} />
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {item.name}
                    {item.type !== "initiator" && item.type !== "end" && item.type !== "resubmit" && 
                     item.approvalMode === "or" && (
                      <span className="text-muted-foreground font-normal"> (或签)</span>
                    )}
                    {item.type !== "initiator" && item.type !== "end" && item.type !== "resubmit" && 
                     item.approvalMode === "countersign" && (
                      <span className="text-muted-foreground font-normal"> (会签)</span>
                    )}
                  </span>
                  {item.status === "current" && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                      当前节点
                    </Badge>
                  )}
                </div>

                {/* 发起人信息 */}
                {item.type === "initiator" && item.initiator && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {item.initiator.name} - {item.initiator.department}
                    <span className="ml-2 text-xs">
                      {instance?.created_at && format(new Date(instance.created_at), "MM-dd HH:mm", { locale: zhCN })}
                    </span>
                  </div>
                )}

                {/* 发起人重新提交信息 */}
                {item.type === "resubmit" && item.initiator && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {item.initiator.name} 修改后重新提交
                    {item.resubmitTime && (
                      <span className="ml-2 text-xs">
                        {format(new Date(item.resubmitTime), "MM-dd HH:mm", { locale: zhCN })}
                      </span>
                    )}
                  </div>
                )}

                {/* 已处理的记录 - 显示审批人、状态、时间、意见 */}
                {item.type === "record" && item.record && (
                  <div className="mt-1 p-2 rounded-lg text-sm bg-muted/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.record.approver?.name}</span>
                      {item.record.status !== "pending" && (
                        <Badge className={statusConfig[item.record.status]?.color || ""}>
                          {statusConfig[item.record.status]?.label || item.record.status}
                        </Badge>
                      )}
                      {item.record.processed_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.record.processed_at), "MM-dd HH:mm", { locale: zhCN })}
                        </span>
                      )}
                    </div>
                    {item.record.comment && (
                      <div className="mt-1 text-muted-foreground">
                        {item.record.comment}
                      </div>
                    )}
                  </div>
                )}

                {/* 等待中或当前节点 - 显示审批人名称 */}
                {item.type === "node" && item.node && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {item.node.node_type === "cc" ? (
                      // 抄送节点：显示每个抄送人的已阅/未阅状态
                      item.node.approver_ids?.map((approverId, i) => {
                        const approverContact = approverContacts.get(approverId);
                        const record = records.find(r => 
                          r.node_name === item.node!.node_name && r.approver_id === approverId
                        );
                        const hasRead = record?.status === "approved";
                        return (
                          <span key={approverId}>
                            {i > 0 && "、"}
                            {approverContact?.name || record?.approver?.name || "未知"}
                            <span className={hasRead ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400"}>
                              （{hasRead ? "已阅" : "未阅"}）
                            </span>
                          </span>
                        );
                      })
                    ) : (
                      item.approverNames || "未指定"
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 判断当前用户是否是发起人
  const isInitiator = currentUser?.id === instance?.initiator_id;
  
  // 判断是否是抄送待办（只读，不需要审批）
  const isCCNotification = todoItem?.title?.startsWith("[抄送]") || todoItem?.status === "completed";
  
  // 判断是否是被退回需要修改的待办
  const isReturnedForModification = useMemo(() => {
    if (!todoItem || !instance) return false;
    
    // 通过标题前缀判断
    const hasReturnedPrefix = todoItem.title?.startsWith("[需修改]") || todoItem.title?.startsWith("[需修改-重审]");
    // 实例状态是 cancelled（表示被退回）
    const instanceCancelled = instance.status === "cancelled";
    // 待办状态是 pending
    const todoPending = todoItem.status === "pending";
    // 当前用户是发起人
    const isCurrentUserInitiator = currentUser?.id === instance.initiator_id;
    
    // 检查是否有 _return_info 标记（更可靠的判断）
    const hasReturnInfo = !!(instance.form_data as any)?._return_info;
    
    console.log("[isReturnedForModification] check:", {
      hasReturnedPrefix,
      instanceCancelled,
      todoPending,
      isCurrentUserInitiator,
      hasReturnInfo,
      todoTitle: todoItem.title,
      instanceStatus: instance.status,
      todoStatus: todoItem.status,
    });
    
    // 有退回信息且当前用户是发起人且待办待处理 OR 标题前缀匹配
    return ((hasReturnInfo || hasReturnedPrefix) && instanceCancelled && todoPending && isCurrentUserInitiator);
  }, [todoItem, instance, currentUser]);

  // 获取退回信息
  const returnInfo = useMemo(() => {
    return (instance?.form_data as any)?._return_info || null;
  }, [instance]);
  
  // 判断当前用户是否可以审批
  // 待办事项列表已经按 assignee_id 过滤，只显示当前用户的待办
  // 条件: 1. 待办状态是 pending 2. 审批实例状态是 pending（流程未结束）3. 不是抄送待办 4. 不是被退回需修改的待办
  const canApprove = useMemo(() => {
    if (!currentUser || !todoItem || !instance) return false;
    
    // 抄送待办不需要审批
    if (isCCNotification) return false;
    
    // 被退回的待办需要走重新提交流程
    if (isReturnedForModification) return false;
    
    // 待办状态必须是 pending
    const isPending = todoItem.status === "pending";
    // 审批实例状态必须是 pending（流程未结束）
    const instancePending = instance.status === "pending";
    
    return isPending && instancePending;
  }, [currentUser, todoItem, instance, isCCNotification, isReturnedForModification]);
  
  // 判断当前用户是否既是发起人又是审批人（需要显示所有按钮）
  const isInitiatorAndApprover = isInitiator && canApprove;

  if (!todoItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-background">
          <DialogTitle className="flex items-center gap-2">
            <span>{todoItem.title}</span>
            <Badge className={statusConfig[todoItem.status]?.color || ""}>
              {statusConfig[todoItem.status]?.label || todoItem.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground px-6">
            加载中...
          </div>
        ) : (
          <div className="overflow-y-auto px-6 py-4 space-y-6">
            {/* 表单区域 - 使用专用业务数据渲染组件 */}
            <div>
              <h3 className="text-sm font-medium mb-4">申请信息</h3>
              {/* 优先使用 BusinessDataRenderer 渲染业务数据 */}
              {todoItem.business_type && (
                <BusinessDataRenderer 
                  businessType={todoItem.business_type}
                  businessData={businessData}
                  formData={instance?.form_data}
                />
              )}
              {/* 如果有表单字段配置，作为补充渲染（用于审批设计器配置的额外字段） */}
              {formFields.length > 0 && Object.keys(businessData).length === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {formFields.map(renderFormField)}
                </div>
              )}
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
                    {/* 发起人撤回按钮 - 发起人且可以撤回时显示 */}
                    {isInitiator && canWithdraw && (
                      <Button
                        variant="outline"
                        onClick={handleWithdraw}
                        disabled={submitting}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        撤回申请
                      </Button>
                    )}
                    
                    {/* 退回按钮 - 无论是否是发起人，只要是审批人就显示 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={submitting}
                          className="text-destructive border-destructive hover:bg-destructive/10"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          退回
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72">
                        <DropdownMenuItem onClick={() => handleReturn("return_to_initiator")}>
                          <div className="flex flex-col">
                            <span className="font-medium">退回发起人（当前节点继续）</span>
                            <span className="text-xs text-muted-foreground">发起人修改后由当前节点继续审批</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleReturn("return_restart")}>
                          <div className="flex flex-col">
                            <span className="font-medium">退回发起人（重新审批）</span>
                            <span className="text-xs text-muted-foreground">发起人修改后所有节点需重新审批</span>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleReturn("return_to_previous")}>
                          <div className="flex flex-col">
                            <span className="font-medium">退回至上一节点</span>
                            <span className="text-xs text-muted-foreground">退回给上一个审批节点重新审批</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* 同意按钮 - 无论是否是发起人，只要是审批人就显示 */}
                    <Button
                      onClick={handleApprove}
                      disabled={submitting}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      同意
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* 被退回需要修改的操作区 */}
            {isReturnedForModification && (
              <>
                <Separator />
                <div className="space-y-4">
                  {/* 退回信息提示 */}
                  {returnInfo && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <RotateCcw className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-destructive">您的申请已被退回</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {returnInfo.type === "return_restart" 
                              ? "修改后需要重新走完整审批流程" 
                              : "修改后将由退回节点继续审批"}
                          </p>
                          {returnInfo.comment && (
                            <p className="text-sm text-foreground mt-2">
                              <span className="font-medium">退回意见：</span>{returnInfo.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 提示 */}
                  <p className="text-sm text-muted-foreground">
                    请检查申请内容，如需修改请直接编辑相关业务表单后重新提交。
                  </p>
                  
                  {/* 重新提交按钮 */}
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={submitting}
                    >
                      稍后处理
                    </Button>
                    <Button
                      onClick={handleResubmit}
                      disabled={submitting}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {submitting ? "提交中..." : "重新提交"}
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
