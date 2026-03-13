import { useEffect, useState } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { usePagination } from "@/hooks/use-pagination";
import * as dataAdapter from "@/lib/dataAdapter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import TablePagination from "./TablePagination";
import RichTextEditor from "@/components/ui/rich-text-editor";

type SecurityLevel = '机密' | '秘密' | '内部' | '公开';
type PublishScope = 'all' | 'organization';

interface Notice {
  id: string;
  title: string;
  department: string;
  content: string | null;
  is_pinned: boolean;
  is_published: boolean;
  security_level: SecurityLevel;
  publish_scope: PublishScope;
  publish_scope_ids: string[];
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
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
    security_level: "公开" as SecurityLevel,
    publish_scope: "all" as PublishScope,
    publish_scope_ids: [] as string[],
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
    const { data, error } = await dataAdapter.getAllNotices(
      filterDepartment && filterDepartment !== "all" ? { department: filterDepartment } : undefined
    );

    if (error) {
      toast.error("获取通知公告失败");
      return;
    }

    setNotices((data || []) as Notice[]);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await dataAdapter.getAllOrganizations();

    if (error) {
      toast.error("获取单位列表失败");
      return;
    }

    setOrganizations(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingNotice) {
      const { error } = await dataAdapter.updateNotice(editingNotice.id, formData);

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
      await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.NOTICE, target_type: '通知', target_id: editingNotice.id, target_name: formData.title });
    } else {
      const { error } = await dataAdapter.createNotice(formData);

      if (error) {
        toast.error("添加失败");
        return;
      }
      toast.success("添加成功");
      await logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.NOTICE, target_type: '通知', target_name: formData.title });
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
      security_level: ((notice.security_level as string) === '一般' ? '公开' : notice.security_level || '公开') as SecurityLevel,
      publish_scope: notice.publish_scope || 'all',
      publish_scope_ids: notice.publish_scope_ids || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条通知吗？")) return;

    const { error } = await dataAdapter.deleteNotice(id);

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
      security_level: "公开",
      publish_scope: "all",
      publish_scope_ids: [],
    });
  };

  const handleScopeOrgToggle = (orgId: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        publish_scope_ids: [...formData.publish_scope_ids, orgId]
      });
    } else {
      setFormData({
        ...formData,
        publish_scope_ids: formData.publish_scope_ids.filter(id => id !== orgId)
      });
    }
  };

  // 构建树形组织结构
  const buildOrgTree = (orgs: Organization[], parentId: string | null = null, level: number = 0): Array<Organization & { indent: number }> => {
    const result: Array<Organization & { indent: number }> = [];
    const children = orgs.filter(org => org.parent_id === parentId);
    children.forEach(child => {
      result.push({ ...child, indent: level });
      result.push(...buildOrgTree(orgs, child.id, level + 1));
    });
    return result;
  };

  const orgTree = buildOrgTree(organizations);

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
          <DialogContent className="max-w-3xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto]" aria-describedby={undefined}>
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingNotice ? "编辑通知" : "添加通知"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 pr-2">
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
                <Label htmlFor="content">内容（可选，支持图文混排）</Label>
                <div className="max-h-[280px] overflow-hidden">
                  <RichTextEditor
                    value={formData.content}
                    onChange={(value) => setFormData({ ...formData, content: value })}
                    placeholder="请输入通知内容，支持插入图片..."
                    minHeight="180px"
                  />
                </div>
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
                    <SelectItem value="内部">内部</SelectItem>
                    <SelectItem value="公开">公开</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>发布范围</Label>
                <Select
                  value={formData.publish_scope}
                  onValueChange={(value: PublishScope) => setFormData({ 
                    ...formData, 
                    publish_scope: value,
                    publish_scope_ids: value === 'all' ? [] : formData.publish_scope_ids
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择发布范围" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部单位</SelectItem>
                    <SelectItem value="organization">指定单位</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.publish_scope === 'organization' && (
                <div className="space-y-2">
                  <Label>选择可见单位</Label>
                  <ScrollArea className="h-40 border rounded-md p-2">
                    <div className="space-y-1">
                      {orgTree.map((org) => (
                        <div 
                          key={org.id} 
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${org.indent * 16}px` }}
                        >
                          {org.indent > 0 && <span className="text-muted-foreground text-sm">└</span>}
                          <Checkbox
                            id={`org-${org.id}`}
                            checked={formData.publish_scope_ids.includes(org.id)}
                            onCheckedChange={(checked) => handleScopeOrgToggle(org.id, !!checked)}
                          />
                          <label 
                            htmlFor={`org-${org.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {org.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    已选择 {formData.publish_scope_ids.length} 个单位
                  </p>
                </div>
              )}

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
            <TableHead className="w-20">发布范围</TableHead>
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
                  notice.security_level === '内部' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {notice.security_level || '公开'}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  notice.publish_scope === 'organization' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {notice.publish_scope === 'organization' ? `${notice.publish_scope_ids?.length || 0}个单位` : '全部'}
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
