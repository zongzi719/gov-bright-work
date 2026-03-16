import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime } from "@/lib/utils";

interface BusinessDataRendererProps {
  businessType: string;
  businessData: Record<string, any>;
  formData?: Record<string, any> | null;
  initiatorName?: string | null;
}

/**
 * 业务数据渲染组件 - 根据业务类型渲染对应的表单数据
 * 确保提交表单和审批详情展示一致
 */
const BusinessDataRenderer = ({ businessType, businessData, formData, initiatorName }: BusinessDataRendererProps) => {
  // 合并业务数据和表单数据（表单数据优先）
  const data = { ...businessData, ...formData };

  // 格式化日期时间 - 使用共享的 parseTime

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      return format(parseTime(value), "yyyy-MM-dd HH:mm", { locale: zhCN });
    } catch {
      return value;
    }
  };

  // 格式化日期 + 上午/下午（出差专用）
  const formatDateAmPm = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      const d = parseTime(value);
      return `${format(d, "yyyy-MM-dd")} ${d.getHours() < 12 ? "上午" : "下午"}`;
    } catch {
      return value;
    }
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      return format(parseTime(value), "yyyy-MM-dd", { locale: zhCN });
    } catch {
      return value;
    }
  };

  // 格式化金额
  const formatMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return `¥${Number(value).toFixed(2)}`;
  };

  // 渲染单个字段
  const renderField = (label: string, value: any, colSpan: 1 | 2 = 1) => (
    <div className={colSpan === 2 ? "col-span-2" : "col-span-1"}>
      <Label className="text-xs text-muted-foreground font-normal">{label}</Label>
      <div className="mt-1 text-sm">{value || "-"}</div>
    </div>
  );

  // 采购申请 (purchase_request)
  if (businessType === "purchase_request") {
    const items = data.items || [];
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {renderField("申请人", data.requested_by || initiatorName)}
          {renderField("申请部门", data.department)}
          {renderField("申请日期", formatDate(data.purchase_date))}
          {renderField("预计完成时间", formatDate(data.expected_completion_date))}
          {renderField("采购方式", data.procurement_method)}
          {renderField("资金来源", getFundingSourceLabel(data.funding_source, data.funding_detail))}
          {renderField("预算金额", formatMoney(data.budget_amount))}
          {renderField("合计金额", formatMoney(data.total_amount))}
        </div>

        {data.purpose && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-normal">采购用途</Label>
            <div className="text-sm">{data.purpose}</div>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-normal">采购物品明细</Label>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>物品名称</TableHead>
                      <TableHead>规格型号</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead className="text-center">数量</TableHead>
                      <TableHead className="text-right">单价(元)</TableHead>
                      <TableHead className="text-right">小计(元)</TableHead>
                      <TableHead>政采云链接</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: any, index: number) => (
                      <TableRow key={item.id || index}>
                        <TableCell>{item.item_name || "-"}</TableCell>
                        <TableCell>{item.specification || "-"}</TableCell>
                        <TableCell>{item.unit || "-"}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{Number(item.unit_price || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(item.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {item.category_link ? (
                            <a href={item.category_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              查看链接
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{item.remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={5} className="text-right font-medium">合计金额</TableCell>
                      <TableCell className="text-right font-bold">{formatMoney(data.total_amount)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 办公用品采购 (supply_purchase)
  if (businessType === "supply_purchase") {
    const items = data.items || [];
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {renderField("申请科室", data.department)}
          {renderField("申请日期", formatDate(data.purchase_date))}
          {renderField("经办人", data.applicant_name || initiatorName)}
          {renderField("合计金额", formatMoney(data.total_amount))}
        </div>

        {data.reason && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-normal">购置理由</Label>
            <div className="text-sm">{data.reason}</div>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-normal">采购物品明细</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>名称</TableHead>
                    <TableHead className="text-center">数量</TableHead>
                    <TableHead className="text-right">单价(元)</TableHead>
                    <TableHead className="text-right">金额(元)</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, index: number) => (
                    <TableRow key={item.id || index}>
                      <TableCell>{item.item_name || "-"}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{Number(item.unit_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{Number(item.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{item.remarks || "-"}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={3} className="text-right font-medium">合计</TableCell>
                    <TableCell className="text-right font-bold">{formatMoney(data.total_amount)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 领用申请 (supply_requisition)
  if (businessType === "supply_requisition") {
    const items = data.items || [];
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {renderField("申请人", data.requisition_by)}
          {renderField("申请日期", formatDate(data.requisition_date))}
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-normal">领用物品明细</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>物品名称</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead className="text-center">数量</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any, index: number) => (
                    <TableRow key={item.id || index}>
                      <TableCell>{item.office_supplies?.name || item.supply?.name || item.supply_name || item.item_name || "-"}</TableCell>
                      <TableCell>{item.office_supplies?.specification || item.supply?.specification || item.specification || "-"}</TableCell>
                      <TableCell>{item.office_supplies?.unit || item.supply?.unit || item.unit || "-"}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 请假/外出/出差 (absence, leave, out, business_trip)
  if (businessType === "absence" || businessType === "leave" || businessType === "out" || businessType === "business_trip") {
    const contactName = data.contacts?.name || data.contact_name || "-";
    const contactDept = data.contacts?.department || data.department || "-";

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {renderField("申请人", contactName)}
          {renderField("所属部门", contactDept)}
          {renderField("开始时间", businessType === "business_trip" ? formatDateAmPm(data.start_time) : formatDateTime(data.start_time))}
          {renderField("结束时间", businessType === "business_trip" ? formatDateAmPm(data.end_time) : formatDateTime(data.end_time))}
          
          {/* 请假类型 - 仅请假显示 */}
          {data.leave_type && renderField("请假类型", getLeaveTypeLabel(data.leave_type))}
          
          {/* 出差相关字段 */}
          {data.destination && renderField("出差目的地", data.destination)}
          {data.transport_type && renderField("交通方式", getTransportTypeLabel(data.transport_type))}
          {data.duration_days != null && !data.leave_type && renderField("出差天数", `${data.duration_days} 天`)}
          {data.estimated_cost && renderField("预计费用", formatMoney(data.estimated_cost))}
          
          {/* 请假相关字段 - 显示小时和换算天数 */}
          {data.leave_type && data.duration_hours && renderField("请假时长", `${data.duration_hours} 小时（${data.duration_days || (data.duration_hours / 8)} 天）`)}
          
          {/* 外出相关字段 */}
          {data.out_type && renderField("外出类型", getOutTypeLabel(data.out_type))}
          {data.out_location && renderField("外出地点", data.out_location)}
          {data.contact_phone && renderField("联系电话", data.contact_phone)}
        </div>

        {data.reason && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-normal">事由</Label>
            <div className="text-sm whitespace-pre-wrap">{data.reason}</div>
          </div>
        )}

        {data.notes && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-normal">备注</Label>
            <div className="text-sm whitespace-pre-wrap">{data.notes}</div>
          </div>
        )}
      </div>
    );
  }

  // 默认渲染 - 显示所有非系统字段
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {Object.entries(data)
        .filter(([key]) => !['id', 'created_at', 'updated_at', 'status', 'items', 'contacts', 'supply'].includes(key))
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) return null;
          return renderField(key, String(value ?? '-'));
        })}
    </div>
  );
};

// 辅助函数 - 资金来源标签
const getFundingSourceLabel = (source: string | null | undefined, detail: string | null | undefined) => {
  if (!source) return "-";
  const sourceLabels: Record<string, string> = {
    "财政拨款": "财政拨款",
    "专项经费": "专项经费",
    "其他": "其他",
  };
  const label = sourceLabels[source] || source;
  return detail ? `${label}（${detail}）` : label;
};

// 辅助函数 - 请假类型标签（完整9种假种）
const getLeaveTypeLabel = (type: string | null | undefined) => {
  if (!type) return "-";
  const labels: Record<string, string> = {
    annual: "年假",
    sick: "病假",
    personal: "事假",
    paternity: "陪产假",
    bereavement: "丧假",
    maternity: "产假",
    nursing: "哺乳假",
    marriage: "婚假",
    compensatory: "调休",
  };
  return labels[type] || type;
};

// 辅助函数 - 外出类型标签
const getOutTypeLabel = (type: string | null | undefined) => {
  if (!type) return "-";
  const labels: Record<string, string> = {
    meeting: "外出开会",
    client: "拜访客户",
    errand: "外出办事",
    other: "其他",
  };
  return labels[type] || type;
};

// 辅助函数 - 交通方式标签
const getTransportTypeLabel = (type: string | null | undefined) => {
  if (!type) return "-";
  const labels: Record<string, string> = {
    plane: "飞机",
    train: "火车/高铁",
    car: "汽车/自驾",
    other: "其他",
  };
  return labels[type] || type;
};

export default BusinessDataRenderer;
