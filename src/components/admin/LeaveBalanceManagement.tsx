import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
import * as dataAdapter from "@/lib/dataAdapter";
import { isOfflineMode } from "@/lib/offlineApi";
import { toast } from "sonner";
import { logAudit, AUDIT_ACTIONS, AUDIT_MODULES } from "@/hooks/useAuditLog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Edit, RefreshCw, Calendar, ChevronRight } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  first_work_date: string | null;
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
  paternity_leave_total: number;
  paternity_leave_used: number;
  bereavement_leave_total: number;
  bereavement_leave_used: number;
  maternity_leave_total: number;
  maternity_leave_used: number;
  nursing_leave_total: number;
  nursing_leave_used: number;
  marriage_leave_total: number;
  marriage_leave_used: number;
  compensatory_leave_total: number;
  compensatory_leave_used: number;
  created_at: string;
  updated_at: string;
  contacts?: Contact;
}

// 假期类型配置
const leaveTypeConfigs = [
  { key: "annual", label: "年假", unit: "小时", description: "按工龄配额" },
  { key: "sick", label: "病假", unit: "小时", description: "按小时请假" },
  { key: "personal", label: "事假", unit: "天", description: "个人事务" },
  { key: "compensatory", label: "调休", unit: "小时", description: "加班累积" },
  { key: "marriage", label: "婚假", unit: "天", description: "手动发放" },
  { key: "maternity", label: "产假", unit: "天", description: "手动发放" },
  { key: "paternity", label: "陪产假", unit: "天", description: "手动发放" },
  { key: "nursing", label: "哺乳假", unit: "小时", description: "手动发放" },
  { key: "bereavement", label: "丧假", unit: "天", description: "手动发放" },
];

interface LeaveFormData {
  contact_id: string;
  year: number;
  annual_leave_total: number;
  sick_leave_total: number;
  personal_leave_total: number;
  paternity_leave_total: number;
  bereavement_leave_total: number;
  maternity_leave_total: number;
  nursing_leave_total: number;
  marriage_leave_total: number;
  compensatory_leave_total: number;
}

const currentYear = new Date().getFullYear();

const defaultFormData: LeaveFormData = {
  contact_id: "",
  year: currentYear,
  annual_leave_total: 40, // 5天 * 8小时
  sick_leave_total: 80,   // 10天 * 8小时
  personal_leave_total: 5, // 5天
  paternity_leave_total: 0,
  bereavement_leave_total: 0,
  maternity_leave_total: 0,
  nursing_leave_total: 0,
  marriage_leave_total: 0,
  compensatory_leave_total: 0,
};

// 根据工龄计算年假小时数（法定标准）
const calculateAnnualLeaveHours = (firstWorkDate: string | null): number => {
  if (!firstWorkDate) return 40; // 默认5天
  
  const startDate = new Date(firstWorkDate);
  const now = new Date();
  const yearsOfService = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  // 法定年假标准：工龄<1年=0天，1-10年=5天，10-20年=10天，>20年=15天
  if (yearsOfService < 1) return 0;
  if (yearsOfService < 10) return 40;  // 5天 * 8小时
  if (yearsOfService < 20) return 80;  // 10天 * 8小时
  return 120; // 15天 * 8小时
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
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    fetchData();
  }, [yearFilter]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchBalances(), fetchContacts(), fetchOrganizations()]);
    setLoading(false);
  };

  const fetchBalances = async () => {
    const { data, error } = await dataAdapter.getLeaveBalancesWithContacts(yearFilter);
    if (error) {
      console.error(error);
    } else {
      setBalances((data as unknown as LeaveBalance[]) || []);
    }
  };

  const fetchContacts = async () => {
    const { data, error } = await dataAdapter.getContactsForLeaveBalance();
    if (error) {
      console.error(error);
    } else {
      setContacts((data as unknown as Contact[]) || []);
    }
  };

  const fetchOrganizations = async () => {
    const { data, error } = await dataAdapter.getOrganizations();
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

    const insertData = {
      annual_leave_total: formData.annual_leave_total,
      sick_leave_total: formData.sick_leave_total,
      personal_leave_total: formData.personal_leave_total,
      paternity_leave_total: formData.paternity_leave_total,
      bereavement_leave_total: formData.bereavement_leave_total,
      maternity_leave_total: formData.maternity_leave_total,
      nursing_leave_total: formData.nursing_leave_total,
      marriage_leave_total: formData.marriage_leave_total,
      compensatory_leave_total: formData.compensatory_leave_total,
    };

    if (isEditing && editingId) {
      const { error } = await dataAdapter.updateLeaveBalance(editingId, insertData);

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
      const { data: existing } = await dataAdapter.checkLeaveBalanceExists(formData.contact_id, formData.year);

      if (existing) {
        toast.error("该人员当年的假期记录已存在");
        return;
      }

      const { error } = await dataAdapter.createLeaveBalance({
        contact_id: formData.contact_id,
        year: formData.year,
        ...insertData,
        annual_leave_used: 0,
        sick_leave_used: 0,
        personal_leave_used: 0,
        paternity_leave_used: 0,
        bereavement_leave_used: 0,
        maternity_leave_used: 0,
        nursing_leave_used: 0,
        marriage_leave_used: 0,
        compensatory_leave_used: 0,
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
      paternity_leave_total: balance.paternity_leave_total || 0,
      bereavement_leave_total: balance.bereavement_leave_total || 0,
      maternity_leave_total: balance.maternity_leave_total || 0,
      nursing_leave_total: balance.nursing_leave_total || 0,
      marriage_leave_total: balance.marriage_leave_total || 0,
      compensatory_leave_total: balance.compensatory_leave_total || 0,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData(defaultFormData);
    setActiveTab("basic");
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
      annual_leave_total: calculateAnnualLeaveHours(contact.first_work_date),
      annual_leave_used: 0,
      sick_leave_total: 80, // 10天 * 8小时
      sick_leave_used: 0,
      personal_leave_total: 5,
      personal_leave_used: 0,
      paternity_leave_total: 0,
      paternity_leave_used: 0,
      bereavement_leave_total: 0,
      bereavement_leave_used: 0,
      maternity_leave_total: 0,
      maternity_leave_used: 0,
      nursing_leave_total: 0,
      nursing_leave_used: 0,
      marriage_leave_total: 0,
      marriage_leave_used: 0,
      compensatory_leave_total: 0,
      compensatory_leave_used: 0,
    }));

    const { error } = await dataAdapter.createLeaveBalances(newBalances);

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
        annual_leave_total: calculateAnnualLeaveHours(contact.first_work_date),
      });
    }
  };

  const getLeaveProgress = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((used / total) * 100, 100);
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditing ? "编辑假期" : "新增假期记录"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">基础假期</TabsTrigger>
                    <TabsTrigger value="special">特殊假期</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>年假(小时)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="8"
                          value={formData.annual_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              annual_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">按工龄：1-10年=40h，10-20年=80h，&gt;20年=120h</p>
                      </div>
                      <div className="space-y-2">
                        <Label>病假(小时)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
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
                      <div className="space-y-2">
                        <Label>调休(小时)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.compensatory_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              compensatory_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">加班时长自动计入</p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="special" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>婚假(天)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.marriage_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              marriage_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">法定3天+晚婚奖励</p>
                      </div>
                      <div className="space-y-2">
                        <Label>产假(天)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.maternity_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maternity_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">法定98天+地方奖励</p>
                      </div>
                      <div className="space-y-2">
                        <Label>陪产假(天)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.paternity_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              paternity_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">各地15-30天不等</p>
                      </div>
                      <div className="space-y-2">
                        <Label>哺乳假(小时)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.nursing_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nursing_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">每天1小时至婴儿1岁</p>
                      </div>
                      <div className="space-y-2">
                        <Label>丧假(天)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={formData.bereavement_leave_total}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bereavement_leave_total: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">直系亲属1-3天</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

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
          <LeaveBalanceTable
            balances={filteredBalances}
            onEdit={handleEdit}
            getLeaveProgress={getLeaveProgress}
          />
        )}
      </CardContent>
    </Card>
  );
};

