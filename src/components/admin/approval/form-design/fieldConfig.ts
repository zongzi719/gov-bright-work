import { 
  Type, 
  AlignLeft, 
  Hash, 
  Calendar, 
  Image, 
  List, 
  CheckSquare,
  CircleDot,
  DollarSign,
  Clock,
  User,
} from "lucide-react";
import type { FieldTypeConfig, BusinessFormConfig, FormField } from "./types";

export const fieldTypeConfig: Record<string, FieldTypeConfig> = {
  text: { icon: Type, label: "单行输入", placeholder: "请输入" },
  textarea: { icon: AlignLeft, label: "多行输入", placeholder: "请输入详细内容" },
  number: { icon: Hash, label: "数字", placeholder: "请输入数字" },
  money: { icon: DollarSign, label: "金额", placeholder: "请输入金额" },
  date: { icon: Calendar, label: "日期", placeholder: "请选择日期" },
  datetime: { icon: Clock, label: "日期时间", placeholder: "请选择日期时间" },
  image: { icon: Image, label: "图片", placeholder: "请上传图片" },
  select: { icon: List, label: "下拉选择", placeholder: "请选择" },
  radio: { icon: CircleDot, label: "单选框", placeholder: "请选择" },
  checkbox: { icon: CheckSquare, label: "多选框", placeholder: "请选择" },
  user: { icon: User, label: "人员选择", placeholder: "请选择人员" },
};

/**
 * 业务类型到数据库表的映射
 * 用于表单设计器根据业务类型获取对应的数据库表结构
 */
export const businessTypeTableMapping: Record<string, string> = {
  business_trip: "absence_records",
  leave: "absence_records", 
  out: "absence_records",
  supply_requisition: "supply_requisitions",
  purchase_request: "purchase_requests",
  supply_purchase: "supply_purchases",
};

/**
 * 数据库字段类型到表单字段类型的映射
 */
const dbTypeToFieldType: Record<string, string> = {
  "text": "textarea",
  "uuid": "select",
  "integer": "number",
  "numeric": "number",
  "timestamp with time zone": "datetime",
  "timestamp without time zone": "datetime",
  "date": "date",
  "time without time zone": "text",
  "boolean": "checkbox",
  "USER-DEFINED": "select", // 枚举类型
  "ARRAY": "checkbox",
};

/**
 * 需要排除的系统字段（不应该在表单中显示）
 */
const excludedFields = [
  "id",
  "created_at",
  "updated_at",
  "approved_at",
  "approved_by",
  "cancelled_at",
  "completed_at",
  "processed_at",
  "processed_by",
  "status",
  "initiator_id",
  "type", // absence_records 的类型字段由 business_type 决定
];

/**
 * 申请人字段映射（不同表使用不同的申请人字段名）
 */
const applicantFieldMapping: Record<string, string> = {
  absence_records: "contact_id",
  supply_requisitions: "requisition_by",
  purchase_requests: "requested_by",
  supply_purchases: "applicant_name",
};

/**
 * 字段中文标签映射
 */
const fieldLabelMapping: Record<string, Record<string, string>> = {
  absence_records: {
    contact_id: "申请人",
    start_time: "开始时间",
    end_time: "结束时间",
    reason: "事由",
    notes: "备注",
    leave_type: "请假类型",
    cancel_reason: "取消原因",
    // 出差相关
    destination: "出差目的地",
    transport_type: "交通方式",
    companions: "同行人员",
    estimated_cost: "预计费用",
    duration_days: "出差天数",
    // 请假相关
    handover_person_id: "工作交接人",
    handover_notes: "交接事项",
    duration_hours: "请假时长(小时)",
    // 外出相关
    out_location: "外出地点",
    out_type: "外出类型",
    contact_phone: "联系电话",
  },
  supply_requisitions: {
    requisition_by: "申请人",
    supply_id: "领用物品",
    quantity: "领用数量",
  },
  purchase_requests: {
    requested_by: "申请人",
    supply_id: "采购物品",
    quantity: "采购数量",
    reason: "采购原因",
  },
  supply_purchases: {
    applicant_name: "申请人",
    department: "申请科室",
    purchase_date: "申请日期",
    reason: "购置理由",
    total_amount: "合计金额",
  },
};

/**
 * 字段是否必填映射
 */
