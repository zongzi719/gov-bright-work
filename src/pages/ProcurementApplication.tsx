import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart } from "lucide-react";

// Import the actual page components as content
import Requisition from "./Requisition";
import Purchase from "./Purchase";
import SuppliesPurchase from "./SuppliesPurchase";

const ProcurementApplication = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "requisition";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["requisition", "purchase", "supplies-purchase"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <PageLayout>
      <div className="gov-card h-full flex overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-row h-full w-full" orientation="vertical">
          {/* 左侧垂直标签栏 */}
          <div className="w-36 border-r border-border bg-muted/30 flex-shrink-0">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-1">
              <TabsTrigger 
                value="requisition" 
                className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Package className="w-4 h-4" />
                领用申请
              </TabsTrigger>
              <TabsTrigger 
                value="purchase" 
                className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <ShoppingCart className="w-4 h-4" />
                采购申请
              </TabsTrigger>
              <TabsTrigger 
                value="supplies-purchase" 
                className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Package className="w-4 h-4" />
                办公采购
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <TabsContent value="requisition" className="flex-1 m-0 overflow-auto data-[state=inactive]:hidden">
              <RequisitionContent />
            </TabsContent>

            <TabsContent value="purchase" className="flex-1 m-0 overflow-auto data-[state=inactive]:hidden">
              <PurchaseContent />
            </TabsContent>

            <TabsContent value="supplies-purchase" className="flex-1 m-0 overflow-auto data-[state=inactive]:hidden">
              <SuppliesPurchaseContent />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </PageLayout>
  );
};

// Embedded content components (simplified versions without PageLayout wrapper)
import ApplicationList, { ApplicationItem } from "@/components/ApplicationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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

// === Requisition Content ===
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
  office_supplies: { name: string; specification: string | null; unit: string } | null;
}

interface OfficeSupply {
  id: string;
  name: string;
  specification: string | null;
  unit: string;
  current_stock: number;
}

interface FormItemReq {
  supply_id: string;
  quantity: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "待审批", variant: "secondary", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "已通过", variant: "default", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "已拒绝", variant: "destructive", className: "bg-red-50 text-red-700 border-red-200" },
  completed: { label: "已完成", variant: "outline", className: "bg-slate-50 text-slate-600 border-slate-200" },
};

