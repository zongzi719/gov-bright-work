import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { format } from "date-fns";

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
  status: RequisitionStatus;
  approved_at: string | null;
  created_at: string;
  office_supplies?: OfficeSupply;
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

  useEffect(() => {
    fetchSupplies();
    fetchPurchaseRequests();
    fetchRequisitions();
  }, []);

  // 获取办公用品列表
  const fetchSupplies = async () => {
    const { data, error } = await supabase
      .from("office_supplies")
      .select("*")
      .order("name");

    if (error) {
      toast.error("获取办公用品列表失败");
      return;
    }
    setSupplies(data || []);
  };

  // 获取采购申请列表
  const fetchPurchaseRequests = async () => {
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("*, office_supplies(*)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取采购申请列表失败");
      return;
    }
    setPurchaseRequests(data || []);
  };

  // 获取领用记录列表
  const fetchRequisitions = async () => {
    const { data, error } = await supabase
      .from("supply_requisitions")
      .select("*, office_supplies(*)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取领用记录列表失败");
      return;
    }
    setRequisitions(data || []);
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
      const { error } = await supabase
        .from("office_supplies")
        .update({
          name: supplyForm.name.trim(),
          specification: supplyForm.specification.trim() || null,
          unit: supplyForm.unit,
          current_stock: supplyForm.current_stock,
          min_stock: supplyForm.min_stock,
        })
        .eq("id", editingSupply.id);

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
    } else {
      const { error } = await supabase.from("office_supplies").insert({
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
    }

    setSupplyDialogOpen(false);
    fetchSupplies();
  };

  const handleDeleteSupply = async () => {
    if (!deleteSupplyId) return;

    const { error } = await supabase
      .from("office_supplies")
      .update({ is_active: false })
      .eq("id", deleteSupplyId);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("删除成功");
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

    const { error } = await supabase.from("purchase_requests").insert({
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
    setPurchaseDialogOpen(false);
    fetchPurchaseRequests();
  };

  const handleApprovePurchase = async (id: string) => {
    const { error } = await supabase
      .from("purchase_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("审批失败");
      return;
    }

    toast.success("已批准采购申请");
    fetchPurchaseRequests();
  };

  const handleRejectPurchase = async (id: string) => {
    const { error } = await supabase
      .from("purchase_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      toast.error("拒绝失败");
      return;
    }

    toast.success("已拒绝采购申请");
    fetchPurchaseRequests();
  };

  const handleCompletePurchase = async (request: PurchaseRequest) => {
    // 更新采购状态为已完成
    const { error: updateError } = await supabase
      .from("purchase_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (updateError) {
      toast.error("操作失败");
      return;
    }

    // 更新库存数量
    const supply = supplies.find((s) => s.id === request.supply_id);
    if (supply) {
      const { error: stockError } = await supabase
        .from("office_supplies")
        .update({
          current_stock: supply.current_stock + request.quantity,
        })
        .eq("id", request.supply_id);

      if (stockError) {
        toast.error("更新库存失败");
        return;
      }
    }

    toast.success("采购已入库，库存已更新");
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

    const { error } = await supabase.from("supply_requisitions").insert({
      supply_id: requisitionForm.supply_id,
      quantity: requisitionForm.quantity,
      requisition_by: requisitionForm.requisition_by.trim(),
    });

    if (error) {
      toast.error("提交领用申请失败");
      return;
    }

    toast.success("领用申请已提交");
    setRequisitionDialogOpen(false);
    fetchRequisitions();
  };

  const handleApproveRequisition = async (id: string) => {
    const { error } = await supabase
      .from("supply_requisitions")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("审批失败");
      return;
    }

    toast.success("已批准领用申请");
    fetchRequisitions();
  };

  const handleRejectRequisition = async (id: string) => {
    const { error } = await supabase
      .from("supply_requisitions")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      toast.error("拒绝失败");
      return;
    }

    toast.success("已拒绝领用申请");
    fetchRequisitions();
  };

  const handleCompleteRequisition = async (requisition: SupplyRequisition) => {
    const supply = supplies.find((s) => s.id === requisition.supply_id);
    if (supply && requisition.quantity > supply.current_stock) {
      toast.error(`库存不足，当前库存: ${supply.current_stock}`);
      return;
    }

    // 更新领用状态为已完成
    const { error: updateError } = await supabase
      .from("supply_requisitions")
      .update({ status: "completed" })
      .eq("id", requisition.id);

    if (updateError) {
      toast.error("操作失败");
      return;
    }

    // 更新库存数量
    if (supply) {
      const { error: stockError } = await supabase
        .from("office_supplies")
        .update({
          current_stock: supply.current_stock - requisition.quantity,
        })
        .eq("id", requisition.supply_id);

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
      (r.office_supplies && r.office_supplies.name.includes(purchaseSearch));
    const matchStatus =
      purchaseStatusFilter === "all" || r.status === purchaseStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredRequisitions = requisitions.filter((r) => {
    const matchSearch =
      r.requisition_by.includes(requisitionSearch) ||
      (r.office_supplies && r.office_supplies.name.includes(requisitionSearch));
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
              <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddPurchase}>
                    <Plus className="w-4 h-4 mr-2" />
                    新建采购申请
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建采购申请</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>办公用品 *</Label>
                      <Select
                        value={purchaseForm.supply_id}
                        onValueChange={(value) =>
                          setPurchaseForm({ ...purchaseForm, supply_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择办公用品" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplies
                            .filter((s) => s.is_active)
                            .map((supply) => (
                              <SelectItem key={supply.id} value={supply.id}>
                                {supply.name}
                                {supply.specification
                                  ? ` (${supply.specification})`
                                  : ""}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>采购数量 *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={purchaseForm.quantity}
                          onChange={(e) =>
                            setPurchaseForm({
                              ...purchaseForm,
                              quantity: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>申请人 *</Label>
                        <Input
                          value={purchaseForm.requested_by}
                          onChange={(e) =>
                            setPurchaseForm({
                              ...purchaseForm,
                              requested_by: e.target.value,
                            })
                          }
                          placeholder="输入申请人姓名"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>采购原因</Label>
                      <Textarea
                        value={purchaseForm.reason}
                        onChange={(e) =>
                          setPurchaseForm({
                            ...purchaseForm,
                            reason: e.target.value,
                          })
                        }
                        placeholder="输入采购原因"
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setPurchaseDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button onClick={handleSavePurchase}>提交申请</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>办公用品</TableHead>
                    <TableHead>采购数量</TableHead>
                    <TableHead>申请人</TableHead>
                    <TableHead>采购原因</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchaseRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无采购申请
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchaseRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.office_supplies?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {request.quantity} {request.office_supplies?.unit || ""}
                        </TableCell>
                        <TableCell>{request.requested_by}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {request.reason || "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.created_at), "MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={purchaseStatusColors[request.status]}>
                            {purchaseStatusLabels[request.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprovePurchase(request.id)}
                                  title="批准"
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRejectPurchase(request.id)}
                                  title="拒绝"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {request.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCompletePurchase(request)}
                                className="gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                入库
                              </Button>
                            )}
                          </div>
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
                    <TableHead>办公用品</TableHead>
                    <TableHead>领用数量</TableHead>
                    <TableHead>领用人</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequisitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无领用记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequisitions.map((requisition) => (
                      <TableRow key={requisition.id}>
                        <TableCell className="font-medium">
                          {requisition.office_supplies?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {requisition.quantity}{" "}
                          {requisition.office_supplies?.unit || ""}
                        </TableCell>
                        <TableCell>{requisition.requisition_by}</TableCell>
                        <TableCell>
                          {format(new Date(requisition.created_at), "MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={requisitionStatusColors[requisition.status]}
                          >
                            {requisitionStatusLabels[requisition.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {requisition.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleApproveRequisition(requisition.id)
                                  }
                                  title="批准"
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleRejectRequisition(requisition.id)
                                  }
                                  title="拒绝"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {requisition.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleCompleteRequisition(requisition)
                                }
                                className="gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                确认领取
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

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
