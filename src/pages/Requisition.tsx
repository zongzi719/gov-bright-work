import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

interface SupplyRequisition {
  id: string;
  requisition_by: string;
  requisition_date: string;
  status: string;
  created_at: string;
}

interface RequisitionItem {
  id: string;
  supply_id: string;
  quantity: number;
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
  current_stock: number;
}

interface FormItem {
  supply_id: string;
  quantity: number;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  completed: { label: "已完成", variant: "outline" },
};

const Requisition = () => {
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<SupplyRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SupplyRequisition | null>(null);
  const [selectedItems, setSelectedItems] = useState<RequisitionItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [requisitionDate, setRequisitionDate] = useState<Date>(new Date());
  const [formItems, setFormItems] = useState<FormItem[]>([{ supply_id: "", quantity: 1 }]);

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
      .from("supply_requisitions")
      .select("id, requisition_by, requisition_date, status, created_at")
      .eq("requisition_by", currentUser.name)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRecords(data as SupplyRequisition[]);
    }
    setLoading(false);
  };

  const fetchSupplies = async () => {
    const { data } = await supabase
      .from("office_supplies")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data) setSupplies(data);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.name]);

  const filteredRecords = records.filter(r =>
    r.requisition_by.includes(search) ||
    r.requisition_date.includes(search)
  );

  const handleViewDetail = async (record: SupplyRequisition) => {
    setSelectedRecord(record);
    // Fetch items for this requisition
    const { data } = await supabase
      .from("supply_requisition_items")
      .select(`
        id, supply_id, quantity,
        office_supplies (name, specification, unit)
      `)
      .eq("requisition_id", record.id);
    
    if (data) {
      setSelectedItems(data as RequisitionItem[]);
    }
    setDetailOpen(true);
  };

  const handleOpenForm = () => {
    fetchSupplies();
    setFormItems([{ supply_id: "", quantity: 1 }]);
    setRequisitionDate(new Date());
    setFormOpen(true);
  };

  const handleAddItem = () => {
    setFormItems([...formItems, { supply_id: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof FormItem, value: string | number) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const handleSubmit = async () => {
    // Validate items
    const validItems = formItems.filter(item => item.supply_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("请至少添加一条物品明细");
      return;
    }

    // Check stock for each item
    for (const item of validItems) {
      const supply = supplies.find(s => s.id === item.supply_id);
      if (supply && item.quantity > supply.current_stock) {
        toast.error(`${supply.name} 库存不足，当前库存: ${supply.current_stock}`);
        return;
      }
    }

    setSubmitting(true);

    // Create requisition record (supply_id and quantity are now nullable)
    const { data: record, error } = await supabase
      .from("supply_requisitions")
      .insert({
        requisition_by: currentUser?.name || "",
        requisition_date: format(requisitionDate, "yyyy-MM-dd"),
        supply_id: null,
        quantity: null,
      } as any)
      .select("id")
      .single();

    if (error || !record) {
      toast.error("提交领用申请失败");
      setSubmitting(false);
      return;
    }

    // Insert detail items
    const itemsToInsert = validItems.map(item => ({
      requisition_id: record.id,
      supply_id: item.supply_id,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("supply_requisition_items")
      .insert(itemsToInsert);

    if (itemsError) {
      toast.error("保存物品明细失败");
      setSubmitting(false);
      return;
    }

    // Build approval form data
    const itemNames = validItems.map(item => {
      const supply = supplies.find(s => s.id === item.supply_id);
      return `${supply?.name || "物品"} x ${item.quantity}`;
    }).join(", ");

    const approvalResult = await startApproval({
      businessType: "supply_requisition",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `领用申请 - ${itemNames.substring(0, 50)}${itemNames.length > 50 ? "..." : ""}`,
      formData: {
        items: validItems.map(item => {
          const supply = supplies.find(s => s.id === item.supply_id);
          return {
            supply_id: item.supply_id,
            supply_name: supply?.name,
            quantity: item.quantity,
          };
        }),
        requisition_date: format(requisitionDate, "yyyy-MM-dd"),
      },
    });

    setSubmitting(false);

    if (approvalResult.success) {
      toast.success("领用申请已提交");
      setFormOpen(false);
      setFormItems([{ supply_id: "", quantity: 1 }]);
      fetchRecords();
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  return (
    <PageLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>领用申请</CardTitle>
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
                placeholder="搜索申请人或日期..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无领用记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请人</TableHead>
                  <TableHead>领用日期</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.requisition_by}</TableCell>
                    <TableCell>{record.requisition_date}</TableCell>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建领用申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 申请人 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>领用日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(requisitionDate, "yyyy-MM-dd", { locale: zhCN })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={requisitionDate}
                      onSelect={(date) => date && setRequisitionDate(date)}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 物品明细 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>物品明细 *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  添加物品
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[50%]">办公用品</TableHead>
                      <TableHead className="w-[30%]">领用数量</TableHead>
                      <TableHead className="w-[20%]">操作</TableHead>
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
                              {supplies.filter(s => s.current_stock > 0).map((supply) => (
                                <SelectItem key={supply.id} value={supply.id}>
                                  {supply.name}{supply.specification ? ` (${supply.specification})` : ""} - 库存: {supply.current_stock}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
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

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "提交中..." : "提交申请"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>领用详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">申请人</Label>
                  <div className="mt-1">{selectedRecord.requisition_by}</div>
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
                  <Label className="text-sm text-muted-foreground">领用日期</Label>
                  <div className="mt-1">{selectedRecord.requisition_date}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">申请时间</Label>
                  <div className="mt-1">{format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</div>
                </div>
              </div>
              
              {/* 物品明细 */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">物品明细</Label>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>物品名称</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead>数量</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">暂无明细</TableCell>
                        </TableRow>
                      ) : (
                        selectedItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.office_supplies?.name || "-"}</TableCell>
                            <TableCell>{item.office_supplies?.specification || "-"}</TableCell>
                            <TableCell>{item.quantity} {item.office_supplies?.unit}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Requisition;