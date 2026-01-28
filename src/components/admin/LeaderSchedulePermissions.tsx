import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";

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

interface LeaderSchedulePermissionsProps {
  leaders: Leader[];
}

const LeaderSchedulePermissions = ({ leaders }: LeaderSchedulePermissionsProps) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [contactUsers, setContactUsers] = useState<ContactUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<ContactUser[]>([]);

  // 表单状态
  const [formData, setFormData] = useState({
    contact_id: "",
    leader_id: "",
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
          c.department?.toLowerCase().includes(searchTerm.toLowerCase())
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
    const { data, error } = await supabase
      .from("leader_schedule_permissions")
      .select(`
        *,
        leader:contacts!leader_id(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取权限列表失败:", error);
      return;
    }

    // 获取用户信息 - 从contacts表获取
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, name, mobile")
        .in("id", userIds);

      const contactMap = new Map(contactsData?.map((c) => [c.id, c]) || []);
      const enrichedData = data.map((p) => ({
        ...p,
        profile: {
          display_name: contactMap.get(p.user_id)?.name || null,
          email: contactMap.get(p.user_id)?.mobile || null,
        },
      }));
      setPermissions(enrichedData);
    } else {
      setPermissions([]);
    }
  };

  const fetchContactUsers = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, position, department, mobile")
      .eq("is_active", true)
      .order("name");

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

    if (!formData.can_view_all && !formData.leader_id) {
      toast.error("请选择可查看的领导或勾选查看全部");
      return;
    }

    const permissionData = {
      user_id: formData.contact_id,
      leader_id: formData.can_view_all ? null : formData.leader_id,
      can_view_all: formData.can_view_all,
    };

    const { error } = await supabase
      .from("leader_schedule_permissions")
      .insert(permissionData);

    if (error) {
      if (error.code === "23505") {
        toast.error("该用户已有相同的权限配置");
      } else {
        toast.error("添加权限失败");
        console.error(error);
      }
      return;
    }

    toast.success("权限已添加");
    setDialogOpen(false);
    resetForm();
    fetchPermissions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条权限吗？")) return;

    const { error } = await supabase
      .from("leader_schedule_permissions")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("权限已删除");
    fetchPermissions();
  };

  const resetForm = () => {
    setFormData({
      contact_id: "",
      leader_id: "",
      can_view_all: false,
    });
    setSearchTerm("");
    setSelectedContactName("");
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
        <p className="text-sm text-muted-foreground">
          管理哪些用户可以查看领导日程。管理员默认拥有全部查看权限。
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                添加授权
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加日程查看权限</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>用户 *</Label>
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
                  {formData.contact_id && (
                    <p className="text-xs text-green-600">已选择: {selectedContactName}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.can_view_all}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_view_all: checked, leader_id: "" })}
                    id="can_view_all"
                  />
                  <Label>允许查看所有领导日程</Label>
                </div>

                {!formData.can_view_all && (
                  <div className="space-y-2">
                    <Label>指定可查看的领导</Label>
                    <Select value={formData.leader_id} onValueChange={(v) => setFormData({ ...formData, leader_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择领导" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaders.map((leader) => (
                          <SelectItem key={leader.id} value={leader.id}>
                            {leader.name} - {leader.position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                  <Button onClick={handleSubmit}>添加</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : permissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无授权记录
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>权限范围</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.id}>
                <TableCell className="font-medium">
                  {permission.profile?.display_name || "未知用户"}
                </TableCell>
                <TableCell>{permission.profile?.email || "-"}</TableCell>
                <TableCell>
                  {permission.can_view_all ? (
                    <span className="text-green-600 font-medium">全部领导</span>
                  ) : (
                    <span>{permission.leader?.name || "指定领导"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(permission.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
