import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  User,
  UserCheck,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
} from "lucide-react";

interface ApprovalNode {
  id: string;
  node_type: string;
  node_name: string;
  approver_type: string;
  approver_ids: string[] | null;
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

interface ContactInfo {
  id: string;
  name: string;
  department: string | null;
}

interface ApprovalTimelineProps {
  businessId: string;
  businessType: string;
}

const nodeTypeIcons: Record<string, any> = {
  initiator: User,
  approver: UserCheck,
  cc: Send,
};

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-yellow-100 text-yellow-800", label: "待处理", icon: Clock },
  approved: { color: "bg-green-100 text-green-800", label: "已同意", icon: CheckCircle },
  rejected: { color: "bg-red-100 text-red-800", label: "已退回", icon: XCircle },
  returned_to_initiator: { color: "bg-orange-100 text-orange-800", label: "已退回发起人", icon: RotateCcw },
  returned_restart: { color: "bg-orange-100 text-orange-800", label: "已退回(重审)", icon: RotateCcw },
  returned_to_previous: { color: "bg-orange-100 text-orange-800", label: "已退回上一节点", icon: RotateCcw },
  processing: { color: "bg-blue-100 text-blue-800", label: "处理中", icon: Clock },
};

const ApprovalTimeline = ({ businessId, businessType }: ApprovalTimelineProps) => {
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<ApprovalInstance | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [nodesSnapshot, setNodesSnapshot] = useState<ApprovalNode[]>([]);
  const [approverContacts, setApproverContacts] = useState<Map<string, ContactInfo>>(new Map());

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

  // 评估条件
  const evaluateCondition = (conditionExpression: any, formData: Record<string, any>): boolean => {
    // 如果没有条件表达式，或者没有groups，或者groups为空，则默认匹配
    if (!conditionExpression) return true;
    
    const groups = conditionExpression.groups || conditionExpression.condition_groups;
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
            // 尝试获取 contact_id 或直接使用值
            value = formData["contact_id"] || formData["申请人"] || formData["applicant"] || value;
          }
          
          console.log(`[ApprovalTimeline] Evaluating condition: field=${field}, operator=${cond.operator}, value=${value}, target=${targetValue}`);
          
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

  // 展平节点树用于执行 - 只保留实际执行路径上的节点
  // 节点存储为扁平列表，通过 ID 引用关联
  const flattenNodesForExecution = (nodes: ApprovalNode[], formData: Record<string, any>): ApprovalNode[] => {
    const result: ApprovalNode[] = [];
    
    console.log("[ApprovalTimeline] Flattening nodes with formData:", formData);
    
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
      console.log(`[ApprovalTimeline] Processing node: ${node.node_name}, type: ${node.node_type}`);
      
      if (node.node_type === "condition") {
        // 条件节点 - 获取其分支并评估
        const branchIds = node.condition_expression?.branches || [];
        const branches = branchIds.map((id: string) => nodeMap.get(id)).filter(Boolean) as ApprovalNode[];
        
        console.log(`[ApprovalTimeline] Condition node has ${branches.length} branches`);
        
        // 按 sort_order 排序分支
        branches.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        let matchedBranch: ApprovalNode | null = null;
        for (const branch of branches) {
          // 分支的 condition_expression.condition_groups 包含该分支的条件
          const branchCondition = branch.condition_expression;
          const matches = evaluateCondition(branchCondition, formData);
          console.log(`[ApprovalTimeline] Branch ${branch.node_name} conditions:`, branch.condition_expression?.condition_groups);
          console.log(`[ApprovalTimeline] Branch ${branch.node_name} matches: ${matches}`);
          
          if (matches) {
            matchedBranch = branch;
            break; // 只走第一个匹配的分支
          }
        }
        
        // 如果找到匹配的分支，处理其子节点
        if (matchedBranch) {
          console.log(`[ApprovalTimeline] Using matched branch: ${matchedBranch.node_name}`);
          const childIds = matchedBranch.condition_expression?.child_nodes || [];
          const childNodes = childIds.map((id: string) => nodeMap.get(id)).filter(Boolean) as ApprovalNode[];
          childNodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
          
          // 递归处理子节点
          childNodes.forEach(child => processNode(child));
        }
      } else if (node.node_type === "condition_branch") {
        // 分支节点本身不加入结果（不应该在主流程中单独出现）
        // 这种情况通常不会发生，因为分支已被排除在主流程之外
      } else {
        // 普通节点（approver, cc 等）- 加入结果
        result.push(node);
      }
    };
    
    // 处理主流程节点
    mainNodes.forEach(node => processNode(node));
    
    console.log(`[ApprovalTimeline] Final execution path has ${result.length} nodes:`, result.map(n => n.node_name));
    return result;
  };

  useEffect(() => {
    if (businessId && businessType) {
      fetchApprovalData();
    }
  }, [businessId, businessType]);

  const fetchApprovalData = async () => {
    setLoading(true);
    
    try {
      // 获取审批实例
      const { data: instanceData, error: instanceError } = await supabase
        .from("approval_instances")
        .select(`
          *,
          initiator:contacts!approval_instances_initiator_id_fkey(name, department)
        `)
        .eq("business_id", businessId)
        .eq("business_type", businessType)
        .single();

      if (instanceError || !instanceData) {
        setLoading(false);
        return;
      }
      
      setInstance(instanceData as unknown as ApprovalInstance);

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
          // 加入发起人ID
          if (instanceData.initiator_id) {
            approverIds.push(instanceData.initiator_id);
          }
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
        .eq("instance_id", instanceData.id)
        .order("node_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (recordsData) {
        setRecords(recordsData as unknown as ApprovalRecord[]);
      }
    } catch (error) {
      console.error("Error fetching approval data:", error);
    }
    
    setLoading(false);
  };

  // 构建时间线显示数据
  const timelineData = useMemo(() => {
    if (!instance) return [];
    
    const formData = instance.form_data || {};
    const executionNodes = flattenNodesForExecution(nodesSnapshot, formData);
    
    // 过滤掉 condition 类型节点
    const displayNodes = executionNodes.filter(n => 
      n.node_type !== "condition" && n.node_type !== "branch"
    );
    
    return displayNodes.map((node, index) => {
      // 获取该节点的审批记录
      const nodeRecords = records.filter(r => r.node_name === node.node_name);
      
      // 获取审批人名称
      const approverNames = (node.approver_ids || []).map(id => {
        const contact = approverContacts.get(id);
        return contact?.name || "未知";
      });
      
      // 判断节点状态
      let nodeStatus: "pending" | "approved" | "rejected" | "waiting" = "waiting";
      let processedRecord: ApprovalRecord | undefined;
      
      if (nodeRecords.length > 0) {
        const approvedRecords = nodeRecords.filter(r => r.status === "approved");
        const rejectedRecords = nodeRecords.filter(r => 
          r.status === "rejected" || 
          r.status === "returned_to_initiator" || 
          r.status === "returned_restart" || 
          r.status === "returned_to_previous"
        );
        const pendingRecords = nodeRecords.filter(r => r.status === "pending");
        
        if (rejectedRecords.length > 0) {
          nodeStatus = "rejected";
          processedRecord = rejectedRecords[0];
        } else if (approvedRecords.length > 0 && pendingRecords.length === 0) {
          nodeStatus = "approved";
          processedRecord = approvedRecords[0];
        } else if (pendingRecords.length > 0) {
          nodeStatus = "pending";
        }
      }
      
      return {
        node,
        index,
        nodeRecords,
        approverNames,
        nodeStatus,
        processedRecord,
      };
    });
  }, [instance, nodesSnapshot, records, approverContacts]);

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">加载审批流程...</div>;
  }

  if (!instance) {
    return <div className="text-sm text-muted-foreground py-4">暂无审批流程信息</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">审批流程</h4>
      <div className="relative">
        {/* 发起人 */}
        <div className="flex items-start gap-3 pb-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            {timelineData.length > 0 && (
              <div className="w-0.5 h-full bg-border flex-1 mt-2" />
            )}
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {instance.initiator?.name || "发起人"}
              </span>
              <span className="text-xs text-muted-foreground">
                {instance.initiator?.department}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800">
                已提交
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {format(new Date(instance.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
            </div>
          </div>
        </div>

        {/* 审批节点 */}
        {timelineData.map((item, idx) => {
          const Icon = nodeTypeIcons[item.node.node_type] || UserCheck;
          const isLast = idx === timelineData.length - 1;
          
          let statusBg = "bg-muted";
          let statusText = "等待中";
          let statusTextColor = "text-muted-foreground";
          
          if (item.nodeStatus === "approved") {
            statusBg = "bg-green-100";
            statusText = "已同意";
            statusTextColor = "text-green-800";
          } else if (item.nodeStatus === "rejected") {
            statusBg = "bg-red-100";
            statusText = "已退回";
            statusTextColor = "text-red-800";
          } else if (item.nodeStatus === "pending") {
            statusBg = "bg-yellow-100";
            statusText = "待处理";
            statusTextColor = "text-yellow-800";
          }
          
          return (
            <div key={item.node.id} className="flex items-start gap-3 pb-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.nodeStatus === "approved" ? "bg-green-100" :
                  item.nodeStatus === "rejected" ? "bg-red-100" :
                  item.nodeStatus === "pending" ? "bg-yellow-100" :
                  "bg-muted"
                }`}>
                  <Icon className={`w-4 h-4 ${
                    item.nodeStatus === "approved" ? "text-green-600" :
                    item.nodeStatus === "rejected" ? "text-red-600" :
                    item.nodeStatus === "pending" ? "text-yellow-600" :
                    "text-muted-foreground"
                  }`} />
                </div>
                {!isLast && (
                  <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                )}
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{item.node.node_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusBg} ${statusTextColor}`}>
                    {statusText}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.approverNames.length > 0 ? item.approverNames.join("、") : "未指定"}
                  {item.node.approval_mode === "or" && " (或签)"}
                  {item.node.approval_mode === "countersign" && " (会签)"}
                </div>
                {item.processedRecord?.comment && (
                  <div className="text-xs text-muted-foreground mt-1 bg-muted/50 px-2 py-1 rounded">
                    意见：{item.processedRecord.comment}
                  </div>
                )}
                {item.processedRecord?.processed_at && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(item.processedRecord.processed_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* 结束节点 */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              instance.status === "approved" ? "bg-green-100" :
              instance.status === "rejected" ? "bg-red-100" :
              "bg-muted"
            }`}>
              {instance.status === "approved" ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : instance.status === "rejected" ? (
                <XCircle className="w-4 h-4 text-red-600" />
              ) : (
                <Clock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">结束</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                instance.status === "approved" ? "bg-green-100 text-green-800" :
                instance.status === "rejected" ? "bg-red-100 text-red-800" :
                "bg-muted text-muted-foreground"
              }`}>
                {instance.status === "approved" ? "已完成" :
                 instance.status === "rejected" ? "已拒绝" :
                 "审批中"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalTimeline;
