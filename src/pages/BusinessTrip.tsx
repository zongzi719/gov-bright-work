import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import BusinessTripForm from "@/components/forms/BusinessTripForm";

interface AbsenceRecord {
  id: string;
  reason: string;
  destination: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  duration_days: number | null;
  transport_type: string | null;
  estimated_cost: number | null;
  companions: string[] | null;
  notes: string | null;
  created_at: string;
  contacts: {
    name: string;
    department: string | null;
  } | null;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审批", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已拒绝", variant: "destructive" },
  completed: { label: "已完成", variant: "outline" },
  cancelled: { label: "已取消", variant: "outline" },
};

const transportTypeLabels: Record<string, string> = {
  plane: "飞机",
  train: "火车/高铁",
  car: "汽车/自驾",
  other: "其他",
};

const BusinessTrip = () => {
  const [records, setRecords] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AbsenceRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
    if (!currentUser?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("absence_records")
      .select(`
        *,
        contacts:contacts!absence_records_contact_id_fkey (
          name,
          department
        )
      `)
      .eq("type", "business_trip")
      .eq("contact_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRecords(data as AbsenceRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, [currentUser?.id]);

  const filteredRecords = records.filter(r =>
    r.destination?.includes(search) ||
    r.reason.includes(search)
  );

  const handleViewDetail = (record: AbsenceRecord) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      fetchRecords();
    }
  };

  return (
    <PageLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>出差申请</CardTitle>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新增申请
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索目的地或事由..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无出差记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>目的地</TableHead>
                  <TableHead>出差事由</TableHead>
                  <TableHead>开始时间</TableHead>
                  <TableHead>结束时间</TableHead>
                  <TableHead>天数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.destination || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{record.reason}</TableCell>
                    <TableCell>{format(new Date(record.start_time), "yyyy-MM-dd", { locale: zhCN })}</TableCell>
                    <TableCell>{record.end_time ? format(new Date(record.end_time), "yyyy-MM-dd", { locale: zhCN }) : "-"}</TableCell>
                    <TableCell>{record.duration_days || "-"}</TableCell>
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

      <BusinessTripForm
        open={formOpen}
        onOpenChange={handleFormClose}
        currentUser={currentUser}
      />

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>出差详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">目的地</Label>
                  <div className="mt-1">{selectedRecord.destination || "-"}</div>
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
              <div>
                <Label className="text-sm text-muted-foreground">出差事由</Label>
                <div className="mt-1">{selectedRecord.reason}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">开始时间</Label>
                  <div className="mt-1">{format(new Date(selectedRecord.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN })}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">结束时间</Label>
                  <div className="mt-1">{selectedRecord.end_time ? format(new Date(selectedRecord.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN }) : "-"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">出差天数</Label>
                  <div className="mt-1">{selectedRecord.duration_days || "-"} 天</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">交通方式</Label>
                  <div className="mt-1">{selectedRecord.transport_type ? transportTypeLabels[selectedRecord.transport_type] || selectedRecord.transport_type : "-"}</div>
                </div>
              </div>
              {selectedRecord.estimated_cost && (
                <div>
                  <Label className="text-sm text-muted-foreground">预计费用</Label>
                  <div className="mt-1">¥{selectedRecord.estimated_cost}</div>
                </div>
              )}
              {selectedRecord.notes && (
                <div>
                  <Label className="text-sm text-muted-foreground">备注</Label>
                  <div className="mt-1">{selectedRecord.notes}</div>
                </div>
              )}
              <div>
                <Label className="text-sm text-muted-foreground">申请时间</Label>
                <div className="mt-1">{format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default BusinessTrip;
