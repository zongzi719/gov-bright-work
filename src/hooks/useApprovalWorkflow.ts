import * as dataAdapter from "@/lib/dataAdapter";
import type { Database } from "@/integrations/supabase/types";

type TodoBusinessType = Database["public"]["Enums"]["todo_business_type"];

interface ApprovalNode {
  id: string;
  node_type: string;
  node_name: string;
  approver_type: string;
  approver_ids: string[] | null;
  condition_expression?: unknown;
  sort_order: number;
}

interface ProcessVersion {
  id: string;
  version_number: number;
  nodes_snapshot: ApprovalNode[];
}

interface ApprovalTemplate {
  id: string;
  code: string;
  business_type: string;
}

interface StartApprovalParams {
  businessType: string;      // business_trip, leave, out, supply_requisition, purchase_request
  businessId: string;        // 业务记录ID
  initiatorId: string;       // 发起人ID
  initiatorName: string;     // 发起人姓名
  title: string;             // 待办标题
  formData?: Record<string, unknown>; // 表单数据快照
}

interface StartApprovalResult {
  success: boolean;
  instanceId?: string;
  error?: string;
}

// 业务类型映射到待办业务类型
const businessTypeToTodoType: Record<string, TodoBusinessType> = {
  business_trip: "business_trip",
  leave: "absence",
  out: "absence",
  supply_requisition: "supply_requisition",
  purchase_request: "purchase_request",
  supply_purchase: "supply_purchase",
  custom_approval: "custom_approval",
};

// 内置业务类型
const BUILTIN_BUSINESS_TYPES = [
  "business_trip", "leave", "out",
  "supply_requisition", "purchase_request", "supply_purchase",
  "absence", "external_approval",
];

// 解析业务类型到待办类型（自定义类型使用 custom_approval）
const resolveTodoBusinessType = (businessType: string): TodoBusinessType => {
  if (businessTypeToTodoType[businessType]) {
    return businessTypeToTodoType[businessType];
  }
  return "custom_approval";
};

/**
 * 审批工作流服务
 * 负责启动审批流程、创建审批实例、生成待办事项
 */
