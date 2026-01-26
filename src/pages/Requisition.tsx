import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, ArrowLeft, Eye, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";

interface SupplyRequisition {
  id: string;
  supply_id: string;
  quantity: number;
  requisition_by: string;
  requisition_date: string;
  status: string;
  created_at: string;
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

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  completed: { label: "已完成", variant: "outline" },
};

const Requisition = () => {
  const navigate = useNavigate();
  const { startApproval } = useApprovalWorkflow();
  const [records, setRecords] = useState<SupplyRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SupplyRequisition | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    supply_id: "",
    quantity: 1,
    requisition_date: new Date(),
  });

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
      .select(`
        *,
        office_supplies (
          name,
          specification,
          unit
        )
      `)
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
    r.office_supplies?.name.includes(search)
  );

  const handleViewDetail = (record: SupplyRequisition) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  const handleOpenForm = () => {
    fetchSupplies();
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.supply_id) {
      toast.error("请选择办公用品");
      return;
    }
    if (form.quantity < 1) {
      toast.error("数量必须大于0");
      return;
    }

    const supply = supplies.find((s) => s.id === form.supply_id);
    if (supply && form.quantity > supply.current_stock) {
      toast.error(`库存不足，当前库存: ${supply.current_stock}`);
      return;
    }

    setSubmitting(true);

    const { data: record, error } = await supabase.from("supply_requisitions").insert({
      supply_id: form.supply_id,
      quantity: form.quantity,
      requisition_by: currentUser?.name || "",
      requisition_date: format(form.requisition_date, "yyyy-MM-dd"),
    }).select("id").single();

    if (error || !record) {
      toast.error("提交领用申请失败");
      setSubmitting(false);
      return;
    }

    const approvalResult = await startApproval({
      businessType: "supply_requisition",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `领用申请 - ${supply?.name || "办公用品"}`,
      formData: {
        supply_id: form.supply_id,
        supply_name: supply?.name,
        quantity: form.quantity,
        requisition_date: format(form.requisition_date, "yyyy-MM-dd"),
      },
    });

    setSubmitting(false);

    if (approvalResult.success) {
      toast.success("领用申请已提交");
      setFormOpen(false);
      setForm({ supply_id: "", quantity: 1, requisition_date: new Date() });
      fetchRecords();
    } else {
      toast.error(approvalResult.error || "启动审批流程失败");
    }
  };

  return (
    <PageLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>领用申请</CardTitle>
          </div>
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
                placeholder="搜索物品名称..."
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
                  <TableHead>物品名称</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>领用日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.office_supplies?.name || "-"}</TableCell>
                    <TableCell>{record.office_supplies?.specification || "-"}</TableCell>
                    <TableCell>{record.quantity} {record.office_supplies?.unit}</TableCell>
                    <TableCell>{record.requisition_date}</TableCell>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建领用申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>办公用品 *</Label>
              <Select value={form.supply_id} onValueChange={(v) => setForm({ ...form, supply_id: v })}>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>领用数量 *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>领用日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(form.requisition_date, "yyyy-MM-dd", { locale: zhCN })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.requisition_date}
                      onSelect={(date) => date && setForm({ ...form, requisition_date: date })}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>领用详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">物品名称</Label>
                  <div className="mt-1">{selectedRecord.office_supplies?.name || "-"}</div>
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
                  <Label className="text-sm text-muted-foreground">规格</Label>
                  <div className="mt-1">{selectedRecord.office_supplies?.specification || "-"}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">领用数量</Label>
                  <div className="mt-1">{selectedRecord.quantity} {selectedRecord.office_supplies?.unit}</div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Requisition;
