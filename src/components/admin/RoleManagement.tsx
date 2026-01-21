import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Shield, Pencil, Trash2 } from "lucide-react";

interface Role {
  id: string;
  name: string;
  label: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface RoleFormData {
  name: string;
  label: string;
  description: string;
}

const RoleManagement = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: "",
    label: "",
    description: "",
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("获取角色列表失败");
      setLoading(false);
      return;
    }
    setRoles(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      label: "",
      description: "",
    });
    setEditingRole(null);
  };

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        label: role.label,
        description: role.description || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.label.trim()) {
      toast.error("请填写角色标识和角色名称");
      return;
    }

    // 验证角色标识格式（只允许字母、数字、下划线）
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.name)) {
      toast.error("角色标识只能包含字母、数字和下划线，且必须以字母或下划线开头");
      return;
    }

    if (editingRole) {
      // 系统角色只能修改名称和描述
      const updateData = editingRole.is_system
        ? { label: formData.label, description: formData.description || null }
        : { name: formData.name, label: formData.label, description: formData.description || null };

      const { error } = await supabase
        .from("roles")
        .update(updateData)
        .eq("id", editingRole.id);

      if (error) {
        toast.error("更新角色失败");
        return;
      }
      toast.success("角色已更新");
    } else {
      const maxSortOrder = Math.max(...roles.map(r => r.sort_order), 0);
      const { error } = await supabase
        .from("roles")
        .insert({
          name: formData.name,
          label: formData.label,
          description: formData.description || null,
          is_system: false,
          sort_order: maxSortOrder + 1,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("角色标识已存在");
        } else {
          toast.error("创建角色失败");
        }
        return;
      }
      toast.success("角色已创建");
    }

    handleCloseDialog();
    fetchRoles();
  };

  const handleDelete = async (role: Role) => {
    if (role.is_system) {
      toast.error("系统角色不能删除");
      return;
    }

    if (!confirm(`确定要删除角色"${role.label}"吗？`)) return;

    const { error } = await supabase
      .from("roles")
      .delete()
      .eq("id", role.id);

    if (error) {
      toast.error("删除角色失败");
      return;
    }
    toast.success("角色已删除");
    fetchRoles();
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          角色列表
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              新增角色
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRole ? "编辑角色" : "新增角色"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">角色标识 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如: department_manager"
                  disabled={editingRole?.is_system}
                />
                {editingRole?.is_system && (
                  <p className="text-xs text-muted-foreground">系统角色的标识不可修改</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">角色名称 *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="如: 部门经理"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">角色描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="描述该角色的权限范围和职责"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                取消
              </Button>
              <Button onClick={handleSubmit}>
                {editingRole ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">角色标识</TableHead>
              <TableHead className="w-[150px]">角色名称</TableHead>
              <TableHead>角色描述</TableHead>
              <TableHead className="w-[100px]">角色分类</TableHead>
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  暂无角色数据
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-mono text-sm">{role.name}</TableCell>
                  <TableCell className="font-medium">{role.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.is_system ? "default" : "secondary"}>
                      {role.is_system ? "系统角色" : "自定义角色"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(role)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!role.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(role)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p>💡 提示：系统角色由系统预设，只能修改名称和描述，不能删除。自定义角色支持完整的增删改操作。</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleManagement;
