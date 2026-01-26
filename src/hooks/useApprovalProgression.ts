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
 * 负责在当前节点审批完成后推进到下一节点，以及处理退回和撤回操作
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
   */
  const flattenNodesForExecution = (nodes: ApprovalNode[], formData: Record<string, any>, initiatorId?: string): ApprovalNode[] => {
    const result: ApprovalNode[] = [];
    
    // 将 initiator_id 注入到 formData 中用于条件评估（与 TodoDetailDialog 保持一致）
    const enrichedFormData = {
      ...formData,
      contact_id: initiatorId || formData.contact_id,
    };
    
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
          
          // 检查分支条件是否满足（使用 enrichedFormData）
          if (evaluateCondition(branch.condition_expression, enrichedFormData)) {
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
        // 跳过条件分支节点本身
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
   * 注意：只检查当前批次的审批记录（按 pending 状态的记录判断）
   * 重新提交后会创建新的 pending 记录，老的 rejected 记录不影响判断
   */
  const checkNodeComplete = async (
    instanceId: string,
    nodeName: string,
    approvalMode: string = "countersign"
  ): Promise<{ complete: boolean; allApproved: boolean }> => {
    // 获取该节点所有审批记录，按创建时间倒序
    const { data: allRecords } = await supabase
      .from("approval_records")
      .select("status, created_at, approver_id")
      .eq("instance_id", instanceId)
      .eq("node_name", nodeName)
      .order("created_at", { ascending: false });

    if (!allRecords || allRecords.length === 0) {
      return { complete: false, allApproved: false };
    }

    // 获取每个审批人的最新记录（重新提交后可能有多条记录）
    const latestRecordsByApprover = new Map<string, { status: string; created_at: string }>();
    for (const record of allRecords) {
      if (!latestRecordsByApprover.has(record.approver_id)) {
        latestRecordsByApprover.set(record.approver_id, {
          status: record.status,
          created_at: record.created_at,
        });
      }
    }

    // 只统计每个审批人的最新记录
    const latestRecords = Array.from(latestRecordsByApprover.values());
    const approvedCount = latestRecords.filter(r => r.status === "approved").length;
    const rejectedCount = latestRecords.filter(r => r.status === "rejected").length;
    const pendingCount = latestRecords.filter(r => r.status === "pending").length;
    const totalCount = latestRecords.length;

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
   * 处理抄送节点 - 创建只读通知并自动跳过
   */
  const processCCNode = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    initiatorName: string,
    title: string,
    nodeIndex: number,
    node: ApprovalNode,
    versionNumber: number
  ): Promise<void> => {
    const todoBusinessType = businessTypeToTodoType[businessType] || "absence";
    const ccRecipientIds = node.approver_ids || [];
    
    console.log(`Processing CC node "${node.node_name}" for recipients:`, ccRecipientIds);

    for (const recipientId of ccRecipientIds) {
      // 创建审批记录（状态设为 pending 表示未阅）
      await supabase
        .from("approval_records")
        .insert({
          instance_id: instanceId,
          node_index: nodeIndex,
          node_name: node.node_name,
          node_type: "cc",
          approver_id: recipientId,
          status: "pending", // 抄送节点初始状态为未阅
          comment: null,
        });

      // 创建待办通知（状态设为 pending，表示未阅）
      await supabase
        .from("todo_items")
        .insert({
          source: "internal",
          business_type: todoBusinessType,
          business_id: businessId,
          title: `[抄送] ${title}`,
          description: `${initiatorName} 发起的申请 - 抄送通知`,
          priority: "normal",
          status: "pending", // 抄送待办初始状态为未阅
          process_result: "cc_notified",
          initiator_id: initiatorId,
          assignee_id: recipientId,
          approval_instance_id: instanceId,
          approval_version_number: versionNumber,
        });
    }
  };

  /**
   * 推进审批流程到下一节点（递归处理抄送节点）
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
      // 使用 initiatorId 进行扁平化以确保条件评估一致
      const flatNodes = flattenNodesForExecution(nodesSnapshot, formData, initiatorId);
      
      console.log("Flat nodes for progression:", flatNodes.map(n => n.node_name));
      
      const currentIndex = flatNodes.findIndex(n => n.node_name === currentNodeName);
      
      if (currentIndex === -1) {
        console.error("Current node not found in flattened nodes:", currentNodeName);
        return { success: false, error: "找不到当前节点" };
      }

      const currentNode = flatNodes[currentIndex];
      const approvalMode = currentNode.approval_mode || "countersign";
      const { complete, allApproved } = await checkNodeComplete(instanceId, currentNodeName, approvalMode);

      console.log(`Node ${currentNodeName} status:`, { complete, allApproved, approvalMode });

      if (!complete) {
        console.log("Node not complete yet, waiting for other approvers");
        return { success: true, completed: false };
      }

      if (!allApproved) {
        console.log("Node rejected, terminating workflow");
        await supabase
          .from("approval_instances")
          .update({ status: "rejected", completed_at: new Date().toISOString() })
          .eq("id", instanceId);
        
        return { success: true, completed: true };
      }

      // 递归推进到下一个审批节点（跳过所有抄送节点）
      let nextIndex = currentIndex + 1;
      
      while (nextIndex < flatNodes.length) {
        const nextNode = flatNodes[nextIndex];
        
        if (nextNode.node_type === "cc") {
          // 处理抄送节点并继续
          console.log(`Skipping CC node "${nextNode.node_name}", processing notifications...`);
          await processCCNode(
            instanceId,
            businessId,
            businessType,
            initiatorId,
            initiatorName,
            title,
            nextIndex,
            nextNode,
            versionNumber
          );
          nextIndex++;
        } else {
          // 找到下一个审批节点，停止循环
          break;
        }
      }
      
      if (nextIndex >= flatNodes.length) {
        console.log("No more nodes, workflow completed");
        await supabase
          .from("approval_instances")
          .update({ 
            status: "approved", 
            completed_at: new Date().toISOString(),
            current_node_index: flatNodes.length - 1,
          })
          .eq("id", instanceId);
        
        return { success: true, completed: true };
      }

      const nextNode = flatNodes[nextIndex];
      
      console.log("Advancing to next approver node:", nextNode.node_name, "at index:", nextIndex);
      
      await supabase
        .from("approval_instances")
        .update({ current_node_index: nextIndex })
        .eq("id", instanceId);

      const approverIds = nextNode.approver_ids || [];
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";

      console.log("Creating todos for approvers:", approverIds);

      for (const approverId of approverIds) {
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
   * 退回发起人（当前节点继续）
   * 发起人修改后由退回节点继续审批
   */
  const returnToInitiatorCurrentNode = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    title: string,
    versionNumber: number,
    currentNodeIndex: number,
    comment: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";

      // 更新审批实例状态为 "cancelled"（用于表示退回），通过form_data保存退回信息
      const { data: currentInstance } = await supabase
        .from("approval_instances")
        .select("form_data")
        .eq("id", instanceId)
        .single();

      const updatedFormData = {
        ...(currentInstance?.form_data as Record<string, any> || {}),
        _return_info: {
          type: "return_to_initiator_current",
          return_node_index: currentNodeIndex,
          comment,
          returned_at: new Date().toISOString(),
        }
      };

      await supabase
        .from("approval_instances")
        .update({ 
          status: "cancelled", // 使用 cancelled 表示退回状态
          form_data: updatedFormData,
        })
        .eq("id", instanceId);

      // 为发起人创建修改待办
      const { error: todoError } = await supabase
        .from("todo_items")
        .insert({
          source: "internal",
          business_type: todoBusinessType,
          business_id: businessId,
          title: `[需修改] ${title}`,
          description: `您的申请被退回，请修改后重新提交。修改后由当前节点继续审批。\n退回意见：${comment}`,
          priority: "urgent",
          status: "pending",
          initiator_id: initiatorId,
          assignee_id: initiatorId,
          approval_instance_id: instanceId,
          approval_version_number: versionNumber,
          process_notes: JSON.stringify({ 
            return_type: "return_to_initiator", 
            return_node_index: currentNodeIndex,
            comment 
          }),
        });

      if (todoError) {
        console.error("Failed to create todo for initiator:", todoError);
        return { success: false, error: "创建待办失败" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error returning to initiator:", error);
      return { success: false, error: "退回发起人失败" };
    }
  };

  /**
   * 退回发起人（重新审批）
   * 发起人修改后所有节点需重新审批
   */
  const returnToInitiatorRestart = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    title: string,
    versionNumber: number,
    comment: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";

      // 更新审批实例状态为 "cancelled"，重置节点索引为0
      const { data: currentInstance } = await supabase
        .from("approval_instances")
        .select("form_data")
        .eq("id", instanceId)
        .single();

      const updatedFormData = {
        ...(currentInstance?.form_data as Record<string, any> || {}),
        _return_info: {
          type: "return_restart",
          comment,
          returned_at: new Date().toISOString(),
        }
      };

      await supabase
        .from("approval_instances")
        .update({ 
          status: "cancelled", // 使用 cancelled 表示退回状态
          current_node_index: 0,
          form_data: updatedFormData,
        })
        .eq("id", instanceId);

      // 为发起人创建修改待办
      const { error: todoError } = await supabase
        .from("todo_items")
        .insert({
          source: "internal",
          business_type: todoBusinessType,
          business_id: businessId,
          title: `[需修改-重审] ${title}`,
          description: `您的申请被退回，请修改后重新提交。修改后需要重新走完整审批流程。\n退回意见：${comment}`,
          priority: "urgent",
          status: "pending",
          initiator_id: initiatorId,
          assignee_id: initiatorId,
          approval_instance_id: instanceId,
          approval_version_number: versionNumber,
          process_notes: JSON.stringify({ 
            return_type: "return_restart",
            comment 
          }),
        });

      if (todoError) {
        console.error("Failed to create todo for initiator:", todoError);
        return { success: false, error: "创建待办失败" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error returning to initiator (restart):", error);
      return { success: false, error: "退回发起人失败" };
    }
  };

  /**
   * 退回至上一节点
   */
  const returnToPreviousNode = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    initiatorName: string,
    title: string,
    nodesSnapshot: ApprovalNode[],
    formData: Record<string, any>,
    versionNumber: number,
    currentNodeIndex: number,
    comment: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 获取上一个节点
      const flatNodes = flattenNodesForExecution(nodesSnapshot, formData);
      
      if (currentNodeIndex <= 0) {
        // 如果是第一个节点，退回给发起人
        return returnToInitiatorCurrentNode(
          instanceId,
          businessId,
          businessType,
          initiatorId,
          title,
          versionNumber,
          0,
          comment
        );
      }

      const previousNodeIndex = currentNodeIndex - 1;
      const previousNode = flatNodes[previousNodeIndex];
      
      if (!previousNode) {
        return { success: false, error: "找不到上一节点" };
      }

      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";

      // 更新审批实例状态（保持 pending 表示流程进行中）
      await supabase
        .from("approval_instances")
        .update({ 
          status: "pending",
          current_node_index: previousNodeIndex,
        })
        .eq("id", instanceId);

      // 将上一节点的审批记录重置为 pending
      await supabase
        .from("approval_records")
        .update({ 
          status: "pending",
          comment: null,
          processed_at: null,
        })
        .eq("instance_id", instanceId)
        .eq("node_name", previousNode.node_name);

      // 为上一节点的审批人创建新的待办
      const approverIds = previousNode.approver_ids || [];
      
      for (const approverId of approverIds) {
        const { error: todoError } = await supabase
          .from("todo_items")
          .insert({
            source: "internal",
            business_type: todoBusinessType,
            business_id: businessId,
            title: `[退回重审] ${title}`,
            description: `申请被下一节点退回，需要重新审批。\n退回意见：${comment}`,
            priority: "urgent",
            status: "pending",
            initiator_id: initiatorId,
            assignee_id: approverId,
            approval_instance_id: instanceId,
            approval_version_number: versionNumber,
          });

        if (todoError) {
          console.error("Failed to create todo for previous node:", todoError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Error returning to previous node:", error);
      return { success: false, error: "退回上一节点失败" };
    }
  };

  /**
   * 发起人撤回申请
   * 只有当下一节点未进行任何操作时才能撤回
   */
  const withdrawApplication = async (
    instanceId: string,
    initiatorId: string,
    currentUserId: string
  ): Promise<{ success: boolean; canWithdraw: boolean; error?: string }> => {
    try {
      // 验证是否是发起人
      const { data: instance } = await supabase
        .from("approval_instances")
        .select("initiator_id, status, current_node_index")
        .eq("id", instanceId)
        .single();

      if (!instance) {
        return { success: false, canWithdraw: false, error: "找不到审批实例" };
      }

      if (instance.initiator_id !== currentUserId) {
        return { success: false, canWithdraw: false, error: "只有发起人可以撤回申请" };
      }

      if (instance.status !== "pending") {
        return { success: false, canWithdraw: false, error: "当前状态不允许撤回" };
      }

      // 检查当前节点是否有人已操作
      const { data: records } = await supabase
        .from("approval_records")
        .select("status")
        .eq("instance_id", instanceId)
        .eq("node_index", instance.current_node_index);

      const hasProcessed = records?.some(r => r.status === "approved" || r.status === "rejected");
      
      if (hasProcessed) {
        return { success: false, canWithdraw: false, error: "当前节点已有人审批，无法撤回" };
      }

      // 可以撤回 - 更新审批实例状态（使用 cancelled 表示撤回）
      await supabase
        .from("approval_instances")
        .update({ 
          status: "cancelled", // 使用 cancelled 表示撤回
          completed_at: new Date().toISOString(),
        })
        .eq("id", instanceId);

      // 将所有 pending 状态的待办标记为已取消
      await supabase
        .from("todo_items")
        .update({ 
          status: "completed",
          process_result: "withdrawn",
          process_notes: "发起人已撤回申请",
          processed_at: new Date().toISOString(),
        })
        .eq("approval_instance_id", instanceId)
        .eq("status", "pending");

      // 将所有 pending 状态的审批记录标记为已取消
      await supabase
        .from("approval_records")
        .update({ 
          status: "approved", // 使用 approved 状态表示流程结束
          comment: "发起人已撤回申请",
          processed_at: new Date().toISOString(),
        })
        .eq("instance_id", instanceId)
        .eq("status", "pending");

      return { success: true, canWithdraw: true };
    } catch (error) {
      console.error("Error withdrawing application:", error);
      return { success: false, canWithdraw: false, error: "撤回申请失败" };
    }
  };

  /**
   * 检查发起人是否可以撤回
   */
  const checkCanWithdraw = async (
    instanceId: string,
    currentUserId: string
  ): Promise<boolean> => {
    try {
      const { data: instance } = await supabase
        .from("approval_instances")
        .select("initiator_id, status, current_node_index")
        .eq("id", instanceId)
        .single();

      if (!instance || instance.initiator_id !== currentUserId) {
        return false;
      }

      if (instance.status !== "pending") {
        return false;
      }

      // 检查当前节点是否有人已操作
      const { data: records } = await supabase
        .from("approval_records")
        .select("status")
        .eq("instance_id", instanceId)
        .eq("node_index", instance.current_node_index);

      const hasProcessed = records?.some(r => r.status === "approved" || r.status === "rejected");
      
      return !hasProcessed;
    } catch (error) {
      console.error("Error checking withdraw status:", error);
      return false;
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

  /**
   * 发起人重新提交被退回的申请
   * 根据退回类型决定从哪个节点继续
   */
  const resubmitAfterReturn = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    initiatorName: string,
    title: string,
    nodesSnapshot: ApprovalNode[],
    formData: Record<string, any>,
    versionNumber: number,
    todoItemId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 获取审批实例，获取退回信息
      const { data: instanceData } = await supabase
        .from("approval_instances")
        .select("form_data, current_node_index")
        .eq("id", instanceId)
        .single();

      if (!instanceData) {
        return { success: false, error: "找不到审批实例" };
      }

      const returnInfo = (instanceData.form_data as any)?._return_info;
      if (!returnInfo) {
        return { success: false, error: "找不到退回信息" };
      }

      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";
      
      // 扁平化节点列表
      const flatNodes = flattenNodesForExecution(nodesSnapshot, formData);

      // 根据退回类型决定从哪个节点继续
      let startNodeIndex: number;
      if (returnInfo.type === "return_restart") {
        // 重新审批 - 从第一个节点开始
        startNodeIndex = 0;
      } else {
        // 从退回节点继续 - 使用保存的节点索引
        startNodeIndex = returnInfo.return_node_index || 0;
      }

      const startNode = flatNodes[startNodeIndex];
      if (!startNode) {
        return { success: false, error: "找不到起始审批节点" };
      }

      // 清除退回信息，准备重新审批
      const updatedFormData = { ...formData };
      delete updatedFormData._return_info;

      // 更新审批实例状态为 pending
      await supabase
        .from("approval_instances")
        .update({
          status: "pending",
          current_node_index: startNodeIndex,
          form_data: updatedFormData,
        })
        .eq("id", instanceId);

      // 将当前修改待办标记为已完成
      await supabase
        .from("todo_items")
        .update({
          status: "completed",
          process_result: "resubmitted",
          process_notes: "已重新提交",
          processed_at: new Date().toISOString(),
        })
        .eq("id", todoItemId);

      // 为起始节点的审批人创建新的审批记录和待办
      const approverIds = startNode.approver_ids || [];
      
      for (const approverId of approverIds) {
        // 创建审批记录
        await supabase
          .from("approval_records")
          .insert({
            instance_id: instanceId,
            node_index: startNodeIndex,
            node_name: startNode.node_name,
            node_type: startNode.node_type,
            approver_id: approverId,
            status: "pending",
          });

        // 创建待办事项
        await supabase
          .from("todo_items")
          .insert({
            source: "internal",
            business_type: todoBusinessType,
            business_id: businessId,
            title: title.replace(/^\[需修改(-重审)?\]\s*/, ""), // 移除前缀
            description: `${initiatorName} 重新提交的申请`,
            priority: "normal",
            status: "pending",
            initiator_id: initiatorId,
            assignee_id: approverId,
            approval_instance_id: instanceId,
            approval_version_number: versionNumber,
          });
      }

      return { success: true };
    } catch (error) {
      console.error("Error resubmitting after return:", error);
      return { success: false, error: "重新提交失败" };
    }
  };

  return {
    advanceToNextNode,
    checkNodeComplete,
    flattenNodesForExecution,
    getInitiatorInfo,
    returnToInitiatorCurrentNode,
    returnToInitiatorRestart,
    returnToPreviousNode,
    withdrawApplication,
    checkCanWithdraw,
    resubmitAfterReturn,
  };
};
