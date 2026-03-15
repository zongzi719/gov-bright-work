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
import { Plus, CalendarIcon, Trash2, FileText, GitBranch } from "lucide-react";
import * as dataAdapter from "@/lib/dataAdapter";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { parseTime, normalizeDate } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import ApprovalTimeline from "@/components/admin/ApprovalTimeline";

interface SupplyPurchase {
  id: string;
  department: string;
  purchase_date: string;
  reason: string | null;
  total_amount: number;
  applicant_name: string;
  status: string;
  created_at: string;
}

interface PurchaseItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
  supply_id?: string | null;
  specification?: string | null;
  unit?: string | null;
}

interface FormItem {
  supply_id: string;
  item_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string;
}

interface OfficeSupply {
  id: string;
  name: string;
  specification: string | null;
  unit: string;
  current_stock: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "待审批", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "已通过", variant: "default", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "已拒绝", variant: "destructive", className: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "已完成", variant: "outline", className: "bg-slate-50 text-slate-600 border-slate-200" },
};

const SuppliesPurchase = () => {
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<SupplyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SupplyPurchase | null>(null);
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  
  // Form state
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([
    { supply_id: "", item_name: "", specification: "", unit: "个", quantity: 1, unit_price: 0, amount: 0, remarks: "" }
  ]);
  const [purchaseDateOpen, setPurchaseDateOpen] = useState(false);

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
    const { data, error } = await dataAdapter.getSupplyPurchases({ applicant_name: currentUser.name });

    if (!error && data) {
      setRecords(data as SupplyPurchase[]);
    }
    setLoading(false);
  };

  const fetchSupplies = async () => {
    const { data } = await dataAdapter.getOfficeSupplies({ is_active: true });
    if (data) setSupplies(data as OfficeSupply[]);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.name]);

  const filteredRecords = records.filter(r =>
    r.department.includes(search) ||
    r.applicant_name.includes(search) ||
    r.purchase_date.includes(search)
  );

  const totalAmount = formItems.reduce((sum, item) => sum + item.amount, 0);

  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: `办公用品采购申请`,
    subtitle: `${record.department} - ${record.applicant_name}`,
    time: format(parseTime(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "申请日期", value: normalizeDate(record.purchase_date) },
      { label: "合计金额", value: `¥${(record.total_amount || 0).toFixed(2)}` },
    ],
  }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      const { data } = await dataAdapter.getSupplyPurchaseItems(record.id);
      
      if (data) {
        setSelectedItems(data as PurchaseItem[]);
      }
      setDetailOpen(true);
      void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.SUPPLY, target_type: '办公用品采购', target_id: record.id, target_name: `${record.department} - ${record.applicant_name}` });
    }
  };

  const handleOpenForm = () => {
    fetchSupplies();
    setDepartment(currentUser?.department || "");
    setReason("");
    setPurchaseDate(new Date());
    setFormItems([{ supply_id: "", item_name: "", specification: "", unit: "个", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]);
    setFormOpen(true);
  };

  const handleAddItem = () => {
    setFormItems([...formItems, { supply_id: "", item_name: "", specification: "", unit: "个", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // 当选择库存物品时，自动填充名称、规格、单位
    if (field === "supply_id" && value) {
      const supply = supplies.find(s => s.id === value);
      if (supply) {
        newItems[index].item_name = supply.name;
        newItems[index].specification = supply.specification || "";
        newItems[index].unit = supply.unit;
      }
    }
    
    if (field === "quantity" || field === "unit_price") {
      const quantity = field === "quantity" ? Number(value) : newItems[index].quantity;
      const unitPrice = field === "unit_price" ? Number(value) : newItems[index].unit_price;
      newItems[index].amount = Number((quantity * unitPrice).toFixed(2));
    }
    setFormItems(newItems);
  };

  const handleSubmit = async () => {
    if (!department.trim()) {
      toast.error("请填写申请科室");
      return;
    }

    const validItems = formItems.filter(item => item.item_name.trim() && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("请至少添加一条物品明细");
      return;
    }

    setSubmitting(true);

    const calculatedTotal = validItems.reduce((sum, item) => sum + item.amount, 0);

    const { data: record, error } = await dataAdapter.createSupplyPurchase({
      department,
      purchase_date: format(purchaseDate, "yyyy-MM-dd"),
      reason: reason || null,
      total_amount: calculatedTotal,
      applicant_id: currentUser?.id || "",
      applicant_name: currentUser?.name || "",
    });

    if (error || !record) {
      toast.error("提交采购申请失败");
      setSubmitting(false);
      return;
    }

    const itemsToInsert = validItems.map(item => ({
      purchase_id: record.id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      remarks: item.remarks || null,
      supply_id: item.supply_id || null,
      specification: item.specification || null,
      unit: item.unit || "个",
    }));

    const { error: itemsError } = await dataAdapter.createSupplyPurchaseItems(itemsToInsert);

    if (itemsError) {
      toast.error("保存物品明细失败");
      setSubmitting(false);
      return;
    }

    const itemNames = validItems.map(item => item.item_name).join(", ");

    const approvalResult = await startApproval({
      businessType: "supply_purchase",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `办公用品采购 - ${itemNames.substring(0, 30)}${itemNames.length > 30 ? "..." : ""}`,
      formData: {
        department,
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        reason,
        total_amount: calculatedTotal,
        items: validItems,
      },
    });

    setSubmitting(false);

    if (approvalResult.success) {
      await logAudit({
        action: AUDIT_ACTIONS.CREATE,
        module: AUDIT_MODULES.SUPPLY,
        target_type: '办公用品采购',
        target_id: record.id,
        target_name: itemNames.substring(0, 50),
        detail: { total_amount: calculatedTotal, department },
      });
      toast.success("采购申请已提交");
      setFormOpen(false);
      fetchRecords();
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  return (
    <PageLayout>
      <ApplicationList
        title="办公用品采购申请"
        items={listItems}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onAddClick={handleOpenForm}
        onItemClick={handleItemClick}
        searchPlaceholder="搜索科室或日期..."
        emptyText="暂无采购记录"
        statusConfig={statusConfig}
      />

      {/* 新增对话框 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>新建办公用品采购申请</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请科室 *</Label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="请输入申请科室"
                />
              </div>
              <div className="space-y-2">
                <Label>申请日期 *</Label>
                <Popover open={purchaseDateOpen} onOpenChange={setPurchaseDateOpen}>
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
                      onSelect={(date) => {
                        if (date) {
                          setPurchaseDate(date);
                          setPurchaseDateOpen(false);
                        }
                      }}
                      locale={zhCN}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>经办人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
              </div>
            </div>

            {/* 物品明细 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>采购物品明细 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  添加物品
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[35%]">物品（从库存选择或手动输入）</TableHead>
                      <TableHead className="w-[12%]">数量</TableHead>
                      <TableHead className="w-[15%]">单价（元）</TableHead>
                      <TableHead className="w-[13%]">金额</TableHead>
                      <TableHead className="w-[15%]">备注</TableHead>
                      <TableHead className="w-[10%]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2">
                          <div className="space-y-1">
                            <Select
                              value={item.supply_id}
                              onValueChange={(v) => handleItemChange(index, "supply_id", v)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="选择库存物品" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manual">手动输入物品</SelectItem>
                                {supplies.map((supply) => (
                                  <SelectItem key={supply.id} value={supply.id}>
                                    {supply.name}{supply.specification ? ` (${supply.specification})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {(item.supply_id === "manual" || !item.supply_id) && (
                              <Input
                                value={item.item_name}
                                onChange={(e) => handleItemChange(index, "item_name", e.target.value)}
                                placeholder="输入物品名称"
                                className="mt-1"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                            onBlur={(e) => {
                              if (!e.target.value || parseInt(e.target.value) < 1) {
                                handleItemChange(index, "quantity", 1);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)}
                            onBlur={(e) => {
                              if (!e.target.value) {
                                handleItemChange(index, "unit_price", 0);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="p-2 text-right font-medium">
                          ¥{(item.amount || 0).toFixed(2)}
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
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3} className="text-right font-medium">合计金额：</TableCell>
                      <TableCell className="font-bold text-primary">¥{(totalAmount || 0).toFixed(2)}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <Label>采购原因/用途</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请输入采购原因或用途说明"
                rows={2}
              />
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
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
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
                        <Label className="text-xs text-muted-foreground font-normal">申请科室</Label>
                        <div className="text-sm">{selectedRecord.department}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">经办人</Label>
                        <div className="text-sm">{selectedRecord.applicant_name}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">申请日期</Label>
                        <div className="text-sm">{normalizeDate(selectedRecord.purchase_date)}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">合计金额</Label>
                        <div className="text-sm font-medium text-primary">¥{(selectedRecord.total_amount || 0).toFixed(2)}</div>
                      </div>
                    </div>
                    
                    {selectedRecord.reason && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">采购原因/用途</Label>
                        <div className="text-sm">{selectedRecord.reason}</div>
                      </div>
                    )}
                    
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">物品明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>物品名称</TableHead>
                              <TableHead>数量</TableHead>
                              <TableHead>单价</TableHead>
                              <TableHead>金额</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">暂无明细</TableCell>
                              </TableRow>
                            ) : (
                              selectedItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.item_name}</TableCell>
                                  <TableCell>{item.quantity} {item.unit || ""}</TableCell>
                                  <TableCell>¥{(item.unit_price || 0).toFixed(2)}</TableCell>
                                  <TableCell>¥{(item.amount || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="approval" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[calc(85vh-180px)]">
                  <div className="px-6 py-4">
                    <ApprovalTimeline 
                      businessId={selectedRecord.id}
                      businessType="supply_purchase"
                    />
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

export default SuppliesPurchase;
