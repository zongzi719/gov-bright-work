import { useEffect, useState } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Save, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type DataScope = Database["public"]["Enums"]["data_scope"];

interface RolePermission {
  id: string;
  role: string;
  module_name: string;
  module_label: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  data_scope: DataScope;
}

interface Role {
  id: string;
  name: string;
  label: string;
  is_system: boolean;
}

const scopeLabels: Record<DataScope, string> = {
  self: '仅本人',
  department: '本部门',
  organization: '本单位',
  all: '全部',
};

const PermissionManagement = () => {
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [modifiedPermissions, setModifiedPermissions] = useState<Record<string, Partial<RolePermission>>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPermissions(), fetchRoles()]);
    setLoading(false);
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from("roles")
      .select("id, name, label, is_system")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      toast.error("获取角色列表失败");
      return;
    }
    setRoles(data || []);
  };

  const fetchPermissions = async () => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("*")
      .order("module_name");

    if (error) {
      toast.error("获取权限配置失败");
      return;
    }
    setPermissions(data || []);
    setModifiedPermissions({});
  };

  const getRoleLabel = (roleName: string): string => {
    const role = roles.find(r => r.name === roleName);
    return role?.label || roleName;
  };

  const handlePermissionChange = (
    permissionId: string,
    field: keyof RolePermission,
    value: boolean | DataScope
  ) => {
    setModifiedPermissions((prev) => ({
      ...prev,
      [permissionId]: {
        ...prev[permissionId],
        [field]: value,
      },
    }));
  };

  const getPermissionValue = (permission: RolePermission, field: keyof RolePermission) => {
    if (modifiedPermissions[permission.id]?.[field] !== undefined) {
      return modifiedPermissions[permission.id][field];
    }
    return permission[field];
  };

  const handleSave = async () => {
    const updates = Object.entries(modifiedPermissions);
    if (updates.length === 0) {
      toast.info("没有需要保存的修改");
      return;
    }

    setSaving(true);

    try {
      for (const [id, changes] of updates) {
        const { error } = await supabase
          .from("role_permissions")
          .update(changes)
          .eq("id", id);

        if (error) {
          toast.error(`保存权限失败: ${error.message}`);
          setSaving(false);
          return;
        }
      }

      toast.success("权限配置已保存");
      await logAudit({ action: AUDIT_ACTIONS.UPDATE, module: AUDIT_MODULES.PERMISSION, target_type: '权限配置', target_name: selectedRole });
      await fetchPermissions();
    } catch (error) {
      toast.error("保存失败");
    }

    setSaving(false);
  };

  const getFilteredPermissions = () => {
    return permissions.filter((p) => p.role === selectedRole);
  };

  const hasModifications = Object.keys(modifiedPermissions).length > 0;

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          权限配置
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="选择角色" />
            </SelectTrigger>
            <SelectContent>
              {roles.map(role => (
                <SelectItem key={role.name} value={role.name}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasModifications}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            保存修改
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Badge variant={selectedRole === 'admin' ? 'default' : 'secondary'} className="text-sm">
            当前配置：{getRoleLabel(selectedRole)}
          </Badge>
          {hasModifications && (
            <Badge variant="outline" className="ml-2 text-sm text-orange-600">
              有未保存的修改
            </Badge>
          )}
        </div>

        <PermissionTable
          permissions={getFilteredPermissions()}
          getPermissionValue={getPermissionValue}
          handlePermissionChange={handlePermissionChange}
        />

      </CardContent>
    </Card>
  );
};

// 抽取表格组件以支持分页
const PermissionTable = ({
  permissions,
  getPermissionValue,
  handlePermissionChange,
}: {
  permissions: RolePermission[];
  getPermissionValue: (permission: RolePermission, field: keyof RolePermission) => string | boolean;
  handlePermissionChange: (permissionId: string, field: keyof RolePermission, value: boolean | DataScope) => void;
}) => {
  const pagination = usePagination(permissions);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">模块</TableHead>
            <TableHead className="w-[80px] text-center">新增</TableHead>
            <TableHead className="w-[80px] text-center">查看</TableHead>
            <TableHead className="w-[80px] text-center">编辑</TableHead>
            <TableHead className="w-[80px] text-center">删除</TableHead>
            <TableHead className="w-[150px]">数据范围</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.map((permission) => (
            <TableRow key={permission.id}>
              <TableCell className="font-medium">
                {permission.module_label}
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={getPermissionValue(permission, 'can_create') as boolean}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(permission.id, 'can_create', checked)
                  }
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={getPermissionValue(permission, 'can_read') as boolean}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(permission.id, 'can_read', checked)
                  }
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={getPermissionValue(permission, 'can_update') as boolean}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(permission.id, 'can_update', checked)
                  }
                />
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={getPermissionValue(permission, 'can_delete') as boolean}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(permission.id, 'can_delete', checked)
                  }
                />
              </TableCell>
              <TableCell>
                <Select
                  value={getPermissionValue(permission, 'data_scope') as DataScope}
                  onValueChange={(value) =>
                    handlePermissionChange(permission.id, 'data_scope', value as DataScope)
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">仅本人</SelectItem>
                    <SelectItem value="department">本部门</SelectItem>
                    <SelectItem value="organization">本单位</SelectItem>
                    <SelectItem value="all">全部</SelectItem>
                  </SelectContent>
                </Select>
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

export default PermissionManagement;
