import * as dataAdapter from "@/lib/dataAdapter";
import type { Database } from "@/integrations/supabase/types";

// 生成本地时间 ISO 字符串，避免 toISOString() 转换为 UTC 导致 8 小时偏差
const formatLocalNow = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

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
  supply_purchase: "supply_purchase",
};

// 业务类型到联系人状态的映射
const businessTypeToContactStatus: Record<string, string> = {
  business_trip: "business_trip",
  leave: "leave",
  out: "out",
};

/**
 * 处理审批完成后的库存变动
 */
const handleStockUpdate = async (
  businessType: string,
  businessId: string,
  operatorName?: string
) => {
  try {
    // 采购申请完成后入库
    if (businessType === "purchase_request") {
      const { data: items } = await dataAdapter.getPurchaseRequestItems(businessId);

      if (items) {
        for (const item of items) {
          if (!item.supply_id) continue;
          
          const { data: supply } = await dataAdapter.getOfficeSupplyById(item.supply_id);

          if (supply) {
            const beforeStock = supply.current_stock;
            const afterStock = beforeStock + item.quantity;
            
            await dataAdapter.updateOfficeSupply(item.supply_id, { current_stock: afterStock });

            await dataAdapter.createStockMovement({
              supply_id: item.supply_id,
              movement_type: "purchase_in",
              quantity: item.quantity,
              before_stock: beforeStock,
              after_stock: afterStock,
              reference_type: "purchase_request",
              reference_id: businessId,
              operator_name: operatorName || null,
              notes: `采购入库: ${item.item_name || supply.name}`,
            });
          }
        }
        console.log("Purchase request stock updated");
      }
    }

    // 办公采购完成后入库
    if (businessType === "supply_purchase") {
      const { data: items } = await dataAdapter.getSupplyPurchaseItemsById(businessId);

      if (items) {
        for (const item of items) {
          if (!item.supply_id) continue;
          
          const { data: supply } = await dataAdapter.getOfficeSupplyById(item.supply_id);

          if (supply) {
            const beforeStock = supply.current_stock;
            const afterStock = beforeStock + item.quantity;
            
            await dataAdapter.updateOfficeSupply(item.supply_id, { current_stock: afterStock });

            await dataAdapter.createStockMovement({
              supply_id: item.supply_id,
              movement_type: "purchase_in",
              quantity: item.quantity,
              before_stock: beforeStock,
              after_stock: afterStock,
              reference_type: "supply_purchase",
              reference_id: businessId,
              operator_name: operatorName || null,
              notes: `办公采购入库: ${item.item_name || supply.name}`,
            });
          }
        }
        console.log("Supply purchase stock updated");
      }
    }

    // 领用申请完成后出库
    if (businessType === "supply_requisition") {
      const { data: items } = await dataAdapter.getSupplyRequisitionItemsById(businessId);

      if (items) {
        for (const item of items) {
          const { data: supply } = await dataAdapter.getOfficeSupplyById(item.supply_id);

          if (supply) {
            const beforeStock = supply.current_stock;
            const afterStock = Math.max(0, beforeStock - item.quantity);
            
            await dataAdapter.updateOfficeSupply(item.supply_id, { current_stock: afterStock });

            await dataAdapter.createStockMovement({
              supply_id: item.supply_id,
              movement_type: "requisition_out",
              quantity: item.quantity,
              before_stock: beforeStock,
              after_stock: afterStock,
              reference_type: "supply_requisition",
              reference_id: businessId,
              operator_name: operatorName || null,
              notes: `领用出库: ${(item.office_supplies as any)?.name || supply.name}`,
            });
          }
        }
        console.log("Requisition stock updated");
      }
    }
  } catch (error) {
    console.error("Failed to update stock:", error);
  }
};

/**
 * 处理请假审批通过后的假期余额扣减
 */
