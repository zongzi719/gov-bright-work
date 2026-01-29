import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, CalendarIcon, Trash2, FileText, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import ApprovalTimeline from "@/components/admin/ApprovalTimeline";

interface PurchaseRequest {
  id: string;
  requested_by: string;
  department: string | null;
  purchase_date: string;
  procurement_method: string | null;
  funding_source: string | null;
  funding_detail: string | null;
  budget_amount: number | null;
  expected_completion_date: string | null;
  purpose: string | null;
  total_amount: number | null;
  reason: string | null;
  status: string;
  created_at: string;
}

interface PurchaseItem {
  id: string;
  item_name: string | null;
  specification: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  category_link: string | null;
  remarks: string | null;
}

interface FormItem {
  item_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  category_link: string;
  remarks: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "待审批", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "已通过", variant: "default", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "已拒绝", variant: "destructive", className: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "已完成", variant: "outline", className: "bg-slate-50 text-slate-600 border-slate-200" },
};

const procurementMethods = [
  { value: "政采云平台采购", label: "政采云平台采购" },
  { value: "集中采购", label: "集中采购" },
  { value: "分散采购（政采云渠道）", label: "分散采购（政采云渠道）" },
];

const fundingSources = [
  { value: "财政拨款", label: "财政拨款", placeholder: "项目名称" },
  { value: "专项经费", label: "专项经费", placeholder: "经费编号" },
  { value: "其他", label: "其他", placeholder: "请说明" },
];

