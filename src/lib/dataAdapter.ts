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

export async function getAllOfficeSupplies() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/office-supplies');
  }
  
  const { data, error } = await supabase
    .from("office_supplies")
    .select("*")
    .order("name");
  return { data, error };
}

export async function createOfficeSupply(supply: {
  name: string;
  specification?: string | null;
  unit: string;
  current_stock: number;
  min_stock: number;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/office-supplies', {
      method: 'POST',
      body: JSON.stringify(supply),
    });
  }
  
  const { data, error } = await supabase
    .from("office_supplies")
    .insert(supply)
    .select("id")
    .single();
  return { data, error };
}

export async function updateOfficeSupply(id: string, updates: {
  name?: string;
  specification?: string | null;
  unit?: string;
  current_stock?: number;
  min_stock?: number;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/office-supplies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("office_supplies")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
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

export async function getAllSchedules() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/schedules');
  }
  
  const { data, error } = await supabase
    .from("schedules")
    .select("*, contact:contacts(id, name, department, organization:organizations!contacts_organization_id_fkey(name))")
    .order("schedule_date", { ascending: false })
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

export async function getAllSupplyRequisitions() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/supply-requisitions');
  }
  
  const { data, error } = await supabase
    .from("supply_requisitions")
    .select("*, office_supplies(*)")
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

export async function createDirectSupplyRequisition(requisition: {
  supply_id: string;
  quantity: number;
  requisition_by: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/supply-requisitions', {
      method: 'POST',
      body: JSON.stringify(requisition),
    });
  }
  
  const { data, error } = await supabase
    .from("supply_requisitions")
    .insert(requisition as any)
    .select("id")
    .single();
  return { data, error };
}

export async function updateSupplyRequisition(id: string, updates: {
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  approved_at?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/supply-requisitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("supply_requisitions")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
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

export async function getAllSupplyPurchases() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/supply-purchases');
  }
  
  const { data, error } = await supabase
    .from("supply_purchases")
    .select("*")
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

export async function getAllPurchaseRequests() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/purchase-requests');
  }
  
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*, office_supplies(*)")
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

export async function createDirectPurchaseRequest(request: {
  supply_id: string;
  quantity: number;
  reason?: string | null;
  requested_by: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
  
  const { data, error } = await supabase
    .from("purchase_requests")
    .insert(request as any)
    .select("id")
    .single();
  return { data, error };
}

export async function updatePurchaseRequest(id: string, updates: {
  status?: 'pending' | 'approved' | 'rejected' | 'completed';
  approved_at?: string;
  completed_at?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/purchase-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("purchase_requests")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
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
    // 离线模式使用 /api/canteen-menus/id/:id 路径
    return offlineRequest<{ success: boolean }>(`/api/canteen-menus/id/${id}`, {
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

export async function deleteCanteenMenu(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/canteen-menus/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase.from("canteen_menus").delete().eq("id", id);
  return { data: null, error };
}

// ==================== Absence Records (请假/外出/出差) ====================

export async function getAbsenceRecords(params: {
  contact_id: string;
  type: 'out' | 'leave' | 'business_trip';
}) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('contact_id', params.contact_id);
    searchParams.set('type', params.type);
    return offlineRequest<any[]>(`/api/absence-records?${searchParams.toString()}`);
  }
  
  // 先获取缺勤记录
  const { data: absenceRecords, error } = await supabase
    .from("absence_records")
    .select(`
      *,
      contacts:contacts!absence_records_contact_id_fkey (
        name,
        department
      ),
      handover_person:contacts!absence_records_handover_person_id_fkey (
        name
      )
    `)
    .eq("type", params.type)
    .eq("contact_id", params.contact_id)
    .order("created_at", { ascending: false });
  
  if (error || !absenceRecords) {
    return { data: absenceRecords, error };
  }
  
  // 获取对应的审批实例状态
  const businessType = params.type === 'leave' ? 'leave' : params.type;
  const businessIds = absenceRecords.map(r => r.id);
  
  if (businessIds.length === 0) {
    return { data: absenceRecords, error: null };
  }
  
  const { data: instances } = await supabase
    .from("approval_instances")
    .select("business_id, status")
    .eq("business_type", businessType)
    .in("business_id", businessIds);
  
  // 合并审批实例状态到记录中
  const instanceMap = new Map<string, string>();
  instances?.forEach(inst => {
    instanceMap.set(inst.business_id, inst.status);
  });
  
  const mergedData = absenceRecords.map(record => ({
    ...record,
    // 使用审批实例的状态覆盖原始状态
    status: instanceMap.get(record.id) || record.status,
    // 保留原始业务状态
    _original_status: record.status,
  }));
  
  return { data: mergedData, error: null };
}

// 批量获取 absence_records（用于待办列表丰富显示）
export async function getAbsenceRecordsByIds(ids: string[]) {
  if (ids.length === 0) {
    return { data: [], error: null };
  }
  
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/absence-records/batch?ids=${ids.join(',')}`);
  }
  
  const { data, error } = await supabase
    .from("absence_records")
    .select(`
      id,
      reason,
      leave_type,
      type,
      contacts:contacts!absence_records_contact_id_fkey (
        name
      )
    `)
    .in("id", ids);
  return { data, error };
}

// 管理后台 - 获取所有某类型的缺勤记录（带联系人信息）
export async function getAdminAbsenceRecords(type: 'out' | 'leave' | 'business_trip') {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/admin/absence-records?type=${type}`);
  }
  
  const { data, error } = await supabase
    .from("absence_records")
    .select(`
      *,
      contacts:contacts!absence_records_contact_id_fkey (
        id,
        name,
        department,
        position,
        organization:organizations!contacts_organization_id_fkey (name)
      )
    `)
    .eq("type", type)
    .order("created_at", { ascending: false });
  return { data, error };
}

// 管理后台 - 获取审批实例状态（批量）
export async function getApprovalInstancesForAdmin(businessType: string, businessIds: string[]) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/admin/approval-instances?business_type=${businessType}&business_ids=${businessIds.join(',')}`);
  }
  
  const { data, error } = await supabase
    .from("approval_instances")
    .select("business_id, status, form_data")
    .eq("business_type", businessType)
    .in("business_id", businessIds);
  return { data, error };
}

// 管理后台 - 获取单个审批实例
export async function getApprovalInstanceForDetail(businessId: string, businessType: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/admin/approval-instance?business_id=${businessId}&business_type=${businessType}`);
  }
  
  const { data, error } = await supabase
    .from("approval_instances")
    .select("status, form_data")
    .eq("business_id", businessId)
    .eq("business_type", businessType)
    .maybeSingle();
  return { data, error };
}

