// 统一数据适配器 - 自动切换 Supabase（在线）和本地 API（离线）
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "./offlineApi";

// 获取 API 基础地址
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).GOV_CONFIG?.API_BASE_URL) {
    return (window as any).GOV_CONFIG.API_BASE_URL;
  }
  return 'http://localhost:3001';
};

// 通用离线请求方法
async function offlineRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error);
    return { data: null, error: error as Error };
  }
}

// ==================== Office Supplies ====================

export async function getOfficeSupplies(params?: { is_active?: boolean }) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    const query = searchParams.toString();
    return offlineRequest<any[]>(`/api/office-supplies${query ? `?${query}` : ''}`);
  }
  
  let query = supabase.from("office_supplies").select("*");
  if (params?.is_active !== undefined) query = query.eq("is_active", params.is_active);
  const { data, error } = await query.order("name");
  return { data, error };
}

// ==================== Schedules ====================

export async function getSchedules(params: {
  contact_id: string;
  start_date: string;
  end_date: string;
}) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('contact_id', params.contact_id);
    searchParams.set('start_date', params.start_date);
    searchParams.set('end_date', params.end_date);
    return offlineRequest<any[]>(`/api/schedules?${searchParams.toString()}`);
  }
  
  const { data, error } = await supabase
    .from("schedules")
    .select("*, contact:contacts(id, name, department)")
    .eq("contact_id", params.contact_id)
    .gte("schedule_date", params.start_date)
    .lte("schedule_date", params.end_date)
    .order("schedule_date")
    .order("start_time");
  return { data, error };
}

export async function createSchedule(schedule: {
  contact_id: string;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  notes?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean; id: string }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  }
  
  const { data, error } = await supabase.from("schedules").insert(schedule).select("id").single();
  return { data, error };
}

export async function updateSchedule(id: string, updates: {
  title?: string;
  schedule_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string | null;
  notes?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { data, error } = await supabase.from("schedules").update(updates).eq("id", id);
  return { data, error };
}

export async function deleteSchedule(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  return { data: null, error };
}

// ==================== Supply Requisitions ====================

export async function getSupplyRequisitions(params: { requisition_by: string }) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/supply-requisitions?requisition_by=${encodeURIComponent(params.requisition_by)}`);
  }
  
  const { data, error } = await supabase
    .from("supply_requisitions")
    .select("id, requisition_by, requisition_date, status, created_at")
    .eq("requisition_by", params.requisition_by)
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function createSupplyRequisition(requisition: {
  requisition_by: string;
  requisition_date: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/supply-requisitions', {
      method: 'POST',
      body: JSON.stringify(requisition),
    });
  }
  
  const { data, error } = await supabase
    .from("supply_requisitions")
    .insert({ ...requisition, supply_id: null, quantity: null } as any)
    .select("id")
    .single();
  return { data, error };
}

export async function getSupplyRequisitionItems(requisitionId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/supply-requisition-items?requisition_id=${requisitionId}`);
  }
  
  const { data, error } = await supabase
    .from("supply_requisition_items")
    .select(`id, supply_id, quantity, office_supplies (name, specification, unit)`)
    .eq("requisition_id", requisitionId);
  return { data, error };
}

export async function createSupplyRequisitionItems(items: Array<{
  requisition_id: string;
  supply_id: string;
  quantity: number;
}>) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>('/api/supply-requisition-items', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }
  
  const { error } = await supabase.from("supply_requisition_items").insert(items);
  return { data: null, error };
}

// ==================== Supply Purchases ====================