// 抽取表格组件以支持分页
const LeaveBalanceTable = ({
  balances,
  onEdit,
  getLeaveProgress,
}: {
  balances: LeaveBalance[];
  onEdit: (balance: LeaveBalance) => void;
  getLeaveProgress: (used: number, total: number) => number;
}) => {
  const pagination = usePagination(balances);

  const renderLeaveCell = (used: number, total: number, unit: string) => {
    const remaining = total - used;
    return (
      <div className="space-y-1 min-w-[120px]">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{used}/{total}{unit}</span>
          <Badge
            variant={remaining <= 0 ? "destructive" : "secondary"}
            className="text-xs"
          >
            {remaining}{unit}
          </Badge>
        </div>
        <Progress value={getLeaveProgress(used, total)} className="h-1.5" />
      </div>
    );
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background">人员</TableHead>
            <TableHead>年假(h)</TableHead>
            <TableHead>病假(h)</TableHead>
            <TableHead>事假(天)</TableHead>
            <TableHead>调休(h)</TableHead>
            <TableHead>其他</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.map((balance) => {
            const hasSpecialLeave = 
              (balance.marriage_leave_total || 0) > 0 ||
              (balance.maternity_leave_total || 0) > 0 ||
              (balance.paternity_leave_total || 0) > 0 ||
              (balance.nursing_leave_total || 0) > 0 ||
              (balance.bereavement_leave_total || 0) > 0;
            
            return (
              <TableRow key={balance.id}>
                <TableCell className="sticky left-0 bg-background">
                  <div>
                    <div className="font-medium">{balance.contacts?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {balance.contacts?.organization?.name}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {renderLeaveCell(balance.annual_leave_used, balance.annual_leave_total, "h")}
                </TableCell>
                <TableCell>
                  {renderLeaveCell(balance.sick_leave_used, balance.sick_leave_total, "h")}
                </TableCell>
                <TableCell>
                  {renderLeaveCell(balance.personal_leave_used, balance.personal_leave_total, "天")}
                </TableCell>
                <TableCell>
                  {renderLeaveCell(
                    balance.compensatory_leave_used || 0, 
                    balance.compensatory_leave_total || 0, 
                    "h"
                  )}
                </TableCell>
                <TableCell>
                  {hasSpecialLeave ? (
                    <div className="flex flex-wrap gap-1">
                      {(balance.marriage_leave_total || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          婚{balance.marriage_leave_total - (balance.marriage_leave_used || 0)}天
                        </Badge>
                      )}
                      {(balance.maternity_leave_total || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          产{balance.maternity_leave_total - (balance.maternity_leave_used || 0)}天
                        </Badge>
                      )}
                      {(balance.paternity_leave_total || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          陪{balance.paternity_leave_total - (balance.paternity_leave_used || 0)}天
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(balance)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
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
    </div>
  );
};

export default LeaveBalanceManagement;
