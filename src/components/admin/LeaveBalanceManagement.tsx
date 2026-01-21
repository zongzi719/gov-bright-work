import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Search, Plus, Edit, RefreshCw, Calendar } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  created_at: string;
  organization: Organization | null;
}

interface LeaveBalance {
  id: string;
  contact_id: string;
  year: number;
  annual_leave_total: number;
  annual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  personal_leave_total: number;
  personal_leave_used: number;
  created_at: string;
  updated_at: string;
  contacts?: Contact;
}

interface LeaveFormData {
  contact_id: string;
  year: number;
  annual_leave_total: number;
  sick_leave_total: number;
  personal_leave_total: number;
}

const currentYear = new Date().getFullYear();

const defaultFormData: LeaveFormData = {
  contact_id: "",
  year: currentYear,
  annual_leave_total: 5,
  sick_leave_total: 10,
  personal_leave_total: 5,
};

// 根据在职时间计算年假天数
const calculateAnnualLeave = (createdAt: string): number => {
  const startDate = new Date(createdAt);
  const now = new Date();
  const yearsOfService = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  if (yearsOfService < 1) return 5;
  if (yearsOfService < 10) return 5;
  if (yearsOfService < 20) return 10;
  return 15;
};

const LeaveBalanceManagement = () => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<LeaveFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<number>(currentYear);

  useEffect(() => {
    fetchData();
  }, [yearFilter]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchBalances(), fetchContacts(), fetchOrganizations()]);
    setLoading(false);
  };

  const fetchBalances = async () => {
    const { data, error } = await supabase
      .from("leave_balances")
      .select(`
        *,
        contacts (
          id,
          name,
          department,
          position,
          created_at,
          organization:organizations (id, name)
        )
      `)
      .eq("year", yearFilter)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setBalances((data as unknown as LeaveBalance[]) || []);
    }
  };

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select(`
        id,
        name,
        department,
        position,
        created_at,
        organization:organizations (id, name)
      `)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error(error);
    } else {
      setContacts((data as unknown as Contact[]) || []);
    }
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .order("sort_order");

    if (error) {
      console.error(error);
    } else {
      setOrganizations(data || []);
    }
  };

  const handleSubmit = async () => {
    if (!formData.contact_id) {
      toast.error("请选择人员");
      return;
    }

    if (isEditing && editingId) {
      const { error } = await supabase
        .from("leave_balances")
        .update({
          annual_leave_total: formData.annual_leave_total,
          sick_leave_total: formData.sick_leave_total,
          personal_leave_total: formData.personal_leave_total,
        })
        .eq("id", editingId);

      if (error) {
        toast.error("更新失败");
        console.error(error);
      } else {
        toast.success("更新成功");
        closeDialog();
        fetchBalances();
      }
    } else {
      // Check if already exists
      const { data: existing } = await supabase
        .from("leave_balances")
        .select("id")
        .eq("contact_id", formData.contact_id)
        .eq("year", formData.year)
        .single();

      if (existing) {
        toast.error("该人员当年的假期记录已存在");
        return;
      }

      const { error } = await supabase.from("leave_balances").insert({
        contact_id: formData.contact_id,
        year: formData.year,
        annual_leave_total: formData.annual_leave_total,
        sick_leave_total: formData.sick_leave_total,
        personal_leave_total: formData.personal_leave_total,
        annual_leave_used: 0,
        sick_leave_used: 0,
        personal_leave_used: 0,
      });

      if (error) {
        toast.error("添加失败");
        console.error(error);
      } else {
        toast.success("添加成功");
        closeDialog();
        fetchBalances();
      }
    }
  };

  const handleEdit = (balance: LeaveBalance) => {
    setIsEditing(true);
    setEditingId(balance.id);
    setFormData({
      contact_id: balance.contact_id,
      year: balance.year,
      annual_leave_total: balance.annual_leave_total,
      sick_leave_total: balance.sick_leave_total,
      personal_leave_total: balance.personal_leave_total,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData(defaultFormData);
  };

  const handleInitializeAll = async () => {
    // Get contacts without leave balance for current year
    const existingContactIds = balances.map((b) => b.contact_id);
    const contactsToAdd = contacts.filter((c) => !existingContactIds.includes(c.id));

    if (contactsToAdd.length === 0) {
      toast.info("所有人员已有假期记录");
      return;
    }

    const newBalances = contactsToAdd.map((contact) => ({
      contact_id: contact.id,
      year: yearFilter,
      annual_leave_total: calculateAnnualLeave(contact.created_at),
      annual_leave_used: 0,
      sick_leave_total: 10,
      sick_leave_used: 0,
      personal_leave_total: 5,
      personal_leave_used: 0,
    }));

    const { error } = await supabase.from("leave_balances").insert(newBalances);

    if (error) {
      toast.error("批量初始化失败");
      console.error(error);
    } else {
      toast.success(`已为 ${contactsToAdd.length} 人初始化假期`);
      fetchBalances();
    }
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      setFormData({
        ...formData,
        contact_id: contactId,
        annual_leave_total: calculateAnnualLeave(contact.created_at),
      });
    }
  };

  const getLeaveProgress = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((used / total) * 100, 100);
  };

  const getProgressColor = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const filteredBalances = balances.filter((balance) => {
    const matchesSearch =
      !searchTerm ||
      balance.contacts?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg =
      orgFilter === "all" || balance.contacts?.organization?.id === orgFilter;
    return matchesSearch && matchesOrg;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          假期管理
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleInitializeAll}>
            <RefreshCw className="w-4 h-4 mr-2" />
            批量初始化
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增假期
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{isEditing ? "编辑假期" : "新增假期记录"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>人员 *</Label>
                  <Select
                    value={formData.contact_id}
                    onValueChange={handleContactSelect}
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择人员" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                          {contact.organization?.name && ` - ${contact.organization.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>年份 *</Label>
                  <Select
                    value={formData.year.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, year: parseInt(value) })
                    }
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}年
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>年假(天)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.annual_leave_total}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          annual_leave_total: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>病假(天)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.sick_leave_total}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sick_leave_total: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>事假(天)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.personal_leave_total}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          personal_leave_total: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={closeDialog}>
                    取消
                  </Button>
                  <Button onClick={handleSubmit}>
                    {isEditing ? "保存" : "添加"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 搜索和筛选 */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索人员姓名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={yearFilter.toString()} onValueChange={(v) => setYearFilter(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="单位" />
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
        </div>

        {/* 假期列表 */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : filteredBalances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无假期记录，请点击"批量初始化"为所有人员生成假期
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>人员</TableHead>
                  <TableHead>年假</TableHead>
                  <TableHead>病假</TableHead>
                  <TableHead>事假</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBalances.map((balance) => (
                  <TableRow key={balance.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{balance.contacts?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {balance.contacts?.organization?.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>已用 {balance.annual_leave_used} / {balance.annual_leave_total} 天</span>
                          <Badge
                            variant={
                              balance.annual_leave_used >= balance.annual_leave_total
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            剩余 {balance.annual_leave_total - balance.annual_leave_used}
                          </Badge>
                        </div>
                        <Progress
                          value={getLeaveProgress(balance.annual_leave_used, balance.annual_leave_total)}
                          className="h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>已用 {balance.sick_leave_used} / {balance.sick_leave_total} 天</span>
                          <Badge
                            variant={
                              balance.sick_leave_used >= balance.sick_leave_total
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            剩余 {balance.sick_leave_total - balance.sick_leave_used}
                          </Badge>
                        </div>
                        <Progress
                          value={getLeaveProgress(balance.sick_leave_used, balance.sick_leave_total)}
                          className="h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>已用 {balance.personal_leave_used} / {balance.personal_leave_total} 天</span>
                          <Badge
                            variant={
                              balance.personal_leave_used >= balance.personal_leave_total
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            剩余 {balance.personal_leave_total - balance.personal_leave_used}
                          </Badge>
                        </div>
                        <Progress
                          value={getLeaveProgress(balance.personal_leave_used, balance.personal_leave_total)}
                          className="h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(balance)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeaveBalanceManagement;