// 管理后台 - 删除缺勤记录及相关审批数据
export async function deleteAbsenceRecordWithApproval(recordId: string, businessType: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/admin/absence-records/${recordId}?business_type=${businessType}`, {
      method: 'DELETE'
    });
  }
  
  // 1. 先获取审批实例ID
  const { data: instanceData } = await supabase
    .from("approval_instances")
    .select("id")
    .eq("business_id", recordId)
    .eq("business_type", businessType)
    .maybeSingle();
  
  if (instanceData) {
    // 2. 删除待办事项
    await supabase
      .from("todo_items")
      .delete()
      .eq("approval_instance_id", instanceData.id);
    
    // 3. 删除审批记录
    await supabase
      .from("approval_records")
      .delete()
      .eq("instance_id", instanceData.id);
    
    // 4. 删除审批实例
    await supabase
      .from("approval_instances")
      .delete()
      .eq("id", instanceData.id);
  }
  
  // 5. 删除业务记录
  const { error } = await supabase
    .from("absence_records")
    .delete()
    .eq("id", recordId);
  
  return { data: { success: !error }, error };
}

export async function getAbsenceRecordById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/absence-records/${id}`);
  }
  
  const { data, error } = await supabase
    .from("absence_records")
    .select("*, contacts!absence_records_contact_id_fkey(id, name, department)")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

// ==================== Contacts (通讯录) ====================

export async function getContactsWithOrg() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/contacts?with_org=true');
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select(`
      id, name, department, position, mobile, phone, email, office_location, status, is_leader, organization_id, security_level,
      organization:organizations!contacts_organization_id_fkey (name)
    `)
    .eq("is_active", true)
    .order("sort_order");
  return { data, error };
}

export async function getOrganizations() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/organizations');
  }
  
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, parent_id, sort_order")
    .order("sort_order");
  return { data, error };
}

// 获取所有组织（管理后台用）
export async function getAllOrganizations() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/organizations?all=true');
  }
  
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("sort_order");
  return { data, error };
}

// 创建组织
export async function createOrganization(org: {
  name: string;
  short_name?: string | null;
  parent_id?: string | null;
  level?: number;
  sort_order?: number;
  address?: string | null;
  phone?: string | null;
  direct_supervisor_id?: string | null;
  department_head_id?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(org),
    });
  }
  
  const { data, error } = await supabase
    .from("organizations")
    .insert(org as any)
    .select("id")
    .single();
  return { data, error };
}

// 更新组织
export async function updateOrganization(id: string, updates: {
  name?: string;
  short_name?: string | null;
  parent_id?: string | null;
  level?: number;
  sort_order?: number;
  address?: string | null;
  phone?: string | null;
  direct_supervisor_id?: string | null;
  department_head_id?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/organizations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("organizations")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

// 删除组织
export async function deleteOrganization(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/organizations/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// 获取所有联系人（管理后台用）
export async function getAllContacts() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/contacts?all=true');
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select("*, organization:organizations!contacts_organization_id_fkey(*)")
    .order("sort_order");
  return { data, error };
}

// 创建联系人
export async function createContact(contact: {
  organization_id: string;
  name: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  office_location?: string | null;
  sort_order?: number;
  is_active?: boolean;
  status?: string;
  status_note?: string | null;
  security_level?: string;
  is_leader?: boolean;
  first_work_date?: string | null;
  account?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    });
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .insert(contact as any)
    .select("id")
    .single();
  return { data, error };
}

// 更新联系人
export async function updateContact(id: string, updates: {
  organization_id?: string;
  name?: string;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  office_location?: string | null;
  sort_order?: number;
  is_active?: boolean;
  status?: string;
  status_note?: string | null;
  security_level?: string;
  is_leader?: boolean;
  first_work_date?: string | null;
  account?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("contacts")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

// 删除联系人
export async function deleteContact(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/contacts/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// 获取所有 Banners（管理后台用）
export async function getAllBanners() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/banners?all=true');
  }
  
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order");
  return { data, error };
}

// 创建 Banner
export async function createBanner(banner: {
  image_url: string;
  title: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/banners', {
      method: 'POST',
      body: JSON.stringify(banner),
    });
  }
  
  const { data, error } = await supabase
    .from("banners")
    .insert(banner as any)
    .select("id")
    .single();
  return { data, error };
}

// 更新 Banner
export async function updateBanner(id: string, updates: {
  image_url?: string;
  title?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("banners")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

// 删除 Banner
export async function deleteBanner(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/banners/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// ==================== Approval (审批) ====================

export async function getApprovalTemplates(params?: { include_inactive?: boolean }) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    if (params?.include_inactive) searchParams.set('include_inactive', 'true');
    const query = searchParams.toString();
    return offlineRequest<any[]>(`/api/approval-templates${query ? `?${query}` : ''}`);
  }
  
  let query = supabase.from("approval_templates").select("*");
  if (!params?.include_inactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  return { data, error };
}

export async function getAllApprovalTemplates() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/approval-templates?include_inactive=true');
  }
  
  const { data, error } = await supabase
    .from("approval_templates")
    .select("*")
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function createApprovalTemplate(template: {
  name: string;
  code: string;
  description?: string | null;
  icon?: string;
  business_type: string;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/approval-templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_templates")
    .insert(template as any)
    .select()
    .single();
  return { data, error };
}

export async function updateApprovalTemplate(id: string, updates: {
  name?: string;
  description?: string | null;
  icon?: string;
  business_type?: string;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("approval_templates")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

export async function seedApprovalTemplates() {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean; count: number }>('/api/approval-templates/seed', {
      method: 'POST',
    });
  }
  // 在线模式不需要 seed，数据库已有
  return { data: { success: true, count: 0 }, error: null };
}

export async function getApprovalInstances(params: { business_id: string; business_type: string }) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('business_id', params.business_id);
    searchParams.set('business_type', params.business_type);
    return offlineRequest<any[]>(`/api/approval-instances?${searchParams.toString()}`);
  }
  
  const { data, error } = await supabase
    .from("approval_instances")
    .select("*")
    .eq("business_id", params.business_id)
    .eq("business_type", params.business_type)
    .order("created_at", { ascending: false });
  return { data, error };
}