export async function getSupplyPurchases(params: { applicant_name: string }) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/supply-purchases?applicant_name=${encodeURIComponent(params.applicant_name)}`);
  }
  
  const { data, error } = await supabase
    .from("supply_purchases")
    .select("*")
    .eq("applicant_name", params.applicant_name)
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function createSupplyPurchase(purchase: {
  department: string;
  purchase_date: string;
  reason?: string | null;
  total_amount: number;
  applicant_id: string;
  applicant_name: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/supply-purchases', {
      method: 'POST',
      body: JSON.stringify(purchase),
    });
  }
  
  const { data, error } = await supabase
    .from("supply_purchases")
    .insert(purchase)
    .select("id")
    .single();
  return { data, error };
}

export async function getSupplyPurchaseItems(purchaseId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/supply-purchase-items?purchase_id=${purchaseId}`);
  }
  
  const { data, error } = await supabase
    .from("supply_purchase_items")
    .select("*")
    .eq("purchase_id", purchaseId);
  return { data, error };
}

export async function createSupplyPurchaseItems(items: Array<{
  purchase_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks?: string | null;
}>) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>('/api/supply-purchase-items', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }
  
  const { error } = await supabase.from("supply_purchase_items").insert(items);
  return { data: null, error };
}

// ==================== Purchase Requests (采购申请) ====================

export async function getPurchaseRequests(params: { requested_by: string }) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/purchase-requests?requested_by=${encodeURIComponent(params.requested_by)}`);
  }
  
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*, purchase_request_items(*)")
    .eq("requested_by", params.requested_by)
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function createPurchaseRequest(request: {
  requested_by: string;
  purchase_date: string;
  purpose?: string | null;
  department?: string | null;
  funding_source?: string | null;
  funding_detail?: string | null;
  budget_amount?: number | null;
  procurement_method?: string | null;
  expected_completion_date?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
  
  const { data, error } = await supabase
    .from("purchase_requests")
    .insert({ ...request, supply_id: null, quantity: null, unit_price: null } as any)
    .select("id")
    .single();
  return { data, error };
}

export async function getPurchaseRequestItems(requestId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/purchase-request-items?request_id=${requestId}`);
  }
  
  const { data, error } = await supabase
    .from("purchase_request_items")
    .select("*, office_supplies(name, specification, unit)")
    .eq("request_id", requestId);
  return { data, error };
}

export async function createPurchaseRequestItems(items: Array<{
  request_id: string;
  supply_id?: string | null;
  item_name?: string | null;
  specification?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  category_link?: string | null;
  remarks?: string | null;
}>) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>('/api/purchase-request-items', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }
  
  const { error } = await supabase.from("purchase_request_items").insert(items);
  return { data: null, error };
}

// ==================== Canteen Menus ====================

export async function getCanteenMenus() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/canteen-menus');
  }
  
  const { data, error } = await supabase
    .from("canteen_menus")
    .select("*")
    .order("day_of_week");
  return { data, error };
}

export async function updateCanteenMenu(id: string, updates: {
  breakfast?: string[];
  lunch?: string[];
  dinner?: string[];
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/canteen-menus/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase.from("canteen_menus").update(updates).eq("id", id);
  return { data: null, error };
}

export async function createCanteenMenu(menu: {
  day_of_week: number;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean; id: string }>('/api/canteen-menus', {
      method: 'POST',
      body: JSON.stringify(menu),
    });
  }
  
  const { error } = await supabase.from("canteen_menus").insert(menu);
  return { data: null, error };
}

// 导出统一接口
export const dataAdapter = {
  // Office Supplies
  getOfficeSupplies,
  // Schedules
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  // Supply Requisitions
  getSupplyRequisitions,
  createSupplyRequisition,
  getSupplyRequisitionItems,
  createSupplyRequisitionItems,
  // Supply Purchases
  getSupplyPurchases,
  createSupplyPurchase,
  getSupplyPurchaseItems,
  createSupplyPurchaseItems,
  // Purchase Requests
  getPurchaseRequests,
  createPurchaseRequest,
  getPurchaseRequestItems,
  createPurchaseRequestItems,
  // Canteen Menus
  getCanteenMenus,
  updateCanteenMenu,
  createCanteenMenu,
  // Utilities
  isOfflineMode,
};

export default dataAdapter;
