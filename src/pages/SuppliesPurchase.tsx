import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarIcon, Trash2, FileText, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
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
}

interface FormItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string;
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
  
  // Form state
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([
    { item_name: "", quantity: 1, unit_price: 0, amount: 0, remarks: "" }
  ]);

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
      .from("supply_purchases")
      .select("*")
      .eq("applicant_name", currentUser.name)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRecords(data as SupplyPurchase[]);
    }
    setLoading(false);
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
    time: format(new Date(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "申请日期", value: record.purchase_date },
      { label: "合计金额", value: `¥${record.total_amount.toFixed(2)}` },
    ],
  }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      const { data } = await supabase
        .from("supply_purchase_items")
        .select("*")
        .eq("purchase_id", record.id);
      
      if (data) {
        setSelectedItems(data as PurchaseItem[]);
      }
      setDetailOpen(true);
    }
  };

  const handleOpenForm = () => {
    setDepartment(currentUser?.department || "");
    setReason("");
    setPurchaseDate(new Date());
    setFormItems([{ item_name: "", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]);
    setFormOpen(true);
  };

  const handleAddItem = () => {
    setFormItems([...formItems, { item_name: "", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]);
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

    const { data: record, error } = await supabase
      .from("supply_purchases")
      .insert({
        department,
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        reason: reason || null,
        total_amount: calculatedTotal,
        applicant_id: currentUser?.id || "",
        applicant_name: currentUser?.name || "",
      })
      .select("id")
      .single();

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
    }));

    const { error: itemsError } = await supabase
      .from("supply_purchase_items")
      .insert(itemsToInsert);

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
                      <TableHead className="w-[30%]">名称</TableHead>
                      <TableHead className="w-[12%]">数量</TableHead>
                      <TableHead className="w-[15%]">单价（元）</TableHead>
                      <TableHead className="w-[13%]">金额</TableHead>
                      <TableHead className="w-[20%]">备注</TableHead>
                      <TableHead className="w-[10%]">操作</TableHead>
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
                          ¥{item.amount.toFixed(2)}
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
                      <TableCell colSpan={3} className="text-right font-medium">
                        合计金额（元）
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        ¥{totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 购置理由 */}
            <div className="space-y-2">
              <Label>购置理由</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请填写购置理由（如：日常办公所需、会议保障等）"
                rows={3}
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
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
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
                        <Label className="text-xs text-muted-foreground font-normal">申请日期</Label>
                        <div className="text-sm">{selectedRecord.purchase_date}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">经办人</Label>
                        <div className="text-sm">{selectedRecord.applicant_name}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">合计金额</Label>
                        <div className="text-sm font-medium text-primary">¥{selectedRecord.total_amount.toFixed(2)}</div>
                      </div>
                      {selectedRecord.reason && (
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-xs text-muted-foreground font-normal">购置理由</Label>
                          <div className="text-sm">{selectedRecord.reason}</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">采购物品明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>名称</TableHead>
                              <TableHead className="text-center">数量</TableHead>
                              <TableHead className="text-right">单价</TableHead>
                              <TableHead className="text-right">金额</TableHead>
                              <TableHead>备注</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">暂无明细</TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {selectedItems.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.item_name}</TableCell>
                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                    <TableCell className="text-right">¥{item.unit_price.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">¥{item.amount.toFixed(2)}</TableCell>
                                    <TableCell>{item.remarks || "-"}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={3} className="text-right font-medium">合计</TableCell>
                                  <TableCell className="text-right font-bold">¥{selectedRecord.total_amount.toFixed(2)}</TableCell>
                                  <TableCell></TableCell>
                                </TableRow>
                              </>
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
                    <ApprovalTimeline businessId={selectedRecord.id} businessType="supply_purchase" />
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
