// 离线 API 客户端 - 替代 Supabase SDK 用于内网环境
// 通过 window.GOV_CONFIG.API_BASE_URL 配置 API 地址

// 获取 API 基础地址
const getApiBaseUrl = (): string => {
  // 优先使用运行时配置
  if (typeof window !== 'undefined' && (window as any).GOV_CONFIG?.API_BASE_URL) {
    return (window as any).GOV_CONFIG.API_BASE_URL;
  }
  // 开发环境默认值
  return 'http://localhost:3001';
};

// 检测是否为离线模式
export const isOfflineMode = (): boolean => {
  // 检查是否配置了 GOV_CONFIG（离线部署时会加载 config.js）
  if (typeof window !== 'undefined' && (window as any).GOV_CONFIG) {
    // 打印调试信息（仅首次）
    if (!(window as any)._offlineModeLogged) {
      console.log('[Offline Mode] GOV_CONFIG detected:', {
        API_BASE_URL: (window as any).GOV_CONFIG.API_BASE_URL,
        OFFLINE_MODE: (window as any).GOV_CONFIG.OFFLINE_MODE,
      });
      (window as any)._offlineModeLogged = true;
    }
    return true;
  }
  // 检查环境变量标志
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
    return true;
  }
  // 如果都不满足，打印警告（仅首次）
  if (typeof window !== 'undefined' && !(window as any)._offlineModeWarned) {
    console.warn('[Offline Mode] window.GOV_CONFIG is undefined! config.js may not be loaded correctly.');
    (window as any)._offlineModeWarned = true;
  }
  return false;
};

// 通用请求方法
async function request<T>(
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

// ==================== 认证相关 ====================

export interface LoginResult {
  id: string;
  name: string;
  mobile: string;
  account: string | null;
  position: string;
  department: string;
  security_level: string;
  organization_id: string;
  organization_name: string;
  is_leader?: boolean;
}

export async function login(mobile: string, password: string) {
  const result = await request<{ success: boolean; user: LoginResult }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ mobile, password }),
  });

  if (result.data?.user) {
    return { data: [result.data.user], error: null };
  }
  return { data: null, error: result.error };
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  return request<{ success: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ userId, oldPassword, newPassword }),
  });
}

// ==================== 组织架构 ====================

export async function getOrganizations() {
  return request<any[]>('/api/organizations');
}

// ==================== 通讯录 ====================

export async function getContacts(params?: { organization_id?: string; is_active?: boolean }) {
  const searchParams = new URLSearchParams();
  if (params?.organization_id) searchParams.set('organization_id', params.organization_id);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  
  const query = searchParams.toString();
  return request<any[]>(`/api/contacts${query ? `?${query}` : ''}`);
}

export async function getContact(id: string) {
  return request<any>(`/api/contacts/${id}`);
}

// ==================== 公告通知 ====================

export async function getNotices(params?: { is_published?: boolean }) {
  const searchParams = new URLSearchParams();
  if (params?.is_published !== undefined) searchParams.set('is_published', String(params.is_published));
  
  const query = searchParams.toString();
  return request<any[]>(`/api/notices${query ? `?${query}` : ''}`);
}

// ==================== 通知图片 ====================

export async function getNoticeImages() {
  return request<any[]>('/api/notice-images');
}

// ==================== 轮播图/背景 ====================

export async function getBanners() {
  return request<any[]>('/api/banners');
}

export async function saveBanner(imageUrl: string, title?: string) {
  return request<{ success: boolean; id: string }>('/api/banners', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, title }),
  });
}

// ==================== 食堂菜单 ====================

export async function getCanteenMenus() {
  return request<any[]>('/api/canteen-menus');
}

// ==================== 待办事项 ====================

export interface TodoItemWithInitiator {
  id: string;
  title: string;
  source_system: string | null;
  source_department: string | null;
  created_at: string;
  priority: 'urgent' | 'normal' | 'low';
  status: string;
  business_type: string;
  business_id: string | null;
  action_url: string | null;
  approval_instance_id: string | null;
  assignee_id: string;
  process_result: string | null;
  processed_at: string | null;
  initiator?: {
    name: string;
    department: string | null;
  } | null;
}

