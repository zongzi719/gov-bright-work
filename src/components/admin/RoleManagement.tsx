import { useEffect, useState } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
import { isOfflineMode } from "@/lib/offlineApi";
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

  const getApiBaseUrl = (): string => {
    if (typeof window !== "undefined" && (window as any).GOV_CONFIG?.API_BASE_URL) {
      return (window as any).GOV_CONFIG.API_BASE_URL;
    }
    return "http://localhost:3001";
  };

  const offlineRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    return result as T;
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      if (isOfflineMode()) {
        const data = await offlineRequest<Role[]>("/api/roles");
        setRoles(data || []);
        return;
      }

      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        toast.error("获取角色列表失败");
        return;
      }
      setRoles(data || []);
    } catch {
      toast.error("获取角色列表失败");
    } finally {
      setLoading(false);
    }
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
      void logAudit({ action: AUDIT_ACTIONS.VIEW, module: AUDIT_MODULES.ROLE, target_type: '角色', target_id: role.id, target_name: role.label });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  // 自动生成角色标识
  const generateRoleName = (label: string): string => {
    // 生成时间戳后缀确保唯一性
    const timestamp = Date.now().toString(36);
    // 如果是纯中文，使用 role_ 前缀
    const base = label.replace(/[^a-zA-Z0-9]/g, '') || 'role';
    return `${base.toLowerCase()}_${timestamp}`;
  };

  const handleSubmit = async () => {
    if (!formData.label.trim()) {
      toast.error("请填写角色名称");
      return;
    }

    try {
      if (editingRole) {
        // 系统角色只能修改名称和描述，自定义角色也不允许修改标识
        const updateData = {
          label: formData.label,
          description: formData.description || null,
        };

        if (isOfflineMode()) {
          await offlineRequest(`/api/roles/${editingRole.id}`, {
            method: "PUT",
            body: JSON.stringify(updateData),
          });
        } else {
          const { error } = await supabase
            .from("roles")
            .update(updateData)
            .eq("id", editingRole.id);

          if (error) {
            throw error;
          }
        }

        toast.success("角色已更新");
        await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.ROLE, target_type: '角色', target_id: editingRole.id, target_name: formData.label });
      } else {
        const maxSortOrder = Math.max(...roles.map(r => r.sort_order), 0);
        const roleName = generateRoleName(formData.label);

        if (isOfflineMode()) {
          const created = await offlineRequest<{ id: string; name: string }>("/api/roles", {
            method: "POST",
            body: JSON.stringify({
              name: roleName,
              label: formData.label,
              description: formData.description || null,
              is_system: false,
              sort_order: maxSortOrder + 1,
            }),
          });

          if (created?.name) {
            await initializeRolePermissions(created.name);
          }
        } else {
          const { data: newRole, error } = await supabase
            .from("roles")
            .insert({
              name: roleName,
              label: formData.label,
              description: formData.description || null,
              is_system: false,
              sort_order: maxSortOrder + 1,
            })
            .select()
            .single();

          if (error) {
            if (error.code === "23505") {
              toast.error("角色标识已存在，请重试");
              return;
            }
            throw error;
          }

          // 自动初始化权限配置记录
          if (newRole) {
            await initializeRolePermissions(roleName);
          }
        }

        toast.success("角色已创建");
        await logAudit({ action: AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.ROLE, target_type: '角色', target_name: formData.label });
      }

      handleCloseDialog();
      fetchRoles();
    } catch (error: any) {
      if (editingRole) {
        toast.error(error?.message ? `更新角色失败：${error.message}` : "更新角色失败");
      } else {
        if (error?.message?.includes('Duplicate') || error?.message?.includes('已存在')) {
          toast.error("角色标识已存在，请重试");
        } else {
          toast.error(error?.message ? `创建角色失败：${error.message}` : "创建角色失败");
        }
      }
    }
  };

  // 初始化角色权限配置
  const initializeRolePermissions = async (roleName: string) => {
    // 定义默认模块列表
    const defaultModules = [
      { name: 'notices', label: '通知公告' },
      { name: 'contacts', label: '通讯录' },
      { name: 'absence', label: '考勤管理' },
      { name: 'supplies', label: '办公用品' },
      { name: 'menus', label: '食堂菜单' },
      { name: 'banners', label: '轮播图' },
    ];

    const permissionRecords = defaultModules.map(module => ({
      role: roleName,
      module_name: module.name,
      module_label: module.label,
      can_create: false,
      can_read: true,
      can_update: false,
      can_delete: false,
      data_scope: 'self' as const,
    }));

    try {
      if (isOfflineMode()) {
        await offlineRequest<{ success: boolean }>("/api/role-permissions/batch", {
          method: "POST",
          body: JSON.stringify(permissionRecords),
        });
        return;
      }

      const { error } = await supabase
        .from("role_permissions")
        .insert(permissionRecords);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("初始化权限配置失败:", error);
      // 不阻止角色创建，只记录错误
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.is_system) {
      toast.error("系统角色不能删除");
      return;
    }

    if (!confirm(`确定要删除角色"${role.label}"吗？`)) return;

    try {
      if (isOfflineMode()) {
        await offlineRequest<{ success: boolean }>(`/api/roles/${role.id}`, {
          method: "DELETE",
        });
      } else {
        const { error } = await supabase
          .from("roles")
          .delete()
          .eq("id", role.id);

        if (error) {
          throw error;
        }
      }

      toast.success("角色已删除");
      await logAudit({ action: AUDIT_ACTIONS.DELETE, module: AUDIT_MODULES.ROLE, target_type: '角色', target_id: role.id, target_name: role.label });
      fetchRoles();
    } catch (error: any) {
      toast.error(error?.message ? `删除角色失败：${error.message}` : "删除角色失败");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            角色列表
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            💡 系统角色仅可修改名称和描述
          </span>
        </div>
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
                <Label htmlFor="label">角色名称 *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="如: 部门经理"
                />
                {!editingRole && (
                  <p className="text-xs text-muted-foreground">角色标识将根据名称自动生成</p>
                )}
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
        <RoleTable roles={roles} onEdit={handleOpenDialog} onDelete={handleDelete} />
      </CardContent>
    </Card>
  );
};

// 抽取表格组件以支持分页
const RoleTable = ({
  roles,
  onEdit,
  onDelete,
}: {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}) => {
  const pagination = usePagination(roles);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">角色标识</TableHead>
            <TableHead className="w-[150px]">角色名称</TableHead>
            <TableHead>角色描述</TableHead>
            <TableHead className="w-[120px] whitespace-nowrap">角色分类</TableHead>
            <TableHead className="w-[120px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                暂无角色数据
              </TableCell>
            </TableRow>
          ) : (
            pagination.paginatedData.map((role) => (
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
                      onClick={() => onEdit(role)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(role)}
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

export default RoleManagement;
