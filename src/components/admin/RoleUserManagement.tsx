import { useEffect, useState, useMemo } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Users, RefreshCw, Search } from "lucide-react";
import { isOfflineMode } from "@/lib/offlineApi";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  label: string;
  is_system: boolean;
}

interface UserOption {
  id: string;       // user_id (auth.users.id) or contact_id
  name: string;
  email: string;
  source: 'profile' | 'contact';
}

const THREE_OFFICER_ROLES = ['sys_admin', 'security_admin', 'audit_admin'];

const RoleUserManagement = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getApiBaseUrl = (): string => {
    if (typeof window !== "undefined" && (window as any).GOV_CONFIG?.API_BASE_URL) {
      return (window as any).GOV_CONFIG.API_BASE_URL;
    }
    return "http://localhost:3001";
  };

  const offlineRequest = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result as T;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUserRoles(), fetchRoles(), fetchUsers()]);
    setLoading(false);
  };

  const fetchUserRoles = async () => {
    try {
      if (isOfflineMode()) {
        const data = await offlineRequest<UserRole[]>("/api/user-roles");
        setUserRoles(data || []);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { toast.error("获取角色用户列表失败"); return; }
      setUserRoles(data || []);
    } catch { toast.error("获取角色用户列表失败"); }
  };

  const fetchRoles = async () => {
    try {
      if (isOfflineMode()) {
        const data = await offlineRequest<Role[]>("/api/roles");
        setRoles((data || []).filter(r => r.is_active !== false));
        return;
      }
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, label, is_system")
        .eq("is_active", true)
        .order("sort_order");
      if (error) { toast.error("获取角色列表失败"); return; }
      setRoles(data || []);
    } catch { toast.error("获取角色列表失败"); }
  };

  const fetchUsers = async () => {
    const options: UserOption[] = [];
    const seenIds = new Set<string>();

    if (isOfflineMode()) {
      // 离线模式：只从 contacts 获取用户
      try {
        const contacts = await offlineRequest<any[]>("/api/contacts");
        if (contacts) {
          for (const c of contacts) {
            if (!seenIds.has(c.id)) {
              seenIds.add(c.id);
              options.push({
                id: c.id,
                name: c.name,
                email: c.email || c.mobile || '-',
                source: 'contact',
              });
            }
          }
        }
      } catch { /* ignore */ }
      setUserOptions(options);
      return;
    }

    // 1. Fetch profiles (Supabase Auth users)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, display_name")
      .order("created_at", { ascending: false });

    if (profiles) {
      for (const p of profiles) {
        if (!seenIds.has(p.user_id)) {
          seenIds.add(p.user_id);
          options.push({
            id: p.user_id,
            name: p.display_name || p.email?.split('@')[0] || '未知用户',
            email: p.email || '-',
            source: 'profile',
          });
        }
      }
    }

    // 2. Fetch contacts (前台用户)
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, mobile, email, position, department")
      .eq("is_active", true)
      .order("sort_order");

    if (contacts) {
      for (const c of contacts) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          options.push({
            id: c.id,
            name: c.name,
            email: c.email || c.mobile || '-',
            source: 'contact',
          });
        }
      }
    }

    setUserOptions(options);
  };

  const getRoleLabel = (roleName: string): string => {
    const role = roles.find(r => r.name === roleName);
    return role?.label || roleName;
  };

  const getUserDisplay = (userId: string) => {
    const user = userOptions.find(u => u.id === userId);
    if (user) {
      return { name: user.name, email: user.email };
    }
    return { name: userId.substring(0, 8) + "...", email: "-" };
  };

  // Filter user options for the dialog search
  const filteredUserOptions = useMemo(() => {
    if (!searchQuery.trim()) return userOptions;
    const q = searchQuery.toLowerCase();
    return userOptions.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [userOptions, searchQuery]);

  const handleAddUserRole = async () => {
    if (!selectedUserId) {
      toast.error("请选择用户");
      return;
    }

    // Check three-officer mutual exclusivity on frontend for better UX
    if (THREE_OFFICER_ROLES.includes(selectedRole)) {
      const existingOfficer = userRoles.find(
        ur => ur.user_id === selectedUserId && THREE_OFFICER_ROLES.includes(ur.role) && ur.role !== selectedRole
      );
      if (existingOfficer) {
        toast.error(`该用户已持有「${getRoleLabel(existingOfficer.role)}」角色，三员不可兼任`);
        return;
      }
    }

    // Check if user already has this exact role
    const existingExact = userRoles.find(ur => ur.user_id === selectedUserId && ur.role === selectedRole);
    if (existingExact) {
      toast.error("该用户已拥有此角色");
      return;
    }

    const selectedUser = userOptions.find(u => u.id === selectedUserId);

    if (isOfflineMode()) {
      // 离线模式：直接通过 API 添加角色
      try {
        await offlineRequest<{ success: boolean; id: string }>("/api/user-roles", {
          method: "POST",
          body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
        });
        toast.success("角色用户已添加");
        await logAudit({ action: AUDIT_ACTIONS.ROLE_ASSIGN, module: AUDIT_MODULES.ROLE, target_type: '角色用户', target_id: selectedUserId, target_name: `${selectedUser?.name || selectedUserId} → ${getRoleLabel(selectedRole)}` });
        setDialogOpen(false);
        setSelectedUserId("");
        setSelectedRole("user");
        setSearchQuery("");
        fetchData();
      } catch (err: any) {
        toast.error(err.message || "添加角色用户失败");
      }
      return;
    }

    // For contact-based users getting admin roles, auto-create Supabase Auth account
    if (selectedUser?.source === 'contact' && selectedUser.email && selectedUser.email !== '-') {
      toast.info("正在为用户创建认证账号...");
      try {
        const { data: contactData } = await supabase
          .from("contacts")
          .select("password_hash")
          .eq("id", selectedUserId)
          .single();

        const contactPassword = contactData?.password_hash || '123456';

        const { data: provisionResult, error: provisionError } = await supabase.functions.invoke(
          "create-admin",
          {
            body: {
              action: "provision",
              contact_id: selectedUserId,
              email: selectedUser.email,
              password: contactPassword,
              role: selectedRole,
            },
          }
        );

        if (provisionError) {
          console.error("Provision error:", provisionError);
          toast.error("创建认证账号失败: " + provisionError.message);
          return;
        }

        if (provisionResult?.user_id) {
          const { error } = await supabase
            .from("user_roles")
            .insert({
              user_id: provisionResult.user_id,
              role: selectedRole,
            });

          if (error) {
            if (error.message.includes('不可兼任')) {
              toast.error("三员角色不可兼任");
            } else if (error.message.includes('duplicate')) {
              toast.error("该用户已拥有此角色");
            } else {
              toast.error("添加角色失败: " + error.message);
            }
            return;
          }

          toast.success("角色用户已添加，认证账号已创建");
          await logAudit({ action: AUDIT_ACTIONS.ROLE_ASSIGN, module: AUDIT_MODULES.ROLE, target_type: '角色用户', target_id: selectedUserId, target_name: `${selectedUser?.name} → ${getRoleLabel(selectedRole)}` });
          setDialogOpen(false);
          setSelectedUserId("");
          setSelectedRole("user");
          setSearchQuery("");
          fetchData();
          return;
        }
      } catch (err) {
        console.error("Provision failed:", err);
        toast.error("创建认证账号时出错");
        return;
      }
    }

    // For profile-based users (already have auth accounts), just insert role
    const { error } = await supabase
      .from("user_roles")
      .insert({
        user_id: selectedUserId,
        role: selectedRole,
      });

    if (error) {
      if (error.message.includes('不可兼任')) {
        toast.error("三员角色不可兼任：" + error.message);
      } else {
        toast.error("添加角色用户失败: " + error.message);
      }
      return;
    }

    toast.success("角色用户已添加");
    const addedUser = userOptions.find(u => u.id === selectedUserId);
    await logAudit({ action: AUDIT_ACTIONS.ROLE_ASSIGN, module: AUDIT_MODULES.ROLE, target_type: '角色用户', target_id: selectedUserId, target_name: `${addedUser?.name || selectedUserId} → ${getRoleLabel(selectedRole)}` });
    setDialogOpen(false);
    setSelectedUserId("");
    setSelectedRole("user");
    setSearchQuery("");
    fetchUserRoles();
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("确定要删除该用户的角色吗？")) return;

    try {
      if (isOfflineMode()) {
        await offlineRequest<{ success: boolean }>(`/api/user-roles/${id}`, { method: "DELETE" });
        toast.success("角色已删除");
        await logAudit({ action: AUDIT_ACTIONS.ROLE_REMOVE, module: AUDIT_MODULES.ROLE, target_type: '角色用户', target_id: id });
        fetchUserRoles();
        return;
      }

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", id);

      if (error) {
        toast.error("删除角色失败");
        return;
      }
      toast.success("角色已删除");
      await logAudit({ action: AUDIT_ACTIONS.ROLE_REMOVE, module: AUDIT_MODULES.ROLE, target_type: '角色用户', target_id: id });
      fetchUserRoles();
    } catch {
      toast.error("删除角色失败");
    }
  };

  const getFilteredUserRoles = () => {
    if (filterRole === "all") return userRoles;
    return userRoles.filter((ur) => ur.role === filterRole);
  };

  const getAllRoles = () => roles;

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          角色用户列表
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="筛选角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              {getAllRoles().map(role => (
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
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedUserId("");
              setSearchQuery("");
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                新增角色用户
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增角色用户</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>选择用户 *</Label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="搜索用户姓名、邮箱或手机号..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择用户">
                          {selectedUserId ? getUserDisplay(selectedUserId).name : "选择用户"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {filteredUserOptions.length === 0 ? (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            未找到匹配用户
                          </div>
                        ) : (
                          filteredUserOptions.slice(0, 30).map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {user.email}
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {filteredUserOptions.length > 30 && (
                      <p className="text-xs text-muted-foreground">
                        显示前30条结果，请输入关键词缩小范围
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">分配角色 *</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllRoles().map(role => (
                        <SelectItem key={role.name} value={role.name}>
                          {role.label}
                          {THREE_OFFICER_ROLES.includes(role.name) && (
                            <span className="ml-1 text-xs text-muted-foreground">（三员）</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {THREE_OFFICER_ROLES.includes(selectedRole) && (
                    <p className="text-xs text-amber-600">
                      ⚠ 三员角色互斥，同一用户只能持有一个三员角色
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddUserRole}>
                  确认添加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <UserRoleTable
          userRoles={getFilteredUserRoles()}
          getRoleLabel={getRoleLabel}
          getUserDisplay={getUserDisplay}
          onDelete={handleDeleteRole}
        />
      </CardContent>
    </Card>
  );
};

const UserRoleTable = ({
  userRoles,
  getRoleLabel,
  getUserDisplay,
  onDelete,
}: {
  userRoles: UserRole[];
  getRoleLabel: (roleName: string) => string;
  getUserDisplay: (userId: string) => { name: string; email: string };
  onDelete: (id: string) => void;
}) => {
  const pagination = usePagination(userRoles);

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'admin') return 'default' as const;
    if (THREE_OFFICER_ROLES.includes(role)) return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱/手机</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>分配时间</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            pagination.paginatedData.map((ur) => {
              const userDisplay = getUserDisplay(ur.user_id);
              return (
                <TableRow key={ur.id}>
                  <TableCell className="font-medium">
                    {userDisplay.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {userDisplay.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(ur.role)}>
                      {getRoleLabel(ur.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(ur.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(ur.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
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

export default RoleUserManagement;
