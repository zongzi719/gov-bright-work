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
  resubmit: RotateCcw,
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
  const flattenNodesForExecution = (nodes: ApprovalNode[], formData: Record<string, any>, initiatorId?: string): ApprovalNode[] => {
    const result: ApprovalNode[] = [];
    
    // 将 initiator_id 注入到 formData 中用于条件评估
    const enrichedFormData = {
      ...formData,
      contact_id: initiatorId || formData.contact_id,
    };
    
    console.log("[ApprovalTimeline] Flattening nodes with enrichedFormData:", enrichedFormData);
    
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
          const matches = evaluateCondition(branchCondition, enrichedFormData);
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

  // 构建时间线显示数据 - 按时间顺序混合显示已处理的记录和未处理的节点
  const timelineData = useMemo(() => {
    if (!instance) return [];
    
    const formData = instance.form_data || {};
    const executionNodes = flattenNodesForExecution(nodesSnapshot, formData, instance.initiator_id);
    
    // 过滤掉 condition 类型节点
    const displayNodes = executionNodes.filter(n => 
      n.node_type !== "condition" && n.node_type !== "branch"
    );
    
    // 收集所有已处理的记录，带上节点信息
    type TimelineItem = {
      type: "record" | "node" | "resubmit";
      node: ApprovalNode;
      record?: ApprovalRecord;
      index: number;
      approverNames: string[];
      nodeStatus: "pending" | "approved" | "rejected" | "waiting";
      resubmitTime?: string;
      timestamp: number;
    };
    
    const timelineItems: TimelineItem[] = [];
    
    // 创建节点名称到节点信息的映射
    const nodeMap = new Map<string, { node: ApprovalNode; index: number; approverNames: string[] }>();
    displayNodes.forEach((node, index) => {
      const approverNames = (node.approver_ids || []).map(id => {
        const contact = approverContacts.get(id);
        return contact?.name || "未知";
      });
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
    const returnInfo = formData?._return_info;
    const isAwaitingResubmit = returnInfo && (returnInfo.type === "return_restart" || returnInfo.type === "return_current_node");
    
    // 找出退回后创建的pending记录的时间点（用于过滤这些记录）
    const returnedAt = returnInfo?.returned_at ? new Date(returnInfo.returned_at).getTime() : 0;
    
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
        // 场景2：退回发起人重新审批，检查第一个节点是否有后续记录（pending 或 已处理）
        const firstNodeRecord = records.find(r => 
          r.node_index === 0 &&
          new Date(r.created_at || 0).getTime() > new Date(rejectedRecord.processed_at || rejectedRecord.created_at || 0).getTime()
        );
        if (firstNodeRecord) {
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
    // 跟踪已经添加的重新提交事件（按退回记录ID）
    const addedResubmitEvents = new Set<string>();
    
    // 按时间顺序处理所有已处理的记录（包括所有非pending状态的记录）
    // 关键修复：确保显示所有历史记录，即使该节点后来被退回并有新的pending记录
    const processedRecords = records
      .filter(r => r.status !== "pending" && r.processed_at)
      .sort((a, b) => new Date(a.processed_at || 0).getTime() - new Date(b.processed_at || 0).getTime());
    
    // 同时收集所有节点的所有已处理记录（包括被退回到的节点的历史记录）
    const allProcessedRecordsByNode = new Map<string, ApprovalRecord[]>();
    processedRecords.forEach(record => {
      const existing = allProcessedRecordsByNode.get(record.node_name) || [];
      existing.push(record);
      allProcessedRecordsByNode.set(record.node_name, existing);
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
          node: {
            id: "resubmit-" + resubmitEvent.afterRecord.id,
            node_type: "resubmit",
            node_name: "发起人重新提交",
            approver_type: "",
            approver_ids: null,
          },
          index: -1,
          approverNames: [],
          nodeStatus: "approved",
          resubmitTime: resubmitEvent.time,
          timestamp: new Date(resubmitEvent.time).getTime() - 1, // 放在新记录之前
        });
      }
      
      processedNodeNames.add(record.node_name);
      
      // 判断该记录的状态
      let recordStatus: "approved" | "rejected" = "approved";
      if (record.status === "rejected" || record.status === "returned_to_initiator" || 
          record.status === "returned_restart" || record.status === "returned_to_previous") {
        recordStatus = "rejected";
      }
      
      timelineItems.push({
        type: "record",
        node: nodeInfo.node,
        record,
        index: nodeInfo.index,
        approverNames: nodeInfo.approverNames,
        nodeStatus: recordStatus,
        timestamp: new Date(record.processed_at || 0).getTime(),
      });
    });
    
    // 添加未处理的节点（当前节点和等待中的节点）
    const currentNodeIndex = instance.current_node_index || 0;
    
    displayNodes.forEach((node, index) => {
      const nodeRecords = nodeRecordsMap.get(node.node_name) || [];
      const approverNames = nodeMap.get(node.node_name)?.approverNames || [];
      
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
          index,
          approverNames,
          // 关键修复：如果发起人尚未重新提交，显示为"等待中"而不是"当前节点"
          nodeStatus: isAwaitingResubmit ? "waiting" : "pending",
          timestamp: Date.now() + index,
        });
        
        // 如果用户已重新提交（有 pending 记录且不是等待重新提交状态），需要显示后续所有节点
        if (!isAwaitingResubmit) {
          // 添加当前节点后面的所有等待节点
          displayNodes.slice(index + 1).forEach((futureNode, futureIdx) => {
            const futureApproverNames = nodeMap.get(futureNode.node_name)?.approverNames || [];
            
            // 检查是否已经在时间线中
            const alreadyAdded = timelineItems.some(
              item => item.node.node_name === futureNode.node_name
            );
            if (!alreadyAdded) {
              timelineItems.push({
                type: "node",
                node: futureNode,
                index: index + futureIdx + 1,
                approverNames: futureApproverNames,
                nodeStatus: "waiting",
                timestamp: Date.now() + 1000 + index + futureIdx + 1,
              });
            }
          });
        }
      } else if (index >= currentNodeIndex && !processedNodeNames.has(node.node_name)) {
        // 如果节点索引 >= 当前节点索引，说明是后续待处理节点
        timelineItems.push({
          type: "node",
          node,
          index,
          approverNames,
          nodeStatus: "waiting",
          timestamp: Date.now() + 1000 + index,
        });
      } else if (isAwaitingResubmit && index < displayNodes.length) {
        // 退回重审场景且发起人尚未重新提交：显示所有后续节点为等待状态
        const alreadyInTimeline = timelineItems.some(
          item => item.node.node_name === node.node_name && item.type === "record"
        );
        // 如果该节点索引 >= 当前退回的节点（退回后需要重新审批的节点）
        if (!alreadyInTimeline || (index > 0 && index >= currentNodeIndex)) {
          // 避免重复添加
          const alreadyAdded = timelineItems.some(
            item => item.node.node_name === node.node_name && item.type === "node"
          );
          if (!alreadyAdded && !pendingRecords.length) {
            timelineItems.push({
              type: "node",
              node,
              index,
              approverNames,
              nodeStatus: "waiting",
              timestamp: Date.now() + 1000 + index,
            });
          }
        }
      }
    });
    
    // 按时间戳排序
    timelineItems.sort((a, b) => a.timestamp - b.timestamp);
    
    return timelineItems;
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

        {/* 审批节点 - 按时间顺序显示每条记录 */}
        {timelineData.map((item, idx) => {
          const Icon = nodeTypeIcons[item.node.node_type] || UserCheck;
          const isLast = idx === timelineData.length - 1;
          
          // 判断状态和样式
          let statusBg = "";
          let statusText = "";
          let statusTextColor = "";
          let showStatus = true;
          
          if (item.type === "resubmit") {
            showStatus = false;
          } else if (item.node.node_type === "cc") {
            showStatus = false;
          } else if (item.nodeStatus === "approved") {
            statusBg = "bg-green-100 dark:bg-green-900/30";
            statusText = "已同意";
            statusTextColor = "text-green-800 dark:text-green-400";
          } else if (item.nodeStatus === "rejected") {
            statusBg = "bg-red-100 dark:bg-red-900/30";
            statusText = "已退回";
            statusTextColor = "text-red-800 dark:text-red-400";
          } else if (item.nodeStatus === "pending") {
            statusBg = "bg-yellow-100 dark:bg-yellow-900/30";
            statusText = "当前节点";
            statusTextColor = "text-yellow-800 dark:text-yellow-400";
          } else {
            showStatus = false;
          }
          
          return (
            <div key={item.node.id + "-" + idx} className="flex items-start gap-3 pb-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.nodeStatus === "approved" ? "bg-green-100 dark:bg-green-900/30" :
                  item.nodeStatus === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
                  item.nodeStatus === "pending" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                  "bg-muted"
                }`}>
                  <Icon className={`w-4 h-4 ${
                    item.nodeStatus === "approved" ? "text-green-600 dark:text-green-400" :
                    item.nodeStatus === "rejected" ? "text-red-600 dark:text-red-400" :
                    item.nodeStatus === "pending" ? "text-yellow-600 dark:text-yellow-400" :
                    "text-muted-foreground"
                  }`} />
                </div>
                {!isLast && (
                  <div className="w-0.5 h-full bg-border flex-1 mt-2" />
                )}
              </div>
              <div className="flex-1 pt-1">
                {/* 节点名称行 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {item.node.node_name}
                    {item.node.node_type === "approver" && item.node.approval_mode === "or" && (
                      <span className="text-muted-foreground font-normal"> (或签)</span>
                    )}
                    {item.node.node_type === "approver" && item.node.approval_mode === "countersign" && (
                      <span className="text-muted-foreground font-normal"> (会签)</span>
                    )}
                  </span>
                  {showStatus && (
                    <span className={`text-xs px-2 py-0.5 rounded ${statusBg} ${statusTextColor}`}>
                      {statusText}
                    </span>
                  )}
                </div>
                
                {/* 内容区域 - 根据类型显示不同内容 */}
                <div className="text-xs text-muted-foreground mt-1">
                  {item.type === "resubmit" ? (
                    // 重新提交节点
                    <span>
                      {instance.initiator?.name || "发起人"} 修改后重新提交
                      {item.resubmitTime && (
                        <span className="ml-1">
                          {format(new Date(item.resubmitTime), "MM-dd HH:mm", { locale: zhCN })}
                        </span>
                      )}
                    </span>
                  ) : item.type === "record" && item.record ? (
                    // 已处理的记录 - 显示审批人、状态、时间、意见
                    <div className="bg-muted/50 px-2 py-1.5 rounded">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{item.record.approver?.name || "审批人"}</span>
                        <span className={
                          item.record.status === "approved" ? "text-green-700 dark:text-green-400" : 
                          item.record.status === "rejected" ? "text-red-700 dark:text-red-400" : ""
                        }>
                          {item.record.status === "approved" ? "已同意" : 
                           item.record.status === "rejected" ? "已退回" : ""}
                        </span>
                        {item.record.processed_at && (
                          <span className="text-muted-foreground">
                            {format(new Date(item.record.processed_at), "MM-dd HH:mm", { locale: zhCN })}
                          </span>
                        )}
                      </div>
                      {item.record.comment && (
                        <div className="mt-0.5 text-foreground">
                          {item.record.comment}
                        </div>
                      )}
                    </div>
                  ) : item.node.node_type === "cc" ? (
                    // 抄送节点 - 显示所有抄送人及其阅读状态
                    item.approverNames.length > 0 
                      ? item.approverNames.map((name, i) => {
                          const approverId = item.node.approver_ids?.[i];
                          // 检查是否已读（需要从records中查找）
                          const hasRead = records.some(r => 
                            r.node_name === item.node.node_name &&
                            r.approver_id === approverId && 
                            r.status === "approved"
                          );
                          return (
                            <span key={i}>
                              {i > 0 && "、"}
                              {name}
                              <span className={hasRead ? "text-green-600 dark:text-green-400" : "text-orange-500 dark:text-orange-400"}>
                                （{hasRead ? "已阅" : "未阅"}）
                              </span>
                            </span>
                          );
                        })
                      : "未指定"
                  ) : (
                    // 等待中的节点 - 只显示审批人名称
                    item.approverNames.length > 0 ? item.approverNames.join("、") : "未指定"
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 结束节点 - 只有流程真正完成时才高亮 */}
        {(() => {
          // 计算是否所有必要节点都已完成（只检查 record 类型和当前/等待节点）
          const recordItems = timelineData.filter(item => item.type === "record" || item.type === "node");
          const allNodesApproved = recordItems.every(item => 
            item.nodeStatus === "approved"
          );
          const hasRejectedNode = recordItems.some(item => item.nodeStatus === "rejected");
          const hasPendingNode = recordItems.some(item => 
            item.nodeStatus === "pending" || item.nodeStatus === "waiting"
          );
          
          // 计算结束节点的实际状态
          const endStatus = allNodesApproved && !hasPendingNode ? "approved" : 
                           (hasRejectedNode && !hasPendingNode) ? "rejected" : 
                           "pending";
          
          return (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  endStatus === "approved" ? "bg-green-100 dark:bg-green-900/30" :
                  endStatus === "rejected" ? "bg-red-100 dark:bg-red-900/30" :
                  "bg-muted"
                }`}>
                  {endStatus === "approved" ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : endStatus === "rejected" ? (
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">结束</span>
                  {endStatus === "approved" && (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      已完成
                    </span>
                  )}
                  {endStatus === "rejected" && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      已拒绝
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ApprovalTimeline;
