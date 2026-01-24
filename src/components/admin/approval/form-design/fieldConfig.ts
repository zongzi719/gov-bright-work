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
} from "lucide-react";
import type { FieldTypeConfig, BusinessFormConfig, FormField } from "./types";

export const fieldTypeConfig: Record<string, FieldTypeConfig> = {
  text: { icon: Type, label: "单行输入", placeholder: "请输入" },
  textarea: { icon: AlignLeft, label: "多行输入", placeholder: "请输入详细内容" },
  number: { icon: Hash, label: "数字", placeholder: "请输入数字" },
  money: { icon: DollarSign, label: "金额", placeholder: "请输入金额" },
  date: { icon: Calendar, label: "日期", placeholder: "请选择日期" },
  daterange: { icon: Calendar, label: "日期区间", placeholder: "请选择日期范围" },
  image: { icon: Image, label: "图片", placeholder: "请上传图片" },
  select: { icon: List, label: "下拉选择", placeholder: "请选择" },
  radio: { icon: CircleDot, label: "单选框", placeholder: "请选择" },
  checkbox: { icon: CheckSquare, label: "多选框", placeholder: "请选择" },
};

// 已有业务表单的默认字段配置
export const businessFormDefaults: BusinessFormConfig[] = [
  {
    business_type: "business_trip",
    defaultFields: [
      { field_type: "text", field_name: "destination", field_label: "目的地", placeholder: "请输入出差目的地", is_required: true, sort_order: 1, field_options: null, col_span: 1 },
      { field_type: "text", field_name: "purpose", field_label: "出差事由", placeholder: "请输入出差事由", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "daterange", field_name: "trip_dates", field_label: "出差日期", placeholder: "请选择出差起止日期", is_required: true, sort_order: 3, field_options: null, col_span: 2 },
      { field_type: "textarea", field_name: "remark", field_label: "备注说明", placeholder: "请输入备注信息", is_required: false, sort_order: 4, field_options: null, col_span: 2 },
    ],
  },
  {
    business_type: "leave",
    defaultFields: [
      { field_type: "select", field_name: "leave_type", field_label: "请假类型", placeholder: "请选择请假类型", is_required: true, sort_order: 1, field_options: ["年假", "事假", "病假", "婚假", "产假", "陪产假", "丧假"], col_span: 1 },
      { field_type: "number", field_name: "days", field_label: "请假天数", placeholder: "请输入请假天数", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "daterange", field_name: "leave_dates", field_label: "请假日期", placeholder: "请选择请假起止日期", is_required: true, sort_order: 3, field_options: null, col_span: 2 },
      { field_type: "textarea", field_name: "reason", field_label: "请假原因", placeholder: "请输入请假原因", is_required: true, sort_order: 4, field_options: null, col_span: 2 },
    ],
  },
  {
    business_type: "out",
    defaultFields: [
      { field_type: "text", field_name: "destination", field_label: "外出地点", placeholder: "请输入外出地点", is_required: true, sort_order: 1, field_options: null, col_span: 1 },
      { field_type: "text", field_name: "reason", field_label: "外出事由", placeholder: "请输入外出事由", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "date", field_name: "out_date", field_label: "外出日期", placeholder: "请选择外出日期", is_required: true, sort_order: 3, field_options: null, col_span: 1 },
      { field_type: "text", field_name: "out_time", field_label: "预计时长", placeholder: "如：2小时", is_required: false, sort_order: 4, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "remark", field_label: "备注", placeholder: "请输入备注信息", is_required: false, sort_order: 5, field_options: null, col_span: 2 },
    ],
  },
  {
    business_type: "supply_requisition",
    defaultFields: [
      { field_type: "text", field_name: "supply_name", field_label: "物品名称", placeholder: "请输入物品名称", is_required: true, sort_order: 1, field_options: null, col_span: 1 },
      { field_type: "number", field_name: "quantity", field_label: "申请数量", placeholder: "请输入申请数量", is_required: true, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "purpose", field_label: "用途说明", placeholder: "请说明领用用途", is_required: false, sort_order: 3, field_options: null, col_span: 2 },
    ],
  },
  {
    business_type: "purchase_request",
    defaultFields: [
      { field_type: "text", field_name: "item_name", field_label: "采购物品", placeholder: "请输入物品名称", is_required: true, sort_order: 1, field_options: null, col_span: 1 },
      { field_type: "text", field_name: "specification", field_label: "规格型号", placeholder: "请输入规格型号", is_required: false, sort_order: 2, field_options: null, col_span: 1 },
      { field_type: "number", field_name: "quantity", field_label: "采购数量", placeholder: "请输入数量", is_required: true, sort_order: 3, field_options: null, col_span: 1 },
      { field_type: "money", field_name: "estimated_price", field_label: "预估单价", placeholder: "请输入预估单价", is_required: false, sort_order: 4, field_options: null, col_span: 1 },
      { field_type: "textarea", field_name: "reason", field_label: "采购原因", placeholder: "请说明采购原因", is_required: true, sort_order: 5, field_options: null, col_span: 2 },
    ],
  },
];

export const getDefaultFieldsForBusinessType = (businessType: string): Omit<FormField, 'id' | 'template_id'>[] => {
  const config = businessFormDefaults.find(c => c.business_type === businessType);
  return config?.defaultFields || [];
};