// 按 business_id 和 business_type 获取单条审批实例（含发起人信息）
export async function getApprovalInstanceByBusinessId(businessId: string, businessType: string) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('business_id', businessId);
    searchParams.set('business_type', businessType);
    return offlineRequest<any>(`/api/approval-instances?${searchParams.toString()}`);
  }
  
  const { data, error } = await supabase
    .from("approval_instances")
    .select(`
      *,
      initiator:contacts!approval_instances_initiator_id_fkey(name, department)
    `)
    .eq("business_id", businessId)
    .eq("business_type", businessType)
    .maybeSingle();
  return { data, error };
}

export async function getApprovalRecords(instanceId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/approval-records?instance_id=${instanceId}`);
  }
  
  const { data, error } = await supabase
    .from("approval_records")
    .select(`
      *,
      approver:contacts!approval_records_approver_id_fkey (name, department)
    `)
    .eq("instance_id", instanceId)
    .order("node_index");
  return { data, error };
}

// ==================== Leave Balances (假期余额) ====================

export async function getLeaveBalance(contactId: string, year: number) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/leave-balances/${contactId}?year=${year}`);
  }
  
  const { data, error } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("contact_id", contactId)
    .eq("year", year)
    .maybeSingle();
  return { data, error };
}

/**
 * 扣减假期余额（请假审批通过后调用）
 * @param contactId 联系人ID
 * @param leaveType 假期类型
 * @param durationHours 时长（小时）
 * @param durationDays 时长（天）
 */
export async function deductLeaveBalance(
  contactId: string,
  leaveType: string,
  durationHours: number | null,
  durationDays: number | null
) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>('/api/leave-balances/deduct', {
      method: 'POST',
      body: JSON.stringify({ contactId, leaveType, durationHours, durationDays }),
    });
  }
  
  console.log(`Calling deduct_leave_balance: contact=${contactId}, type=${leaveType}, hours=${durationHours}, days=${durationDays}`);
  
  // 调用数据库函数扣减假期 - 参数顺序必须与函数定义一致
  // p_contact_id, p_duration_days, p_duration_hours, p_leave_type
  const { data, error } = await supabase.rpc('deduct_leave_balance', {
    p_contact_id: contactId,
    p_duration_days: durationDays || 0,
    p_duration_hours: durationHours || 0,
    p_leave_type: leaveType,
  });
  
  if (error) {
    console.error('deduct_leave_balance error:', error);
  } else {
    console.log('deduct_leave_balance success:', data);
  }
  
  return { data, error };
}

/**
 * 获取请假记录详情（用于扣减假期时获取请假类型和时长）
 */
export async function getAbsenceRecordForLeaveDeduction(businessId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/absence-records/${businessId}`);
  }
  
  const { data, error } = await supabase
    .from("absence_records")
    .select("contact_id, leave_type, duration_hours, duration_days, type")
    .eq("id", businessId)
    .maybeSingle();
  return { data, error };
}

// ==================== Leave Balance Management (假期余额管理) ====================

export async function getLeaveBalancesWithContacts(year: number) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/leave-balances?year=${year}&with_contacts=true`);
  }
  
  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      contacts:contacts!leave_balances_contact_id_fkey (
        id,
        name,
        department,
        position,
        first_work_date,
        created_at,
        organization:organizations!contacts_organization_id_fkey (id, name)
      )
    `)
    .eq("year", year)
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function getContactsForLeaveBalance() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/contacts?for_leave_balance=true');
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select(`
      id,
      name,
      department,
      position,
      first_work_date,
      created_at,
      organization:organizations!contacts_organization_id_fkey (id, name)
    `)
    .eq("is_active", true)
    .order("name");
  return { data, error };
}

export async function checkLeaveBalanceExists(contactId: string, year: number) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/leave-balances/check?contact_id=${contactId}&year=${year}`);
  }
  
  const { data, error } = await supabase
    .from("leave_balances")
    .select("id")
    .eq("contact_id", contactId)
    .eq("year", year)
    .maybeSingle();
  return { data, error };
}

export async function createLeaveBalance(balance: {
  contact_id: string;
  year: number;
  annual_leave_total: number;
  annual_leave_used?: number;
  sick_leave_total: number;
  sick_leave_used?: number;
  personal_leave_total: number;
  personal_leave_used?: number;
  paternity_leave_total?: number;
  paternity_leave_used?: number;
  bereavement_leave_total?: number;
  bereavement_leave_used?: number;
  maternity_leave_total?: number;
  maternity_leave_used?: number;
  nursing_leave_total?: number;
  nursing_leave_used?: number;
  marriage_leave_total?: number;
  marriage_leave_used?: number;
  compensatory_leave_total?: number;
  compensatory_leave_used?: number;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/leave-balances', {
      method: 'POST',
      body: JSON.stringify(balance),
    });
  }
  
  const { data, error } = await supabase
    .from("leave_balances")
    .insert(balance)
    .select("id")
    .single();
  return { data, error };
}

export async function updateLeaveBalance(id: string, updates: {
  annual_leave_total?: number;
  sick_leave_total?: number;
  personal_leave_total?: number;
  paternity_leave_total?: number;
  bereavement_leave_total?: number;
  maternity_leave_total?: number;
  nursing_leave_total?: number;
  marriage_leave_total?: number;
  compensatory_leave_total?: number;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/leave-balances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("leave_balances")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
}

export async function createLeaveBalances(balances: Array<{
  contact_id: string;
  year: number;
  annual_leave_total: number;
  annual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  personal_leave_total: number;
  personal_leave_used: number;
  paternity_leave_total?: number;
  paternity_leave_used?: number;
  bereavement_leave_total?: number;
  bereavement_leave_used?: number;
  maternity_leave_total?: number;
  maternity_leave_used?: number;
  nursing_leave_total?: number;
  nursing_leave_used?: number;
  marriage_leave_total?: number;
  marriage_leave_used?: number;
  compensatory_leave_total?: number;
  compensatory_leave_used?: number;
}>) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>('/api/leave-balances/batch', {
      method: 'POST',
      body: JSON.stringify(balances),
    });
  }
  
  const { error } = await supabase.from("leave_balances").insert(balances);
  return { data: null, error };
}

