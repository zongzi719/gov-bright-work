import { supabase } from "@/integrations/supabase/client";

interface StockMovementRecord {
  supply_id: string;
  movement_type: "purchase_in" | "requisition_out" | "adjustment";
  quantity: number;
  reference_type: string;
  reference_id: string;
  operator_name?: string;
  notes?: string;
}

/**
 * 库存管理 Hook
 * 处理采购入库和领用出库的库存变动
 */
export const useStockManagement = () => {
  /**
   * 更新库存并记录变动明细
   */
  const updateStock = async (
    records: StockMovementRecord[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      for (const record of records) {
        // 获取当前库存
        const { data: supply, error: fetchError } = await supabase
          .from("office_supplies")
          .select("id, current_stock, name")
          .eq("id", record.supply_id)
          .single();

        if (fetchError || !supply) {
          console.error("Failed to fetch supply:", fetchError);
          continue;
        }

        const beforeStock = supply.current_stock;
        let afterStock = beforeStock;

        if (record.movement_type === "purchase_in") {
          afterStock = beforeStock + record.quantity;
        } else if (record.movement_type === "requisition_out") {
          afterStock = Math.max(0, beforeStock - record.quantity);
        }

        // 更新库存
        const { error: updateError } = await supabase
          .from("office_supplies")
          .update({ current_stock: afterStock })
          .eq("id", record.supply_id);

        if (updateError) {
          console.error("Failed to update stock:", updateError);
          return { success: false, error: `更新 ${supply.name} 库存失败` };
        }

        // 记录库存变动
        const { error: movementError } = await supabase
          .from("stock_movements")
          .insert({
            supply_id: record.supply_id,
            movement_type: record.movement_type,
            quantity: record.quantity,
            before_stock: beforeStock,
            after_stock: afterStock,
            reference_type: record.reference_type,
            reference_id: record.reference_id,
            operator_name: record.operator_name || null,
            notes: record.notes || null,
          });

        if (movementError) {
          console.error("Failed to record stock movement:", movementError);
          // 不阻断流程，继续处理
        }
      }

      return { success: true };
    } catch (error) {
      console.error("Stock management error:", error);
      return { success: false, error: "库存更新失败" };
    }
  };

  /**
   * 处理采购审批完成后的入库
   * @param referenceType - 业务类型: purchase_request | supply_purchase
   * @param referenceId - 业务ID
   * @param operatorName - 操作人姓名
   */
  const handlePurchaseComplete = async (
    referenceType: "purchase_request" | "supply_purchase",
    referenceId: string,
    operatorName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let items: { supply_id: string | null; quantity: number; item_name?: string }[] = [];

      if (referenceType === "purchase_request") {
        // 采购申请 - 从 purchase_request_items 获取
        const { data } = await supabase
          .from("purchase_request_items")
          .select("supply_id, quantity, item_name")
          .eq("request_id", referenceId);
        items = data || [];
      } else {
        // 办公采购 - 从 supply_purchase_items 获取
        const { data } = await supabase
          .from("supply_purchase_items")
          .select("supply_id, quantity, item_name")
          .eq("purchase_id", referenceId);
        items = data || [];
      }

      // 只处理有关联 supply_id 的物品
      const validItems = items.filter(item => item.supply_id);
      
      if (validItems.length === 0) {
        console.log("No stock items to update for this purchase");
        return { success: true };
      }

      const movements: StockMovementRecord[] = validItems.map(item => ({
        supply_id: item.supply_id!,
        movement_type: "purchase_in",
        quantity: item.quantity,
        reference_type: referenceType,
        reference_id: referenceId,
        operator_name: operatorName,
        notes: `采购入库: ${item.item_name || "物品"}`,
      }));

      return await updateStock(movements);
    } catch (error) {
      console.error("Handle purchase complete error:", error);
      return { success: false, error: "处理采购入库失败" };
    }
  };

  /**
   * 处理领用审批完成后的出库
   */
  const handleRequisitionComplete = async (
    referenceId: string,
    operatorName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 从 supply_requisition_items 获取领用物品
      const { data: items } = await supabase
        .from("supply_requisition_items")
        .select(`
          supply_id, 
          quantity,
          office_supplies (name)
        `)
        .eq("requisition_id", referenceId);

      if (!items || items.length === 0) {
        console.log("No stock items to update for this requisition");
        return { success: true };
      }

      const movements: StockMovementRecord[] = items.map(item => ({
        supply_id: item.supply_id,
        movement_type: "requisition_out" as const,
        quantity: item.quantity,
        reference_type: "supply_requisition",
        reference_id: referenceId,
        operator_name: operatorName,
        notes: `领用出库: ${(item.office_supplies as any)?.name || "物品"}`,
      }));

      return await updateStock(movements);
    } catch (error) {
      console.error("Handle requisition complete error:", error);
      return { success: false, error: "处理领用出库失败" };
    }
  };

  /**
   * 验证库存是否充足
   */
  const validateStock = async (
    items: { supply_id: string; quantity: number }[]
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    for (const item of items) {
      const { data: supply } = await supabase
        .from("office_supplies")
        .select("id, name, current_stock")
        .eq("id", item.supply_id)
        .single();

      if (!supply) {
        errors.push(`物品不存在`);
        continue;
      }

      if (item.quantity > supply.current_stock) {
        errors.push(`${supply.name} 库存不足，当前库存: ${supply.current_stock}，申请数量: ${item.quantity}`);
      }
    }

    return { valid: errors.length === 0, errors };
  };

  return {
    updateStock,
    handlePurchaseComplete,
    handleRequisitionComplete,
    validateStock,
  };
};