const fieldRequiredMapping: Record<string, Record<string, boolean>> = {
  absence_records: {
    contact_id: true,
    start_time: true,
    end_time: false,
    reason: true,
    notes: false,
    leave_type: true,
    cancel_reason: false,
    // 出差相关
    destination: true,
    transport_type: false,
    companions: false,
    estimated_cost: false,
    duration_days: false,
    // 请假相关
    handover_person_id: false,
    handover_notes: false,
    duration_hours: false,
    // 外出相关
    out_location: true,
    out_type: true,
    contact_phone: false,
  },
  supply_requisitions: {
    requisition_by: true,
    supply_id: true,
    quantity: true,
  },
  purchase_requests: {
    requested_by: true,
    supply_id: true,
    quantity: true,
    reason: false,
  },
  supply_purchases: {
    applicant_name: true,
    department: true,
    purchase_date: true,
    reason: false,
    total_amount: false,
  },
};

/**
 * 特定业务类型需要显示的字段（过滤掉不相关字段）
 * 注意：申请人字段放在最前面
 */
const businessTypeFieldFilter: Record<string, string[]> = {
  // 出差申请：申请人、目的地、事由、开始时间、结束时间、天数、交通方式、同行人、预计费用、备注
  business_trip: ["contact_id", "destination", "reason", "start_time", "end_time", "duration_days", "transport_type", "companions", "estimated_cost", "notes"],
  // 请假申请：申请人、请假类型、事由、开始时间、结束时间、时长、交接人、交接事项、备注
  leave: ["contact_id", "leave_type", "reason", "start_time", "end_time", "duration_hours", "handover_person_id", "handover_notes", "notes"],
  // 外出申请：申请人、外出类型、外出地点、事由、开始时间、结束时间、时长、联系电话、备注
  out: ["contact_id", "out_type", "out_location", "reason", "start_time", "end_time", "duration_hours", "contact_phone", "notes"],
  // 物品领用：申请人、领用物品、领用数量
  supply_requisition: ["requisition_by", "supply_id", "quantity"],
  // 采购申请：申请人、采购物品、采购数量、采购原因
  purchase_request: ["requested_by", "supply_id", "quantity", "reason"],
};

/**
 * 字段特殊配置（如下拉选项）
 */
const fieldOptionsMapping: Record<string, Record<string, string[] | null>> = {
  absence_records: {
    leave_type: ["annual", "sick", "personal"],
    transport_type: ["plane", "train", "car", "other"],
    out_type: ["meeting", "client", "errand", "other"],
  },
  supply_requisitions: {},
  purchase_requests: {},
};

/**
 * 数据库表结构定义（基于实际 Supabase 表结构）
 * 这是从数据库 schema 直接映射过来的
 */
interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
}

const tableSchemas: Record<string, TableColumn[]> = {
  absence_records: [
    { column_name: "id", data_type: "uuid", is_nullable: false },
    { column_name: "contact_id", data_type: "uuid", is_nullable: false },
    { column_name: "type", data_type: "USER-DEFINED", is_nullable: false },
    { column_name: "start_time", data_type: "timestamp with time zone", is_nullable: false },
    { column_name: "end_time", data_type: "timestamp with time zone", is_nullable: true },
    { column_name: "reason", data_type: "text", is_nullable: false },
    { column_name: "notes", data_type: "text", is_nullable: true },
    { column_name: "leave_type", data_type: "USER-DEFINED", is_nullable: true },
    { column_name: "status", data_type: "USER-DEFINED", is_nullable: false },
    { column_name: "approved_by", data_type: "uuid", is_nullable: true },
    { column_name: "approved_at", data_type: "timestamp with time zone", is_nullable: true },
    { column_name: "cancelled_at", data_type: "timestamp with time zone", is_nullable: true },
    { column_name: "cancel_reason", data_type: "text", is_nullable: true },
    { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: false },
    { column_name: "updated_at", data_type: "timestamp with time zone", is_nullable: false },
    // 新增字段 - 出差相关
    { column_name: "destination", data_type: "text", is_nullable: true },
    { column_name: "transport_type", data_type: "text", is_nullable: true },
    { column_name: "companions", data_type: "ARRAY", is_nullable: true },
    { column_name: "estimated_cost", data_type: "numeric", is_nullable: true },
    { column_name: "duration_days", data_type: "numeric", is_nullable: true },
    // 新增字段 - 请假相关
    { column_name: "handover_person_id", data_type: "uuid", is_nullable: true },
    { column_name: "handover_notes", data_type: "text", is_nullable: true },
    { column_name: "duration_hours", data_type: "numeric", is_nullable: true },
    // 新增字段 - 外出相关
    { column_name: "out_location", data_type: "text", is_nullable: true },
    { column_name: "out_type", data_type: "text", is_nullable: true },
    { column_name: "contact_phone", data_type: "text", is_nullable: true },
  ],
  supply_requisitions: [
    { column_name: "id", data_type: "uuid", is_nullable: false },
    { column_name: "supply_id", data_type: "uuid", is_nullable: false },
    { column_name: "quantity", data_type: "integer", is_nullable: false },
    { column_name: "requisition_by", data_type: "text", is_nullable: false },
    { column_name: "status", data_type: "USER-DEFINED", is_nullable: false },
    { column_name: "approved_by", data_type: "uuid", is_nullable: true },
    { column_name: "approved_at", data_type: "timestamp with time zone", is_nullable: true },
    { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: false },
    { column_name: "updated_at", data_type: "timestamp with time zone", is_nullable: false },
  ],
  purchase_requests: [
    { column_name: "id", data_type: "uuid", is_nullable: false },
    { column_name: "supply_id", data_type: "uuid", is_nullable: false },
    { column_name: "quantity", data_type: "integer", is_nullable: false },
    { column_name: "requested_by", data_type: "text", is_nullable: false },
    { column_name: "reason", data_type: "text", is_nullable: true },
    { column_name: "status", data_type: "USER-DEFINED", is_nullable: false },
    { column_name: "approved_by", data_type: "uuid", is_nullable: true },
    { column_name: "approved_at", data_type: "timestamp with time zone", is_nullable: true },
    { column_name: "completed_at", data_type: "timestamp with time zone", is_nullable: true },
    { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: false },
    { column_name: "updated_at", data_type: "timestamp with time zone", is_nullable: false },
  ],
};