// ==================== Leader Schedules (领导日程) ====================

export async function getLeaderSchedules(params: {
  leader_ids: string[];
  start_date: string;
  end_date: string;
}) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('leader_ids', params.leader_ids.join(','));
    searchParams.set('start_date', params.start_date);
    searchParams.set('end_date', params.end_date);
    return offlineRequest<any[]>(`/api/leader-schedules?${searchParams.toString()}`);
  }
  
  const { data, error } = await supabase
    .from("leader_schedules")
    .select("*, leader:contacts!leader_schedules_leader_id_fkey(id, name, department, position)")
    .in("leader_id", params.leader_ids)
    .gte("schedule_date", params.start_date)
    .lte("schedule_date", params.end_date)
    .order("schedule_date")
    .order("start_time");
  return { data, error };
}

export async function getLeaders() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/contacts?is_leader=true');
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, department, position, organization_id")
    .eq("is_leader", true)
    .eq("is_active", true)
    .order("sort_order");
  return { data, error };
}

export async function getLeaderSchedulePermissions(userId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/leader-schedule-permissions?user_id=${userId}`);
  }
  
  const { data, error } = await supabase
    .from("leader_schedule_permissions")
    .select("*")
    .eq("user_id", userId);
  return { data, error };
}

// ==================== Create Absence Record ====================

export async function createAbsenceRecord(record: {
  contact_id: string;
  type: 'out' | 'leave' | 'business_trip';
  reason: string;
  start_time: string;
  end_time?: string | null;
  leave_type?: string | null;
  out_type?: string | null;
  out_location?: string | null;
  destination?: string | null;
  transport_type?: string | null;
  companions?: string[] | null;
  estimated_cost?: number | null;
  duration_hours?: number | null;
  duration_days?: number | null;
  handover_person_id?: string | null;
  handover_notes?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  status?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/absence-records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }
  
  const { data, error } = await supabase
    .from("absence_records")
    .insert(record as any)
    .select("id")
    .single();
  return { data, error };
}

// ==================== Contacts (通讯录) ====================

export async function getContacts(params?: { is_active?: boolean; is_leader?: boolean }) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
    if (params?.is_leader !== undefined) searchParams.set('is_leader', String(params.is_leader));
    const query = searchParams.toString();
    return offlineRequest<any[]>(`/api/contacts${query ? `?${query}` : ''}`);
  }
  
  let query = supabase.from("contacts").select("id, name, department, position, organization_id");
  if (params?.is_active !== undefined) query = query.eq("is_active", params.is_active);
  if (params?.is_leader !== undefined) query = query.eq("is_leader", params.is_leader);
  const { data, error } = await query.order("sort_order");
  return { data, error };
}

export async function getContactsWithOrgForAdmin() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/contacts?with_org=true');
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, department, organization:organizations!contacts_organization_id_fkey(name)")
    .eq("is_active", true)
    .order("sort_order");
  return { data, error };
}

export async function getContactsByIds(ids: string[]) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/contacts?ids=${ids.join(',')}`);
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, department")
    .in("id", ids);
  return { data, error };
}

// ==================== Todo Items (待办事项) ====================

export async function getTodoItems(params: {
  assignee_id: string;
  status?: string[];
  process_result_ne?: string;
  limit?: number;
}) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('assignee_id', params.assignee_id);
    if (params.status) searchParams.set('status', params.status.join(','));
    if (params.process_result_ne) searchParams.set('process_result_ne', params.process_result_ne);
    if (params.limit) searchParams.set('limit', String(params.limit));
    return offlineRequest<any[]>(`/api/todo-items?${searchParams.toString()}`);
  }
  
  let query = supabase
    .from("todo_items")
    .select(`
      id, title, source_system, source_department, created_at, priority, status,
      business_type, business_id, action_url, approval_instance_id, assignee_id,
      process_result, processed_at,
      initiator:contacts!todo_items_initiator_id_fkey(name, department)
    `)
    .eq("assignee_id", params.assignee_id);
  
  if (params.status && params.status.length > 0) {
    query = query.in("status", params.status as any);
  }
  if (params.process_result_ne) {
    query = query.neq("process_result", params.process_result_ne);
  }
  
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(params.limit || 20);
  return { data, error };
}

export async function createTodoItem(item: {
  source?: string;
  business_type: string;
  business_id: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  process_result?: string | null;
  initiator_id: string;
  assignee_id: string;
  approval_instance_id?: string;
  approval_version_number?: number;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/todo-items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }
  
  const { data, error } = await supabase
    .from("todo_items")
    .insert(item as any)
    .select("id")
    .single();
  return { data, error };
}

export async function updateTodoItem(id: string, updates: {
  status?: string;
  process_result?: string;
  processed_at?: string;
  processed_by?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/todo-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("todo_items")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

// ==================== Approval Workflow ====================

export async function getApprovalInstanceById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/approval-instances/${id}`);
  }
  
  const { data, error } = await supabase
    .from("approval_instances")
    .select(`
      *,
      initiator:contacts!approval_instances_initiator_id_fkey(name, department)
    `)
    .eq("id", id)
    .single();
  return { data, error };
}

export async function getApprovalProcessVersionById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/approval-process-versions/${id}`);
  }
  
  const { data, error } = await supabase
    .from("approval_process_versions")
    .select("nodes_snapshot")
    .eq("id", id)
    .single();
  return { data, error };
}

export async function getApprovalRecordsByInstance(instanceId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/approval-records?instance_id=${instanceId}`);
  }
  
  const { data, error } = await supabase
    .from("approval_records")
    .select(`
      *,
      approver:contacts!approval_records_approver_id_fkey(name, department)
    `)
    .eq("instance_id", instanceId)
    .order("node_index", { ascending: true })
    .order("created_at", { ascending: true });
  return { data, error };
}

export async function getApprovalFormFields(templateId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/approval-form-fields?template_id=${templateId}`);
  }
  
  const { data, error } = await supabase
    .from("approval_form_fields")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  return { data, error };
}