const handleLeaveBalanceDeduction = async (
  businessType: string,
  businessId: string
) => {
  // 支持 "leave", "absence", 以及 "business_trip" 等可能包含请假的外出类型
  // 但实际扣减只针对 absence_records.type = 'leave' 的记录
  console.log(`handleLeaveBalanceDeduction called: businessType=${businessType}, businessId=${businessId}`);
  
  try {
    // 获取请假记录详情
    const { data: record, error: fetchError } = await dataAdapter.getAbsenceRecordForLeaveDeduction(businessId);
    
    if (fetchError) {
      console.error("Failed to fetch absence record:", fetchError);
      return;
    }
    
    console.log(`Fetched absence record:`, record);
    
    // 只有当是真正的请假类型（type = 'leave'）时才扣减
    if (record && record.type === 'leave' && record.leave_type && record.contact_id) {
      console.log(`Processing leave balance deduction for ${record.leave_type}: ${record.duration_days} days / ${record.duration_hours} hours`);
      
      // 调用扣减假期函数
      const { data, error } = await dataAdapter.deductLeaveBalance(
        record.contact_id,
        record.leave_type,
        record.duration_hours,
        record.duration_days
      );
      
      if (error) {
        console.error("Failed to deduct leave balance:", error);
      } else {
        console.log(`Leave balance deducted successfully for ${record.leave_type}, result:`, data);
      }
    } else if (record) {
      console.log(`Skipping leave balance deduction - not a leave record (type: ${record.type}, leave_type: ${record.leave_type})`);
    } else {
      console.log(`No absence record found for businessId: ${businessId}`);
    }
  } catch (error) {
    console.error("Failed to handle leave balance deduction:", error);
  }
};

/**
 * 更新业务表状态和联系人状态
 */
const updateBusinessAndContactStatus = async (
  businessType: string,
  businessId: string,
  newStatus: "approved" | "rejected" | "completed"
) => {
  try {
    // 对于 absence 类型（外出、请假、出差），需要获取实际的 type
    let actualType = businessType;
    
    if (businessType === "absence" || ["business_trip", "leave", "out"].includes(businessType)) {
      // 获取业务记录确定实际类型
      const { data: record } = await dataAdapter.getAbsenceRecordContactId(businessId);
      
      if (record?.contact_id) {
        // 更新业务记录状态
        const { error: updateError } = await dataAdapter.updateAbsenceRecord(businessId, { 
          status: newStatus, 
          approved_at: formatLocalNow() 
        });
        
        if (updateError) {
          console.error("Failed to update absence record status:", updateError);
        } else {
          console.log(`Updated absence record ${businessId} status to ${newStatus}`);
        }
        
        // 审批通过时更新联系人状态
        if (newStatus === "approved") {
          // 需要获取 absence_records.type 来确定联系人状态
          const { data: absenceRecord } = await dataAdapter.getAbsenceRecordForLeaveDeduction(businessId);
          if (absenceRecord) {
            actualType = absenceRecord.type || businessType;
          }
          
          const contactStatus = businessTypeToContactStatus[actualType] || "on_duty";
          await dataAdapter.updateContact(record.contact_id, { status: contactStatus });
          console.log(`Updated contact ${record.contact_id} status to ${contactStatus}`);
        }
      }
    } else if (businessType === "supply_purchase") {
      const { error } = await dataAdapter.updateSupplyPurchase(businessId, {
        status: newStatus,
        approved_at: formatLocalNow(),
      });
      if (error) {
        console.error("Failed to update supply_purchase status:", error);
      } else {
        console.log(`Updated supply_purchase ${businessId} status to ${newStatus}`);
      }
    } else if (businessType === "purchase_request") {
      const { error } = await dataAdapter.updatePurchaseRequest(businessId, {
        status: newStatus,
        approved_at: formatLocalNow(),
      });
      if (error) {
        console.error("Failed to update purchase_request status:", error);
      } else {
        console.log(`Updated purchase_request ${businessId} status to ${newStatus}`);
      }
    } else if (businessType === "supply_requisition") {
      const { error } = await dataAdapter.updateSupplyRequisition(businessId, {
        status: newStatus,
        approved_at: formatLocalNow(),
      });
      if (error) {
        console.error("Failed to update supply_requisition status:", error);
      } else {
        console.log(`Updated supply_requisition ${businessId} status to ${newStatus}`);
      }
    }
  } catch (error) {
    console.error("Failed to update business/contact status:", error);
  }
};

/**
 * 审批流程推进服务
 * 负责在当前节点审批完成后推进到下一节点，以及处理退回和撤回操作
 */