const RequisitionContent = () => {
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
  const [formItems, setFormItems] = useState<FormItemReq[]>([{ supply_id: "", quantity: 1 }]);

  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem("frontendUser");
      if (userStr) return JSON.parse(userStr);
    } catch (e) { console.error("Failed to parse frontendUser", e); }
    return null;
  };

  const currentUser = getCurrentUser();

  const fetchRecords = async () => {
    if (!currentUser?.name) return;
    setLoading(true);
    const { data } = await supabase.from("supply_requisitions").select("id, requisition_by, requisition_date, status, created_at").eq("requisition_by", currentUser.name).order("created_at", { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  };

  const fetchSupplies = async () => {
    const { data } = await supabase.from("office_supplies").select("*").eq("is_active", true).order("name");
    if (data) setSupplies(data);
  };

  useEffect(() => { fetchRecords(); }, [currentUser?.name]);

  const filteredRecords = records.filter(r => r.requisition_by.includes(search) || r.requisition_date.includes(search));

  const listItems: ApplicationItem[] = filteredRecords.map(record => ({
    id: record.id,
    title: `领用申请`,
    subtitle: `${record.requisition_by} - ${record.requisition_date}`,
    time: format(new Date(record.created_at), "MM-dd HH:mm", { locale: zhCN }),
    status: record.status,
    meta: [{ label: "领用日期", value: record.requisition_date }],
  }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      const { data } = await supabase.from("supply_requisition_items").select(`id, supply_id, quantity, office_supplies (name, specification, unit)`).eq("requisition_id", record.id);
      if (data) setSelectedItems(data as RequisitionItem[]);
      setDetailOpen(true);
    }
  };

  const handleOpenForm = () => { fetchSupplies(); setFormItems([{ supply_id: "", quantity: 1 }]); setRequisitionDate(new Date()); setFormOpen(true); };

  const handleAddItem = () => { setFormItems([...formItems, { supply_id: "", quantity: 1 }]); };

  const handleRemoveItem = (index: number) => { if (formItems.length > 1) setFormItems(formItems.filter((_, i) => i !== index)); };

  const handleItemChange = (index: number, field: keyof FormItemReq, value: string | number) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const handleSubmit = async () => {
    const validItems = formItems.filter(item => item.supply_id && item.quantity > 0);
    if (validItems.length === 0) { toast.error("请至少添加一条物品明细"); return; }
    for (const item of validItems) {
      const supply = supplies.find(s => s.id === item.supply_id);
      if (supply && item.quantity > supply.current_stock) { toast.error(`${supply.name} 库存不足，当前库存: ${supply.current_stock}`); return; }
    }
    setSubmitting(true);
    const { data: record, error } = await supabase.from("supply_requisitions").insert({ requisition_by: currentUser?.name || "", requisition_date: format(requisitionDate, "yyyy-MM-dd"), supply_id: null, quantity: null } as any).select("id").single();
    if (error || !record) { toast.error("提交领用申请失败"); setSubmitting(false); return; }
    const itemsToInsert = validItems.map(item => ({ requisition_id: record.id, supply_id: item.supply_id, quantity: item.quantity }));
    const { error: itemsError } = await supabase.from("supply_requisition_items").insert(itemsToInsert);
    if (itemsError) { toast.error("保存物品明细失败"); setSubmitting(false); return; }
    const itemNames = validItems.map(item => { const supply = supplies.find(s => s.id === item.supply_id); return `${supply?.name || "物品"} x ${item.quantity}`; }).join(", ");
    const approvalResult = await startApproval({ businessType: "supply_requisition", businessId: record.id, initiatorId: currentUser?.id || "", initiatorName: currentUser?.name || "未知用户", title: `领用申请 - ${itemNames.substring(0, 50)}${itemNames.length > 50 ? "..." : ""}`, formData: { items: validItems.map(item => { const supply = supplies.find(s => s.id === item.supply_id); return { supply_id: item.supply_id, supply_name: supply?.name, quantity: item.quantity }; }), requisition_date: format(requisitionDate, "yyyy-MM-dd") } });
    setSubmitting(false);
    if (approvalResult.success) { toast.success("领用申请已提交"); setFormOpen(false); setFormItems([{ supply_id: "", quantity: 1 }]); fetchRecords(); } else { toast.error(approvalResult.error || "启动审批流程失败"); }
  };

  return (
    <>
      <ApplicationList title="领用申请" items={listItems} loading={loading} search={search} onSearchChange={setSearch} onAddClick={handleOpenForm} onItemClick={handleItemClick} searchPlaceholder="搜索申请人或日期..." emptyText="暂无领用记录" statusConfig={statusConfig} hideTitle />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background"><DialogTitle>新建领用申请</DialogTitle></DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>申请人</Label><Input value={currentUser?.name || ""} disabled className="bg-muted" /></div>
              <div className="space-y-2">
                <Label>领用日期 *</Label>
                <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal")}><CalendarIcon className="mr-2 h-4 w-4" />{format(requisitionDate, "yyyy-MM-dd", { locale: zhCN })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={requisitionDate} onSelect={(date) => date && setRequisitionDate(date)} locale={zhCN} /></PopoverContent></Popover>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>物品明细 *</Label><Button type="button" variant="outline" size="sm" onClick={handleAddItem}><Plus className="h-3 w-3 mr-1" />添加物品</Button></div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[50%]">办公用品</TableHead><TableHead className="w-[30%]">领用数量</TableHead><TableHead className="w-[20%]">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2"><Select value={item.supply_id} onValueChange={(v) => handleItemChange(index, "supply_id", v)}><SelectTrigger><SelectValue placeholder="选择办公用品" /></SelectTrigger><SelectContent>{supplies.filter(s => s.current_stock > 0).map((supply) => (<SelectItem key={supply.id} value={supply.id}>{supply.name}{supply.specification ? ` (${supply.specification})` : ""} - 库存: {supply.current_stock}</SelectItem>))}</SelectContent></Select></TableCell>
                        <TableCell className="p-2"><Input type="number" min={1} value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)} /></TableCell>
                        <TableCell className="p-2"><Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} disabled={formItems.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-background flex justify-end gap-2"><Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>取消</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? "提交中..." : "提交申请"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">领用详情</DialogTitle>
              {selectedRecord && <Badge variant="outline" className={cn("text-xs font-normal border", statusConfig[selectedRecord.status]?.className)}>{statusConfig[selectedRecord.status]?.label || selectedRecord.status}</Badge>}
            </div>
          </DialogHeader>
          {selectedRecord && (
            <Tabs defaultValue="detail" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-4 mb-2 grid w-fit grid-cols-2 bg-muted/50"><TabsTrigger value="detail" className="gap-2 px-4"><FileText className="w-4 h-4" />申请详情</TabsTrigger><TabsTrigger value="approval" className="gap-2 px-4"><GitBranch className="w-4 h-4" />审批流程</TabsTrigger></TabsList>
              <TabsContent value="detail" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[calc(85vh-180px)]">
                  <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请人</Label><div className="text-sm">{selectedRecord.requisition_by}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">领用日期</Label><div className="text-sm">{selectedRecord.requisition_date}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请时间</Label><div className="text-sm">{format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</div></div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">物品明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader><TableRow className="bg-muted/30"><TableHead>物品名称</TableHead><TableHead>规格</TableHead><TableHead>数量</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {selectedItems.length === 0 ? (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">暂无明细</TableCell></TableRow>) : (selectedItems.map((item) => (<TableRow key={item.id}><TableCell>{item.office_supplies?.name || "-"}</TableCell><TableCell>{item.office_supplies?.specification || "-"}</TableCell><TableCell>{item.quantity} {item.office_supplies?.unit || ""}</TableCell></TableRow>)))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="approval" className="flex-1 m-0 overflow-hidden"><ScrollArea className="h-[calc(85vh-180px)]"><div className="px-6 py-4"><ApprovalTimeline businessId={selectedRecord.id} businessType="supply_requisition" /></div></ScrollArea></TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// === Purchase Content ===
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

interface FormItemPurchase {
  item_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  category_link: string;
  remarks: string;
}

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

const PurchaseContent = () => {
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PurchaseRequest | null>(null);
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [department, setDepartment] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [procurementMethod, setProcurementMethod] = useState("");
  const [fundingSource, setFundingSource] = useState("");
  const [fundingDetail, setFundingDetail] = useState("");
  const [budgetAmount, setBudgetAmount] = useState<number>(0);
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<Date | undefined>(undefined);
  const [purpose, setPurpose] = useState("");
  const [formItems, setFormItems] = useState<FormItemPurchase[]>([createEmptyItem()]);

  function createEmptyItem(): FormItemPurchase { return { item_name: "", specification: "", unit: "个", quantity: 1, unit_price: 0, amount: 0, category_link: "", remarks: "" }; }

  const getCurrentUser = () => { try { const userStr = localStorage.getItem("frontendUser"); if (userStr) return JSON.parse(userStr); } catch (e) { console.error("Failed to parse frontendUser", e); } return null; };
  const currentUser = getCurrentUser();

  const fetchRecords = async () => {
    if (!currentUser?.name) return;
    setLoading(true);
    const { data } = await supabase.from("purchase_requests").select("id, requested_by, department, purchase_date, procurement_method, funding_source, funding_detail, budget_amount, expected_completion_date, purpose, total_amount, reason, status, created_at").eq("requested_by", currentUser.name).order("created_at", { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [currentUser?.name]);

  const filteredRecords = records.filter(r => r.requested_by.includes(search) || r.department?.includes(search) || r.purpose?.includes(search));

  const listItems: ApplicationItem[] = filteredRecords.map(record => ({ id: record.id, title: `采购申请`, subtitle: record.purpose || `${record.requested_by} - ${record.department || ""}`, time: format(new Date(record.created_at), "MM-dd HH:mm", { locale: zhCN }), status: record.status, meta: [{ label: "金额", value: `¥${(record.total_amount || 0).toFixed(2)}` }, { label: "日期", value: record.purchase_date }] }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      const { data } = await supabase.from("purchase_request_items").select("id, item_name, specification, unit, quantity, unit_price, amount, category_link, remarks").eq("request_id", record.id);
      if (data) setSelectedItems(data as PurchaseItem[]);
      setDetailOpen(true);
    }
  };

  const handleOpenForm = () => { setDepartment(currentUser?.department || ""); setPurchaseDate(new Date()); setProcurementMethod(""); setFundingSource(""); setFundingDetail(""); setBudgetAmount(0); setExpectedCompletionDate(undefined); setPurpose(""); setFormItems([createEmptyItem()]); setFormOpen(true); };

  const handleAddItem = () => { setFormItems([...formItems, createEmptyItem()]); };
  const handleRemoveItem = (index: number) => { if (formItems.length > 1) setFormItems(formItems.filter((_, i) => i !== index)); };

  const handleItemChange = (index: number, field: keyof FormItemPurchase, value: string | number) => {
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

  const handleSubmit = async () => {
    const validItems = formItems.filter(item => item.item_name.trim() && item.quantity > 0);
    if (validItems.length === 0) { toast.error("请至少添加一条采购明细"); return; }
    if (!procurementMethod) { toast.error("请选择采购方式"); return; }
    if (!fundingSource) { toast.error("请选择资金来源"); return; }
    setSubmitting(true);
    const { data: record, error } = await supabase.from("purchase_requests").insert({ requested_by: currentUser?.name || "", department: department.trim() || null, purchase_date: format(purchaseDate, "yyyy-MM-dd"), procurement_method: procurementMethod, funding_source: fundingSource, funding_detail: fundingDetail.trim() || null, budget_amount: budgetAmount || null, expected_completion_date: expectedCompletionDate ? format(expectedCompletionDate, "yyyy-MM-dd") : null, purpose: purpose.trim() || null, total_amount: Number(totalAmount.toFixed(2)), supply_id: null, quantity: null, unit_price: null } as any).select("id").single();
    if (error || !record) { toast.error("提交采购申请失败"); setSubmitting(false); return; }
    const itemsToInsert = validItems.map(item => ({ request_id: record.id, item_name: item.item_name.trim(), specification: item.specification.trim() || null, unit: item.unit || "个", quantity: item.quantity, unit_price: Number(item.unit_price.toFixed(2)), amount: Number(item.amount.toFixed(2)), category_link: item.category_link.trim() || null, remarks: item.remarks.trim() || null }));
    const { error: itemsError } = await supabase.from("purchase_request_items").insert(itemsToInsert);
    if (itemsError) { toast.error("保存采购明细失败"); setSubmitting(false); return; }
    const itemNames = validItems.map(item => `${item.item_name} x ${item.quantity}`).join(", ");
    const approvalResult = await startApproval({ businessType: "purchase_request", businessId: record.id, initiatorId: currentUser?.id || "", initiatorName: currentUser?.name || "未知用户", title: `采购申请 - ${itemNames.substring(0, 50)}${itemNames.length > 50 ? "..." : ""}`, formData: { department, purchase_date: format(purchaseDate, "yyyy-MM-dd"), procurement_method: procurementMethod, funding_source: fundingSource, funding_detail: fundingDetail, budget_amount: budgetAmount, expected_completion_date: expectedCompletionDate ? format(expectedCompletionDate, "yyyy-MM-dd") : null, purpose, items: validItems, total_amount: totalAmount } });
    setSubmitting(false);
    if (approvalResult.success) { toast.success("采购申请已提交"); setFormOpen(false); fetchRecords(); } else { toast.error(approvalResult.error || "启动审批流程失败"); }
  };

  const getFundingSourceLabel = (source: string, detail: string | null) => { const sourceConfig = fundingSources.find(s => s.value === source); if (!sourceConfig) return source; return detail ? `${sourceConfig.label}（${sourceConfig.placeholder}：${detail}）` : sourceConfig.label; };

  return (
    <>
      <ApplicationList title="采购申请" items={listItems} loading={loading} search={search} onSearchChange={setSearch} onAddClick={handleOpenForm} onItemClick={handleItemClick} searchPlaceholder="搜索申请人、部门或用途..." emptyText="暂无采购记录" statusConfig={statusConfig} hideTitle />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background"><DialogTitle>新建采购申请</DialogTitle></DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>申请人</Label><Input value={currentUser?.name || ""} disabled className="bg-muted" /></div>
              <div className="space-y-2"><Label>申请部门</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="请输入申请部门" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>申请日期 *</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal")}><CalendarIcon className="mr-2 h-4 w-4" />{format(purchaseDate, "yyyy-MM-dd", { locale: zhCN })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={purchaseDate} onSelect={(date) => date && setPurchaseDate(date)} locale={zhCN} className="pointer-events-auto" /></PopoverContent></Popover></div>
              <div className="space-y-2"><Label>预计采购完成时间</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedCompletionDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{expectedCompletionDate ? format(expectedCompletionDate, "yyyy-MM-dd", { locale: zhCN }) : "选择日期"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={expectedCompletionDate} onSelect={setExpectedCompletionDate} locale={zhCN} className="pointer-events-auto" /></PopoverContent></Popover></div>
            </div>
            <div className="space-y-2"><Label>采购方式 *</Label><Select value={procurementMethod} onValueChange={setProcurementMethod}><SelectTrigger><SelectValue placeholder="请选择采购方式" /></SelectTrigger><SelectContent>{procurementMethods.map((method) => (<SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-2"><Label>资金来源 *</Label><RadioGroup value={fundingSource} onValueChange={(v) => { setFundingSource(v); setFundingDetail(""); }} className="flex flex-wrap gap-4">{fundingSources.map((source) => (<div key={source.value} className="flex items-center space-x-2"><RadioGroupItem value={source.value} id={source.value} /><Label htmlFor={source.value} className="font-normal cursor-pointer">{source.label}</Label></div>))}</RadioGroup>{fundingSource && (<Input value={fundingDetail} onChange={(e) => setFundingDetail(e.target.value)} placeholder={fundingSources.find(s => s.value === fundingSource)?.placeholder || ""} className="mt-2" />)}</div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>预算金额（元）</Label><Input type="number" min={0} step={0.01} value={budgetAmount === 0 ? "" : budgetAmount} onChange={(e) => setBudgetAmount(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)} placeholder="请输入预算金额" /></div></div>
            <div className="space-y-2"><Label>采购用途</Label><Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="请填写采购用途说明" rows={2} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>采购物品明细 *</Label><Button type="button" variant="outline" size="sm" onClick={handleAddItem}><Plus className="h-3 w-3 mr-1" />添加物品</Button></div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[18%]">名称</TableHead><TableHead className="w-[12%]">规格型号</TableHead><TableHead className="w-[8%]">单位</TableHead><TableHead className="w-[8%]">数量</TableHead><TableHead className="w-[10%]">单价(元)</TableHead><TableHead className="w-[10%]">金额</TableHead><TableHead className="w-[16%]">政采云链接</TableHead><TableHead className="w-[12%]">备注</TableHead><TableHead className="w-[6%]">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2"><Input value={item.item_name} onChange={(e) => handleItemChange(index, "item_name", e.target.value)} placeholder="名称" /></TableCell>
                        <TableCell className="p-2"><Input value={item.specification} onChange={(e) => handleItemChange(index, "specification", e.target.value)} placeholder="规格" /></TableCell>
                        <TableCell className="p-2"><Input value={item.unit} onChange={(e) => handleItemChange(index, "unit", e.target.value)} placeholder="单位" /></TableCell>
                        <TableCell className="p-2"><Input type="number" min={1} value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)} onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) handleItemChange(index, "quantity", 1); }} /></TableCell>
                        <TableCell className="p-2"><Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)} onBlur={(e) => { if (!e.target.value) handleItemChange(index, "unit_price", 0); }} /></TableCell>
                        <TableCell className="p-2 text-right font-medium">¥{item.amount.toFixed(2)}</TableCell>
                        <TableCell className="p-2"><Input value={item.category_link} onChange={(e) => handleItemChange(index, "category_link", e.target.value)} placeholder="链接" /></TableCell>
                        <TableCell className="p-2"><Input value={item.remarks} onChange={(e) => handleItemChange(index, "remarks", e.target.value)} placeholder="备注" /></TableCell>
                        <TableCell className="p-2"><Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} disabled={formItems.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30"><TableCell colSpan={5} className="text-right font-medium">合计金额（元）</TableCell><TableCell className="text-right font-bold text-primary">¥{totalAmount.toFixed(2)}</TableCell><TableCell colSpan={3}></TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t bg-background flex justify-end gap-2"><Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>取消</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? "提交中..." : "提交申请"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
            <div className="flex items-center justify-between"><DialogTitle className="text-lg font-semibold">采购详情</DialogTitle>{selectedRecord && <Badge variant="outline" className={cn("text-xs font-normal border", statusConfig[selectedRecord.status]?.className)}>{statusConfig[selectedRecord.status]?.label || selectedRecord.status}</Badge>}</div>
          </DialogHeader>
          {selectedRecord && (
            <Tabs defaultValue="detail" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-4 mb-2 grid w-fit grid-cols-2 bg-muted/50"><TabsTrigger value="detail" className="gap-2 px-4"><FileText className="w-4 h-4" />申请详情</TabsTrigger><TabsTrigger value="approval" className="gap-2 px-4"><GitBranch className="w-4 h-4" />审批流程</TabsTrigger></TabsList>
              <TabsContent value="detail" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[calc(85vh-180px)]">
                  <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请人</Label><div className="text-sm">{selectedRecord.requested_by}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请部门</Label><div className="text-sm">{selectedRecord.department || "-"}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">采购方式</Label><div className="text-sm">{selectedRecord.procurement_method || "-"}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">资金来源</Label><div className="text-sm">{selectedRecord.funding_source ? getFundingSourceLabel(selectedRecord.funding_source, selectedRecord.funding_detail) : "-"}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">预算金额</Label><div className="text-sm">{selectedRecord.budget_amount ? `¥${selectedRecord.budget_amount}` : "-"}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请日期</Label><div className="text-sm">{selectedRecord.purchase_date}</div></div>
                    </div>
                    {selectedRecord.purpose && <div className="space-y-1.5 pt-2"><Label className="text-xs text-muted-foreground font-normal">采购用途</Label><div className="text-sm">{selectedRecord.purpose}</div></div>}
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">采购明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader><TableRow className="bg-muted/30"><TableHead>名称</TableHead><TableHead>规格</TableHead><TableHead>数量</TableHead><TableHead>单价</TableHead><TableHead>金额</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {selectedItems.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无明细</TableCell></TableRow>) : (selectedItems.map((item) => (<TableRow key={item.id}><TableCell>{item.item_name || "-"}</TableCell><TableCell>{item.specification || "-"}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>¥{item.unit_price.toFixed(2)}</TableCell><TableCell>¥{item.amount.toFixed(2)}</TableCell></TableRow>)))}
                            {selectedItems.length > 0 && (<TableRow className="bg-muted/30"><TableCell colSpan={4} className="text-right font-medium">合计</TableCell><TableCell className="font-bold text-primary">¥{selectedRecord.total_amount?.toFixed(2) || "0.00"}</TableCell></TableRow>)}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="approval" className="flex-1 m-0 overflow-hidden"><ScrollArea className="h-[calc(85vh-180px)]"><div className="px-6 py-4"><ApprovalTimeline businessId={selectedRecord.id} businessType="purchase_request" /></div></ScrollArea></TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// === Supplies Purchase Content ===
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

interface SupplyPurchaseItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
}

interface FormItemSupply {
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string;
}

const SuppliesPurchaseContent = () => {
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<SupplyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SupplyPurchase | null>(null);
  const [selectedItems, setSelectedItems] = useState<SupplyPurchaseItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [formItems, setFormItems] = useState<FormItemSupply[]>([{ item_name: "", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]);

  const getCurrentUser = () => { try { const userStr = localStorage.getItem("frontendUser"); if (userStr) return JSON.parse(userStr); } catch (e) { console.error("Failed to parse frontendUser", e); } return null; };
  const currentUser = getCurrentUser();

  const fetchRecords = async () => {
    if (!currentUser?.name) return;
    setLoading(true);
    const { data } = await supabase.from("supply_purchases").select("*").eq("applicant_name", currentUser.name).order("created_at", { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [currentUser?.name]);

  const filteredRecords = records.filter(r => r.department.includes(search) || r.applicant_name.includes(search) || r.purchase_date.includes(search));
  const totalAmount = formItems.reduce((sum, item) => sum + item.amount, 0);

  const listItems: ApplicationItem[] = filteredRecords.map(record => ({ id: record.id, title: `办公用品采购申请`, subtitle: `${record.department} - ${record.applicant_name}`, time: format(new Date(record.created_at), "MM-dd HH:mm", { locale: zhCN }), status: record.status, meta: [{ label: "申请日期", value: record.purchase_date }, { label: "合计金额", value: `¥${record.total_amount.toFixed(2)}` }] }));

  const handleItemClick = async (item: ApplicationItem) => {
    const record = records.find(r => r.id === item.id);
    if (record) {
      setSelectedRecord(record);
      const { data } = await supabase.from("supply_purchase_items").select("*").eq("purchase_id", record.id);
      if (data) setSelectedItems(data as SupplyPurchaseItem[]);
      setDetailOpen(true);
    }
  };

  const handleOpenForm = () => { setDepartment(currentUser?.department || ""); setReason(""); setPurchaseDate(new Date()); setFormItems([{ item_name: "", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]); setFormOpen(true); };

  const handleAddItem = () => { setFormItems([...formItems, { item_name: "", quantity: 1, unit_price: 0, amount: 0, remarks: "" }]); };
  const handleRemoveItem = (index: number) => { if (formItems.length > 1) setFormItems(formItems.filter((_, i) => i !== index)); };

  const handleItemChange = (index: number, field: keyof FormItemSupply, value: string | number) => {
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
    if (!department.trim()) { toast.error("请填写申请科室"); return; }
    const validItems = formItems.filter(item => item.item_name.trim() && item.quantity > 0);
    if (validItems.length === 0) { toast.error("请至少添加一条物品明细"); return; }
    setSubmitting(true);
    const calculatedTotal = validItems.reduce((sum, item) => sum + item.amount, 0);
    const { data: record, error } = await supabase.from("supply_purchases").insert({ department, purchase_date: format(purchaseDate, "yyyy-MM-dd"), reason: reason || null, total_amount: calculatedTotal, applicant_id: currentUser?.id || "", applicant_name: currentUser?.name || "" }).select("id").single();
    if (error || !record) { toast.error("提交采购申请失败"); setSubmitting(false); return; }
    const itemsToInsert = validItems.map(item => ({ purchase_id: record.id, item_name: item.item_name, quantity: item.quantity, unit_price: item.unit_price, amount: item.amount, remarks: item.remarks || null }));
    const { error: itemsError } = await supabase.from("supply_purchase_items").insert(itemsToInsert);
    if (itemsError) { toast.error("保存物品明细失败"); setSubmitting(false); return; }
    const itemNames = validItems.map(item => item.item_name).join(", ");
    const approvalResult = await startApproval({ businessType: "supply_purchase", businessId: record.id, initiatorId: currentUser?.id || "", initiatorName: currentUser?.name || "未知用户", title: `办公用品采购 - ${itemNames.substring(0, 30)}${itemNames.length > 30 ? "..." : ""}`, formData: { department, purchase_date: format(purchaseDate, "yyyy-MM-dd"), reason, total_amount: calculatedTotal, items: validItems } });
    setSubmitting(false);
    if (approvalResult.success) { toast.success("采购申请已提交"); setFormOpen(false); fetchRecords(); } else { toast.error(approvalResult.error || "启动审批流程失败"); }
  };

  return (
    <>
      <ApplicationList title="办公用品采购申请" items={listItems} loading={loading} search={search} onSearchChange={setSearch} onAddClick={handleOpenForm} onItemClick={handleItemClick} searchPlaceholder="搜索科室或日期..." emptyText="暂无采购记录" statusConfig={statusConfig} hideTitle />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-background"><DialogTitle>新建办公用品采购申请</DialogTitle></DialogHeader>
          <div className="overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>申请科室 *</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="请输入申请科室" /></div>
              <div className="space-y-2"><Label>申请日期 *</Label><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal")}><CalendarIcon className="mr-2 h-4 w-4" />{format(purchaseDate, "yyyy-MM-dd", { locale: zhCN })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={purchaseDate} onSelect={(date) => date && setPurchaseDate(date)} locale={zhCN} className="pointer-events-auto" /></PopoverContent></Popover></div>
            </div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>经办人</Label><Input value={currentUser?.name || ""} disabled className="bg-muted" /></div></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>采购物品明细 *</Label><Button type="button" variant="outline" size="sm" onClick={handleAddItem}><Plus className="h-3 w-3 mr-1" />添加物品</Button></div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[30%]">名称</TableHead><TableHead className="w-[12%]">数量</TableHead><TableHead className="w-[15%]">单价（元）</TableHead><TableHead className="w-[13%]">金额</TableHead><TableHead className="w-[20%]">备注</TableHead><TableHead className="w-[10%]">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2"><Input value={item.item_name} onChange={(e) => handleItemChange(index, "item_name", e.target.value)} placeholder="物品名称" /></TableCell>
                        <TableCell className="p-2"><Input type="number" min={1} value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)} onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) handleItemChange(index, "quantity", 1); }} /></TableCell>
                        <TableCell className="p-2"><Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)} onBlur={(e) => { if (!e.target.value) handleItemChange(index, "unit_price", 0); }} /></TableCell>
                        <TableCell className="p-2 text-right font-medium">¥{item.amount.toFixed(2)}</TableCell>
                        <TableCell className="p-2"><Input value={item.remarks} onChange={(e) => handleItemChange(index, "remarks", e.target.value)} placeholder="备注" /></TableCell>
                        <TableCell className="p-2"><Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} disabled={formItems.length === 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30"><TableCell colSpan={3} className="text-right font-medium">合计金额（元）</TableCell><TableCell className="text-right font-bold text-primary">¥{totalAmount.toFixed(2)}</TableCell><TableCell colSpan={2}></TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="space-y-2"><Label>购置理由</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请填写购置理由（如：日常办公所需、会议保障等）" rows={3} /></div>
          </div>
          <div className="px-6 py-4 border-t bg-background flex justify-end gap-2"><Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>取消</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? "提交中..." : "提交申请"}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
            <div className="flex items-center justify-between"><DialogTitle className="text-lg font-semibold">采购详情</DialogTitle>{selectedRecord && <Badge variant="outline" className={cn("text-xs font-normal border", statusConfig[selectedRecord.status]?.className)}>{statusConfig[selectedRecord.status]?.label || selectedRecord.status}</Badge>}</div>
          </DialogHeader>
          {selectedRecord && (
            <Tabs defaultValue="detail" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-4 mb-2 grid w-fit grid-cols-2 bg-muted/50"><TabsTrigger value="detail" className="gap-2 px-4"><FileText className="w-4 h-4" />申请详情</TabsTrigger><TabsTrigger value="approval" className="gap-2 px-4"><GitBranch className="w-4 h-4" />审批流程</TabsTrigger></TabsList>
              <TabsContent value="detail" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-[calc(85vh-180px)]">
                  <div className="px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请科室</Label><div className="text-sm">{selectedRecord.department}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">经办人</Label><div className="text-sm">{selectedRecord.applicant_name}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">申请日期</Label><div className="text-sm">{selectedRecord.purchase_date}</div></div>
                      <div className="space-y-1.5"><Label className="text-xs text-muted-foreground font-normal">合计金额</Label><div className="text-sm font-medium text-primary">¥{selectedRecord.total_amount.toFixed(2)}</div></div>
                    </div>
                    {selectedRecord.reason && <div className="space-y-1.5 pt-2"><Label className="text-xs text-muted-foreground font-normal">购置理由</Label><div className="text-sm">{selectedRecord.reason}</div></div>}
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground font-normal">采购明细</Label>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader><TableRow className="bg-muted/30"><TableHead>名称</TableHead><TableHead>数量</TableHead><TableHead>单价</TableHead><TableHead>金额</TableHead><TableHead>备注</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {selectedItems.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无明细</TableCell></TableRow>) : (selectedItems.map((item) => (<TableRow key={item.id}><TableCell>{item.item_name}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>¥{item.unit_price.toFixed(2)}</TableCell><TableCell>¥{item.amount.toFixed(2)}</TableCell><TableCell>{item.remarks || "-"}</TableCell></TableRow>)))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="approval" className="flex-1 m-0 overflow-hidden"><ScrollArea className="h-[calc(85vh-180px)]"><div className="px-6 py-4"><ApprovalTimeline businessId={selectedRecord.id} businessType="supply_purchase" /></div></ScrollArea></TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProcurementApplication;
