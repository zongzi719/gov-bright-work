import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Plus,
  Check,
  X,
  CalendarIcon,
  Search,
  Clock,
  UserCheck,
} from "lucide-react";

type AbsenceType = "out" | "leave" | "business_trip";
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
  type: AbsenceType;
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

const typeLabels: Record<AbsenceType, string> = {
  out: "外出",
  business_trip: "出差",
  leave: "请假",
};

const typeColors: Record<AbsenceType, string> = {
  out: "bg-blue-100 text-blue-800",
  business_trip: "bg-purple-100 text-purple-800",
  leave: "bg-orange-100 text-orange-800",
};

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

interface AbsenceFormData {
  contact_id: string;
  type: AbsenceType;
  reason: string;
  start_time: Date | undefined;
  end_time: Date | undefined;
  notes: string;
}

const defaultFormData: AbsenceFormData = {
  contact_id: "",
  type: "out",
  reason: "",
  start_time: undefined,
  end_time: undefined,
  notes: "",
};

const AbsenceManagement = () => {
  const [records, setRecords] = useState<AbsenceRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AbsenceFormData>(defaultFormData);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AbsenceStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AbsenceType | "all">("all");

  useEffect(() => {
    fetchRecords();
    fetchContacts();
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
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取记录失败");
      console.error(error);
    } else {
      setRecords((data as unknown as AbsenceRecord[]) || []);
    }
    setLoading(false);
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select(`
        id,
        name,
        department,
        position,
        organization:organizations (name)
      `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error(error);
    } else {
      setContacts((data as unknown as Contact[]) || []);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contact_id || !formData.reason || !formData.start_time) {
      toast.error("请填写必填项");
      return;
    }

    const { error } = await supabase.from("absence_records").insert({
      contact_id: formData.contact_id,
      type: formData.type,
      reason: formData.reason,
      start_time: formData.start_time.toISOString(),
      end_time: formData.end_time?.toISOString() || null,
      notes: formData.notes || null,
      status: "pending",
    });

    if (error) {
      toast.error("添加记录失败");
      console.error(error);
    } else {
      toast.success("添加成功");
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      fetchRecords();
      updateContactStatus(formData.contact_id, formData.type);
    }
  };

  const updateContactStatus = async (contactId: string, type: AbsenceType) => {
    await supabase
      .from("contacts")
      .update({ status: type as "out" | "leave" | "business_trip" })
      .eq("id", contactId);
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
      // 恢复联系人状态为在职
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
      // 恢复联系人状态为在职
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
      // 恢复联系人状态为在职
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
    const matchesType = typeFilter === "all" || record.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">外出管理</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              新增记录
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新增外出/请假记录</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>人员 *</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, contact_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择人员" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                        {contact.organization?.name && ` - ${contact.organization.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>类型 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: AbsenceType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="out">外出</SelectItem>
                    <SelectItem value="business_trip">出差</SelectItem>
                    <SelectItem value="leave">请假</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>事由 *</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="请输入事由"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>开始时间 *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.start_time && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_time
                          ? format(formData.start_time, "yyyy-MM-dd", { locale: zhCN })
                          : "选择日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.start_time}
                        onSelect={(date) =>
                          setFormData({ ...formData, start_time: date })
                        }
                        locale={zhCN}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>结束时间</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.end_time && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.end_time
                          ? format(formData.end_time, "yyyy-MM-dd", { locale: zhCN })
                          : "选择日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.end_time}
                        onSelect={(date) =>
                          setFormData({ ...formData, end_time: date })
                        }
                        locale={zhCN}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="可选备注"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setFormData(defaultFormData);
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleSubmit}>提交</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            value={typeFilter}
            onValueChange={(value: AbsenceType | "all") => setTypeFilter(value)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="out">外出</SelectItem>
              <SelectItem value="business_trip">出差</SelectItem>
              <SelectItem value="leave">请假</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value: AbsenceStatus | "all") => setStatusFilter(value)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="状态" />
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

        {/* 记录列表 */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无记录</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>人员</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>事由</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.contacts?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {record.contacts?.organization?.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeColors[record.type]} variant="secondary">
                        {typeLabels[record.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={record.reason}>
                        {record.reason}
                      </div>
                      {record.notes && (
                        <div className="text-xs text-muted-foreground truncate">
                          备注: {record.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(record.start_time), "MM-dd HH:mm")}
                        </div>
                        {record.end_time && (
                          <div className="text-muted-foreground">
                            至 {format(new Date(record.end_time), "MM-dd HH:mm")}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[record.status]} variant="secondary">
                        {statusLabels[record.status]}
                      </Badge>
                      {record.cancel_reason && (
                        <div className="text-xs text-muted-foreground mt-1">
                          取消原因: {record.cancel_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {record.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApprove(record.id)}
                              title="批准"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReject(record.id)}
                              title="拒绝"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {record.status === "approved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleComplete(record.id)}
                            title="销假"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        {(record.status === "pending" || record.status === "approved") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-gray-600 hover:text-gray-700"
                            onClick={() => openCancelDialog(record.id)}
                            title="取消"
                          >
                            取消
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* 取消对话框 */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>取消记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>取消原因</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="请输入取消原因（可选）"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                返回
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                确认取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AbsenceManagement;
