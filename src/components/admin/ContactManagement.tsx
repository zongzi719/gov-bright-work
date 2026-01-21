import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Upload,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  short_name: string | null;
  parent_id: string | null;
  level: number;
  sort_order: number;
  address: string | null;
  phone: string | null;
}

type ContactStatus = 'on_duty' | 'out' | 'leave' | 'business_trip' | 'meeting';

const statusLabels: Record<ContactStatus, string> = {
  on_duty: '在职',
  out: '外出',
  leave: '请假',
  business_trip: '出差',
  meeting: '开会',
};

const statusColors: Record<ContactStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  on_duty: 'default',
  out: 'secondary',
  leave: 'destructive',
  business_trip: 'outline',
  meeting: 'secondary',
};

interface Contact {
  id: string;
  organization_id: string;
  name: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  office_location: string | null;
  sort_order: number;
  is_active: boolean;
  status: ContactStatus;
  status_note: string | null;
  organization?: Organization;
}

const ContactManagement = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("contacts");

  // 搜索和筛选
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOrgId, setFilterOrgId] = useState<string>("all");

  // 单位表单
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgFormData, setOrgFormData] = useState({
    name: "",
    short_name: "",
    parent_id: "",
    level: 1,
    sort_order: 0,
    address: "",
    phone: "",
  });

  // 联系人表单
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactFormData, setContactFormData] = useState({
    organization_id: "",
    name: "",
    position: "",
    department: "",
    phone: "",
    mobile: "",
    email: "",
    office_location: "",
    sort_order: 0,
    is_active: true,
    status: "on_duty" as ContactStatus,
    status_note: "",
  });

  // 导入对话框
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchOrganizations(), fetchContacts()]);
    setLoading(false);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("sort_order");

    if (error) {
      toast.error("获取单位列表失败");
      return;
    }
    setOrganizations(data || []);
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*, organization:organizations(*)")
      .order("sort_order");

    if (error) {
      toast.error("获取联系人列表失败");
      return;
    }
    setContacts(data || []);
  };

  // 单位管理
  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: orgFormData.name,
      short_name: orgFormData.short_name || null,
      parent_id: orgFormData.parent_id || null,
      level: orgFormData.level,
      sort_order: orgFormData.sort_order,
      address: orgFormData.address || null,
      phone: orgFormData.phone || null,
    };

    if (editingOrg) {
      const { error } = await supabase
        .from("organizations")
        .update(payload)
        .eq("id", editingOrg.id);

      if (error) {
        toast.error("更新单位失败");
        return;
      }
      toast.success("单位已更新");
    } else {
      const { error } = await supabase.from("organizations").insert(payload);

      if (error) {
        toast.error("添加单位失败");
        return;
      }
      toast.success("单位已添加");
    }

    resetOrgForm();
    fetchOrganizations();
  };

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setOrgFormData({
      name: org.name,
      short_name: org.short_name || "",
      parent_id: org.parent_id || "",
      level: org.level,
      sort_order: org.sort_order,
      address: org.address || "",
      phone: org.phone || "",
    });
    setOrgDialogOpen(true);
  };

  const handleDeleteOrg = async (id: string) => {
    if (!confirm("确定要删除这个单位吗？关联的联系人也将被删除。")) return;

    const { error } = await supabase.from("organizations").delete().eq("id", id);

    if (error) {
      toast.error("删除单位失败");
      return;
    }
    toast.success("单位已删除");
    fetchData();
  };

  const resetOrgForm = () => {
    setEditingOrg(null);
    setOrgFormData({
      name: "",
      short_name: "",
      parent_id: "",
      level: 1,
      sort_order: 0,
      address: "",
      phone: "",
    });
    setOrgDialogOpen(false);
  };

  // 联系人管理
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactFormData.organization_id) {
      toast.error("请选择所属单位");
      return;
    }

    const payload = {
      organization_id: contactFormData.organization_id,
      name: contactFormData.name,
      position: contactFormData.position || null,
      department: contactFormData.department || null,
      phone: contactFormData.phone || null,
      mobile: contactFormData.mobile || null,
      email: contactFormData.email || null,
      office_location: contactFormData.office_location || null,
      sort_order: contactFormData.sort_order,
      is_active: contactFormData.is_active,
      status: contactFormData.status,
      status_note: contactFormData.status_note || null,
    };

    if (editingContact) {
      const { error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", editingContact.id);

      if (error) {
        toast.error("更新联系人失败");
        return;
      }
      toast.success("联系人已更新");
    } else {
      const { error } = await supabase.from("contacts").insert(payload);

      if (error) {
        toast.error("添加联系人失败");
        return;
      }
      toast.success("联系人已添加");
    }

    resetContactForm();
    fetchContacts();
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactFormData({
      organization_id: contact.organization_id,
      name: contact.name,
      position: contact.position || "",
      department: contact.department || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      email: contact.email || "",
      office_location: contact.office_location || "",
      sort_order: contact.sort_order,
      is_active: contact.is_active,
      status: contact.status || "on_duty",
      status_note: contact.status_note || "",
    });
    setContactDialogOpen(true);
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("确定要删除这个联系人吗？")) return;

    const { error } = await supabase.from("contacts").delete().eq("id", id);

    if (error) {
      toast.error("删除联系人失败");
      return;
    }
    toast.success("联系人已删除");
    fetchContacts();
  };

  const resetContactForm = () => {
    setEditingContact(null);
    setContactFormData({
      organization_id: "",
      name: "",
      position: "",
      department: "",
      phone: "",
      mobile: "",
      email: "",
      office_location: "",
      sort_order: 0,
      is_active: true,
      status: "on_duty",
      status_note: "",
    });
    setContactDialogOpen(false);
  };

  // 导出功能
  const handleExport = () => {
    const filteredContacts = getFilteredContacts();
    
    const csvContent = [
      ["单位", "姓名", "职务", "部门", "办公电话", "手机", "邮箱", "办公地点"].join(","),
      ...filteredContacts.map((c) =>
        [
          c.organization?.name || "",
          c.name,
          c.position || "",
          c.department || "",
          c.phone || "",
          c.mobile || "",
          c.email || "",
          c.office_location || "",
        ]
          .map((field) => `"${field}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `通讯录_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("导出成功");
  };

  // 导入功能
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").slice(1); // 跳过标题行
        
        let successCount = 0;
        let errorCount = 0;

        for (const line of lines) {
          if (!line.trim()) continue;
          
          const fields = line.split(",").map((f) => f.replace(/^"|"$/g, "").trim());
          const [orgName, name, position, department, phone, mobile, email, office_location] = fields;

          if (!orgName || !name) continue;

          // 查找或创建单位
          let orgId: string;
          const existingOrg = organizations.find((o) => o.name === orgName);
          
          if (existingOrg) {
            orgId = existingOrg.id;
          } else {
            const { data: newOrg, error: orgError } = await supabase
              .from("organizations")
              .insert({ name: orgName })
              .select()
              .single();

            if (orgError || !newOrg) {
              errorCount++;
              continue;
            }
            orgId = newOrg.id;
          }

          // 创建联系人
          const { error: contactError } = await supabase.from("contacts").insert({
            organization_id: orgId,
            name,
            position: position || null,
            department: department || null,
            phone: phone || null,
            mobile: mobile || null,
            email: email || null,
            office_location: office_location || null,
          });

          if (contactError) {
            errorCount++;
          } else {
            successCount++;
          }
        }

        toast.success(`导入完成：成功 ${successCount} 条，失败 ${errorCount} 条`);
        fetchData();
        setImportDialogOpen(false);
      } catch (error) {
        toast.error("导入失败，请检查文件格式");
      }
    };
    reader.readAsText(file);
  };

  // 筛选联系人
  const getFilteredContacts = () => {
    return contacts.filter((contact) => {
      const matchesSearch =
        !searchTerm ||
        contact.name.includes(searchTerm) ||
        contact.phone?.includes(searchTerm) ||
        contact.mobile?.includes(searchTerm) ||
        contact.organization?.name.includes(searchTerm);

      const matchesOrg =
        filterOrgId === "all" || contact.organization_id === filterOrgId;

      return matchesSearch && matchesOrg;
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contacts" className="gap-2">
            <User className="w-4 h-4" />
            联系人管理
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-2">
            <Building2 className="w-4 h-4" />
            单位管理
          </TabsTrigger>
        </TabsList>

        {/* 联系人管理 */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                联系人列表
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* 搜索 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索姓名、电话、单位..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>

                {/* 筛选单位 */}
                <Select value={filterOrgId} onValueChange={setFilterOrgId}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="选择单位" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部单位</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 导入 */}
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      导入
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>导入通讯录</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        请上传 CSV 文件，格式：单位,姓名,职务,部门,办公电话,手机,邮箱,办公地点
                      </p>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleImport}
                      />
                    </div>
                  </DialogContent>
                </Dialog>

                {/* 导出 */}
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>

                {/* 添加联系人 */}
                <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={resetContactForm}>
                      <Plus className="w-4 h-4 mr-2" />
                      添加联系人
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingContact ? "编辑联系人" : "添加联系人"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>所属单位 *</Label>
                          <Select
                            value={contactFormData.organization_id}
                            onValueChange={(value) =>
                              setContactFormData({ ...contactFormData, organization_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择单位" />
                            </SelectTrigger>
                            <SelectContent>
                              {organizations.map((org) => (
                                <SelectItem key={org.id} value={org.id}>
                                  {org.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>姓名 *</Label>
                          <Input
                            value={contactFormData.name}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, name: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>职务</Label>
                          <Input
                            value={contactFormData.position}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, position: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>部门</Label>
                          <Input
                            value={contactFormData.department}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, department: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>办公电话</Label>
                          <Input
                            value={contactFormData.phone}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, phone: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>手机</Label>
                          <Input
                            value={contactFormData.mobile}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, mobile: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>邮箱</Label>
                          <Input
                            type="email"
                            value={contactFormData.email}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, email: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>办公地点</Label>
                          <Input
                            value={contactFormData.office_location}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, office_location: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>排序</Label>
                          <Input
                            type="number"
                            value={contactFormData.sort_order}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, sort_order: parseInt(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>人员状态</Label>
                          <Select
                            value={contactFormData.status}
                            onValueChange={(value: ContactStatus) =>
                              setContactFormData({ ...contactFormData, status: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择状态" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_duty">在职</SelectItem>
                              <SelectItem value="out">外出</SelectItem>
                              <SelectItem value="leave">请假</SelectItem>
                              <SelectItem value="business_trip">出差</SelectItem>
                              <SelectItem value="meeting">开会</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>状态备注</Label>
                          <Input
                            value={contactFormData.status_note}
                            onChange={(e) =>
                              setContactFormData({ ...contactFormData, status_note: e.target.value })
                            }
                            placeholder="如：请假至1月25日、出差北京等"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Switch
                            checked={contactFormData.is_active}
                            onCheckedChange={(checked) =>
                              setContactFormData({ ...contactFormData, is_active: checked })
                            }
                          />
                          <Label>启用</Label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={resetContactForm}>
                          取消
                        </Button>
                        <Button type="submit">保存</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {getFilteredContacts().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无联系人数据
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单位</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>职务</TableHead>
                      <TableHead>部门</TableHead>
                      <TableHead>办公电话</TableHead>
                      <TableHead>手机</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredContacts().map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {contact.organization?.name}
                          </div>
                        </TableCell>
                        <TableCell>{contact.name}</TableCell>
                        <TableCell>{contact.position || "-"}</TableCell>
                        <TableCell>{contact.department || "-"}</TableCell>
                        <TableCell>
                          {contact.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {contact.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.mobile && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {contact.mobile}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={statusColors[contact.status]}>
                              {statusLabels[contact.status]}
                            </Badge>
                            {contact.status_note && (
                              <span className="text-xs text-muted-foreground">
                                {contact.status_note}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditContact(contact)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 单位管理 */}
        <TabsContent value="organizations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                单位列表
              </CardTitle>
              <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={resetOrgForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    添加单位
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingOrg ? "编辑单位" : "添加单位"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleOrgSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>单位名称 *</Label>
                      <Input
                        value={orgFormData.name}
                        onChange={(e) =>
                          setOrgFormData({ ...orgFormData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>单位简称</Label>
                      <Input
                        value={orgFormData.short_name}
                        onChange={(e) =>
                          setOrgFormData({ ...orgFormData, short_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>上级单位</Label>
                      <Select
                        value={orgFormData.parent_id || "none"}
                        onValueChange={(value) =>
                          setOrgFormData({ ...orgFormData, parent_id: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择上级单位" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">无</SelectItem>
                          {organizations
                            .filter((o) => o.id !== editingOrg?.id)
                            .map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>级别</Label>
                        <Input
                          type="number"
                          value={orgFormData.level}
                          onChange={(e) =>
                            setOrgFormData({ ...orgFormData, level: parseInt(e.target.value) || 1 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>排序</Label>
                        <Input
                          type="number"
                          value={orgFormData.sort_order}
                          onChange={(e) =>
                            setOrgFormData({ ...orgFormData, sort_order: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>地址</Label>
                      <Input
                        value={orgFormData.address}
                        onChange={(e) =>
                          setOrgFormData({ ...orgFormData, address: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>联系电话</Label>
                      <Input
                        value={orgFormData.phone}
                        onChange={(e) =>
                          setOrgFormData({ ...orgFormData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={resetOrgForm}>
                        取消
                      </Button>
                      <Button type="submit">保存</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {organizations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无单位数据
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单位名称</TableHead>
                      <TableHead>简称</TableHead>
                      <TableHead>联系电话</TableHead>
                      <TableHead>地址</TableHead>
                      <TableHead>排序</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{org.short_name || "-"}</TableCell>
                        <TableCell>
                          {org.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {org.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {org.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              {org.address}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{org.sort_order}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditOrg(org)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteOrg(org.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContactManagement;
