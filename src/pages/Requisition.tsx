import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  supply_name?: string;
  item_name?: string;
  specification?: string | null;
  unit?: string;
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

import { allStatusConfig as statusConfig } from "@/lib/statusLabels";

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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
    const { data, error } = await dataAdapter.getSupplyRequisitions({ requisition_by: currentUser.name });

    if (!error && data) {
      setRecords(data as SupplyRequisition[]);
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
    r.requisition_by.includes(search) ||
    r.requisition_date.includes(search)
  );

  // 转换为通用列表项格式
  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: `领用申请`,
    subtitle: `${record.requisition_by} - ${normalizeDate(record.requisition_date)}`,
    time: format(parseTime(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [
      { label: "领用日期", value: normalizeDate(record.requisition_date) },
    ],
  }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      // Fetch items for this requisition
      const { data } = await dataAdapter.getSupplyRequisitionItems(record.id);
      
      if (data) {
        setSelectedItems(data as RequisitionItem[]);
      }
      setDetailOpen(true);
      void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.SUPPLY, target_type: '领用申请', target_id: record.id, target_name: `${record.requisition_by} - ${record.requisition_date}` });
    }
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
    const validItems = formItems.filter(item => item.supply_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error("请至少添加一条物品明细");
      return;
    }

    for (const item of validItems) {
      const supply = supplies.find(s => s.id === item.supply_id);
      if (supply && item.quantity > supply.current_stock) {
        toast.error(`${supply.name} 库存不足，当前库存: ${supply.current_stock}`);
        return;
      }
    }

    setSubmitting(true);

    const { data: record, error } = await dataAdapter.createSupplyRequisition({
      requisition_by: currentUser?.name || "",
      requisition_date: format(requisitionDate, "yyyy-MM-dd"),
    });

    if (error || !record) {
      toast.error("提交领用申请失败");
      setSubmitting(false);
      return;
    }

    const itemsToInsert = validItems.map(item => ({
      requisition_id: record.id,
      supply_id: item.supply_id,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await dataAdapter.createSupplyRequisitionItems(itemsToInsert);

    if (itemsError) {
      toast.error("保存物品明细失败");
      setSubmitting(false);
      return;
    }

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
      await logAudit({
        action: AUDIT_ACTIONS.CREATE,
        module: AUDIT_MODULES.SUPPLY,
        target_type: '领用申请',
        target_id: record.id,
        target_name: itemNames.substring(0, 50),
      });
      toast.success("领用申请已提交");
      setFormOpen(false);
      fetchRecords();
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  return (
    <PageLayout>
      <ApplicationList
        title="领用申请"
        items={listItems}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onAddClick={handleOpenForm}
        onItemClick={handleItemClick}
        searchPlaceholder="搜索申请人或日期..."
        emptyText="暂无领用记录"
        statusConfig={statusConfig}
      />

      {/* 新增对话框 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>新建领用申请</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>申请人</Label>
                <Input value={currentUser?.name || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>领用日期 <span className="text-destructive">*</span></Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                      onSelect={(date) => {
                        if (date) {
                          setRequisitionDate(date);
                          setDatePickerOpen(false);
                        }
                      }}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>物品明细 <span className="text-destructive">*</span></Label>
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
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="text-lg font-semibold">领用详情</DialogTitle>
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
                        <div className="text-sm">{selectedRecord.requisition_by}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">领用日期</Label>
                        <div className="text-sm">{normalizeDate(selectedRecord.requisition_date)}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-normal">申请时间</Label>
                        <div className="text-sm">{format(parseTime(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">物品明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
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
                                  <TableCell>{item.office_supplies?.name || item.supply_name || item.item_name || "-"}</TableCell>
                                  <TableCell>{item.office_supplies?.specification || item.specification || "-"}</TableCell>
                                  <TableCell>{item.quantity} {item.office_supplies?.unit || item.unit || ""}</TableCell>
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
                      businessType="supply_requisition"
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

export default Requisition;