/**
 * 根据业务类型获取对应的数据库表字段，并转换为表单字段格式
 */
export const getDefaultFieldsForBusinessType = (businessType: string): Omit<FormField, 'id' | 'template_id'>[] => {
  const tableName = businessTypeTableMapping[businessType];
  if (!tableName) return [];

  const tableColumns = tableSchemas[tableName];
  if (!tableColumns) return [];

  const allowedFields = businessTypeFieldFilter[businessType] || [];
  const labels = fieldLabelMapping[tableName] || {};
  const requiredMap = fieldRequiredMapping[tableName] || {};
  const optionsMap = fieldOptionsMapping[tableName] || {};

  const fields: Omit<FormField, 'id' | 'template_id'>[] = [];
  const applicantField = applicantFieldMapping[tableName];

  // 按照 allowedFields 的顺序生成字段
  allowedFields.forEach((fieldName, index) => {
    const column = tableColumns.find(c => c.column_name === fieldName);
    if (!column) return;

    // 排除系统字段
    if (excludedFields.includes(column.column_name)) return;

    // 申请人字段使用 user 类型
    let fieldType = dbTypeToFieldType[column.data_type] || "text";
    if (column.column_name === applicantField) {
      fieldType = "user";
    }

    const label = labels[column.column_name] || column.column_name;
    const isRequired = requiredMap[column.column_name] ?? !column.is_nullable;
    const options = optionsMap[column.column_name] || null;

    // 根据字段类型设置 col_span
    let colSpan = 2;
    if (fieldType === "datetime" || fieldType === "date" || fieldType === "number" || fieldType === "select") {
      colSpan = 1;
    }
    // textarea 始终占满整行
    if (fieldType === "textarea") {
      colSpan = 2;
    }
    // 申请人字段（user类型）占满整行
    if (fieldType === "user") {
      colSpan = 2;
    }

    fields.push({
      field_type: fieldType,
      field_name: column.column_name,
      field_label: label,
      placeholder: fieldType === "user" ? "自动获取当前用户" : `请输入${label}`,
      is_required: isRequired,
      sort_order: index + 1,
      field_options: options,
      col_span: colSpan,
    });
  });

  return fields;
};

/**
 * 获取业务类型对应的数据库表名
 */
export const getTableNameForBusinessType = (businessType: string): string | null => {
  return businessTypeTableMapping[businessType] || null;
};

/**
 * 获取数据库表的所有可用字段（用于控件库展示）
 */
export const getAvailableFieldsForBusinessType = (businessType: string): TableColumn[] => {
  const tableName = businessTypeTableMapping[businessType];
  if (!tableName) return [];

  const tableColumns = tableSchemas[tableName];
  if (!tableColumns) return [];

  // 过滤掉系统字段
  return tableColumns.filter(col => !excludedFields.includes(col.column_name));
};

// 请假类型映射（用于表单显示）
export const leaveTypeLabels: Record<string, string> = {
  annual: "年假",
  sick: "病假",
  personal: "事假",
};
