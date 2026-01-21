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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Users, UserCheck, Search, Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface UserRoleWithProfile extends UserRole {
  profile?: Profile;
}

const RoleUserManagement = () => {
  const [userRoles, setUserRoles] = useState<UserRoleWithProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("user");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUserRoles(), fetchRoles(), fetchProfiles()]);
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

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, display_name")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("获取用户列表失败");
      return;
    }
    setProfiles(data || []);
  };

  const getRoleLabel = (roleName: string): string => {
    const role = roles.find(r => r.name === roleName);
    return role?.label || roleName;
  };

  const getProfileByUserId = (userId: string): Profile | undefined => {
    return profiles.find(p => p.user_id === userId);
  };

  const getFilteredProfiles = () => {
    if (!searchQuery) return profiles;
    const query = searchQuery.toLowerCase();
    return profiles.filter(p => 
      p.email?.toLowerCase().includes(query) ||
      p.display_name?.toLowerCase().includes(query)
    );
  };

  const getSelectedUserDisplay = () => {
    if (!selectedUserId) return "搜索并选择用户...";
    const profile = getProfileByUserId(selectedUserId);
    if (profile) {
      return profile.display_name || profile.email || selectedUserId.substring(0, 8) + "...";
    }
    return selectedUserId.substring(0, 8) + "...";
  };

  const handleAddUserRole = async () => {
    if (!selectedUserId) {
      toast.error("请选择用户");
      return;
    }

    // 检查用户是否已有角色（每用户只能有一个角色）
    const existingRole = userRoles.find(ur => ur.user_id === selectedUserId);
    if (existingRole) {
      // 更新现有角色
      const { error } = await supabase
        .from("user_roles")
        .update({ role: selectedRole })
        .eq("id", existingRole.id);

      if (error) {
        toast.error("更新用户角色失败: " + error.message);
        return;
      }
      toast.success("用户角色已更新");
    } else {
      // 新增角色
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUserId,
          role: selectedRole,
        });

      if (error) {
        toast.error("添加角色用户失败: " + error.message);
        return;
      }
      toast.success("角色用户已添加");
    }

    setDialogOpen(false);
    setSelectedUserId("");
    setSelectedRole("user");
    setSearchQuery("");
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

  const getUserDisplay = (userId: string) => {
    const profile = getProfileByUserId(userId);
    if (profile) {
      return {
        name: profile.display_name || profile.email?.split('@')[0] || userId.substring(0, 8),
        email: profile.email || "-"
      };
    }
    return {
      name: userId.substring(0, 8) + "...",
      email: "-"
    };
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
                  <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userSearchOpen}
                        className="w-full justify-between"
                      >
                        <span className="truncate">{getSelectedUserDisplay()}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="搜索用户邮箱或名称..." 
                          value={searchQuery}
                          onValueChange={setSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>未找到用户</CommandEmpty>
                          <CommandGroup>
                            {getFilteredProfiles().slice(0, 20).map((profile) => (
                              <CommandItem
                                key={profile.user_id}
                                value={`${profile.email || ''} ${profile.display_name || ''}`}
                                onSelect={() => {
                                  setSelectedUserId(profile.user_id);
                                  setUserSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedUserId === profile.user_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {profile.display_name || profile.email?.split('@')[0] || '未知用户'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {profile.email || profile.user_id.substring(0, 8) + '...'}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    每个用户只能分配一个角色，如已有角色将被更新
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
              <TableHead>用户名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>分配时间</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getFilteredUserRoles().length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              getFilteredUserRoles().map((ur) => {
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
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            通过此功能可以为已注册的用户分配角色。每个用户只能拥有一个角色。
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleUserManagement;
