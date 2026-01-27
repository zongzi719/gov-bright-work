import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Search, Eye, CalendarIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";

interface PurchaseRequest {
  id: string;
  requested_by: string;
  purchase_date: string;
  total_amount: number | null;
  reason: string | null;
  status: string;
  created_at: string;
}

interface PurchaseItem {
  id: string;
  supply_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  office_supplies: {
    name: string;
    specification: string | null;
    unit: string;
  } | null;
}

interface OfficeSupply {
  id: string;
  name: string;
  specification: string | null;
  unit: string;
}

interface FormItem {
  supply_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  completed: { label: "已完成", variant: "outline" },
};

const Purchase = () => {
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PurchaseRequest | null>(null);
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [reason, setReason] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([{ supply_id: "", quantity: 1, unit_price: 0, amount: 0 }]);

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
      .select("id, requested_by, purchase_date, total_amount, reason, status, created_at")
      .eq("requested_by", currentUser.name)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRecords(data as PurchaseRequest[]);
    }
    setLoading(false);
  };

  const fetchSupplies = async () => {
    const { data } = await supabase
      .from("office_supplies")
      .select("id, name, specification, unit")
      .eq("is_active", true)
      .order("name");
    if (data) setSupplies(data);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.name]);

  const filteredRecords = records.filter(r =>
    r.requested_by.includes(search) ||
    r.reason?.includes(search)
  );

  const handleViewDetail = async (record: PurchaseRequest) => {
    setSelectedRecord(record);
    // Fetch items for this request
    const { data } = await supabase
      .from("purchase_request_items")
      .select(`
        id, supply_id, quantity, unit_price, amount,
        office_supplies (name, specification, unit)
      `)
      .eq("request_id", record.id);
    
    if (data) {
      setSelectedItems(data as PurchaseItem[]);
    }
    setDetailOpen(true);
  };

  const handleOpenForm = () => {
    fetchSupplies();
    setFormItems([{ supply_id: "", quantity: 1, unit_price: 0, amount: 0 }]);
    setPurchaseDate(new Date());
    setReason("");
    setFormOpen(true);
  };

  const handleAddItem = () => {
    setFormItems([...formItems, { supply_id: "", quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate amount when quantity or unit_price changes
    if (field === "quantity" || field === "unit_price") {
      const quantity = field === "quantity" ? Number(value) : newItems[index].quantity;
      const unitPrice = field === "unit_price" ? Number(value) : newItems[index].unit_price;
      newItems[index].amount = Number((quantity * unitPrice).toFixed(2));
    }
    
    setFormItems(newItems);
  };

  // Calculate total amount
  const totalAmount = formItems.reduce((sum, item) => sum + item.amount, 0);

  const handleSubmit = async () => {
    // Validate items
    const validItems = formItems.filter(item => item.supply_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("请至少添加一条采购明细");
      return;
    }

    setSubmitting(true);

    // Create purchase request record
    const { data: record, error } = await supabase
      .from("purchase_requests")
      .insert({
        requested_by: currentUser?.name || "",
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        reason: reason.trim() || null,
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

    // Insert detail items
    const itemsToInsert = validItems.map(item => ({
      request_id: record.id,
      supply_id: item.supply_id,
      quantity: item.quantity,
      unit_price: Number(item.unit_price.toFixed(2)),
      amount: Number(item.amount.toFixed(2)),
    }));

    const { error: itemsError } = await supabase
      .from("purchase_request_items")
      .insert(itemsToInsert);

    if (itemsError) {
      toast.error("保存采购明细失败");
      setSubmitting(false);
      return;
    }

    // Build approval form data
    const itemNames = validItems.map(item => {
      const supply = supplies.find(s => s.id === item.supply_id);
      return `${supply?.name || "物品"} x ${item.quantity}`;
    }).join(", ");

    const approvalResult = await startApproval({
      businessType: "purchase_request",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `采购申请 - ${itemNames.substring(0, 50)}${itemNames.length > 50 ? "..." : ""}`,
      formData: {
        items: validItems.map(item => {
          const supply = supplies.find(s => s.id === item.supply_id);
          return {
            supply_id: item.supply_id,
            supply_name: supply?.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            amount: item.amount,
          };
        }),
        purchase_date: format(purchaseDate, "yyyy-MM-dd"),
        reason: reason,
        total_amount: totalAmount,
      },
    });

    setSubmitting(false);

    if (approvalResult.success) {
      toast.success("采购申请已提交");
      setFormOpen(false);
      setFormItems([{ supply_id: "", quantity: 1, unit_price: 0, amount: 0 }]);
      setReason("");
      fetchRecords();
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  return (
    <PageLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>采购申请</CardTitle>
          <Button onClick={handleOpenForm}>
            <Plus className="h-4 w-4 mr-2" />
            新增申请
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索申请人或原因..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无采购记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请人</TableHead>
                  <TableHead>采购日期</TableHead>
                  <TableHead>采购总额</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.requested_by}</TableCell>
                    <TableCell>{record.purchase_date}</TableCell>
                    <TableCell>¥{(record.total_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(record.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</TableCell>
                    <TableCell>
                      <Badge variant={statusLabels[record.status]?.variant || "secondary"}>
                        {statusLabels[record.status]?.label || record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetail(record)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增对话框 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>新建采购申请</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            {/* 申请人和日期 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>采购日期 *</Label>
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
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 采购明细 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>采购明细 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  添加物品
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[30%]">办公用品</TableHead>
                      <TableHead className="w-[15%]">采购数量</TableHead>
                      <TableHead className="w-[18%]">采购单价(元)</TableHead>
                      <TableHead className="w-[18%]">采购金额(元)</TableHead>
                      <TableHead className="w-[10%]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2">
                          <Select
                            value={item.supply_id}
                            onValueChange={(v) => handleItemChange(index, "supply_id", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择办公用品" />
                            </SelectTrigger>
                            <SelectContent>
                              {supplies.map((supply) => (
                                <SelectItem key={supply.id} value={supply.id}>
                                  {supply.name}{supply.specification ? ` (${supply.specification})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unit_price === 0 ? "" : item.unit_price}
                            onChange={(e) => handleItemChange(index, "unit_price", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                handleItemChange(index, "unit_price", 0);
                              }
                            }}
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
              {/* 采购总额 */}
              <div className="flex justify-end items-center gap-2 pt-2">
                <Label className="text-muted-foreground">采购总额:</Label>
                <span className="text-lg font-semibold">¥{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* 采购原因 */}
            <div className="space-y-2">
              <Label>采购原因</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明采购原因"
                rows={2}
              />
            </div>
          </div>
          {/* 固定底部操作按钮 */}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>采购详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">申请人</Label>
                  <div className="mt-1">{selectedRecord.requested_by}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">状态</Label>
                  <div className="mt-1">
                    <Badge variant={statusLabels[selectedRecord.status]?.variant || "secondary"}>
                      {statusLabels[selectedRecord.status]?.label || selectedRecord.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">采购日期</Label>
                  <div className="mt-1">{selectedRecord.purchase_date}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">申请时间</Label>
                  <div className="mt-1">{format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</div>
                </div>
              </div>
              
              {/* 采购明细 */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">采购明细</Label>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>物品名称</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead>数量</TableHead>
                        <TableHead>单价(元)</TableHead>
                        <TableHead>金额(元)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            暂无明细数据
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.office_supplies?.name || "-"}</TableCell>
                            <TableCell>{item.office_supplies?.specification || "-"}</TableCell>
                            <TableCell>{item.quantity} {item.office_supplies?.unit}</TableCell>
                            <TableCell>{item.unit_price.toFixed(2)}</TableCell>
                            <TableCell>{item.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* 采购总额 */}
                <div className="flex justify-end items-center gap-2 pt-2">
                  <Label className="text-muted-foreground">采购总额:</Label>
                  <span className="text-lg font-semibold">¥{(selectedRecord.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {selectedRecord.reason && (
                <div>
                  <Label className="text-sm text-muted-foreground">采购原因</Label>
                  <div className="mt-1">{selectedRecord.reason}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Purchase;
