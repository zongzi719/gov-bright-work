import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Notice {
  id: string;
  title: string;
  department: string;
  content: string | null;
  is_pinned: boolean;
  is_published: boolean;
  created_at: string;
}

const NoticeManagement = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    content: "",
    is_pinned: false,
    is_published: true,
  });

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const { data, error } = await supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取通知公告失败");
      return;
    }

    setNotices(data || []);
    setLoading(false);
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
    });
  };

  return (
    <div className="gov-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="gov-card-title">通知公告管理</h2>
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
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="请输入发布单位"
                  required
                />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead className="w-24">发布单位</TableHead>
                <TableHead className="w-24">发布日期</TableHead>
                <TableHead className="w-16">置顶</TableHead>
                <TableHead className="w-16">状态</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((notice) => (
                <TableRow key={notice.id}>
                  <TableCell className="font-medium">{notice.title}</TableCell>
                  <TableCell>{notice.department}</TableCell>
                  <TableCell>{new Date(notice.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {notice.is_pinned && (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">置顶</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded ${notice.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {notice.is_published ? "已发布" : "草稿"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(notice)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(notice.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default NoticeManagement;