export const useApprovalWorkflow = () => {

  /**
   * 根据发起人获取动态审批人（直接主管、部门负责人）
   */
  /**
   * 判断是否为直属主管类型（支持多种别名）
   */
  const isDirectSupervisorType = (approverType: string): boolean => {
    return approverType === 'direct_supervisor' || approverType === 'supervisor';
  };

  /**
   * 根据发起人获取动态审批人（直接主管、部门负责人）
   */
  const resolveDynamicApprovers = async (approverType: string, initiatorId: string): Promise<string[]> => {
    // 支持 supervisor 作为 direct_supervisor 的别名
    const isSupervisor = isDirectSupervisorType(approverType);
    const isDeptHead = approverType === 'department_head';
    
    if (!isSupervisor && !isDeptHead) {
      return [];
    }
    
    try {
      const { data, error } = await dataAdapter.getOrganizationApprovers(initiatorId);
      if (error || !data) {
        console.warn(`Failed to get organization approvers for ${initiatorId}:`, error);
        return [];
      }
      
      if (isSupervisor && data.direct_supervisor_id) {
        console.log(`Resolved supervisor (type: ${approverType}) for initiator ${initiatorId}: ${data.direct_supervisor_id}`);
        return [data.direct_supervisor_id];
      }
      
      if (isDeptHead && data.department_head_id) {
        console.log(`Resolved department_head for initiator ${initiatorId}: ${data.department_head_id}`);
        return [data.department_head_id];
      }
      
      return [];
    } catch (error) {
      console.error('Error resolving dynamic approvers:', error);
      return [];
    }
  };

  /**
   * 根据业务类型查找对应的审批模版
   */
  const findTemplateByBusinessType = async (businessType: string): Promise<ApprovalTemplate | null> => {
    const { data, error } = await dataAdapter.getApprovalTemplates();

    if (error || !data) {
      console.error("Failed to find template:", error);
      return null;
    }
    
    const template = data.find((t: any) => t.business_type === businessType && t.is_active !== false);
    return template || null;
  };

  /**
   * 获取模版的最新发布版本
   */
  const getLatestPublishedVersion = async (templateId: string): Promise<ProcessVersion | null> => {
    const { data, error } = await dataAdapter.getApprovalProcessVersions(templateId, true);

    if (error) {
      console.error("Failed to get latest version:", error);
      return null;
    }
    
    if (data && !Array.isArray(data) && data.id) {
      return {
        id: data.id,
        version_number: data.version_number,
        nodes_snapshot: (data.nodes_snapshot as unknown) as ApprovalNode[]
      };
    }
    return null;
  };

  /**
   * 评估条件表达式
   */
  const evaluateCondition = (conditionExpression: any, formData: Record<string, unknown>): boolean => {
    if (!conditionExpression) return true;
    
    const groups = conditionExpression.condition_groups || conditionExpression.groups || [];
    if (groups.length === 0) return true;
    
    return groups.some((group: any) => {
      const conditions = group.conditions || [];
      if (conditions.length === 0) return true;
      
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
          default:
            return true;
        }
      });
    });
  };

  /**
   * 扁平化节点列表（根据条件表达式过滤分支）- 与 useApprovalProgression 保持一致
   */
  const flattenNodesForExecution = (nodes: ApprovalNode[], formData: Record<string, unknown>): ApprovalNode[] => {
    const result: ApprovalNode[] = [];
    
    const sortedNodes = [...nodes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    const nodeMap = new Map<string, ApprovalNode>();
    sortedNodes.forEach(node => nodeMap.set(node.id, node));
    
    const branchChildNodeIds = new Set<string>();
    sortedNodes.forEach(node => {
      if (node.node_type === "condition_branch" && (node.condition_expression as any)?.child_nodes) {
        ((node.condition_expression as any).child_nodes as string[]).forEach((id: string) => branchChildNodeIds.add(id));
      }
    });
    
    for (const node of sortedNodes) {
      if (node.node_type === "condition") {
        const branchIds = (node.condition_expression as any)?.branches || [];
        
        for (const branchId of branchIds) {
          const branch = nodeMap.get(branchId);
          if (!branch) continue;
          
          if (evaluateCondition(branch.condition_expression, formData)) {
            const childNodeIds = (branch.condition_expression as any)?.child_nodes || [];
            for (const childId of childNodeIds) {
              const childNode = nodeMap.get(childId);
              if (childNode && (childNode.node_type === "approver" || childNode.node_type === "cc")) {
                result.push(childNode);
              }
            }
            break;
          }
        }
      } else if (node.node_type === "condition_branch") {
        continue;
      } else if (node.node_type === "approver" || node.node_type === "cc") {
        if (!branchChildNodeIds.has(node.id)) {
          result.push(node);
        }
      }
    }
    
    return result;
  };

  /**
   * 找到第一个审批节点（跳过CC节点）- 同步版本，只检查节点配置
   */
  const findFirstApproverNode = (nodes: ApprovalNode[], formData: Record<string, unknown>): { node: ApprovalNode; index: number } | null => {
    const flatNodes = flattenNodesForExecution(nodes, formData);
    
    for (let i = 0; i < flatNodes.length; i++) {
      const node = flatNodes[i];
      // 跳过CC节点，只找审批节点
      // 支持指定审批人或动态类型（直接主管/supervisor、部门负责人）
      if (node.node_type === "approver") {
        const hasStaticApprovers = node.approver_ids && node.approver_ids.length > 0;
        const isDynamicType = isDirectSupervisorType(node.approver_type) || node.approver_type === 'department_head';
        
        if (hasStaticApprovers || isDynamicType) {
          console.log(`findFirstApproverNode: Found approver node "${node.node_name}" at index ${i}, type=${node.approver_type}, hasStatic=${hasStaticApprovers}, isDynamic=${isDynamicType}`);
          return { node, index: i };
        }
      }
    }
    return null;
  };

  /**
   * 解析审批节点的实际审批人ID列表
   */
  const resolveNodeApproverIds = async (node: ApprovalNode, initiatorId: string): Promise<string[]> => {
    // 如果是动态审批人类型，先尝试解析（支持 supervisor 作为 direct_supervisor 的别名）
    const isDynamicType = isDirectSupervisorType(node.approver_type) || node.approver_type === 'department_head';
    
    if (isDynamicType) {
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
   * 处理启动时的抄送节点 - 创建只读通知
   */
  const processInitialCCNodes = async (
    instanceId: string,
    businessId: string,
    businessType: string,
    initiatorId: string,
    initiatorName: string,
    title: string,
    nodes: ApprovalNode[],
    formData: Record<string, unknown>,
    versionNumber: number,
    firstApproverIndex: number
  ): Promise<void> => {
    const flatNodes = flattenNodesForExecution(nodes, formData);
    const todoBusinessType = businessTypeToTodoType[businessType] || "absence";
    
    // 处理第一个审批节点之前的所有CC节点
    for (let i = 0; i < firstApproverIndex; i++) {
      const node = flatNodes[i];
      if (node.node_type === "cc") {
        const ccRecipientIds = node.approver_ids || [];
        console.log(`Processing initial CC node "${node.node_name}" for recipients:`, ccRecipientIds);
        
        for (const recipientId of ccRecipientIds) {
          // 创建审批记录（状态设为 pending 表示未阅）
          await dataAdapter.createApprovalRecord({
            instance_id: instanceId,
            node_index: i,
            node_name: node.node_name,
            node_type: "cc",
            approver_id: recipientId,
            status: "pending",
            comment: null,
          });

          // 创建待办通知（状态设为 pending，表示未阅）
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
      }
    }
  };

  /**
   * 启动审批流程
   */
  const startApproval = async (params: StartApprovalParams): Promise<StartApprovalResult> => {
    const { businessType, businessId, initiatorId, initiatorName, title, formData } = params;

    try {
      // 1. 查找对应的审批模版
      const template = await findTemplateByBusinessType(businessType);
      if (!template) {
        console.log(`No active template found for business type: ${businessType}`);
        // 如果没有配置审批模版，不阻止业务提交
        return { success: true };
      }

      // 2. 获取最新发布的版本
      const version = await getLatestPublishedVersion(template.id);
      if (!version) {
        console.log(`No published version found for template: ${template.id}`);
        return { success: true };
      }

      // 3. 找到第一个审批节点（使用扁平化后的索引）
      const firstNodeResult = findFirstApproverNode(version.nodes_snapshot, formData || {});
      if (!firstNodeResult) {
        console.log("No approver node found in workflow");
        return { success: true };
      }

      const { node: firstNode, index: firstNodeIndex } = firstNodeResult;

      console.log("Starting approval workflow, first node:", firstNode.node_name, "at index:", firstNodeIndex);

      // 4. 创建审批实例
      const { data: instance, error: instanceError } = await dataAdapter.createApprovalInstance({
        template_id: template.id,
        version_id: version.id,
        version_number: version.version_number,
        business_type: businessType,
        business_id: businessId,
        initiator_id: initiatorId,
        status: "pending",
        current_node_index: firstNodeIndex,
        form_data: formData || {},
      });

      if (instanceError || !instance) {
        console.error("Failed to create approval instance:", instanceError);
        return { success: false, error: "创建审批实例失败" };
      }

      // 5. 处理第一个审批节点之前的CC节点
      if (firstNodeIndex > 0) {
        await processInitialCCNodes(
          instance.id,
          businessId,
          businessType,
          initiatorId,
          initiatorName,
          title,
          version.nodes_snapshot,
          formData || {},
          version.version_number,
          firstNodeIndex
        );
      }

      // 6. 为第一个审批节点的所有审批人创建审批记录和待办
      // 使用动态解析审批人（支持直接主管、部门负责人等）
      const approverIds = await resolveNodeApproverIds(firstNode, initiatorId);
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";
      
      console.log("First approver node:", firstNode.node_name, "approver_type:", firstNode.approver_type, "resolved approver_ids:", approverIds);
      
      // 如果没有配置审批人，流程也应该能启动成功（后续可手动分配或跳过）
      if (approverIds.length === 0) {
        console.warn("No approvers configured/resolved for first node, approval may need manual assignment");
        return { success: true, instanceId: instance.id };
      }
      
      for (const approverId of approverIds) {
        // 跳过无效的审批人 ID
        if (!approverId || approverId === "") {
          console.warn("Skipping empty approver_id");
          continue;
        }
        
        // 创建审批记录
        const { data: recordData, error: recordError } = await dataAdapter.createApprovalRecord({
          instance_id: instance.id,
          node_index: firstNodeIndex,
          node_name: firstNode.node_name,
          node_type: firstNode.node_type,
          approver_id: approverId,
          status: "pending",
        });

        if (recordError) {
          console.error("Failed to create approval record:", recordError);
          // 不要因为单个记录失败而中断整个流程
          continue;
        }

        // 创建待办事项
        const { error: todoError } = await dataAdapter.createTodoItem({
          source: "internal",
          business_type: todoBusinessType,
          business_id: businessId,
          title: title,
          description: `${initiatorName} 发起的${getBusinessTypeLabel(businessType)}申请`,
          priority: "normal",
          status: "pending",
          initiator_id: initiatorId,
          assignee_id: approverId,
          approval_instance_id: instance.id,
          approval_version_number: version.version_number,
        });

        if (todoError) {
          console.error("Failed to create todo item:", todoError);
        }
      }

      return { success: true, instanceId: instance.id };

    } catch (error) {
      console.error("Error starting approval:", error);
      return { success: false, error: "启动审批流程失败" };
    }
  };

  /**
   * 获取业务类型的中文标签
   */
  const getBusinessTypeLabel = (businessType: string): string => {
    const labels: Record<string, string> = {
      business_trip: "出差",
      leave: "请假",
      out: "外出",
      supply_requisition: "领用",
      purchase_request: "采购",
      supply_purchase: "办公采购",
    };
    return labels[businessType] || businessType;
  };

  return {
    startApproval,
    findTemplateByBusinessType,
    getLatestPublishedVersion,
    getBusinessTypeLabel,
  };
};