export const useApprovalProgression = () => {

  /**
   * 根据发起人获取动态审批人（直接主管、部门负责人）
   */
  const resolveDynamicApprovers = async (approverType: string, initiatorId: string): Promise<string[]> => {
    if (approverType !== 'direct_supervisor' && approverType !== 'department_head') {
      return [];
    }
    
    try {
      const { data, error } = await dataAdapter.getOrganizationApprovers(initiatorId);
      if (error || !data) {
        console.warn(`Failed to get organization approvers for ${initiatorId}:`, error);
        return [];
      }
      
      if (approverType === 'direct_supervisor' && data.direct_supervisor_id) {
        return [data.direct_supervisor_id];
      }
      
      if (approverType === 'department_head' && data.department_head_id) {
        return [data.department_head_id];
      }
      
      return [];
    } catch (error) {
      console.error('Error resolving dynamic approvers:', error);
      return [];
    }
  };

  /**
   * 解析审批节点的实际审批人ID列表
   */
  const resolveNodeApproverIds = async (node: ApprovalNode, initiatorId: string): Promise<string[]> => {
    // 如果是动态审批人类型，先尝试解析
    if (node.approver_type === 'direct_supervisor' || node.approver_type === 'department_head') {
      const dynamicApprovers = await resolveDynamicApprovers(node.approver_type, initiatorId);
      if (dynamicApprovers.length > 0) {
        console.log(`Resolved ${node.approver_type} for initiator ${initiatorId}:`, dynamicApprovers);
        return dynamicApprovers;
      }
      console.warn(`Could not resolve ${node.approver_type} for initiator ${initiatorId}, falling back to static approvers`);
    }
    
    // 回退到静态配置的审批人
    return node.approver_ids || [];
  };

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
   */
  const checkNodeComplete = async (
    instanceId: string,
    nodeName: string,
    approvalMode: string = "countersign"
  ): Promise<{ complete: boolean; allApproved: boolean }> => {
    // 获取该节点所有审批记录，按创建时间倒序
    const { data: allRecords } = await dataAdapter.getApprovalRecordsByNodeName(instanceId, nodeName);

    if (!allRecords || allRecords.length === 0) {
      return { complete: false, allApproved: false };
    }

    // 获取每个审批人的最新记录
    const latestRecordsByApprover = new Map<string, { status: string; created_at: string }>();
    for (const record of allRecords) {
      if (!latestRecordsByApprover.has(record.approver_id)) {
        latestRecordsByApprover.set(record.approver_id, {
          status: record.status,
          created_at: record.created_at,
        });
      }
    }

    const latestRecords = Array.from(latestRecordsByApprover.values());
    const approvedCount = latestRecords.filter(r => r.status === "approved").length;
    const rejectedCount = latestRecords.filter(r => r.status === "rejected").length;
    const pendingCount = latestRecords.filter(r => r.status === "pending").length;
    const totalCount = latestRecords.length;

    if (approvalMode === "or_sign") {
      if (approvedCount > 0) {
        return { complete: true, allApproved: true };
      }
      if (rejectedCount > 0) {
        return { complete: true, allApproved: false };
      }
      return { complete: false, allApproved: false };
    } else {
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
      await dataAdapter.createApprovalRecord({
        instance_id: instanceId,
        node_index: nodeIndex,
        node_name: node.node_name,
        node_type: "cc",
        approver_id: recipientId,
        status: "pending",
        comment: null,
      });

      await dataAdapter.createTodoItem({
        source: "internal",
        business_type: todoBusinessType,
        business_id: businessId,
        title: `[抄送] ${title}`,
        description: `${initiatorName} 发起的申请 - 抄送通知`,
        priority: "normal",
        status: "pending",
        process_result: "cc_notified",
        initiator_id: initiatorId,
        assignee_id: recipientId,
        approval_instance_id: instanceId,
        approval_version_number: versionNumber,
      });
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

      // 或签模式下，节点完成后清除同节点其他审批人的待办和审批记录
      if (approvalMode === "or_sign" && complete) {
        console.log("Or-sign node complete, clearing other pending records for node:", currentNodeName);
        
        // 批量更新同节点其他待处理的审批记录为"已跳过"
        await dataAdapter.updateApprovalRecordsByNodeName(instanceId, currentNodeName, "pending", {
          status: "approved",
          comment: "或签节点已由其他审批人完成",
          processed_at: formatLocalNow(),
        });
        
        // 批量更新同节点其他待处理的待办为"已完成"
        await dataAdapter.updateTodosByNodeName(instanceId, currentNodeName, "pending", {
          status: "completed",
          process_result: "or_sign_skipped",
          processed_at: formatLocalNow(),
        });
      }

      if (!allApproved) {
        console.log("Node rejected, terminating workflow");
        await dataAdapter.updateApprovalInstance(instanceId, { 
          status: "rejected", 
          completed_at: formatLocalNow()
        });
        
        return { success: true, completed: true };
      }

      // 递归推进到下一个审批节点
      let nextIndex = currentIndex + 1;
      
      while (nextIndex < flatNodes.length) {
        const nextNode = flatNodes[nextIndex];
        
        if (nextNode.node_type === "cc") {
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
          break;
        }
      }
      
      if (nextIndex >= flatNodes.length) {
        console.log("No more nodes, workflow completed");
        await dataAdapter.updateApprovalInstance(instanceId, { 
          status: "approved", 
          completed_at: formatLocalNow(),
          current_node_index: flatNodes.length - 1,
        });
        
        await updateBusinessAndContactStatus(businessType, businessId, "approved");
        await handleStockUpdate(businessType, businessId, initiatorName);
        await handleLeaveBalanceDeduction(businessType, businessId);
        
        return { success: true, completed: true };
      }

      const nextNode = flatNodes[nextIndex];
      
      console.log("Advancing to next approver node:", nextNode.node_name, "at index:", nextIndex);
      
      await dataAdapter.updateApprovalInstance(instanceId, { current_node_index: nextIndex });

      // 使用动态解析审批人（支持直接主管、部门负责人等）
      const approverIds = await resolveNodeApproverIds(nextNode, initiatorId);
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";

      console.log("Creating todos for approvers:", approverIds, "approver_type:", nextNode.approver_type);

      if (approverIds.length === 0) {
        console.warn("No approvers resolved for node, skipping to next node");
        // 如果没有审批人，递归推进到下一个节点
        return advanceToNextNode(
          instanceId,
          businessId,
          businessType,
          initiatorId,
          initiatorName,
          title,
          nodesSnapshot,
          formData,
          versionNumber,
          nextNode.node_name
        );
      }

      for (const approverId of approverIds) {
        const { error: recordError } = await dataAdapter.createApprovalRecord({
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

        const { error: todoError } = await dataAdapter.createTodoItem({
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

      const { data: currentInstance } = await dataAdapter.getApprovalInstanceById(instanceId);

      const updatedFormData = {
        ...(currentInstance?.form_data as Record<string, any> || {}),
        _return_info: {
          type: "return_to_initiator_current",
          return_node_index: currentNodeIndex,
          comment,
          returned_at: formatLocalNow(),
        }
      };

      await dataAdapter.updateApprovalInstance(instanceId, { 
        status: "pending",
        form_data: updatedFormData,
      });

      const { error: todoError } = await dataAdapter.createTodoItem({
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

      const { data: currentInstance } = await dataAdapter.getApprovalInstanceById(instanceId);

      const updatedFormData = {
        ...(currentInstance?.form_data as Record<string, any> || {}),
        _return_info: {
          type: "return_restart",
          comment,
          returned_at: formatLocalNow(),
        }
      };

      await dataAdapter.updateApprovalInstance(instanceId, { 
        status: "pending",
        current_node_index: 0,
        form_data: updatedFormData,
      });

      const { error: todoError } = await dataAdapter.createTodoItem({
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
      const flatNodes = flattenNodesForExecution(nodesSnapshot, formData);
      
      if (currentNodeIndex <= 0) {
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

      await dataAdapter.updateApprovalInstance(instanceId, { 
        status: "pending",
        current_node_index: previousNodeIndex,
      });

      const approverIds = previousNode.approver_ids || [];
      
      for (const approverId of approverIds) {
        const { error: recordError } = await dataAdapter.createApprovalRecord({
          instance_id: instanceId,
          node_index: previousNodeIndex,
          node_name: previousNode.node_name,
          node_type: previousNode.node_type,
          approver_id: approverId,
          status: "pending",
        });

        if (recordError) {
          console.error("Failed to create approval record for previous node:", recordError);
        }

        const { error: todoError } = await dataAdapter.createTodoItem({
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
   */
  const withdrawApplication = async (
    instanceId: string,
    initiatorId: string,
    currentUserId: string
  ): Promise<{ success: boolean; canWithdraw: boolean; error?: string }> => {
    try {
      const { data: instance } = await dataAdapter.getApprovalInstanceById(instanceId);

      if (!instance) {
        return { success: false, canWithdraw: false, error: "找不到审批实例" };
      }

      if (instance.initiator_id !== currentUserId) {
        return { success: false, canWithdraw: false, error: "只有发起人可以撤回申请" };
      }

      if (instance.status !== "pending") {
        return { success: false, canWithdraw: false, error: "当前状态不允许撤回" };
      }

      const { data: records } = await dataAdapter.getApprovalRecordsByInstance(instanceId);

      const currentNodeRecords = records?.filter(r => r.node_index === instance.current_node_index);
      const hasProcessed = currentNodeRecords?.some(r => r.status === "approved" || r.status === "rejected");
      
      if (hasProcessed) {
        return { success: false, canWithdraw: false, error: "当前节点已有人审批，无法撤回" };
      }

      await dataAdapter.updateApprovalInstance(instanceId, { 
        status: "cancelled",
        completed_at: formatLocalNow(),
      });

      await dataAdapter.updateTodosByInstanceId(instanceId, "pending", { 
        status: "completed",
        process_result: "withdrawn",
        process_notes: "发起人已撤回申请",
        processed_at: formatLocalNow(),
      });

      await dataAdapter.updateApprovalRecordsByInstanceId(instanceId, "pending", { 
        status: "approved",
        comment: "发起人已撤回申请",
        processed_at: formatLocalNow(),
      });

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
      const { data: instance } = await dataAdapter.getApprovalInstanceById(instanceId);

      if (!instance || instance.initiator_id !== currentUserId) {
        return false;
      }

      if (instance.status !== "pending") {
        return false;
      }

      const { data: records } = await dataAdapter.getApprovalRecordsByInstance(instanceId);

      const currentNodeRecords = records?.filter(r => r.node_index === instance.current_node_index);
      const hasProcessed = currentNodeRecords?.some(r => r.status === "approved" || r.status === "rejected");
      
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
    const { data } = await dataAdapter.getContactById(initiatorId);
    return data;
  };

  /**
   * 发起人重新提交被退回的申请
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
      const { data: instanceData } = await dataAdapter.getApprovalInstanceById(instanceId);

      if (!instanceData) {
        return { success: false, error: "找不到审批实例" };
      }

      const returnInfo = (instanceData.form_data as any)?._return_info;
      if (!returnInfo) {
        return { success: false, error: "找不到退回信息" };
      }

      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";
      const flatNodes = flattenNodesForExecution(nodesSnapshot, formData);

      let startNodeIndex: number;
      if (returnInfo.type === "return_restart") {
        startNodeIndex = 0;
      } else {
        startNodeIndex = returnInfo.return_node_index || 0;
      }

      const startNode = flatNodes[startNodeIndex];
      if (!startNode) {
        return { success: false, error: "找不到起始审批节点" };
      }

      const updatedFormData = { ...formData };
      delete updatedFormData._return_info;

      await dataAdapter.updateApprovalInstance(instanceId, {
        status: "pending",
        current_node_index: startNodeIndex,
        form_data: updatedFormData,
      });

      await dataAdapter.updateTodoItem(todoItemId, {
        status: "completed",
        process_result: "resubmitted",
        processed_at: formatLocalNow(),
      });

      const approverIds = startNode.approver_ids || [];
      
      for (const approverId of approverIds) {
        await dataAdapter.createApprovalRecord({
          instance_id: instanceId,
          node_index: startNodeIndex,
          node_name: startNode.node_name,
          node_type: startNode.node_type,
          approver_id: approverId,
          status: "pending",
        });

        await dataAdapter.createTodoItem({
          source: "internal",
          business_type: todoBusinessType,
          business_id: businessId,
          title: title.replace(/^\[需修改(-重审)?\]\s*/, ""),
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