export async function createApprovalFormField(field: {
  template_id: string;
  field_type: string;
  field_name: string;
  field_label: string;
  placeholder?: string | null;
  is_required?: boolean;
  sort_order?: number;
  field_options?: string[] | null;
  col_span?: number;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/approval-form-fields', {
      method: 'POST',
      body: JSON.stringify(field),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_form_fields")
    .insert(field as any)
    .select("id")
    .single();
  return { data, error };
}

export async function createApprovalFormFieldsBatch(fields: Array<{
  template_id: string;
  field_type: string;
  field_name: string;
  field_label: string;
  placeholder?: string | null;
  is_required?: boolean;
  sort_order?: number;
  field_options?: string[] | null;
  col_span?: number;
}>) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean; count: number }>('/api/approval-form-fields/batch', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
  }
  
  const { error } = await supabase
    .from("approval_form_fields")
    .insert(fields as any);
  return { data: { success: !error, count: fields.length }, error };
}

export async function updateApprovalFormField(id: string, updates: {
  field_type?: string;
  field_label?: string;
  placeholder?: string | null;
  is_required?: boolean;
  sort_order?: number;
  field_options?: string[] | null;
  col_span?: number;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-form-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("approval_form_fields")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

export async function deleteApprovalFormField(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-form-fields/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("approval_form_fields")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

export async function createApprovalInstance(instance: {
  template_id: string;
  version_id: string;
  version_number: number;
  business_type: string;
  business_id: string;
  initiator_id: string;
  status?: string;
  current_node_index?: number;
  form_data?: Record<string, unknown>;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/approval-instances', {
      method: 'POST',
      body: JSON.stringify(instance),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_instances")
    .insert(instance as any)
    .select("id")
    .single();
  return { data, error };
}

export async function updateApprovalInstance(id: string, updates: {
  status?: string;
  current_node_index?: number;
  completed_at?: string;
  form_data?: Record<string, unknown>;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("approval_instances")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

export async function createApprovalRecord(record: {
  instance_id: string;
  node_index: number;
  node_name: string;
  node_type: string;
  approver_id: string;
  status?: string;
  comment?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/approval-records', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_records")
    .insert(record as any)
    .select("id")
    .single();
  return { data, error };
}

export async function updateApprovalRecord(id: string, updates: {
  status?: string;
  comment?: string;
  processed_at?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("approval_records")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

export async function updateAbsenceRecord(id: string, updates: {
  status?: string;
  approved_at?: string;
  approved_by?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/absence-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("absence_records")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

export async function getApprovalProcessVersions(templateId: string, isCurrent?: boolean) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    searchParams.set('template_id', templateId);
    if (isCurrent !== undefined) searchParams.set('is_current', String(isCurrent));
    return offlineRequest<any[]>(`/api/approval-process-versions?${searchParams.toString()}`);
  }
  
  let query = supabase
    .from("approval_process_versions")
    .select("id, version_number, nodes_snapshot")
    .eq("template_id", templateId);
  
  if (isCurrent !== undefined) {
    query = query.eq("is_current", isCurrent);
  }
  
  const { data, error } = await query.maybeSingle();
  return { data, error };
}

// ==================== Approval Nodes (审批节点) ====================

export async function getApprovalNodes(templateId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/approval-nodes?template_id=${templateId}`);
  }
  
  const { data, error } = await supabase
    .from("approval_nodes")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  return { data, error };
}

export async function createApprovalNode(node: {
  template_id: string;
  node_type: string;
  node_name: string;
  approver_type?: string;
  approver_ids?: string[] | null;
  sort_order?: number;
  condition_expression?: any;
  field_permissions?: any;
  approval_mode?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/approval-nodes', {
      method: 'POST',
      body: JSON.stringify(node),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_nodes")
    .insert(node as any)
    .select()
    .single();
  return { data, error };
}

export async function updateApprovalNode(id: string, updates: {
  node_name?: string;
  node_type?: string;
  approver_type?: string;
  approver_ids?: string[] | null;
  sort_order?: number;
  condition_expression?: any;
  field_permissions?: any;
  approval_mode?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_nodes")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

export async function deleteApprovalNode(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-nodes/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("approval_nodes")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

export async function getAllApprovalProcessVersions(templateId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/approval-process-versions?template_id=${templateId}&all=true`);
  }
  
  const { data, error } = await supabase
    .from("approval_process_versions")
    .select("*")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false });
  return { data, error };
}

export async function createApprovalProcessVersion(version: {
  template_id: string;
  version_number: number;
  version_name: string;
  nodes_snapshot: any;
  is_current?: boolean;
  published_by?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/approval-process-versions', {
      method: 'POST',
      body: JSON.stringify(version),
    });
  }
  
  const { data, error } = await supabase
    .from("approval_process_versions")
    .insert(version as any)
    .select()
    .single();
  return { data, error };
}

export async function updateApprovalProcessVersion(id: string, updates: {
  is_current?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-process-versions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("approval_process_versions")
    .update(updates as any)
    .eq("id", id);
  return { data: null, error };
}

export async function setVersionsNotCurrent(templateId: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-process-versions/unset-current/${templateId}`, {
      method: 'PUT',
    });
  }
  
  const { error } = await supabase
    .from("approval_process_versions")
    .update({ is_current: false })
    .eq("template_id", templateId);
  return { data: null, error };
}

// ==================== Banners ====================

export async function getBanners() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/banners');
  }
  
  const { data, error } = await supabase
    .from("banners")
    .select("id, image_url, title")
    .eq("is_active", true)
    .order("sort_order");
  return { data, error };
}

// ==================== Notice Images (Admin CRUD) ====================

export async function getNoticeImages() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/notice-images');
  }
  
  const { data, error } = await supabase
    .from("notice_images")
    .select("id, image_url, title")
    .eq("is_active", true)
    .order("sort_order");
  return { data, error };
}

export async function getAllNoticeImages() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/notice-images?all=true');
  }
  
  const { data, error } = await supabase
    .from("notice_images")
    .select("*")
    .order("sort_order");
  return { data, error };
}

export async function createNoticeImage(image: {
  image_url: string;
  title?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/notice-images', {
      method: 'POST',
      body: JSON.stringify(image),
    });
  }
  
  const { data, error } = await supabase
    .from("notice_images")
    .insert(image)
    .select("id")
    .single();
  return { data, error };
}

export async function updateNoticeImage(id: string, updates: {
  image_url?: string;
  title?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/notice-images/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("notice_images")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
}

export async function deleteNoticeImage(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/notice-images/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("notice_images")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// ==================== Notices (Admin CRUD) ====================

export async function getNotices(params?: {
  is_published?: boolean;
  organization_id?: string;
  security_level?: string;
  limit?: number;
}) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    if (params?.is_published !== undefined) searchParams.set('is_published', String(params.is_published));
    if (params?.organization_id) searchParams.set('organization_id', params.organization_id);
    if (params?.security_level) searchParams.set('security_level', params.security_level);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return offlineRequest<any[]>(`/api/notices${query ? `?${query}` : ''}`);
  }
  
  let query = supabase.from("notices").select("*");
  if (params?.is_published !== undefined) query = query.eq("is_published", params.is_published);
  const { data, error } = await query
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(params?.limit || 100);
  return { data, error };
}

export async function getAllNotices(params?: { department?: string }) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    if (params?.department) searchParams.set('department', params.department);
    const query = searchParams.toString();
    return offlineRequest<any[]>(`/api/notices${query ? `?${query}` : ''}`);
  }
  
  let query = supabase.from("notices").select("*");
  if (params?.department && params.department !== 'all') {
    query = query.eq("department", params.department);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  return { data, error };
}

export async function createNotice(notice: {
  title: string;
  department: string;
  content?: string;
  is_pinned?: boolean;
  is_published?: boolean;
  security_level?: string;
  publish_scope?: string;
  publish_scope_ids?: string[];
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/notices', {
      method: 'POST',
      body: JSON.stringify(notice),
    });
  }
  
  const { data, error } = await supabase
    .from("notices")
    .insert(notice)
    .select("id")
    .single();
  return { data, error };
}

export async function updateNotice(id: string, updates: {
  title?: string;
  department?: string;
  content?: string;
  is_pinned?: boolean;
  is_published?: boolean;
  security_level?: string;
  publish_scope?: string;
  publish_scope_ids?: string[];
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/notices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("notices")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
}

export async function deleteNotice(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/notices/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("notices")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// ==================== Leader Schedule Permissions (Admin CRUD) ====================

export async function getAllLeaderSchedulePermissions() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/leader-schedule-permissions');
  }
  
  const { data, error } = await supabase
    .from("leader_schedule_permissions")
    .select(`*, leader:contacts!leader_id(name)`)
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function createLeaderSchedulePermission(permission: {
  user_id: string;
  leader_id?: string | null;
  can_view_all?: boolean;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/leader-schedule-permissions', {
      method: 'POST',
      body: JSON.stringify(permission),
    });
  }
  
  const { data, error } = await supabase
    .from("leader_schedule_permissions")
    .insert(permission)
    .select("id")
    .single();
  return { data, error };
}

export async function createLeaderSchedulePermissions(permissions: Array<{
  user_id: string;
  leader_id?: string | null;
  can_view_all?: boolean;
}>) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>('/api/leader-schedule-permissions/batch', {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    });
  }
  
  const { error } = await supabase
    .from("leader_schedule_permissions")
    .insert(permissions);
  return { data: null, error };
}

export async function deleteLeaderSchedulePermissionsByUser(userId: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/leader-schedule-permissions/user/${userId}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("leader_schedule_permissions")
    .delete()
    .eq("user_id", userId);
  return { data: null, error };
}

// ==================== Stock Movements ====================

export async function createStockMovement(movement: {
  supply_id: string;
  movement_type: string;
  quantity: number;
  before_stock: number;
  after_stock: number;
  reference_type?: string;
  reference_id?: string;
  operator_name?: string;
  notes?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/stock-movements', {
      method: 'POST',
      body: JSON.stringify(movement),
    });
  }
  
  const { data, error } = await supabase
    .from("stock_movements")
    .insert(movement as any)
    .select("id")
    .single();
  return { data, error };
}

export async function updateOfficeSupplyStock(id: string, currentStock: number) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/office-supplies/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ current_stock: currentStock }),
    });
  }
  
  const { error } = await supabase
    .from("office_supplies")
    .update({ current_stock: currentStock })
    .eq("id", id);
  return { data: null, error };
}

// ==================== Supply Requisition By ID ====================

export async function getSupplyRequisitionById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/supply-requisitions/${id}`);
  }
  
  const { data, error } = await supabase
    .from("supply_requisitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

// ==================== Supply Purchase By ID ====================

export async function getSupplyPurchaseById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/supply-purchases/${id}`);
  }
  
  const { data, error } = await supabase
    .from("supply_purchases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

// ==================== Purchase Request By ID ====================

export async function getPurchaseRequestById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/purchase-requests/${id}`);
  }
  
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

// ==================== Approval Progression 专用函数 ====================

// 按节点名称和实例查询审批记录
export async function getApprovalRecordsByNodeName(instanceId: string, nodeName: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/approval-records?instance_id=${instanceId}&node_name=${encodeURIComponent(nodeName)}`);
  }
  
  const { data, error } = await supabase
    .from("approval_records")
    .select("status, created_at, approver_id")
    .eq("instance_id", instanceId)
    .eq("node_name", nodeName)
    .order("created_at", { ascending: false });
  return { data, error };
}

// 批量更新待办事项（按实例ID和状态）
export async function updateTodosByInstanceId(instanceId: string, status: string, updates: {
  status?: string;
  process_result?: string;
  process_notes?: string;
  processed_at?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/todo-items/by-instance/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ current_status: status, updates }),
    });
  }
  
  const { error } = await supabase
    .from("todo_items")
    .update(updates as any)
    .eq("approval_instance_id", instanceId)
    .eq("status", status as any);
  return { data: null, error };
}

// 批量更新审批记录（按实例ID和状态）
export async function updateApprovalRecordsByInstanceId(instanceId: string, status: string, updates: {
  status?: string;
  comment?: string;
  processed_at?: string;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/approval-records/by-instance/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify({ current_status: status, updates }),
    });
  }
  
  const { error } = await supabase
    .from("approval_records")
    .update(updates as any)
    .eq("instance_id", instanceId)
    .eq("status", status as any);
  return { data: null, error };
}

// 获取缺勤记录的联系人ID
export async function getAbsenceRecordContactId(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ contact_id: string }>(`/api/absence-records/${id}/contact`);
  }
  
  const { data, error } = await supabase
    .from("absence_records")
    .select("contact_id")
    .eq("id", id)
    .single();
  return { data, error };
}

// 按ID获取物资
export async function getOfficeSupplyById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/office-supplies/${id}`);
  }
  
  const { data, error } = await supabase
    .from("office_supplies")
    .select("id, current_stock, name")
    .eq("id", id)
    .single();
  return { data, error };
}

