import { useState, useEffect } from "react";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
import * as dataAdapter from "@/lib/dataAdapter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw, Search, UserCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Leader {
  id: string;
  name: string;
  position: string | null;
}

interface Permission {
  id: string;
  user_id: string;
  leader_id: string | null;
  can_view_all: boolean;
  profile?: {
    display_name: string | null;
    email: string | null;
  };
  leader?: {
    name: string;
  } | null;
}

interface ContactUser {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  mobile: string | null;
}

// 按用户分组的权限视图
interface GroupedPermission {
  user_id: string;
  user_name: string;
  user_mobile: string | null;
  can_view_all: boolean;
  leader_names: string[];
  permission_ids: string[];
}

interface LeaderSchedulePermissionsProps {
  leaders: Leader[];
}

const LeaderSchedulePermissions = ({ leaders }: LeaderSchedulePermissionsProps) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermission[]>([]);
  const [contactUsers, setContactUsers] = useState<ContactUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<ContactUser[]>([]);

  // 表单状态
  const [formData, setFormData] = useState({
    contact_id: "",
    selected_leader_ids: [] as string[],
    can_view_all: false,
  });
  const [selectedContactName, setSelectedContactName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 1) {
      const filtered = contactUsers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.department?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts([]);
    }
  }, [searchTerm, contactUsers]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPermissions(), fetchContactUsers()]);
    setLoading(false);
  };

  const fetchPermissions = async () => {
    const { data, error } = await dataAdapter.getAllLeaderSchedulePermissions();

    if (error) {
      console.error("获取权限列表失败:", error);
      return;
    }

    // 获取用户信息 - 从contacts表获取
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const { data: contactsData } = await dataAdapter.getContactsByIds(userIds as string[]);

      const contactMap = new Map(contactsData?.map((c: any) => [c.id, c]) || []);
      const enrichedData = data.map((p: any) => ({
        ...p,
        profile: {
          display_name: (contactMap.get(p.user_id) as any)?.name || null,
          email: (contactMap.get(p.user_id) as any)?.mobile || null,
        },
      }));
      setPermissions(enrichedData);

      // 按用户分组
      const grouped = new Map<string, GroupedPermission>();
      enrichedData.forEach((p: any) => {
        if (!grouped.has(p.user_id)) {
          grouped.set(p.user_id, {
            user_id: p.user_id,
            user_name: p.profile?.display_name || "未知用户",
            user_mobile: p.profile?.email || null,
            can_view_all: p.can_view_all,
            leader_names: [],
            permission_ids: [],
          });
        }
        const group = grouped.get(p.user_id)!;
        group.permission_ids.push(p.id);
        if (p.can_view_all) {
          group.can_view_all = true;
        }
        if (p.leader?.name) {
          group.leader_names.push(p.leader.name);
        }
      });
      setGroupedPermissions(Array.from(grouped.values()));
    } else {
      setPermissions([]);
      setGroupedPermissions([]);
    }
  };

  const fetchContactUsers = async () => {
    const { data, error } = await dataAdapter.getContacts({ is_active: true });

    if (error) {
      console.error("获取通讯录用户列表失败:", error);
      return;
    }
    setContactUsers(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.contact_id) {
      toast.error("请选择用户");
      return;
    }

    if (!formData.can_view_all && formData.selected_leader_ids.length === 0) {
      toast.error("请选择可查看的领导或勾选查看全部");
      return;
    }

    try {
      // 先删除该用户现有的所有权限
      await dataAdapter.deleteLeaderSchedulePermissionsByUser(formData.contact_id);

      if (formData.can_view_all) {
        // 如果是查看全部，只插入一条记录
        const { error } = await dataAdapter.createLeaderSchedulePermission({
          user_id: formData.contact_id,
          leader_id: null,
          can_view_all: true,
        });
        if (error) throw error;
      } else {
        // 为每个选中的领导插入一条权限记录
        const permissionRecords = formData.selected_leader_ids.map((leaderId) => ({
          user_id: formData.contact_id,
          leader_id: leaderId,
          can_view_all: false,
        }));

        const { error } = await dataAdapter.createLeaderSchedulePermissions(permissionRecords);
        if (error) throw error;
      }

      toast.success(editMode ? "权限已更新" : "权限已添加");
      await logAudit({ action: editMode ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE, module: AUDIT_MODULES.LEADER_SCHEDULE, target_type: '日程权限', target_id: formData.contact_id });
      setDialogOpen(false);
      resetForm();
      fetchPermissions();
    } catch (error) {
      toast.error(editMode ? "更新权限失败" : "添加权限失败");
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("确定要删除该用户的所有权限吗？")) return;

    const { error } = await dataAdapter.deleteLeaderSchedulePermissionsByUser(userId);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("权限已删除");
    fetchPermissions();
  };

  const handleEditUser = (group: GroupedPermission) => {
    setEditMode(true);
    setEditingUserId(group.user_id);
    setFormData({
      contact_id: group.user_id,
      selected_leader_ids: group.can_view_all
        ? []
        : permissions.filter((p) => p.user_id === group.user_id && p.leader_id).map((p) => p.leader_id!),
      can_view_all: group.can_view_all,
    });
    setSelectedContactName(group.user_name);
    setSearchTerm(group.user_name);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      contact_id: "",
      selected_leader_ids: [],
      can_view_all: false,
    });
    setSearchTerm("");
    setSelectedContactName("");
    setEditMode(false);
    setEditingUserId(null);
  };

  const toggleLeaderSelection = (leaderId: string) => {
    setFormData((prev) => ({
      ...prev,
      selected_leader_ids: prev.selected_leader_ids.includes(leaderId)
        ? prev.selected_leader_ids.filter((id) => id !== leaderId)
        : [...prev.selected_leader_ids, leaderId],
    }));
  };

  const selectContact = (contact: ContactUser) => {
    setFormData({ ...formData, contact_id: contact.id });
    setSelectedContactName(contact.name);
    setSearchTerm(contact.name);
    setFilteredContacts([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">管理哪些用户可以查看领导日程。管理员默认拥有全部查看权限。</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                添加授权
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{editMode ? "编辑日程查看权限" : "添加日程查看权限"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>用户 *</Label>
                  {editMode ? (
                    <div className="p-2 bg-muted rounded-md text-sm font-medium">{selectedContactName}</div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索用户名或邮箱..."
                        className="pl-9"
                      />
                      {filteredContacts.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto z-50">
                          {filteredContacts.map((contact) => (
                            <button
                              key={contact.id}
                              className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                              onClick={() => selectContact(contact)}
                            >
                              <UserCheck className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{contact.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {contact.position || contact.department || contact.mobile || "-"}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {!editMode && formData.contact_id && (
                    <p className="text-xs text-primary">已选择: {selectedContactName}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.can_view_all}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, can_view_all: checked, selected_leader_ids: [] })
                    }
                    id="can_view_all"
                  />
                  <Label htmlFor="can_view_all">允许查看所有领导日程</Label>
                </div>

                {!formData.can_view_all && (
                  <div className="space-y-2">
                    <Label>指定可查看的领导（可多选）</Label>
                    <ScrollArea className="h-48 border rounded-md p-2">
                      <div className="space-y-2">
                        {leaders.map((leader) => (
                          <div
                            key={leader.id}
                            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                            onClick={() => toggleLeaderSelection(leader.id)}
                          >
                            <Checkbox
                              checked={formData.selected_leader_ids.includes(leader.id)}
                              onCheckedChange={() => toggleLeaderSelection(leader.id)}
                            />
                            <div>
                              <div className="font-medium text-sm">{leader.name}</div>
                              <div className="text-xs text-muted-foreground">{leader.position}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    {formData.selected_leader_ids.length > 0 && (
                      <p className="text-xs text-primary">已选择 {formData.selected_leader_ids.length} 位领导</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSubmit}>{editMode ? "保存" : "添加"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : groupedPermissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">暂无授权记录</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>账号</TableHead>
              <TableHead>权限范围</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedPermissions.map((group) => (
              <TableRow key={group.user_id}>
                <TableCell className="font-medium">{group.user_name}</TableCell>
                <TableCell>{group.user_mobile || "-"}</TableCell>
                <TableCell>
                  {group.can_view_all ? (
                    <span className="text-green-600 font-medium">全部领导</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {group.leader_names.map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditUser(group)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(group.user_id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default LeaderSchedulePermissions;