const Purchase = () => {
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PurchaseRequest | null>(null);
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [department, setDepartment] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [procurementMethod, setProcurementMethod] = useState("");
  const [fundingSource, setFundingSource] = useState("");
  const [fundingDetail, setFundingDetail] = useState("");
  const [budgetAmount, setBudgetAmount] = useState<number>(0);
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<Date | undefined>(undefined);
  const [purpose, setPurpose] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([createEmptyItem()]);

  function createEmptyItem(): FormItem {
    return {
      item_name: "",
      specification: "",
      unit: "个",
      quantity: 1,
      unit_price: 0,
      amount: 0,
      category_link: "",
      remarks: "",
    };
  }

  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) return JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse frontendUser", e);
    }
    return null;
  };

  const currentUser = getCurrentUser();

  const fetchRecords = async () => {
    if (!currentUser?.name) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("id, requested_by, department, purchase_date, procurement_method, funding_source, funding_detail, budget_amount, expected_completion_date, purpose, total_amount, reason, status, created_at")
      .eq("requested_by", currentUser.name)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRecords(data as PurchaseRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.name]);

  const filteredRecords = records.filter(r =>
    r.requested_by.includes(search) ||
    r.department?.includes(search) ||
    r.purpose?.includes(search)
  );

  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: `采购申请`,
    subtitle: record.purpose || `${record.requested_by} - ${record.department || ""}`,
    time: format(new Date(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "金额", value: `¥${(record.total_amount || 0).toFixed(2)}` },
      { label: "日期", value: record.purchase_date },
    ],
  }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      const { data } = await supabase
        .from("purchase_request_items")
        .select("id, item_name, specification, unit, quantity, unit_price, amount, category_link, remarks")
        .eq("request_id", record.id);
      
      if (data) {
        setSelectedItems(data as PurchaseItem[]);
      }
      setDetailOpen(true);
    }
  };

  const handleOpenForm = () => {
    setDepartment(currentUser?.department || "");
    setPurchaseDate(new Date());
    setProcurementMethod("");
    setFundingSource("");
    setFundingDetail("");
    setBudgetAmount(0);
    setExpectedCompletionDate(undefined);
    setPurpose("");
    setFormItems([createEmptyItem()]);
    setFormOpen(true);
  };

  const handleAddItem = () => {
    setFormItems([...formItems, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "unit_price") {
      const quantity = field === "quantity" ? Number(value) : newItems[index].quantity;
      const unitPrice = field === "unit_price" ? Number(value) : newItems[index].unit_price;
      newItems[index].amount = Number((quantity * unitPrice).toFixed(2));
    }
    
    setFormItems(newItems);
  };

  const totalAmount = formItems.reduce((sum, item) => sum + item.amount, 0);

  // 自动同步预算金额为物品明细合计
  useEffect(() => {
    setBudgetAmount(Number(totalAmount.toFixed(2)));
  }, [totalAmount]);

  const handleSubmit = async () => {
    const validItems = formItems.filter(item => item.item_name.trim() && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("请至少添加一条采购明细");
      return;
    }

    if (!procurementMethod) {
      toast.error("请选择采购方式");
      return;
    }

    if (!fundingSource) {
      toast.error("请选择资金来源");
      return;
    }

    setSubmitting(true);

    const { data: record, error } = await supabase
      .from("purchase_requests")
      .insert({
        requested_by: currentUser?.name || "",
        department: department.trim() || null,
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        procurement_method: procurementMethod,
        funding_source: fundingSource,
        funding_detail: fundingDetail.trim() || null,
        budget_amount: budgetAmount || null,
        expected_completion_date: expectedCompletionDate ? format(expectedCompletionDate, "yyyy-MM-dd") : null,
        purpose: purpose.trim() || null,
        total_amount: Number(totalAmount.toFixed(2)),
        supply_id: null,
        quantity: null,
        unit_price: null,
      } as any)
      .select("id")
      .single();

    if (error || !record) {
      toast.error("提交采购申请失败");
      setSubmitting(false);
      return;
    }

    const itemsToInsert = validItems.map(item => ({
      request_id: record.id,
      item_name: item.item_name.trim(),
      specification: item.specification.trim() || null,
      unit: item.unit || "个",
      quantity: item.quantity,
      unit_price: Number(item.unit_price.toFixed(2)),
      amount: Number(item.amount.toFixed(2)),
      category_link: item.category_link.trim() || null,
      remarks: item.remarks.trim() || null,
    }));

    const { error: itemsError } = await supabase
      .from("purchase_request_items")
      .insert(itemsToInsert);

    if (itemsError) {
      toast.error("保存采购明细失败");
      setSubmitting(false);
      return;
    }

    const itemNames = validItems.map(item => `${item.item_name} x ${item.quantity}`).join(", ");

    const approvalResult = await startApproval({
      businessType: "purchase_request",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `采购申请 - ${itemNames.substring(0, 50)}${itemNames.length > 50 ? "..." : ""}`,
      formData: {
        department,
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        procurement_method: procurementMethod,
        funding_source: fundingSource,
        funding_detail: fundingDetail,
        budget_amount: budgetAmount,
        expected_completion_date: expectedCompletionDate ? format(expectedCompletionDate, "yyyy-MM-dd") : null,
        purpose,
        items: validItems,
        total_amount: totalAmount,
      },
    });

    setSubmitting(false);

    if (approvalResult.success) {
      toast.success("采购申请已提交");
      setFormOpen(false);
      fetchRecords();
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  const getFundingSourceLabel = (source: string, detail: string | null) => {
    const sourceConfig = fundingSources.find(s => s.value === source);
    if (!sourceConfig) return source;
    return detail ? `${sourceConfig.label}（${sourceConfig.placeholder}：${detail}）` : sourceConfig.label;
  };

  return (
    <PageLayout>
      <ApplicationList
        title="采购申请"
        items={listItems}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onAddClick={handleOpenForm}
        onItemClick={handleItemClick}
        searchPlaceholder="搜索申请人、部门或用途..."
        emptyText="暂无采购记录"
        statusConfig={statusConfig}
      />

      {/* 新增对话框 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>新建采购申请</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>申请部门</Label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="请输入申请部门"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(purchaseDate, "yyyy-MM-dd", { locale: zhCN })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={purchaseDate}
                      onSelect={(date) => date && setPurchaseDate(date)}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>预计采购完成时间</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedCompletionDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expectedCompletionDate ? format(expectedCompletionDate, "yyyy-MM-dd", { locale: zhCN }) : "选择日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expectedCompletionDate}
                      onSelect={setExpectedCompletionDate}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 采购方式 */}
            <div className="space-y-2">
              <Label>采购方式 *</Label>
              <RadioGroup value={procurementMethod} onValueChange={setProcurementMethod} className="flex flex-wrap gap-4">
                {procurementMethods.map((method) => (
                  <div key={method.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={method.value} id={`method-${method.value}`} />
                    <Label htmlFor={`method-${method.value}`} className="font-normal cursor-pointer">{method.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* 资金来源 */}
            <div className="space-y-2">
              <Label>资金来源 *</Label>
              <RadioGroup value={fundingSource} onValueChange={(v) => { setFundingSource(v); setFundingDetail(""); }} className="flex flex-wrap gap-4">
                {fundingSources.map((source) => (
                  <div key={source.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={source.value} id={source.value} />
                    <Label htmlFor={source.value} className="font-normal cursor-pointer">{source.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              {fundingSource && (
                <Input
                  value={fundingDetail}
                  onChange={(e) => setFundingDetail(e.target.value)}
                  placeholder={fundingSources.find(s => s.value === fundingSource)?.placeholder || ""}
                  className="mt-2"
                />
              )}
            </div>

            {/* 预算金额 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>预算金额（元）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={budgetAmount === 0 ? "" : budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                  placeholder="请输入预算金额"
                />
              </div>
            </div>

            {/* 采购用途 */}
            <div className="space-y-2">
              <Label>采购用途</Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="如：日常办公所需、会议保障、专项工作开展等，简要说明"
                rows={2}
              />
            </div>

            {/* 采购物品明细 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>采购物品明细 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  添加物品
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="min-w-[120px]">物品名称 *</TableHead>
                        <TableHead className="min-w-[150px]">规格型号/技术参数</TableHead>
                        <TableHead className="w-[80px]">单位</TableHead>
                        <TableHead className="w-[80px]">数量 *</TableHead>
                        <TableHead className="w-[100px]">单价(元)</TableHead>
                        <TableHead className="w-[100px]">小计(元)</TableHead>
                        <TableHead className="min-w-[150px]">政采云类目/链接</TableHead>
                        <TableHead className="min-w-[100px]">备注</TableHead>
                        <TableHead className="w-[60px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="p-2">
                            <Input
                              value={item.item_name}
                              onChange={(e) => handleItemChange(index, "item_name", e.target.value)}
                              placeholder="物品名称"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.specification}
                              onChange={(e) => handleItemChange(index, "specification", e.target.value)}
                              placeholder="规格型号"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.unit}
                              onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                              placeholder="个"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity === 0 ? "" : item.quantity}
                              onChange={(e) => handleItemChange(index, "quantity", e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                              onBlur={(e) => {
                                if (e.target.value === "" || parseInt(e.target.value) < 1) {
                                  handleItemChange(index, "quantity", 1);
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={item.unit_price === 0 ? "" : item.unit_price}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                  handleItemChange(index, "unit_price", val === "" ? 0 : parseFloat(val) || 0);
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  handleItemChange(index, "unit_price", 0);
                                }
                              }}
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.amount.toFixed(2)}
                              disabled
                              className="bg-muted text-right"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.category_link}
                              onChange={(e) => handleItemChange(index, "category_link", e.target.value)}
                              placeholder="链接（可选）"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.remarks}
                              onChange={(e) => handleItemChange(index, "remarks", e.target.value)}
                              placeholder="备注"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              disabled={formItems.length === 1}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex justify-end items-center gap-2 pt-2">
                <Label className="text-muted-foreground">合计金额:</Label>
                <span className="text-lg font-semibold">¥{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-background flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "提交中..." : "提交申请"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">采购详情</DialogTitle>
              {selectedRecord && (
                <Badge
                  variant="outline"
                  className={cn("text-xs font-normal border", statusConfig[selectedRecord.status]?.className)}
                >
                  {statusConfig[selectedRecord.status]?.label || selectedRecord.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {selectedRecord && (
            <Tabs defaultValue="detail" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-4 mb-2 grid w-fit grid-cols-2 bg-muted/50">
                <TabsTrigger value="detail" className="gap-2 px-4">
                  <FileText className="w-4 h-4" />
                  申请详情
                </TabsTrigger>
                <TabsTrigger value="approval" className="gap-2 px-4">
                  <GitBranch className="w-4 h-4" />
                  审批流程
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detail" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[calc(85vh-180px)]">
                  <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">申请人</Label>
                        <div className="text-sm">{selectedRecord.requested_by}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">申请部门</Label>
                        <div className="text-sm">{selectedRecord.department || "-"}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">申请日期</Label>
                        <div className="text-sm">{selectedRecord.purchase_date}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">预计完成时间</Label>
                        <div className="text-sm">{selectedRecord.expected_completion_date || "-"}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">采购方式</Label>
                        <div className="text-sm">{selectedRecord.procurement_method || "-"}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">资金来源</Label>
                        <div className="text-sm">
                          {selectedRecord.funding_source 
                            ? getFundingSourceLabel(selectedRecord.funding_source, selectedRecord.funding_detail)
                            : "-"}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">预算金额</Label>
                        <div className="text-sm">{selectedRecord.budget_amount ? `¥${selectedRecord.budget_amount.toFixed(2)}` : "-"}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">合计金额</Label>
                        <div className="text-sm font-medium">¥{(selectedRecord.total_amount || 0).toFixed(2)}</div>
                      </div>
                    </div>

                    {selectedRecord.purpose && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">采购用途</Label>
                        <div className="text-sm">{selectedRecord.purpose}</div>
                      </div>
                    )}
                    
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">采购物品明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead>物品名称</TableHead>
                                <TableHead>规格型号</TableHead>
                                <TableHead>单位</TableHead>
                                <TableHead>数量</TableHead>
                                <TableHead>单价(元)</TableHead>
                                <TableHead>小计(元)</TableHead>
                                <TableHead>政采云链接</TableHead>
                                <TableHead>备注</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedItems.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center text-muted-foreground">暂无明细数据</TableCell>
                                </TableRow>
                              ) : (
                                selectedItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.item_name || "-"}</TableCell>
                                    <TableCell>{item.specification || "-"}</TableCell>
                                    <TableCell>{item.unit || "-"}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>{item.unit_price.toFixed(2)}</TableCell>
                                    <TableCell>{item.amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                      {item.category_link ? (
                                        <a href={item.category_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                          查看链接
                                        </a>
                                      ) : "-"}
                                    </TableCell>
                                    <TableCell>{item.remarks || "-"}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="approval" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[calc(85vh-180px)]">
                  <div className="px-6 py-4">
                    <ApprovalTimeline businessId={selectedRecord.id} businessType="purchase_request" />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Purchase;
