import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, Briefcase, Heart, Gift, Baby, Smile, Coffee, MapPin } from "lucide-react";
import { getLeaveBalance } from "@/lib/dataAdapter";

interface LeaveBalance {
  id: string;
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
  family_visit_leave_total: number;
  family_visit_leave_used: number;
  marriage_leave_total: number;
  marriage_leave_used: number;
  compensatory_leave_total: number;
  compensatory_leave_used: number;
}

// 假期类型配置
const leaveTypeConfigs = [
  {
    key: "annual",
    label: "年假",
    icon: Calendar,
    unit: "小时",
    description: "每年1月1日自动发放，按工龄配额",
    totalField: "annual_leave_total",
    usedField: "annual_leave_used",
    color: "bg-blue-500",
  },
  {
    key: "sick",
    label: "病假",
    icon: Heart,
    unit: "小时",
    description: "按小时请假",
    totalField: "sick_leave_total",
    usedField: "sick_leave_used",
    color: "bg-rose-500",
  },
  {
    key: "personal",
    label: "事假",
    icon: Clock,
    unit: "天",
    description: "个人事务",
    totalField: "personal_leave_total",
    usedField: "personal_leave_used",
    color: "bg-orange-500",
  },
  {
    key: "compensatory",
    label: "调休",
    icon: Coffee,
    unit: "小时",
    description: "加班时长自动计入调休余额",
    totalField: "compensatory_leave_total",
    usedField: "compensatory_leave_used",
    color: "bg-teal-500",
  },
  {
    key: "marriage",
    label: "婚假",
    icon: Gift,
    unit: "天",
    description: "手动发放",
    totalField: "marriage_leave_total",
    usedField: "marriage_leave_used",
    color: "bg-pink-500",
  },
  {
    key: "maternity",
    label: "生育假",
    icon: Baby,
    unit: "天",
    description: "手动发放",
    totalField: "maternity_leave_total",
    usedField: "maternity_leave_used",
    color: "bg-purple-500",
  },
  {
    key: "paternity",
    label: "陪产假",
    icon: Briefcase,
    unit: "天",
    description: "手动发放",
    totalField: "paternity_leave_total",
    usedField: "paternity_leave_used",
    color: "bg-indigo-500",
  },
  {
    key: "family_visit",
    label: "探亲假",
    icon: MapPin,
    unit: "天",
    description: "手动发放",
    totalField: "family_visit_leave_total",
    usedField: "family_visit_leave_used",
    color: "bg-fuchsia-500",
  },
  {
    key: "bereavement",
    label: "丧假",
    icon: Smile,
    unit: "天",
    description: "手动发放",
    totalField: "bereavement_leave_total",
    usedField: "bereavement_leave_used",
    color: "bg-gray-500",
  },
];

interface MyLeaveBalanceProps {
  contactId: string;
  compact?: boolean;
}

const MyLeaveBalance = ({ contactId, compact = false }: MyLeaveBalanceProps) => {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contactId) {
      fetchBalance();
    }
  }, [contactId]);

  const fetchBalance = async () => {
    setLoading(true);
    const currentYear = new Date().getFullYear();
    const { data, error } = await getLeaveBalance(contactId, currentYear);
    if (!error && data) {
      setBalance(data);
    }
    setLoading(false);
  };

  const getRemaining = (total: number, used: number) => {
    return Math.max(0, total - used);
  };

  const getProgress = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((used / total) * 100, 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          暂无假期数据，请联系管理员初始化
        </CardContent>
      </Card>
    );
  }

  // 过滤出有配额的假期类型
  const availableLeaveTypes = leaveTypeConfigs.filter((config) => {
    const total = balance[config.totalField as keyof LeaveBalance] as number;
    return total > 0 || config.key === "annual" || config.key === "sick" || config.key === "personal";
  });

  if (compact) {
    const mainLeaveTypes = leaveTypeConfigs.filter((c) =>
      ["annual", "sick", "personal", "compensatory"].includes(c.key)
    );

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            我的假期余额
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mainLeaveTypes.map((config) => {
            const total = balance[config.totalField as keyof LeaveBalance] as number;
            const used = balance[config.usedField as keyof LeaveBalance] as number;
            const remaining = getRemaining(total, used);

            return (
              <div key={config.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{config.label}</span>
                <Badge variant={remaining > 0 ? "secondary" : "destructive"}>
                  剩余 {remaining} {config.unit}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {balance.year}年假期余额
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableLeaveTypes.map((config) => {
            const IconComponent = config.icon;
            const total = balance[config.totalField as keyof LeaveBalance] as number;
            const used = balance[config.usedField as keyof LeaveBalance] as number;
            const remaining = getRemaining(total, used);
            const progress = getProgress(used, total);

            return (
              <div
                key={config.key}
                className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${config.color} text-white`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      已用 {used} / {total} {config.unit}
                    </span>
                    <Badge
                      variant={remaining > 0 ? "secondary" : "destructive"}
                      className="font-medium"
                    >
                      剩余 {remaining} {config.unit}
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default MyLeaveBalance;