// 按ID获取联系人
export async function getContactById(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/contacts/${id}`);
  }
  
  const { data, error } = await supabase
    .from("contacts")
    .select("name, department")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

// 根据联系人ID获取其组织的主管信息（支持向上查找父级组织）
export async function getOrganizationApprovers(contactId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any>(`/api/contacts/${contactId}/organization-approvers`);
  }
  
  // 先获取联系人的组织ID
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("organization_id")
    .eq("id", contactId)
    .maybeSingle();
  
  if (contactError || !contact) {
    console.warn(`getOrganizationApprovers: Failed to get contact ${contactId}:`, contactError);
    return { data: null, error: contactError };
  }
  
  // 递归向上查找有主管设置的组织
  let currentOrgId = contact.organization_id;
  let maxDepth = 10; // 防止无限循环
  
  while (currentOrgId && maxDepth > 0) {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, parent_id, direct_supervisor_id, department_head_id")
      .eq("id", currentOrgId)
      .maybeSingle();
    
    if (orgError || !org) {
      console.warn(`getOrganizationApprovers: Failed to get organization ${currentOrgId}:`, orgError);
      return { data: null, error: orgError };
    }
    
    console.log(`getOrganizationApprovers: Checking org "${org.name}" (${org.id}), supervisor=${org.direct_supervisor_id}, head=${org.department_head_id}`);
    
    // 如果当前组织有设置主管，返回
    if (org.direct_supervisor_id || org.department_head_id) {
      console.log(`getOrganizationApprovers: Found approvers in org "${org.name}": supervisor=${org.direct_supervisor_id}, head=${org.department_head_id}`);
      return { 
        data: { 
          direct_supervisor_id: org.direct_supervisor_id, 
          department_head_id: org.department_head_id 
        }, 
        error: null 
      };
    }
    
    // 向上查找父级组织
    if (org.parent_id) {
      console.log(`getOrganizationApprovers: No approvers in "${org.name}", checking parent org ${org.parent_id}`);
      currentOrgId = org.parent_id;
    } else {
      // 没有父级组织了，停止查找
      console.log(`getOrganizationApprovers: No approvers found and no parent org for "${org.name}"`);
      break;
    }
    
    maxDepth--;
  }
  
  // 没有找到任何主管
  console.warn(`getOrganizationApprovers: No approvers found for contact ${contactId} after traversing org hierarchy`);
  return { data: { direct_supervisor_id: null, department_head_id: null }, error: null };
}

// ==================== Leader Schedule Management (领导日程管理 - Admin) ====================

export async function getAllLeaderSchedules() {
  if (isOfflineMode()) {
    return offlineRequest<any[]>('/api/leader-schedules?all=true');
  }
  
  const { data, error } = await supabase
    .from("leader_schedules")
    .select(`
      *,
      leader:contacts!leader_id(id, name, position)
    `)
    .order("schedule_date", { ascending: false })
    .order("start_time");
  return { data, error };
}

export async function getLeaderSchedulesByWeek(startDate: string, endDate: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/leader-schedules?start_date=${startDate}&end_date=${endDate}`);
  }
  
  const { data, error } = await supabase
    .from("leader_schedules")
    .select(`
      *,
      leader:contacts!leader_id(id, name, position)
    `)
    .gte("schedule_date", startDate)
    .lte("schedule_date", endDate)
    .order("schedule_date")
    .order("start_time");
  return { data, error };
}

