import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TodoBusinessType = Database["public"]["Enums"]["todo_business_type"];

interface ApprovalNode {
  id: string;
  node_type: string;
  node_name: string;
  approver_type: string;
  approver_ids: string[] | null;
  approval_mode?: string;
  condition_expression?: any;
  sort_order?: number;
}

// 业务类型映射到待办业务类型
const businessTypeToTodoType: Record<string, TodoBusinessType> = {
  business_trip: "business_trip",
  leave: "absence",
  out: "absence",
  supply_requisition: "supply_requisition",
  purchase_request: "purchase_request",
};

/**
 * 审批流程推进服务
 * 负责在当前节点审批完成后推进到下一节点
 */
export const useApprovalProgression = () => {

  /**
   * 评估条件表达式（适配新结构）
   */
  const evaluateCondition = (conditionExpression: any, formData: Record<string, any>): boolean => {
    if (!conditionExpression) return true;
    
    // 新结构使用 condition_groups
    const groups = conditionExpression.condition_groups || conditionExpression.groups || [];
    if (groups.length === 0) return true;
    
    // 组之间是 OR 关系
    return groups.some((group: any) => {
      const conditions = group.conditions || [];
      if (conditions.length === 0) return true;
      
      // 条件之间是 AND 关系
      return conditions.every((cond: any) => {
        const fieldName = cond.field || cond.field_name;
        const fieldValue = formData[fieldName];
        const targetValue = cond.value;
        
        switch (cond.operator) {
          case "equals":
            return String(fieldValue) === String(targetValue);
          case "not_equals":
            return String(fieldValue) !== String(targetValue);
          case "contains":
            return String(fieldValue).includes(String(targetValue));
          case "is_empty":
            return !fieldValue || fieldValue === "";
          case "not_empty":
            return !!fieldValue && fieldValue !== "";
          case "greater_than":
            return Number(fieldValue) > Number(targetValue);
          case "less_than":
            return Number(fieldValue) < Number(targetValue);
          default:
            return true;
        }
      });
    });
  };

  /**
   * 扁平化节点列表（根据条件表达式过滤分支）
   * 节点是按 sort_order 排序的扁平数组，条件分支通过 child_nodes 引用子节点
   */
  const flattenNodesForExecution = (nodes: ApprovalNode[], formData: Record<string, any>): ApprovalNode[] => {
    const result: ApprovalNode[] = [];
    
    // 按 sort_order 排序
    const sortedNodes = [...nodes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    // 创建节点ID到节点的映射
    const nodeMap = new Map<string, ApprovalNode>();
    sortedNodes.forEach(node => nodeMap.set(node.id, node));
    
    // 获取所有条件分支节点的子节点ID集合
    const branchChildNodeIds = new Set<string>();
    sortedNodes.forEach(node => {
      if (node.node_type === "condition_branch" && node.condition_expression?.child_nodes) {
        node.condition_expression.child_nodes.forEach((id: string) => branchChildNodeIds.add(id));
      }
    });
    
    // 遍历所有节点
    for (const node of sortedNodes) {
      if (node.node_type === "condition") {
        // 条件容器节点 - 找到满足条件的分支
        const branchIds = node.condition_expression?.branches || [];
        
        for (const branchId of branchIds) {
          const branch = nodeMap.get(branchId);
          if (!branch) continue;
          
          // 检查分支条件是否满足
          if (evaluateCondition(branch.condition_expression, formData)) {
            // 添加分支的子节点
            const childNodeIds = branch.condition_expression?.child_nodes || [];
            for (const childId of childNodeIds) {
              const childNode = nodeMap.get(childId);
              if (childNode && (childNode.node_type === "approver" || childNode.node_type === "cc")) {
                result.push(childNode);
              }
            }
            break; // 只走第一个满足条件的分支
          }
        }
      } else if (node.node_type === "condition_branch") {
        // 跳过条件分支节点本身，其子节点会在条件容器节点中处理
        continue;
      } else if (node.node_type === "approver" || node.node_type === "cc") {
        // 只添加不属于任何分支的节点
        if (!branchChildNodeIds.has(node.id)) {
          result.push(node);
        }
      }
    }
    
    return result;
  };

  /**
   * 检查当前节点是否完成审批
   * @param instanceId 审批实例ID
   * @param nodeName 节点名称
   * @param approvalMode 审批模式 countersign(会签) 或 or_sign(或签)
   */
  const checkNodeComplete = async (
    instanceId: string,
    nodeName: string,
    approvalMode: string = "countersign"
  ): Promise<{ complete: boolean; allApproved: boolean }> => {
    // 获取当前节点的所有审批记录
    const { data: records } = await supabase
      .from("approval_records")
      .select("status")
      .eq("instance_id", instanceId)
      .eq("node_name", nodeName);

    if (!records || records.length === 0) {
      return { complete: false, allApproved: false };
    }

    const approvedCount = records.filter(r => r.status === "approved").length;
    const rejectedCount = records.filter(r => r.status === "rejected").length;
    const pendingCount = records.filter(r => r.status === "pending").length;
    const totalCount = records.length;

    if (approvalMode === "or_sign") {
      // 或签：任一审批人同意或拒绝即完成
      if (approvedCount > 0) {
        return { complete: true, allApproved: true };
      }
      if (rejectedCount > 0) {
        return { complete: true, allApproved: false };
      }
      return { complete: false, allApproved: false };
    } else {
      // 会签：所有审批人都同意才完成，有一人拒绝即终止
      if (rejectedCount > 0) {
        return { complete: true, allApproved: false };
      }
      if (pendingCount === 0 && approvedCount === totalCount) {
        return { complete: true, allApproved: true };
      }
      return { complete: false, allApproved: false };
    }
  };

  /**
   * 推进审批流程到下一节点
   */
  const advanceToNextNode = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    initiatorName: string,
    title: string,
    nodesSnapshot: ApprovalNode[],
    formData: Record<string, any>,
    versionNumber: number,
    currentNodeName: string
  ): Promise<{ success: boolean; completed?: boolean; error?: string }> => {
    try {
      // 扁平化节点列表（根据条件过滤分支）
      const flatNodes = flattenNodesForExecution(nodesSnapshot, formData);
      
      console.log("Flat nodes for progression:", flatNodes.map(n => n.node_name));
      
      // 找到当前节点在扁平化列表中的位置
      const currentIndex = flatNodes.findIndex(n => n.node_name === currentNodeName);
      
      if (currentIndex === -1) {
        console.error("Current node not found in flattened nodes:", currentNodeName);
        return { success: false, error: "找不到当前节点" };
      }

      // 获取当前节点的审批模式
      const currentNode = flatNodes[currentIndex];
      const approvalMode = currentNode.approval_mode || "countersign";

      // 检查当前节点是否完成
      const { complete, allApproved } = await checkNodeComplete(instanceId, currentNodeName, approvalMode);

      console.log(`Node ${currentNodeName} status:`, { complete, allApproved, approvalMode });

      if (!complete) {
        // 当前节点尚未完成（还有其他审批人需要审批）
        console.log("Node not complete yet, waiting for other approvers");
        return { success: true, completed: false };
      }

      if (!allApproved) {
        // 当前节点被拒绝，终止流程
        console.log("Node rejected, terminating workflow");
        await supabase
          .from("approval_instances")
          .update({ status: "rejected", completed_at: new Date().toISOString() })
          .eq("id", instanceId);
        
        return { success: true, completed: true };
      }

      // 找到下一个节点
      const nextIndex = currentIndex + 1;
      
      if (nextIndex >= flatNodes.length) {
        // 没有下一节点，流程完成
        console.log("No more nodes, workflow completed");
        await supabase
          .from("approval_instances")
          .update({ status: "approved", completed_at: new Date().toISOString() })
          .eq("id", instanceId);
        
        return { success: true, completed: true };
      }

      const nextNode = flatNodes[nextIndex];
      
      console.log("Advancing to next node:", nextNode.node_name);
      
      // 更新审批实例的当前节点
      await supabase
        .from("approval_instances")
        .update({ current_node_index: nextIndex })
        .eq("id", instanceId);

      // 为下一节点创建审批记录和待办事项
      const approverIds = nextNode.approver_ids || [];
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";

      console.log("Creating todos for approvers:", approverIds);

      for (const approverId of approverIds) {
        // 创建审批记录
        const { error: recordError } = await supabase
          .from("approval_records")
          .insert({
            instance_id: instanceId,
            node_index: nextIndex,
            node_name: nextNode.node_name,
            node_type: nextNode.node_type,
            approver_id: approverId,
            status: "pending",
          });

        if (recordError) {
          console.error("Failed to create approval record:", recordError);
        }

        // 创建待办事项
        const { error: todoError } = await supabase
          .from("todo_items")
          .insert({
            source: "internal",
            business_type: todoBusinessType,
            business_id: businessId,
            title: title,
            description: `${initiatorName} 发起的申请 - ${nextNode.node_name}`,
            priority: "normal",
            status: "pending",
            initiator_id: initiatorId,
            assignee_id: approverId,
            approval_instance_id: instanceId,
            approval_version_number: versionNumber,
          });

        if (todoError) {
          console.error("Failed to create todo item:", todoError);
        }
      }

      return { success: true, completed: false };

    } catch (error) {
      console.error("Error advancing approval:", error);
      return { success: false, error: "推进审批流程失败" };
    }
  };

  /**
   * 获取申请人信息
   */
  const getInitiatorInfo = async (initiatorId: string): Promise<{ name: string; department: string | null } | null> => {
    const { data } = await supabase
      .from("contacts")
      .select("name, department")
      .eq("id", initiatorId)
      .maybeSingle();
    
    return data;
  };

  return {
    advanceToNextNode,
    checkNodeComplete,
    flattenNodesForExecution,
    getInitiatorInfo,
  };
};
