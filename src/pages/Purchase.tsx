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
import { Plus, Search, Eye, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";

interface PurchaseRequest {
  id: string;
  supply_id: string;
  quantity: number;
  requested_by: string;
  purchase_date: string;
  unit_price: number | null;
  total_amount: number | null;
  reason: string | null;
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [supplies, setSupplies] = useState<OfficeSupply[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    supply_id: "",
    quantity: 1,
    reason: "",
    purchase_date: new Date(),
    unit_price: 0,
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
      .from("purchase_requests")
      .select(`
        *,
        office_supplies (
          name,
          specification,
          unit
        )
      `)
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
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data) setSupplies(data);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.name]);

  const filteredRecords = records.filter(r =>
    r.office_supplies?.name.includes(search) ||
    r.reason?.includes(search)
  );

  const handleViewDetail = (record: PurchaseRequest) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  const handleOpenForm = () => {
    fetchSupplies();
    setFormOpen(true);
  };

  const totalAmount = form.quantity * form.unit_price;

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
    setSubmitting(true);

    const { data: record, error } = await supabase.from("purchase_requests").insert({
      supply_id: form.supply_id,
      quantity: form.quantity,
      reason: form.reason.trim() || null,
      requested_by: currentUser?.name || "",
      purchase_date: format(form.purchase_date, "yyyy-MM-dd"),
      unit_price: form.unit_price,
      total_amount: totalAmount,
    }).select("id").single();

    if (error || !record) {
      toast.error("提交采购申请失败");
      setSubmitting(false);
      return;
    }

    const approvalResult = await startApproval({
      businessType: "purchase_request",
      businessId: record.id,
      initiatorId: currentUser?.id || "",
      initiatorName: currentUser?.name || "未知用户",
      title: `采购申请 - ${supply?.name || "办公用品"}`,
      formData: {
        supply_id: form.supply_id,
        supply_name: supply?.name,
        quantity: form.quantity,
        reason: form.reason,
        purchase_date: format(form.purchase_date, "yyyy-MM-dd"),
        unit_price: form.unit_price,
        total_amount: totalAmount,
      },
    });

    setSubmitting(false);

    if (approvalResult.success) {
      toast.success("采购申请已提交");
      setFormOpen(false);
      setForm({ supply_id: "", quantity: 1, reason: "", purchase_date: new Date(), unit_price: 0 });
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
                placeholder="搜索物品名称或原因..."
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
                  <TableHead>物品名称</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>总额</TableHead>
                  <TableHead>采购日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.office_supplies?.name || "-"}</TableCell>
                    <TableCell>{record.quantity} {record.office_supplies?.unit}</TableCell>
                    <TableCell>¥{record.unit_price || 0}</TableCell>
                    <TableCell>¥{record.total_amount || 0}</TableCell>
                    <TableCell>{record.purchase_date}</TableCell>
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
            <DialogTitle>新建采购申请</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>办公用品 *</Label>
              <Select value={form.supply_id} onValueChange={(v) => setForm({ ...form, supply_id: v })}>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>采购数量 *</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>采购日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(form.purchase_date, "yyyy-MM-dd", { locale: zhCN })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.purchase_date}
                      onSelect={(date) => date && setForm({ ...form, purchase_date: date })}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>采购单价 (元)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>采购总额</Label>
                <Input value={`¥${totalAmount.toFixed(2)}`} disabled className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>采购原因</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="请说明采购原因"
                rows={2}
              />
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
            <DialogTitle>采购详情</DialogTitle>
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
                  <Label className="text-sm text-muted-foreground">采购数量</Label>
                  <div className="mt-1">{selectedRecord.quantity} {selectedRecord.office_supplies?.unit}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">采购单价</Label>
                  <div className="mt-1">¥{selectedRecord.unit_price || 0}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">采购总额</Label>
                  <div className="mt-1">¥{selectedRecord.total_amount || 0}</div>
                </div>
              </div>
              {selectedRecord.reason && (
                <div>
                  <Label className="text-sm text-muted-foreground">采购原因</Label>
                  <div className="mt-1">{selectedRecord.reason}</div>
                </div>
              )}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Purchase;
