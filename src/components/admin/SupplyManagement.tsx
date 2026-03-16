import { useState, useEffect } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import * as dataAdapter from "@/lib/dataAdapter";

const formatLocalNow = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  ShoppingCart,
  ClipboardList,
  Check,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  GitBranch,
} from "lucide-react";
import { format } from "date-fns";
import { parseTime, normalizeDate } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import ApprovalTimeline from "@/components/admin/ApprovalTimeline";
import StockMovementHistory from "./StockMovementHistory";

type PurchaseStatus = "pending" | "approved" | "rejected" | "completed";
type RequisitionStatus = "pending" | "approved" | "rejected" | "completed";

interface OfficeSupply {
  id: string;
  name: string;
  specification: string | null;
  unit: string;
  current_stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
}

interface PurchaseRequest {
  id: string;
  supply_id: string;
  quantity: number;
  reason: string | null;
  status: PurchaseStatus;
  requested_by: string;
  department: string | null;
  purchase_date: string;
  procurement_method: string | null;
  funding_source: string | null;
  funding_detail: string | null;
  budget_amount: number | null;
  total_amount: number | null;
  purpose: string | null;
  expected_completion_date: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  office_supplies?: OfficeSupply;
}

interface SupplyRequisition {
  id: string;
  supply_id: string;
  quantity: number;
  requisition_by: string;
  requisition_date: string;
  status: RequisitionStatus;
  approved_at: string | null;
  created_at: string;
  office_supplies?: OfficeSupply;
}

interface SupplyPurchase {
  id: string;
  department: string;
  purchase_date: string;
  reason: string | null;
  total_amount: number | null;
  applicant_id: string;
  applicant_name: string;
  status: string;
  created_at: string;
}

interface SupplyPurchaseItem {
  id: string;
  purchase_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  remarks: string | null;
}

const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  pending: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  completed: "已入库",
};

const purchaseStatusColors: Record<PurchaseStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
};

const requisitionStatusLabels: Record<RequisitionStatus, string> = {
  pending: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  completed: "已领取",
};

const requisitionStatusColors: Record<RequisitionStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
};

const officePurchaseStatusLabels: Record<string, string> = {
  pending: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  completed: "已完成",
};

const officePurchaseStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
};

