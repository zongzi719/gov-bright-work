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
import { Plus, Trash2, Users, UserCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

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

const RoleUserManagement = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [userId, setUserId] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUserRoles(), fetchRoles()]);
    setLoading(false);
  };

  const fetchUserRoles = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取角色用户列表失败");
      return;
    }
    setUserRoles(data || []);
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

  const getRoleLabel = (roleName: string): string => {
    const role = roles.find(r => r.name === roleName);
    return role?.label || roleName;
  };

  const handleAddUserRole = async () => {
    if (!userId.trim()) {
      toast.error("请输入用户ID");
      return;
    }

    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId.trim())) {
      toast.error("用户ID格式不正确，请输入有效的UUID");
      return;
    }

    // 检查是否已存在
    const exists = userRoles.some(
      ur => ur.user_id === userId.trim() && ur.role === selectedRole
    );
    if (exists) {
      toast.error("该用户已拥有此角色");
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId.trim(),
        role: selectedRole,
      });

    if (error) {
      toast.error("添加角色用户失败");
      return;
    }

    toast.success("角色用户已添加");
    setDialogOpen(false);
    setUserId("");
    setSelectedRole("user");
    fetchUserRoles();
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm("确定要删除该用户的角色吗？")) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除角色失败");
      return;
    }
    toast.success("角色已删除");
    fetchUserRoles();
  };

  const getFilteredUserRoles = () => {
    if (filterRole === "all") return userRoles;
    return userRoles.filter((ur) => ur.role === filterRole);
  };

  const getUserIdDisplay = (userId: string) => {
    return userId.substring(0, 8) + "...";
  };

  // 获取所有角色用于下拉选择（支持自定义角色）
  const getAllRoles = () => {
    return roles;
  };

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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <Label htmlFor="userId">用户ID *</Label>
                  <Input
                    id="userId"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="请输入用户的UUID"
                  />
                  <p className="text-xs text-muted-foreground">
                    用户ID可以在用户登录后从系统获取
                  </p>
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户ID</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>分配时间</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getFilteredUserRoles().length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              getFilteredUserRoles().map((ur) => (
                <TableRow key={ur.id}>
                  <TableCell className="font-mono text-sm">
                    {getUserIdDisplay(ur.user_id)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ur.role === 'admin' ? 'default' : 'secondary'}>
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
                      onClick={() => handleDeleteRole(ur.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            通过此功能可以为已注册的用户分配角色。用户ID为登录用户的唯一标识（UUID格式）。
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleUserManagement;
