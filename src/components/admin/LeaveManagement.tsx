import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Check, X, Search, Clock, UserCheck } from "lucide-react";

type AbsenceStatus = "pending" | "approved" | "rejected" | "completed" | "cancelled";

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  organization: {
    name: string;
  } | null;
}

interface AbsenceRecord {
  id: string;
  contact_id: string;
  type: string;
  reason: string;
  start_time: string;
  end_time: string | null;
  status: AbsenceStatus;
  approved_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
  contacts: Contact | null;
}

const statusLabels: Record<AbsenceStatus, string> = {
  pending: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  completed: "已销假",
  cancelled: "已取消",
};

const statusColors: Record<AbsenceStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const LeaveManagement = () => {
  const [records, setRecords] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AbsenceStatus | "all">("all");

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("absence_records")
      .select(`
        *,
        contacts (
          id,
          name,
          department,
          position,
          organization:organizations (name)
        )
      `)
      .eq("type", "leave")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取记录失败");
      console.error(error);
    } else {
      setRecords((data as unknown as AbsenceRecord[]) || []);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("absence_records")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("审批失败");
    } else {
      toast.success("已批准");
      fetchRecords();
    }
  };

  const handleReject = async (id: string) => {
    const record = records.find((r) => r.id === id);
    const { error } = await supabase
      .from("absence_records")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      toast.error("操作失败");
    } else {
      toast.success("已拒绝");
      if (record?.contact_id) {
        await supabase
          .from("contacts")
          .update({ status: "on_duty", status_note: null })
          .eq("id", record.contact_id);
      }
      fetchRecords();
    }
  };

  const handleComplete = async (id: string) => {
    const record = records.find((r) => r.id === id);
    const { error } = await supabase
      .from("absence_records")
      .update({ status: "completed" })
      .eq("id", id);

    if (error) {
      toast.error("销假失败");
    } else {
      toast.success("销假成功");
      if (record?.contact_id) {
        await supabase
          .from("contacts")
          .update({ status: "on_duty", status_note: null })
          .eq("id", record.contact_id);
      }
      fetchRecords();
    }
  };

  const openCancelDialog = (id: string) => {
    setSelectedRecordId(id);
    setCancelReason("");
    setIsCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!selectedRecordId) return;

    const record = records.find((r) => r.id === selectedRecordId);
    const { error } = await supabase
      .from("absence_records")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: cancelReason || null,
      })
      .eq("id", selectedRecordId);

    if (error) {
      toast.error("取消失败");
    } else {
      toast.success("已取消");
      if (record?.contact_id) {
        await supabase
          .from("contacts")
          .update({ status: "on_duty", status_note: null })
          .eq("id", record.contact_id);
      }
      setIsCancelDialogOpen(false);
      fetchRecords();
    }
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !searchTerm ||
      record.contacts?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pagination = usePagination(filteredRecords, { defaultPageSize: 10 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">请假申请</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 搜索和筛选 */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索人员姓名或事由..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as AbsenceStatus | "all")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="pending">待审批</SelectItem>
              <SelectItem value="approved">已批准</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
              <SelectItem value="completed">已销假</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 表格 */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无记录</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>人员</TableHead>
                  <TableHead>单位/部门</TableHead>
                  <TableHead>事由</TableHead>
                  <TableHead>开始时间</TableHead>
                  <TableHead>结束时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedData.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.contacts?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {record.contacts?.organization?.name || record.contacts?.department || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {record.reason}
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.start_time), "MM-dd HH:mm", { locale: zhCN })}
                    </TableCell>
                    <TableCell>
                      {record.end_time
                        ? format(new Date(record.end_time), "MM-dd HH:mm", { locale: zhCN })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[record.status]}>
                        {statusLabels[record.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        onClick={() => {/* TODO: 查看详情 */}}
                      >
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
          </>
        )}
      </CardContent>

      {/* 取消对话框 */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>撤销请假</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">撤销原因</label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="请输入撤销原因（可选）"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCancel}>确认撤销</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LeaveManagement;