export async function createLeaderSchedule(schedule: {
  leader_id: string;
  title: string;
  location?: string | null;
  schedule_date: string;
  start_time: string;
  end_time: string;
  schedule_type: string;
  notes?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/leader-schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    });
  }
  
  const { data, error } = await supabase
    .from("leader_schedules")
    .insert(schedule)
    .select("id")
    .single();
  return { data, error };
}

export async function updateLeaderSchedule(id: string, updates: {
  leader_id?: string;
  title?: string;
  location?: string | null;
  schedule_date?: string;
  start_time?: string;
  end_time?: string;
  schedule_type?: string;
  notes?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/leader-schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("leader_schedules")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
}

export async function deleteLeaderSchedule(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/leader-schedules/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("leader_schedules")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// ==================== File Transfers (文件收发) ====================

export async function getFileTransfers(params?: { status?: string }) {
  if (isOfflineMode()) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return offlineRequest<any[]>(`/api/file-transfers${query ? `?${query}` : ''}`);
  }
  
  let query = supabase.from("file_transfers").select("*");
  if (params?.status) query = query.eq("status", params.status);
  const { data, error } = await query.order("created_at", { ascending: false });
  return { data, error };
}

export async function createFileTransfer(transfer: {
  title: string;
  send_unit: string;
  send_unit_id?: string | null;
  doc_number: string;
  security_level: string;
  urgency: string;
  source_unit?: string | null;
  send_type?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  document_date?: string | null;
  copies?: number | null;
  confidential_period?: string | null;
  main_unit?: string | null;
  sign_leader?: string | null;
  sign_date?: string | null;
  file_type?: string | null;
  notify_type?: string | null;
  copy_unit?: string | null;
  description?: string | null;
  status?: string;
  attachments?: any;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ id: string }>('/api/file-transfers', {
      method: 'POST',
      body: JSON.stringify(transfer),
    });
  }
  
  const { data, error } = await supabase
    .from("file_transfers")
    .insert(transfer)
    .select("id")
    .single();
  return { data, error };
}

