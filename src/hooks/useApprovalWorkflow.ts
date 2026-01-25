import { supabase } from "@/integrations/supabase/client";
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
};

/**
 * 审批工作流服务
 * 负责启动审批流程、创建审批实例、生成待办事项
 */
export const useApprovalWorkflow = () => {

  /**
   * 根据业务类型查找对应的审批模版
   */
  const findTemplateByBusinessType = async (businessType: string): Promise<ApprovalTemplate | null> => {
    const { data, error } = await supabase
      .from("approval_templates")
      .select("id, code, business_type")
      .eq("business_type", businessType)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Failed to find template:", error);
      return null;
    }
    return data;
  };

  /**
   * 获取模版的最新发布版本
   */
  const getLatestPublishedVersion = async (templateId: string): Promise<ProcessVersion | null> => {
    const { data, error } = await supabase
      .from("approval_process_versions")
      .select("id, version_number, nodes_snapshot")
      .eq("template_id", templateId)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      console.error("Failed to get latest version:", error);
      return null;
    }
    
    if (data) {
      return {
        ...data,
        nodes_snapshot: (data.nodes_snapshot as unknown) as ApprovalNode[]
      };
    }
    return null;
  };

  /**
   * 找到第一个审批节点（跳过开始节点和条件节点）
   */
  const findFirstApproverNode = (nodes: ApprovalNode[]): ApprovalNode | null => {
    // 按 sort_order 排序
    const sortedNodes = [...nodes].sort((a, b) => a.sort_order - b.sort_order);
    
    // 找到第一个 approver 类型的节点
    for (const node of sortedNodes) {
      if (node.node_type === "approver" && node.approver_ids && node.approver_ids.length > 0) {
        return node;
      }
    }
    return null;
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

      // 3. 找到第一个审批节点
      const firstNode = findFirstApproverNode(version.nodes_snapshot);
      if (!firstNode) {
        console.log("No approver node found in workflow");
        return { success: true };
      }

      // 4. 创建审批实例
      const instanceInsert = {
        template_id: template.id,
        version_id: version.id,
        version_number: version.version_number,
        business_type: businessType,
        business_id: businessId,
        initiator_id: initiatorId,
        status: "pending" as const,
        current_node_index: firstNode.sort_order,
        form_data: formData || {},
      };

      const { data: instance, error: instanceError } = await supabase
        .from("approval_instances")
        .insert(instanceInsert as never)
        .select("id")
        .single();

      if (instanceError || !instance) {
        console.error("Failed to create approval instance:", instanceError);
        return { success: false, error: "创建审批实例失败" };
      }

      // 5. 为第一个节点的所有审批人创建审批记录和待办
      const approverIds = firstNode.approver_ids || [];
      const todoBusinessType = businessTypeToTodoType[businessType] || "absence";
      
      for (const approverId of approverIds) {
        // 创建审批记录
        const { error: recordError } = await supabase
          .from("approval_records")
          .insert({
            instance_id: instance.id,
            node_index: firstNode.sort_order,
            node_name: firstNode.node_name,
            node_type: firstNode.node_type,
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
