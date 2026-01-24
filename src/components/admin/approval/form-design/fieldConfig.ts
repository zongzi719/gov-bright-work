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
};

/**
 * 已有业务表单的默认字段配置
 * 基于实际数据库表结构：
 * - absence_records: 用于外出(out)、请假(leave)、出差(business_trip)、会议(meeting)
 * - supply_requisitions: 物品领用
 * - purchase_requests: 物品采购
 */
export const businessFormDefaults: BusinessFormConfig[] = [
  {
    // 出差申请 - 对应 absence_records 表 (type = 'business_trip')
    business_type: "business_trip",
    defaultFields: [
      { field_type: "datetime", field_name: "start_time", field_label: "开始时间", placeholder: "请选择出差开始时间", is_required: true, sort_order: 1, field_options: null, col_span: 1 },
      { field_type: "datetime", field_name: "end_time", field_label: "结束时间", placeholder: "请选择出差结束时间", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "reason", field_label: "出差事由", placeholder: "请输入出差事由", is_required: true, sort_order: 3, field_options: null, col_span: 2 },
      { field_type: "textarea", field_name: "notes", field_label: "备注说明", placeholder: "请输入备注信息（如目的地、行程安排等）", is_required: false, sort_order: 4, field_options: null, col_span: 2 },
    ],
  },
  {
    // 请假申请 - 对应 absence_records 表 (type = 'leave')
    business_type: "leave",
    defaultFields: [
      { field_type: "select", field_name: "leave_type", field_label: "请假类型", placeholder: "请选择请假类型", is_required: true, sort_order: 1, field_options: ["annual", "sick", "personal"], col_span: 1 },
      { field_type: "datetime", field_name: "start_time", field_label: "开始时间", placeholder: "请选择请假开始时间", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "datetime", field_name: "end_time", field_label: "结束时间", placeholder: "请选择请假结束时间", is_required: true, sort_order: 3, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "reason", field_label: "请假原因", placeholder: "请输入请假原因", is_required: true, sort_order: 4, field_options: null, col_span: 2 },
      { field_type: "textarea", field_name: "notes", field_label: "备注", placeholder: "请输入备注信息", is_required: false, sort_order: 5, field_options: null, col_span: 2 },
    ],
  },
  {
    // 外出申请 - 对应 absence_records 表 (type = 'out')
    business_type: "out",
    defaultFields: [
      { field_type: "datetime", field_name: "start_time", field_label: "外出时间", placeholder: "请选择外出开始时间", is_required: true, sort_order: 1, field_options: null, col_span: 1 },
      { field_type: "datetime", field_name: "end_time", field_label: "预计返回", placeholder: "请选择预计返回时间", is_required: false, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "reason", field_label: "外出事由", placeholder: "请输入外出事由", is_required: true, sort_order: 3, field_options: null, col_span: 2 },
      { field_type: "textarea", field_name: "notes", field_label: "备注", placeholder: "请输入备注信息（如外出地点等）", is_required: false, sort_order: 4, field_options: null, col_span: 2 },
    ],
  },
  {
    // 物品领用 - 对应 supply_requisitions 表
    business_type: "supply_requisition",
    defaultFields: [
      { field_type: "select", field_name: "supply_id", field_label: "领用物品", placeholder: "请选择要领用的物品", is_required: true, sort_order: 1, field_options: null, col_span: 2 },
      { field_type: "number", field_name: "quantity", field_label: "领用数量", placeholder: "请输入领用数量", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
    ],
  },
  {
    // 物品采购 - 对应 purchase_requests 表
    business_type: "purchase_request",
    defaultFields: [
      { field_type: "select", field_name: "supply_id", field_label: "采购物品", placeholder: "请选择要采购的物品", is_required: true, sort_order: 1, field_options: null, col_span: 2 },
      { field_type: "number", field_name: "quantity", field_label: "采购数量", placeholder: "请输入采购数量", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "reason", field_label: "采购原因", placeholder: "请说明采购原因", is_required: false, sort_order: 3, field_options: null, col_span: 2 },
    ],
  },
];

// 请假类型映射（用于表单显示）
export const leaveTypeLabels: Record<string, string> = {
  annual: "年假",
  sick: "病假",
  personal: "事假",
};

export const getDefaultFieldsForBusinessType = (businessType: string): Omit<FormField, 'id' | 'template_id'>[] => {
  const config = businessFormDefaults.find(c => c.business_type === businessType);
  return config?.defaultFields || [];
};
