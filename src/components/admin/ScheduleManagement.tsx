import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import TablePagination from "./TablePagination";
import { usePagination } from "@/hooks/use-pagination";

interface Contact {
  id: string;
  name: string;
  department: string | null;
  organization?: { name: string } | null;
}

interface Schedule {
  id: string;
  contact_id: string;
  title: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  contact?: Contact;
}

const ScheduleManagement = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [contactFilter, setContactFilter] = useState("all");

  const [formData, setFormData] = useState({
    contact_id: "",
    title: "",
    schedule_date: "",
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    notes: "",
  });

  // 过滤后的数据
  const filteredSchedules = schedules.filter((schedule) => {
    const matchesSearch =
      schedule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContact = contactFilter === "all" || schedule.contact_id === contactFilter;
    return matchesSearch && matchesContact;
  });

  // 分页
  const pagination = usePagination(filteredSchedules);
  const {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    paginatedData: paginatedSchedules,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    canGoNext,
    canGoPrevious,
    goToNextPage,
    goToPreviousPage,
  } = pagination;

  useEffect(() => {
    fetchSchedules();
    fetchContacts();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("schedules")
      .select("*, contact:contacts(id, name, department, organization:organizations(name))")
      .order("schedule_date", { ascending: false })
      .order("start_time");

    if (error) {
      toast.error("获取日程列表失败");
      console.error(error);
    } else {
      setSchedules(data as Schedule[]);
    }
    setLoading(false);
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, department, organization:organizations(name)")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setContacts(data);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contact_id || !formData.title || !formData.schedule_date) {
      toast.error("请填写必填项");
      return;
    }

    const payload = {
      contact_id: formData.contact_id,
      title: formData.title,
      schedule_date: formData.schedule_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      location: formData.location || null,
      notes: formData.notes || null,
    };

    if (editingSchedule) {
      const { error } = await supabase
        .from("schedules")
        .update(payload)
        .eq("id", editingSchedule.id);

      if (error) {
        toast.error("更新日程失败");
        console.error(error);
      } else {
        toast.success("日程已更新");
        fetchSchedules();
        closeDialog();
      }
    } else {
      const { error } = await supabase.from("schedules").insert(payload);

      if (error) {
        toast.error("添加日程失败");
        console.error(error);
      } else {
        toast.success("日程已添加");
        fetchSchedules();
        closeDialog();
      }
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      contact_id: schedule.contact_id,
      title: schedule.title,
      schedule_date: schedule.schedule_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      location: schedule.location || "",
      notes: schedule.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条日程吗？")) return;

    const { error } = await supabase.from("schedules").delete().eq("id", id);

    if (error) {
      toast.error("删除失败");
      console.error(error);
    } else {
      toast.success("日程已删除");
      fetchSchedules();
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSchedule(null);
    setFormData({
      contact_id: "",
      title: "",
      schedule_date: "",
      start_time: "09:00",
      end_time: "10:00",
      location: "",
      notes: "",
    });
  };

  // 获取唯一的人员列表用于筛选
  const uniqueContacts = Array.from(
    new Map(schedules.map((s) => [s.contact_id, s.contact])).values()
  ).filter(Boolean) as Contact[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">日程管理</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新增日程
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSchedule ? "编辑日程" : "新增日程"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>人员 *</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(v) => setFormData({ ...formData, contact_id: v })}
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
                <Label>日程标题 *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="输入日程标题"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>日期 *</Label>
                  <Input
                    type="date"
                    value={formData.schedule_date}
                    onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>地点</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="输入地点"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>开始时间</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束时间</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="输入备注"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={closeDialog}>
                  取消
                </Button>
                <Button onClick={handleSubmit}>{editingSchedule ? "保存" : "添加"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索标题、人员或地点..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={contactFilter} onValueChange={setContactFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="筛选人员" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部人员</SelectItem>
            {uniqueContacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 日程列表 */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : paginatedSchedules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || contactFilter !== "all" ? "没有符合条件的日程" : "暂无日程"}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>人员</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>地点</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSchedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <div className="font-medium">{schedule.contact?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {schedule.contact?.organization?.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{schedule.title}</div>
                    {schedule.notes && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {schedule.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(schedule.schedule_date), "yyyy-MM-dd", { locale: zhCN })}
                  </TableCell>
                  <TableCell>
                    {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>{schedule.location || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(schedule)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(schedule.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            goToNextPage={goToNextPage}
            goToPreviousPage={goToPreviousPage}
          />
        </>
      )}
    </div>
  );
};

export default ScheduleManagement;