export async function getTodoItems(params?: { assignee_id?: string; status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.assignee_id) searchParams.set('assignee_id', params.assignee_id);
  if (params?.status) searchParams.set('status', params.status);
  
  const query = searchParams.toString();
  return request<any[]>(`/api/todo-items${query ? `?${query}` : ''}`);
}

export async function getTodoItemsWithInitiator(assigneeId: string, filter: 'pending' | 'completed' | 'cc') {
  return request<TodoItemWithInitiator[]>(`/api/todo-items/list?assignee_id=${assigneeId}&filter=${filter}`);
}

export async function getTodoCount(assigneeId: string) {
  return request<{ count: number }>(`/api/todo-items/count?assignee_id=${assigneeId}`);
}

export async function updateTodoStatus(todoId: string, updates: {
  status: string;
  process_result?: string;
  process_notes?: string;
  processed_by?: string;
}) {
  return request<{ success: boolean }>(`/api/todo-items/${todoId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTodoItem(todoId: string) {
  return request<{ success: boolean }>(`/api/todo-items/${todoId}`, {
    method: 'DELETE',
  });
}

export async function deleteTodoItemsByInstanceId(instanceId: string) {
  return request<{ success: boolean }>(`/api/todo-items/by-instance/${instanceId}`, {
    method: 'DELETE',
  });
}

// ==================== 请假/外出/出差记录 ====================

export async function getAbsenceRecords(params?: { contact_id?: string; type?: string; status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.contact_id) searchParams.set('contact_id', params.contact_id);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  
  const query = searchParams.toString();
  return request<any[]>(`/api/absence-records${query ? `?${query}` : ''}`);
}

export async function createAbsenceRecord(data: any) {
  return request<{ success: boolean; id: string }>('/api/absence-records', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== 文件收发 ====================

export async function getFileTransfers(params?: { status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  
  const query = searchParams.toString();
  return request<any[]>(`/api/file-transfers${query ? `?${query}` : ''}`);
}

export async function createFileTransfer(data: any) {
  return request<{ success: boolean; id: string }>('/api/file-transfers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== 文件上传 ====================

export async function uploadFile(file: File, type: string = 'misc') {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${baseUrl}/api/upload/${type}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('上传失败');
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// ==================== 缺勤记录创建 ====================

export async function createAbsenceRecordOffline(data: {
  contact_id: string;
  type: 'out' | 'leave' | 'business_trip';
  reason: string;
  start_time: string;
  end_time?: string | null;
  [key: string]: any;
}) {
  return request<{ success: boolean; id: string }>('/api/absence-records', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== 健康检查 ====================

export async function checkHealth() {
  return request<{ status: string; database: string }>('/api/health');
}

// ==================== SSO 单点登录 ====================

export async function ssoGetChallenge() {
  return request<string>('/api/cjgov/sso/challenge');
}

export async function ssoVerifyTicket(challenge: string, identityticket: string) {
  return request<any>('/api/cjgov/sso/verifyTicket', {
    method: 'POST',
    body: JSON.stringify({ challenge, identityticket }),
  });
}

// ==================== 管理员认证 ====================

export interface AdminLoginResult {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function adminLogin(email: string, password: string) {
  const result = await request<{ success: boolean; admin: AdminLoginResult }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (result.data?.admin) {
    return { data: result.data.admin, error: null };
  }
  return { data: null, error: result.error };
}

// 导出一个兼容 Supabase 风格的客户端接口
export const offlineApi = {
  login,
  changePassword,
  getOrganizations,
  getContacts,
  getContact,
  getNotices,
  getNoticeImages,
  getBanners,
  saveBanner,
  getCanteenMenus,
  getTodoItems,
  getTodoItemsWithInitiator,
  getTodoCount,
  updateTodoStatus,
  deleteTodoItem,
  deleteTodoItemsByInstanceId,
  getAbsenceRecords,
  createAbsenceRecord,
  getFileTransfers,
  createFileTransfer,
  uploadFile,
  checkHealth,
  adminLogin,
  ssoGetChallenge,
  ssoVerifyTicket,
  isOfflineMode,
};

export default offlineApi;
