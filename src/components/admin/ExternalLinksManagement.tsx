import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink, Upload } from "lucide-react";
import * as dataAdapter from "@/lib/dataAdapter";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { isOfflineMode } from "@/lib/offlineApi";

interface ExternalLinkItem {
  id: string;
  title: string;
  url: string;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}

// 解析图标URL - 离线模式下拼接API基地址
const resolveIconUrl = (iconUrl: string): string => {
  if (!iconUrl) return '';
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://') || iconUrl.startsWith('data:')) return iconUrl;
  if (isOfflineMode()) {
    const baseUrl = (window as any).GOV_CONFIG?.API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}${iconUrl}`;
  }
  return iconUrl;
};

const ExternalLinksManagement = () => {
  const [links, setLinks] = useState<ExternalLinkItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ExternalLinkItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    url: "",
    icon_url: "",
    sort_order: 0,
    is_active: true,
  });

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const baseUrl = (window as any).GOV_CONFIG?.API_BASE_URL || 'http://localhost:3001';
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${baseUrl}/api/upload/external-links`, {
        method: 'POST',
        body: formData,
      });
      const result = await resp.json();
      if (result.url) {
        setForm(f => ({ ...f, icon_url: result.url }));
        toast.success("图标上传成功");
      }
    } catch {
      toast.error("图标上传失败");
    }
    if (iconFileRef.current) iconFileRef.current.value = '';
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    const { data, error } = await dataAdapter.getExternalLinks();
    if (error) {
      toast.error("获取外部链接失败");
      return;
    }
    setLinks(data || []);
  };

  const handleAdd = () => {
    setEditingLink(null);
    setForm({ title: "", url: "", icon_url: "", sort_order: 0, is_active: true });
    setDialogOpen(true);
  };

  const handleEdit = (link: ExternalLinkItem) => {
    setEditingLink(link);
    setForm({
      title: link.title,
      url: link.url,
      icon_url: link.icon_url || "",
      sort_order: link.sort_order,
      is_active: link.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("请填写名称和链接地址");
      return;
    }

    const payload = {
      title: form.title.trim(),
      url: form.url.trim(),
      icon_url: form.icon_url.trim() || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    if (editingLink) {
      const { error } = await dataAdapter.updateExternalLink(editingLink.id, payload);
      if (error) { toast.error("更新失败"); return; }
      toast.success("更新成功");
      await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.SYSTEM, target_type: '外部链接', target_id: editingLink.id, target_name: form.title });
    } else {
      const { error } = await dataAdapter.createExternalLink(payload);
      if (error) { toast.error("添加失败"); return; }
      toast.success("添加成功");
      await logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.SYSTEM, target_type: '外部链接', target_name: form.title });
    }

    setDialogOpen(false);
    fetchLinks();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await dataAdapter.deleteExternalLink(deleteId);
    if (error) { toast.error("删除失败"); return; }
    toast.success("删除成功");
    const link = links.find(l => l.id === deleteId);
    await logAudit({ action: AUDIT_ACTIONS.DELETE, module: AUDIT_MODULES.SYSTEM, target_type: '外部链接', target_id: deleteId, target_name: link?.title });
    setDeleteId(null);
    fetchLinks();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-base flex items-center gap-2">
          <ExternalLink className="w-5 h-5" />
          外部链接管理
        </CardTitle>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" /> 添加链接
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 whitespace-nowrap">排序</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>链接地址</TableHead>
              <TableHead className="whitespace-nowrap">图标</TableHead>
              <TableHead className="w-20">状态</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  暂无外部链接，点击"添加链接"创建
                </TableCell>
              </TableRow>
            ) : (
              links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>{link.sort_order}</TableCell>
                  <TableCell className="font-medium">{link.title}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{link.url}</TableCell>
                  <TableCell>
                    {link.icon_url ? (
                      <img src={resolveIconUrl(link.icon_url)} alt="" className="w-8 h-8 object-contain rounded" />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={link.is_active ? "default" : "secondary"}>
                      {link.is_active ? "启用" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(link)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(link.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* 编辑/新增弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "编辑链接" : "添加链接"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="如：人民网资料库" />
            </div>
            <div className="space-y-2">
              <Label>链接地址 *</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://www.example.com" />
            </div>
            <div className="space-y-2">
              <Label>图标（可选）</Label>
              <div className="flex gap-2 items-center">
                <Input value={form.icon_url} onChange={e => setForm(f => ({ ...f, icon_url: e.target.value }))} placeholder="图标URL或上传图片，留空使用默认" className="flex-1" />
                <input ref={iconFileRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                <Button type="button" variant="outline" size="icon" onClick={() => iconFileRef.current?.click()} title="上传图标">
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              {form.icon_url && (
                <div className="flex items-center gap-2 mt-1">
                  <img src={resolveIconUrl(form.icon_url)} alt="预览" className="w-8 h-8 object-contain rounded border" />
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{form.icon_url}</span>
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>排序（数字越小越靠前）</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2 flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>{form.is_active ? "启用" : "禁用"}</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button onClick={handleSave}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除该外部链接吗？此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ExternalLinksManagement;
