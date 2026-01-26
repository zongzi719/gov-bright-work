import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import ApprovalTimeline from "./ApprovalTimeline";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Search, Eye } from "lucide-react";

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
  leave_type: string | null;
  created_at: string;
  contacts: Contact | null;
  // 关联的审批实例状态
  approval_status?: string;
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

const approvalStatusLabels: Record<string, string> = {
  pending: "审批中",
  pending_returned: "已退回", // 退回待修改
  approved: "已完成",
  rejected: "已驳回",
  cancelled: "已取消",
  expired: "已过期",
};

const approvalStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  pending_returned: "bg-orange-100 text-orange-800", // 退回待修改
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-500",
};

const leaveTypeLabels: Record<string, string> = {
  annual: "年假",
  sick: "病假",
  personal: "事假",
};

const LeaveManagement = () => {
  const [records, setRecords] = useState<AbsenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AbsenceRecord | null>(null);
  const [approvalInstanceStatus, setApprovalInstanceStatus] = useState<string | null>(null);
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
      const recordsData = (data as unknown as AbsenceRecord[]) || [];
      
      // 批量获取审批实例状态
      if (recordsData.length > 0) {
        const recordIds = recordsData.map(r => r.id);
        const { data: instancesData } = await supabase
          .from("approval_instances")
          .select("business_id, status, form_data")
          .eq("business_type", "leave")
          .in("business_id", recordIds);
        
        // 创建映射 - 判断是否有退回信息
        const statusMap = new Map<string, string>();
        instancesData?.forEach(inst => {
          let displayStatus: string = inst.status;
          // 如果状态是 pending 但有退回信息，显示为"已退回"
          if (inst.status === "pending" && inst.form_data) {
            const formData = inst.form_data as Record<string, any>;
            if (formData._return_info) {
              displayStatus = "pending_returned";
            }
          }
          statusMap.set(inst.business_id, displayStatus);
        });
        
        // 合并状态
        recordsData.forEach(record => {
          record.approval_status = statusMap.get(record.id);
        });
      }
      
      setRecords(recordsData);
    }
    setLoading(false);
  };

  const openDetailDialog = async (record: AbsenceRecord) => {
    setSelectedRecord(record);
    setApprovalInstanceStatus(null);
    setIsDetailDialogOpen(true);
    
    // 获取审批实例的真实状态
    const { data: instanceData } = await supabase
      .from("approval_instances")
      .select("status, form_data")
      .eq("business_id", record.id)
      .eq("business_type", "leave")
      .single();
    
    if (instanceData) {
      // 如果状态是 pending 但有退回信息，显示为"已退回"
      let displayStatus: string = instanceData.status;
      if (instanceData.status === "pending" && instanceData.form_data) {
        const formData = instanceData.form_data as Record<string, any>;
        if (formData._return_info) {
          displayStatus = "pending_returned";
        }
      }
      setApprovalInstanceStatus(displayStatus);
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
                      {record.approval_status ? (
                        <Badge className={approvalStatusColors[record.approval_status] || "bg-gray-100 text-gray-800"}>
                          {approvalStatusLabels[record.approval_status] || record.approval_status}
                        </Badge>
                      ) : (
                        <Badge className={statusColors[record.status]}>
                          {statusLabels[record.status]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        onClick={() => openDetailDialog(record)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
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

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              请假申请详情
              {approvalInstanceStatus ? (
                <Badge className={approvalStatusColors[approvalInstanceStatus] || "bg-gray-100 text-gray-800"}>
                  {approvalStatusLabels[approvalInstanceStatus] || approvalInstanceStatus}
                </Badge>
              ) : selectedRecord ? (
                <Badge className={statusColors[selectedRecord.status]}>
                  {statusLabels[selectedRecord.status]}
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">申请人</Label>
                  <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                    {selectedRecord.contacts?.name || "-"}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">单位/部门</Label>
                  <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                    {selectedRecord.contacts?.organization?.name || selectedRecord.contacts?.department || "-"}
                  </div>
                </div>
                {selectedRecord.leave_type && (
                  <div>
                    <Label className="text-sm text-muted-foreground">请假类型</Label>
                    <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                      {leaveTypeLabels[selectedRecord.leave_type] || selectedRecord.leave_type}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <Label className="text-sm text-muted-foreground">事由</Label>
                  <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                    {selectedRecord.reason}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">开始时间</Label>
                  <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                    {format(new Date(selectedRecord.start_time), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">结束时间</Label>
                  <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                    {selectedRecord.end_time 
                      ? format(new Date(selectedRecord.end_time), "yyyy-MM-dd HH:mm", { locale: zhCN })
                      : "-"}
                  </div>
                </div>
                {selectedRecord.notes && (
                  <div className="col-span-2">
                    <Label className="text-sm text-muted-foreground">备注</Label>
                    <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                      {selectedRecord.notes}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-muted-foreground">申请时间</Label>
                  <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                    {format(new Date(selectedRecord.created_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                  </div>
                </div>
                {selectedRecord.approved_at && (
                  <div>
                    <Label className="text-sm text-muted-foreground">审批时间</Label>
                    <div className="mt-1 px-3 py-2 bg-muted/50 rounded-md">
                      {format(new Date(selectedRecord.approved_at), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                    </div>
                  </div>
                )}
              </div>
              
              {/* 审批流程 */}
              <Separator />
              <ApprovalTimeline 
                businessId={selectedRecord.id} 
                businessType="leave" 
              />
              
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                  关闭
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LeaveManagement;
