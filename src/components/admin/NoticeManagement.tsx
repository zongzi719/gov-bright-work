import { useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import TablePagination from "./TablePagination";

type SecurityLevel = '机密' | '秘密' | '一般';

interface Notice {
  id: string;
  title: string;
  department: string;
  content: string | null;
  is_pinned: boolean;
  is_published: boolean;
  security_level: SecurityLevel;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

const NoticeManagement = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    content: "",
    is_pinned: false,
    is_published: true,
    security_level: "一般" as SecurityLevel,
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [filterDepartment]);

  const fetchData = async () => {
    await Promise.all([fetchNotices(), fetchOrganizations()]);
    setLoading(false);
  };

  const fetchNotices = async () => {
    let query = supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterDepartment && filterDepartment !== "all") {
      query = query.eq("department", filterDepartment);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("获取通知公告失败");
      return;
    }

    setNotices((data || []) as Notice[]);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("获取单位列表失败");
      return;
    }

    setOrganizations(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingNotice) {
      const { error } = await supabase
        .from("notices")
        .update(formData)
        .eq("id", editingNotice.id);

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
    } else {
      const { error } = await supabase.from("notices").insert(formData);

      if (error) {
        toast.error("添加失败");
        return;
      }
      toast.success("添加成功");
    }

    setDialogOpen(false);
    resetForm();
    fetchNotices();
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      department: notice.department,
      content: notice.content || "",
      is_pinned: notice.is_pinned,
      is_published: notice.is_published,
      security_level: notice.security_level || "一般",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条通知吗？")) return;

    const { error } = await supabase.from("notices").delete().eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("删除成功");
    fetchNotices();
  };

  const resetForm = () => {
    setEditingNotice(null);
    setFormData({
      title: "",
      department: "",
      content: "",
      is_pinned: false,
      is_published: true,
      security_level: "一般",
    });
  };

  return (
    <div className="gov-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="gov-card-title">通知公告管理</h2>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="筛选发布单位" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部单位</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.name}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              添加通知
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingNotice ? "编辑通知" : "添加通知"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="请输入通知标题"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">发布单位</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择发布单位" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.name}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">内容（可选）</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="请输入通知内容"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="security_level">密级</Label>
                <Select
                  value={formData.security_level}
                  onValueChange={(value: SecurityLevel) => setFormData({ ...formData, security_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择密级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="机密">机密</SelectItem>
                    <SelectItem value="秘密">秘密</SelectItem>
                    <SelectItem value="一般">一般</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_pinned"
                    checked={formData.is_pinned}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
                  />
                  <Label htmlFor="is_pinned">置顶</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_published"
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label htmlFor="is_published">发布</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit">保存</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : notices.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无通知公告</div>
        ) : (
          <NoticeTable notices={notices} onEdit={handleEdit} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
};

// 抽取表格组件以支持分页
const NoticeTable = ({ 
  notices, 
  onEdit, 
  onDelete 
}: { 
  notices: Notice[]; 
  onEdit: (notice: Notice) => void; 
  onDelete: (id: string) => void; 
}) => {
  const pagination = usePagination(notices);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead className="w-28">发布单位</TableHead>
            <TableHead className="w-24">发布日期</TableHead>
            <TableHead className="w-16">密级</TableHead>
            <TableHead className="w-14">置顶</TableHead>
            <TableHead className="w-16">状态</TableHead>
            <TableHead className="w-20">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.map((notice) => (
            <TableRow key={notice.id}>
              <TableCell className="font-medium">{notice.title}</TableCell>
              <TableCell>{notice.department}</TableCell>
              <TableCell>{new Date(notice.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="whitespace-nowrap">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  notice.security_level === '机密' ? 'bg-red-100 text-red-700' : 
                  notice.security_level === '秘密' ? 'bg-orange-100 text-orange-700' : 
                  'bg-gray-100 text-gray-500'
                }`}>
                  {notice.security_level || '一般'}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {notice.is_pinned && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">置顶</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <span className={`text-xs px-1.5 py-0.5 rounded ${notice.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {notice.is_published ? "已发布" : "草稿"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(notice)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(notice.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
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
  );
};

export default NoticeManagement;
