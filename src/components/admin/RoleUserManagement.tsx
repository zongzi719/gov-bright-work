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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Users, UserCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  organization?: {
    name: string;
  };
}

const roleLabels: Record<AppRole, string> = {
  admin: '管理员',
  user: '普通用户',
};

const RoleUserManagement = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("user");
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUserRoles(), fetchContacts()]);
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

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, department, position, organization:organizations(name)")
      .eq("is_active", true)
      .order("name");

    if (error) {
      toast.error("获取联系人列表失败");
      return;
    }
    setContacts(data || []);
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
    // 简化显示用户ID
    return userId.substring(0, 8) + "...";
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
              <SelectItem value="admin">管理员</SelectItem>
              <SelectItem value="user">普通用户</SelectItem>
            </SelectContent>
          </Select>
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
                      {roleLabels[ur.role]}
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
            用户角色在用户首次登录时分配。可通过删除角色来撤销用户权限。
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleUserManagement;
