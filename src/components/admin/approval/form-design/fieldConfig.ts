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
  "contact_id", // 自动获取当前用户
  "requested_by", // 自动获取当前用户
  "requisition_by", // 自动获取当前用户
  "initiator_id",
  "type", // absence_records 的类型字段由 business_type 决定
];

/**
 * 字段中文标签映射
 */
const fieldLabelMapping: Record<string, Record<string, string>> = {
  absence_records: {
    start_time: "开始时间",
    end_time: "结束时间",
    reason: "事由",
    notes: "备注",
    leave_type: "请假类型",
    cancel_reason: "取消原因",
  },
  supply_requisitions: {
    supply_id: "领用物品",
    quantity: "领用数量",
  },
  purchase_requests: {
    supply_id: "采购物品",
    quantity: "采购数量",
    reason: "采购原因",
  },
};

/**
 * 字段是否必填映射
 */
const fieldRequiredMapping: Record<string, Record<string, boolean>> = {
  absence_records: {
    start_time: true,
    end_time: false,
    reason: true,
    notes: false,
    leave_type: true,
    cancel_reason: false,
  },
  supply_requisitions: {
    supply_id: true,
    quantity: true,
  },
  purchase_requests: {
    supply_id: true,
    quantity: true,
    reason: false,
  },
};

/**
 * 特定业务类型需要显示的字段（过滤掉不相关字段）
 */
const businessTypeFieldFilter: Record<string, string[]> = {
  business_trip: ["start_time", "end_time", "reason", "notes"],
  leave: ["leave_type", "start_time", "end_time", "reason", "notes"],
  out: ["start_time", "end_time", "reason", "notes"],
  supply_requisition: ["supply_id", "quantity"],
  purchase_request: ["supply_id", "quantity", "reason"],
};

/**
 * 字段特殊配置（如下拉选项）
 */
const fieldOptionsMapping: Record<string, Record<string, string[] | null>> = {
  absence_records: {
    leave_type: ["annual", "sick", "personal"],
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

  // 按照 allowedFields 的顺序生成字段
  allowedFields.forEach((fieldName, index) => {
    const column = tableColumns.find(c => c.column_name === fieldName);
    if (!column) return;

    // 排除系统字段
    if (excludedFields.includes(column.column_name)) return;

    const fieldType = dbTypeToFieldType[column.data_type] || "text";
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

    fields.push({
      field_type: fieldType,
      field_name: column.column_name,
      field_label: label,
      placeholder: `请输入${label}`,
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