export async function updateFileTransfer(id: string, updates: {
  status?: string;
  sign_leader?: string | null;
  sign_date?: string | null;
}) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/file-transfers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
  
  const { error } = await supabase
    .from("file_transfers")
    .update(updates)
    .eq("id", id);
  return { data: null, error };
}

export async function deleteFileTransfer(id: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ success: boolean }>(`/api/file-transfers/${id}`, {
      method: 'DELETE',
    });
  }
  
  const { error } = await supabase
    .from("file_transfers")
    .delete()
    .eq("id", id);
  return { data: null, error };
}

// ==================== Check Leader Schedule Permission ====================

export async function checkLeaderSchedulePermission(userId: string) {
  if (isOfflineMode()) {
    return offlineRequest<{ has_permission: boolean }>(`/api/leader-schedule-permissions/check?user_id=${userId}`);
  }
  
  const { data, error } = await supabase
    .from("leader_schedule_permissions")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  
  return { data: { has_permission: data && data.length > 0 }, error };
}

// 按ID获取采购申请明细
export async function getSupplyPurchaseItemsById(purchaseId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/supply-purchase-items?purchase_id=${purchaseId}`);
  }
  
  const { data, error } = await supabase
    .from("supply_purchase_items")
    .select("supply_id, quantity, item_name")
    .eq("purchase_id", purchaseId);
  return { data, error };
}

// 按ID获取领用申请明细
export async function getSupplyRequisitionItemsById(requisitionId: string) {
  if (isOfflineMode()) {
    return offlineRequest<any[]>(`/api/supply-requisition-items?requisition_id=${requisitionId}`);
  }
  
  const { data, error } = await supabase
    .from("supply_requisition_items")
    .select("supply_id, quantity, office_supplies(name)")
    .eq("requisition_id", requisitionId);
  return { data, error };
}

// 导出统一接口
export const dataAdapter = {
  // Office Supplies
  getOfficeSupplies,
  getAllOfficeSupplies,
  createOfficeSupply,
  updateOfficeSupply,
  updateOfficeSupplyStock,
  // Schedules
  getSchedules,
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  // Supply Requisitions
  getSupplyRequisitions,
  getAllSupplyRequisitions,
  createSupplyRequisition,
  createDirectSupplyRequisition,
  updateSupplyRequisition,
  getSupplyRequisitionItems,
  createSupplyRequisitionItems,
  getSupplyRequisitionById,
  // Supply Purchases
  getSupplyPurchases,
  getAllSupplyPurchases,
  createSupplyPurchase,
  getSupplyPurchaseItems,
  createSupplyPurchaseItems,
  getSupplyPurchaseById,
  // Purchase Requests
  getPurchaseRequests,
  getAllPurchaseRequests,
  createPurchaseRequest,
  createDirectPurchaseRequest,
  updatePurchaseRequest,
  getPurchaseRequestItems,
  createPurchaseRequestItems,
  getPurchaseRequestById,
  // Canteen Menus
  getCanteenMenus,
  updateCanteenMenu,
  createCanteenMenu,
  deleteCanteenMenu,
  // Absence Records
  getAbsenceRecords,
  getAbsenceRecordById,
  createAbsenceRecord,
  updateAbsenceRecord,
  // Admin Absence Records
  getAdminAbsenceRecords,
  getApprovalInstancesForAdmin,
  getApprovalInstanceForDetail,
  deleteAbsenceRecordWithApproval,
  // Contacts
  getContactsWithOrg,
  getContactsWithOrgForAdmin,
  getOrganizations,
  getAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getContacts,
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactsByIds,
  // Banners
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  // Approval
  getApprovalTemplates,
  getAllApprovalTemplates,
  createApprovalTemplate,
  updateApprovalTemplate,
  seedApprovalTemplates,
  getApprovalInstances,
  getApprovalInstanceByBusinessId,
  getApprovalInstanceById,
  getApprovalRecords,
  getApprovalRecordsByInstance,
  getApprovalFormFields,
  getApprovalProcessVersionById,
  createApprovalInstance,
  updateApprovalInstance,
  createApprovalRecord,
  updateApprovalRecord,
  getApprovalProcessVersions,
  // Approval Nodes
  getApprovalNodes,
  createApprovalNode,
  updateApprovalNode,
  deleteApprovalNode,
  getAllApprovalProcessVersions,
  createApprovalProcessVersion,
  updateApprovalProcessVersion,
  setVersionsNotCurrent,
  // Leave Balances
  getLeaveBalance,
  checkLeaveBalanceExists,
  createLeaveBalance,
  updateLeaveBalance,
  createLeaveBalances,
  // Leader Schedules
  getLeaderSchedules,
  getAllLeaderSchedules,
  getLeaderSchedulesByWeek,
  createLeaderSchedule,
  updateLeaderSchedule,
  deleteLeaderSchedule,
  getLeaders,
  getLeaderSchedulePermissions,
  checkLeaderSchedulePermission,
  // File Transfers
  getFileTransfers,
  createFileTransfer,
  updateFileTransfer,
  deleteFileTransfer,
  // Todo Items
  getTodoItems,
  createTodoItem,
  updateTodoItem,
  // Banners & Notices
  getBanners,
  getNoticeImages,
  getAllNoticeImages,
  createNoticeImage,
  updateNoticeImage,
  deleteNoticeImage,
  getNotices,
  getAllNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  // Leader Schedule Permissions
  getAllLeaderSchedulePermissions,
  createLeaderSchedulePermission,
  createLeaderSchedulePermissions,
  deleteLeaderSchedulePermissionsByUser,
  // Leave Balances (新增)
  getLeaveBalancesWithContacts,
  getContactsForLeaveBalance,
  // Stock
  createStockMovement,
  // Approval Progression 专用
  getApprovalRecordsByNodeName,
  updateTodosByInstanceId,
  updateApprovalRecordsByInstanceId,
  getAbsenceRecordContactId,
  getSupplyPurchaseItemsById,
  getSupplyRequisitionItemsById,
  getOfficeSupplyById,
  getContactById,
  getOrganizationApprovers,
  // Utilities
  isOfflineMode,
};

export default dataAdapter;