const SupplyManagement = () => {
  const [activeTab, setActiveTab] = useState("inventory");
  
  // 库存管理
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [supplySearch, setSupplySearch] = useState("");
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<OfficeSupply | null>(null);
  const [supplyForm, setSupplyForm] = useState({
    name: "",
    specification: "",
    unit: "个",
    current_stock: 0,
    min_stock: 0,
  });
  const [deleteSupplyId, setDeleteSupplyId] = useState<string | null>(null);

  // 采购管理
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<string>("all");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supply_id: "",
    quantity: 1,
    reason: "",
    requested_by: "",
  });
  const [selectedPurchaseRequest, setSelectedPurchaseRequest] = useState<PurchaseRequest | null>(null);
  const [purchaseDetailOpen, setPurchaseDetailOpen] = useState(false);
  const [purchaseDetailItems, setPurchaseDetailItems] = useState<any[]>([]);

  // 领用管理
  const [requisitions, setRequisitions] = useState<SupplyRequisition[]>([]);
  const [requisitionSearch, setRequisitionSearch] = useState("");
  const [requisitionStatusFilter, setRequisitionStatusFilter] = useState<string>("all");
  const [requisitionDialogOpen, setRequisitionDialogOpen] = useState(false);
  const [requisitionForm, setRequisitionForm] = useState({
    supply_id: "",
    quantity: 1,
    requisition_by: "",
  });
  const [selectedRequisition, setSelectedRequisition] = useState<SupplyRequisition | null>(null);
  const [requisitionDetailOpen, setRequisitionDetailOpen] = useState(false);
  const [requisitionDetailItems, setRequisitionDetailItems] = useState<any[]>([]);

  // 办公采购管理
  const [officePurchases, setOfficePurchases] = useState<SupplyPurchase[]>([]);
  const [officePurchaseSearch, setOfficePurchaseSearch] = useState("");
  const [officePurchaseStatusFilter, setOfficePurchaseStatusFilter] = useState<string>("all");
  const [selectedOfficePurchase, setSelectedOfficePurchase] = useState<SupplyPurchase | null>(null);
  const [officePurchaseItems, setOfficePurchaseItems] = useState<SupplyPurchaseItem[]>([]);
  const [officePurchaseDetailOpen, setOfficePurchaseDetailOpen] = useState(false);

  // 根据 supply_id 查找用品名称的辅助函数
  const getSupplyName = (item: any) => {
    if (item.office_supplies?.name) return item.office_supplies.name;
    if (item.supply_name) return item.supply_name;
    if (item.item_name) return item.item_name;
    // fallback: 从本地 supplies 列表查找
    const found = supplies.find(s => s.id === item.supply_id);
    return found?.name || "-";
  };
  const getSupplyUnit = (item: any) => {
    if (item.office_supplies?.unit) return item.office_supplies.unit;
    if (item.unit) return item.unit;
    const found = supplies.find(s => s.id === item.supply_id);
    return found?.unit || "";
  };

  useEffect(() => {
    fetchSupplies();
    fetchPurchaseRequests();
    fetchRequisitions();
    fetchOfficePurchases();
  }, []);

  // 获取办公用品列表
  const fetchSupplies = async () => {
    const { data, error } = await dataAdapter.getAllOfficeSupplies();

    if (error) {
      toast.error("获取办公用品列表失败");
      return;
    }
    setSupplies(data || []);
  };

  // 获取采购申请列表
  const fetchPurchaseRequests = async () => {
    const { data, error } = await dataAdapter.getAllPurchaseRequests();

    if (error) {
      toast.error("获取采购申请列表失败");
      return;
    }
    setPurchaseRequests(data || []);
  };

  // 获取领用记录列表
  const fetchRequisitions = async () => {
    const { data, error } = await dataAdapter.getAllSupplyRequisitions();

    if (error) {
      toast.error("获取领用记录列表失败");
      return;
    }
    setRequisitions(data || []);
  };

  // 获取办公采购记录列表
  const fetchOfficePurchases = async () => {
    const { data, error } = await dataAdapter.getAllSupplyPurchases();

    if (error) {
      toast.error("获取办公采购列表失败");
      return;
    }
    setOfficePurchases(data || []);
  };

  // 获取办公采购明细
  const fetchOfficePurchaseItems = async (purchaseId: string) => {
    const { data, error } = await dataAdapter.getSupplyPurchaseItems(purchaseId);

    if (error) {
      toast.error("获取采购明细失败");
      return;
    }
    setOfficePurchaseItems(data || []);
  };

  // 查看办公采购详情
  const handleViewOfficePurchase = async (purchase: SupplyPurchase) => {
    setSelectedOfficePurchase(purchase);
    await fetchOfficePurchaseItems(purchase.id);
    setOfficePurchaseDetailOpen(true);
    void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.SUPPLY, target_type: '办公用品采购', target_id: purchase.id, target_name: `${purchase.department} - ${purchase.applicant_name}` });
  };

  // 查看采购需求详情
  const handleViewPurchaseDetail = async (request: PurchaseRequest) => {
    setSelectedPurchaseRequest(request);
    const { data } = await dataAdapter.getPurchaseRequestItems(request.id);
    setPurchaseDetailItems(data || []);
    setPurchaseDetailOpen(true);
    void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.SUPPLY, target_type: '采购需求', target_id: request.id, target_name: request.purpose || request.requested_by });
  };

  // 查看领用详情
  const handleViewRequisitionDetail = async (requisition: SupplyRequisition) => {
    setSelectedRequisition(requisition);
    const { data } = await dataAdapter.getSupplyRequisitionItems(requisition.id);
    setRequisitionDetailItems(data || []);
    setRequisitionDetailOpen(true);
    void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.SUPPLY, target_type: '领用申请', target_id: requisition.id, target_name: requisition.requisition_by });
  };

  const getFundingSourceLabel = (source: string, detail: string | null) => {
    const labels: Record<string, string> = { '财政拨款': '财政拨款', '专项经费': '专项经费', '其他': '其他' };
    const placeholders: Record<string, string> = { '财政拨款': '项目名称', '专项经费': '经费编号', '其他': '请说明' };
    const label = labels[source] || source;
    return detail ? `${label}（${placeholders[source] || ''}：${detail}）` : label;
  };

  // =============== 库存管理 ===============
  const handleAddSupply = () => {
    setEditingSupply(null);
    setSupplyForm({
      name: "",
      specification: "",
      unit: "个",
      current_stock: 0,
      min_stock: 0,
    });
    setSupplyDialogOpen(true);
  };

  const handleEditSupply = (supply: OfficeSupply) => {
    setEditingSupply(supply);
    void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.SUPPLY, target_type: '办公用品', target_id: supply.id, target_name: supply.name });
    setSupplyForm({
      name: supply.name,
      specification: supply.specification || "",
      unit: supply.unit,
      current_stock: supply.current_stock,
      min_stock: supply.min_stock,
    });
    setSupplyDialogOpen(true);
  };

  const handleSaveSupply = async () => {
    if (!supplyForm.name.trim()) {
      toast.error("请输入用品名称");
      return;
    }

    if (editingSupply) {
      const { error } = await dataAdapter.updateOfficeSupply(editingSupply.id, {
        name: supplyForm.name.trim(),
        specification: supplyForm.specification.trim() || null,
        unit: supplyForm.unit,
        current_stock: supplyForm.current_stock,
        min_stock: supplyForm.min_stock,
      });

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
      await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.SUPPLY, target_type: '办公用品', target_id: editingSupply.id, target_name: supplyForm.name });
    } else {
      const { error } = await dataAdapter.createOfficeSupply({
        name: supplyForm.name.trim(),
        specification: supplyForm.specification.trim() || null,
        unit: supplyForm.unit,
        current_stock: supplyForm.current_stock,
        min_stock: supplyForm.min_stock,
      });

      if (error) {
        toast.error("添加失败");
        return;
      }
      toast.success("添加成功");
      await logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.SUPPLY, target_type: '办公用品', target_name: supplyForm.name });
    }

    setSupplyDialogOpen(false);
    fetchSupplies();
  };

  const handleDeleteSupply = async () => {
    if (!deleteSupplyId) return;

    const { error } = await dataAdapter.updateOfficeSupply(deleteSupplyId, { is_active: false });

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("删除成功");
    await logAudit({ action: AUDIT_ACTIONS.DELETE, module: AUDIT_MODULES.SUPPLY, target_type: '办公用品', target_id: deleteSupplyId });
    setDeleteSupplyId(null);
    fetchSupplies();
  };

  // =============== 采购管理 ===============
  const handleAddPurchase = () => {
    setPurchaseForm({
      supply_id: "",
      quantity: 1,
      reason: "",
      requested_by: "",
    });
    setPurchaseDialogOpen(true);
  };

  const handleSavePurchase = async () => {
    if (!purchaseForm.supply_id) {
      toast.error("请选择办公用品");
      return;
    }
    if (!purchaseForm.requested_by.trim()) {
      toast.error("请输入申请人");
      return;
    }
    if (purchaseForm.quantity < 1) {
      toast.error("数量必须大于0");
      return;
    }

    const { error } = await dataAdapter.createDirectPurchaseRequest({
      supply_id: purchaseForm.supply_id,
      quantity: purchaseForm.quantity,
      reason: purchaseForm.reason.trim() || null,
      requested_by: purchaseForm.requested_by.trim(),
    });

    if (error) {
      toast.error("提交采购申请失败");
      return;
    }

    toast.success("采购申请已提交");
    await logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.SUPPLY, target_type: '采购申请' });
    setPurchaseDialogOpen(false);
    fetchPurchaseRequests();
  };

  const handleApprovePurchase = async (id: string) => {
    const { error } = await dataAdapter.updatePurchaseRequest(id, {
      status: "approved",
      approved_at: formatLocalNow(),
    });

    if (error) {
      toast.error("审批失败");
      return;
    }

    toast.success("已批准采购申请");
    await logAudit({ action: AUDIT_ACTIONS.APPROVE, module: AUDIT_MODULES.SUPPLY, target_type: '采购申请', target_id: id });
    fetchPurchaseRequests();
  };

  const handleRejectPurchase = async (id: string) => {
    const { error } = await dataAdapter.updatePurchaseRequest(id, { status: "rejected" });

    if (error) {
      toast.error("拒绝失败");
      return;
    }

    toast.success("已拒绝采购申请");
    await logAudit({ action: AUDIT_ACTIONS.REJECT, module: AUDIT_MODULES.SUPPLY, target_type: '采购申请', target_id: id });
    fetchPurchaseRequests();
  };

  const handleCompletePurchase = async (request: PurchaseRequest) => {
    // 更新采购状态为已完成
    const { error: updateError } = await dataAdapter.updatePurchaseRequest(request.id, {
      status: "completed",
      completed_at: formatLocalNow(),
    });

    if (updateError) {
      toast.error("操作失败");
      return;
    }

    // 更新库存数量
    const supply = supplies.find((s) => s.id === request.supply_id);
    if (supply) {
      const { error: stockError } = await dataAdapter.updateOfficeSupplyStock(
        request.supply_id,
        supply.current_stock + request.quantity
      );

      if (stockError) {
        toast.error("更新库存失败");
        return;
      }
    }

    toast.success("采购已入库，库存已更新");
    await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.SUPPLY, target_type: '采购入库', target_id: request.id });
    fetchPurchaseRequests();
    fetchSupplies();
  };

  // =============== 领用管理 ===============
  const handleAddRequisition = () => {
    setRequisitionForm({
      supply_id: "",
      quantity: 1,
      requisition_by: "",
    });
    setRequisitionDialogOpen(true);
  };

  const handleSaveRequisition = async () => {
    if (!requisitionForm.supply_id) {
      toast.error("请选择办公用品");
      return;
    }
    if (!requisitionForm.requisition_by.trim()) {
      toast.error("请输入领用人");
      return;
    }
    if (requisitionForm.quantity < 1) {
      toast.error("数量必须大于0");
      return;
    }

    const supply = supplies.find((s) => s.id === requisitionForm.supply_id);
    if (supply && requisitionForm.quantity > supply.current_stock) {
      toast.error(`库存不足，当前库存: ${supply.current_stock}`);
      return;
    }

    const { error } = await dataAdapter.createDirectSupplyRequisition({
      supply_id: requisitionForm.supply_id,
      quantity: requisitionForm.quantity,
      requisition_by: requisitionForm.requisition_by.trim(),
    });

    if (error) {
      toast.error("提交领用申请失败");
      return;
    }

    toast.success("领用申请已提交");
    await logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.SUPPLY, target_type: '领用申请' });
    setRequisitionDialogOpen(false);
    fetchRequisitions();
  };

  const handleApproveRequisition = async (id: string) => {
    const { error } = await dataAdapter.updateSupplyRequisition(id, {
      status: "approved",
      approved_at: formatLocalNow(),
    });

    if (error) {
      toast.error("审批失败");
      return;
    }

    toast.success("已批准领用申请");
    await logAudit({ action: AUDIT_ACTIONS.APPROVE, module: AUDIT_MODULES.SUPPLY, target_type: '领用申请', target_id: id });
    fetchRequisitions();
  };

  const handleRejectRequisition = async (id: string) => {
    const { error } = await dataAdapter.updateSupplyRequisition(id, { status: "rejected" });

    if (error) {
      toast.error("拒绝失败");
      return;
    }

    toast.success("已拒绝领用申请");
    await logAudit({ action: AUDIT_ACTIONS.REJECT, module: AUDIT_MODULES.SUPPLY, target_type: '领用申请', target_id: id });
    fetchRequisitions();
  };

  const handleCompleteRequisition = async (requisition: SupplyRequisition) => {
    const supply = supplies.find((s) => s.id === requisition.supply_id);
    if (supply && requisition.quantity > supply.current_stock) {
      toast.error(`库存不足，当前库存: ${supply.current_stock}`);
      return;
    }

    // 更新领用状态为已完成
    const { error: updateError } = await dataAdapter.updateSupplyRequisition(requisition.id, { status: "completed" });

    if (updateError) {
      toast.error("操作失败");
      return;
    }

    // 更新库存数量
    if (supply) {
      const { error: stockError } = await dataAdapter.updateOfficeSupplyStock(
        requisition.supply_id,
        supply.current_stock - requisition.quantity
      );

      if (stockError) {
        toast.error("更新库存失败");
        return;
      }
    }

    toast.success("领用完成，库存已更新");
    fetchRequisitions();
    fetchSupplies();
  };

  // 筛选数据
  const filteredSupplies = supplies.filter(
    (s) =>
      s.is_active &&
      (s.name.includes(supplySearch) ||
        (s.specification && s.specification.includes(supplySearch)))
  );

  const filteredPurchaseRequests = purchaseRequests.filter((r) => {
    const matchSearch =
      r.requested_by.includes(purchaseSearch) ||
      (r.department && r.department.includes(purchaseSearch)) ||
      (r.purpose && r.purpose.includes(purchaseSearch));
    const matchStatus =
      purchaseStatusFilter === "all" || r.status === purchaseStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredRequisitions = requisitions.filter((r) => {
    const matchSearch =
      r.requisition_by.includes(requisitionSearch);
    const matchStatus =
      requisitionStatusFilter === "all" || r.status === requisitionStatusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          办公用品管理
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              库存管理
            </TabsTrigger>
            <TabsTrigger value="purchase" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              采购需求
            </TabsTrigger>
            <TabsTrigger value="requisition" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              领用管理
            </TabsTrigger>
            <TabsTrigger value="office-purchase" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              办公采购
            </TabsTrigger>
            <TabsTrigger value="stock-history" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              库存变动
            </TabsTrigger>
          </TabsList>

          {/* 库存管理 */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜索用品名称或规格..."
                  value={supplySearch}
                  onChange={(e) => setSupplySearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={supplyDialogOpen} onOpenChange={setSupplyDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddSupply}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加用品
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingSupply ? "编辑办公用品" : "添加办公用品"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>用品名称 *</Label>
                      <Input
                        value={supplyForm.name}
                        onChange={(e) =>
                          setSupplyForm({ ...supplyForm, name: e.target.value })
                        }
                        placeholder="如：A4纸"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>规格</Label>
                      <Input
                        value={supplyForm.specification}
                        onChange={(e) =>
                          setSupplyForm({
                            ...supplyForm,
                            specification: e.target.value,
                          })
                        }
                        placeholder="如：80g 500张/包"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>单位</Label>
                        <Input
                          value={supplyForm.unit}
                          onChange={(e) =>
                            setSupplyForm({ ...supplyForm, unit: e.target.value })
                          }
                          placeholder="如：包、个、盒"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>当前库存</Label>
                        <Input
                          type="number"
                          min={0}
                          value={supplyForm.current_stock}
                          onChange={(e) =>
                            setSupplyForm({
                              ...supplyForm,
                              current_stock: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>最低库存警戒线</Label>
                      <Input
                        type="number"
                        min={0}
                        value={supplyForm.min_stock}
                        onChange={(e) =>
                          setSupplyForm({
                            ...supplyForm,
                            min_stock: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setSupplyDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button onClick={handleSaveSupply}>保存</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <SupplyTable 
              supplies={filteredSupplies} 
              onEdit={handleEditSupply} 
              onDelete={setDeleteSupplyId}
            />
          </TabsContent>

          {/* 采购需求管理 */}
          <TabsContent value="purchase" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="搜索用品或申请人..."
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={purchaseStatusFilter}
                  onValueChange={setPurchaseStatusFilter}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待审批</SelectItem>
                    <SelectItem value="approved">已批准</SelectItem>
                    <SelectItem value="rejected">已拒绝</SelectItem>
                    <SelectItem value="completed">已入库</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请人</TableHead>
                    <TableHead>申请部门</TableHead>
                    <TableHead>预算金额</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchaseRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无采购申请
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchaseRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.requested_by}</TableCell>
                        <TableCell>{request.department || "-"}</TableCell>
                        <TableCell>¥{Number(request.budget_amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {format(parseTime(request.created_at), "MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={purchaseStatusColors[request.status]}>
                            {purchaseStatusLabels[request.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            onClick={() => handleViewPurchaseDetail(request)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 领用管理 */}
          <TabsContent value="requisition" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="搜索用品或领用人..."
                    value={requisitionSearch}
                    onChange={(e) => setRequisitionSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={requisitionStatusFilter}
                  onValueChange={setRequisitionStatusFilter}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待审批</SelectItem>
                    <SelectItem value="approved">已批准</SelectItem>
                    <SelectItem value="rejected">已拒绝</SelectItem>
                    <SelectItem value="completed">已领取</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog
                open={requisitionDialogOpen}
                onOpenChange={setRequisitionDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建领用申请</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>办公用品 *</Label>
                      <Select
                        value={requisitionForm.supply_id}
                        onValueChange={(value) =>
                          setRequisitionForm({
                            ...requisitionForm,
                            supply_id: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择办公用品" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplies
                            .filter((s) => s.is_active && s.current_stock > 0)
                            .map((supply) => (
                              <SelectItem key={supply.id} value={supply.id}>
                                {supply.name}
                                {supply.specification
                                  ? ` (${supply.specification})`
                                  : ""}{" "}
                                - 库存: {supply.current_stock}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>领用数量 *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={requisitionForm.quantity}
                          onChange={(e) =>
                            setRequisitionForm({
                              ...requisitionForm,
                              quantity: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>领用人 *</Label>
                        <Input
                          value={requisitionForm.requisition_by}
                          onChange={(e) =>
                            setRequisitionForm({
                              ...requisitionForm,
                              requisition_by: e.target.value,
                            })
                          }
                          placeholder="输入领用人姓名"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setRequisitionDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button onClick={handleSaveRequisition}>提交申请</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>领用人</TableHead>
                    <TableHead>领用日期</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequisitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        暂无领用记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequisitions.map((requisition) => (
                      <TableRow key={requisition.id}>
                        <TableCell className="font-medium">{requisition.requisition_by}</TableCell>
                        <TableCell>{normalizeDate(requisition.requisition_date) || "-"}</TableCell>
                        <TableCell>
                          {format(parseTime(requisition.created_at), "MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={requisitionStatusColors[requisition.status]}>
                            {requisitionStatusLabels[requisition.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            onClick={() => handleViewRequisitionDetail(requisition)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 办公采购管理 */}
          <TabsContent value="office-purchase" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜索部门或申请人..."
                  value={officePurchaseSearch}
                  onChange={(e) => setOfficePurchaseSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={officePurchaseStatusFilter}
                onValueChange={setOfficePurchaseStatusFilter}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待审批</SelectItem>
                  <SelectItem value="approved">已批准</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>部门</TableHead>
                    <TableHead>申请人</TableHead>
                    <TableHead>采购日期</TableHead>
                    <TableHead>总金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officePurchases
                    .filter(p => 
                      (officePurchaseStatusFilter === "all" || p.status === officePurchaseStatusFilter) &&
                      (p.department.includes(officePurchaseSearch) || p.applicant_name.includes(officePurchaseSearch))
                    )
                    .length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无办公采购记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    officePurchases
                      .filter(p => 
                        (officePurchaseStatusFilter === "all" || p.status === officePurchaseStatusFilter) &&
                        (p.department.includes(officePurchaseSearch) || p.applicant_name.includes(officePurchaseSearch))
                      )
                      .map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">{purchase.department}</TableCell>
                          <TableCell>{purchase.applicant_name}</TableCell>
                          <TableCell>{purchase.purchase_date}</TableCell>
                          <TableCell>¥{Number(purchase.total_amount || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={officePurchaseStatusColors[purchase.status] || "bg-gray-100 text-gray-800"}>
                              {officePurchaseStatusLabels[purchase.status] || purchase.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                              onClick={() => handleViewOfficePurchase(purchase)}
                            >
                              查看详情
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 库存变动记录 */}
          <TabsContent value="stock-history" className="space-y-4">
            <StockMovementHistory />
          </TabsContent>
        </Tabs>

        {/* 办公采购详情对话框 */}
        <Dialog open={officePurchaseDetailOpen} onOpenChange={setOfficePurchaseDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-background to-muted/30">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-lg font-semibold">办公采购详情</DialogTitle>
                {selectedOfficePurchase && (
                  <Badge className={officePurchaseStatusColors[selectedOfficePurchase.status] || "bg-gray-100 text-gray-800"}>
                    {officePurchaseStatusLabels[selectedOfficePurchase.status] || selectedOfficePurchase.status}
                  </Badge>
                )}
              </div>
            </DialogHeader>
            {selectedOfficePurchase && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">部门</Label>
                    <div className="font-medium">{selectedOfficePurchase.department}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">申请人</Label>
                    <div className="font-medium">{selectedOfficePurchase.applicant_name}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">采购日期</Label>
                    <div className="font-medium">{selectedOfficePurchase.purchase_date}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">总金额</Label>
                    <div className="font-medium text-primary">¥{Number(selectedOfficePurchase.total_amount || 0).toFixed(2)}</div>
                  </div>
                  {selectedOfficePurchase.reason && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">采购理由</Label>
                      <div className="font-medium">{selectedOfficePurchase.reason}</div>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label className="text-muted-foreground text-xs mb-2 block">采购明细</Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>品名</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>单价</TableHead>
                          <TableHead>小计</TableHead>
                          <TableHead>备注</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {officePurchaseItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">暂无明细</TableCell>
                          </TableRow>
                        ) : (
                          officePurchaseItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.item_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>¥{Number(item.unit_price || 0).toFixed(2)}</TableCell>
                              <TableCell>¥{Number(item.amount || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-muted-foreground">{item.remarks || "-"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator />
                <ApprovalTimeline businessId={selectedOfficePurchase.id} businessType="supply_purchase" />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 采购需求详情对话框 */}
        <Dialog open={purchaseDetailOpen} onOpenChange={setPurchaseDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center justify-between pr-8">
                <span>采购详情</span>
                {selectedPurchaseRequest && (
                  <Badge className={purchaseStatusColors[selectedPurchaseRequest.status]}>
                    {purchaseStatusLabels[selectedPurchaseRequest.status]}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedPurchaseRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">申请人</Label>
                    <div className="font-medium">{selectedPurchaseRequest.requested_by}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">申请部门</Label>
                    <div className="font-medium">{selectedPurchaseRequest.department || "-"}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">采购方式</Label>
                    <div className="font-medium">{selectedPurchaseRequest.procurement_method || "-"}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">资金来源</Label>
                    <div className="font-medium">{selectedPurchaseRequest.funding_source ? getFundingSourceLabel(selectedPurchaseRequest.funding_source, selectedPurchaseRequest.funding_detail) : "-"}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">预算金额</Label>
                    <div className="font-medium">{selectedPurchaseRequest.budget_amount ? `¥${Number(selectedPurchaseRequest.budget_amount).toFixed(2)}` : "-"}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">申请日期</Label>
                    <div className="font-medium">{normalizeDate(selectedPurchaseRequest.purchase_date)}</div>
                  </div>
                </div>
                {selectedPurchaseRequest.purpose && (
                  <div>
                    <Label className="text-muted-foreground text-xs">采购用途</Label>
                    <div className="font-medium">{selectedPurchaseRequest.purpose}</div>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground text-xs mb-2 block">采购明细</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader><TableRow className="bg-muted/30"><TableHead>名称</TableHead><TableHead>规格</TableHead><TableHead>数量</TableHead><TableHead>单价</TableHead><TableHead>金额</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {purchaseDetailItems.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无明细</TableCell></TableRow>
                        ) : (
                          purchaseDetailItems.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.office_supplies?.name || item.item_name || "-"}</TableCell>
                              <TableCell>{item.office_supplies?.specification || item.specification || "-"}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>¥{Number(item.unit_price || 0).toFixed(2)}</TableCell>
                              <TableCell>¥{Number(item.amount || 0).toFixed(2)}</TableCell>
                            </TableRow>
                          ))
                        )}
                        {purchaseDetailItems.length > 0 && (
                          <TableRow className="bg-muted/30"><TableCell colSpan={4} className="text-right font-medium">合计</TableCell><TableCell className="font-bold text-primary">¥{Number(selectedPurchaseRequest.total_amount || 0).toFixed(2)}</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator />
                <ApprovalTimeline businessId={selectedPurchaseRequest.id} businessType="purchase_request" />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 领用详情对话框 */}
        <Dialog open={requisitionDetailOpen} onOpenChange={setRequisitionDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center justify-between pr-8">
                <span>领用详情</span>
                {selectedRequisition && (
                  <Badge className={requisitionStatusColors[selectedRequisition.status]}>
                    {requisitionStatusLabels[selectedRequisition.status]}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedRequisition && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">申请人</Label>
                    <div className="font-medium">{selectedRequisition.requisition_by}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">领用日期</Label>
                    <div className="font-medium">{normalizeDate(selectedRequisition.requisition_date) || "-"}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">申请时间</Label>
                    <div className="font-medium">{format(parseTime(selectedRequisition.created_at), "yyyy-MM-dd HH:mm")}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs mb-2 block">物品明细</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader><TableRow className="bg-muted/30"><TableHead>物品名称</TableHead><TableHead>规格</TableHead><TableHead>数量</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {requisitionDetailItems.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">暂无明细</TableCell></TableRow>
                        ) : (
                          requisitionDetailItems.map((item: any) => (
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

                <Separator />
                <ApprovalTimeline businessId={selectedRequisition.id} businessType="supply_requisition" />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 删除确认对话框 */}
        <AlertDialog
          open={!!deleteSupplyId}
          onOpenChange={() => setDeleteSupplyId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除这个办公用品吗？删除后将无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSupply}>
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

// 抽取表格组件以支持分页
const SupplyTable = ({
  supplies,
  onEdit,
  onDelete,
}: {
  supplies: OfficeSupply[];
  onEdit: (supply: OfficeSupply) => void;
  onDelete: (id: string) => void;
}) => {
  const pagination = usePagination(supplies);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用品名称</TableHead>
            <TableHead>规格</TableHead>
            <TableHead>单位</TableHead>
            <TableHead>当前库存</TableHead>
            <TableHead>库存警戒</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                暂无办公用品数据
              </TableCell>
            </TableRow>
          ) : (
            pagination.paginatedData.map((supply) => (
              <TableRow key={supply.id}>
                <TableCell className="font-medium">{supply.name}</TableCell>
                <TableCell>{supply.specification || "-"}</TableCell>
                <TableCell>{supply.unit}</TableCell>
                <TableCell>
                  <span
                    className={
                      supply.current_stock <= supply.min_stock
                        ? "text-destructive font-medium"
                        : ""
                    }
                  >
                    {supply.current_stock}
                  </span>
                </TableCell>
                <TableCell>{supply.min_stock}</TableCell>
                <TableCell>
                  {supply.current_stock <= supply.min_stock ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      库存不足
                    </Badge>
                  ) : (
                    <Badge variant="secondary">正常</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(supply)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(supply.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrevious={pagination.canGoPrevious}
        onPageChange={pagination.setCurrentPage}
        onPageSizeChange={pagination.setPageSize}
        goToNextPage={pagination.goToNextPage}
        goToPreviousPage={pagination.goToPreviousPage}
      />
    </div>
  );
};

export default SupplyManagement;
