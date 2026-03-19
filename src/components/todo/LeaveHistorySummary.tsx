import { useState, useEffect } from "react";
import { getLeaveBalance } from "@/lib/dataAdapter";

interface LeaveHistorySummaryProps {
  contactId: string;
}

interface LeaveBalance {
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
}

/**
 * 请假审批页 - 展示请假人当年度历史请假汇总和剩余假期
 * 
 * 单位换算规则 (8小时工作制):
 * - 年假/病假/调休/哺乳假: 以小时存储, 转天数 /8
 * - 事假/陪产假/丧假/产假/婚假: 以天存储
 */
const LeaveHistorySummary = ({ contactId }: LeaveHistorySummaryProps) => {
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

  if (loading) {
    return (
      <div className="mt-4 p-3 bg-muted/30 rounded-md border border-dashed text-sm text-muted-foreground">
        加载假期信息中...
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  // 用量（换算为天）
  const personalDays = Number(balance.personal_leave_used || 0);
  const sickDays = Number(balance.sick_leave_used || 0) / 8;
  const annualDays = Number(balance.annual_leave_used || 0) / 8;
  const familyVisitDays = 0; // 系统中无探亲假
  const marriageBereavement = Number(balance.marriage_leave_used || 0) + Number(balance.bereavement_leave_used || 0);
  const maternityDays = Number(balance.maternity_leave_used || 0) + Number(balance.nursing_leave_used || 0) / 8;
  const paternityDays = Number(balance.paternity_leave_used || 0);
  const otherDays = Number(balance.compensatory_leave_used || 0) / 8;

  const totalDays = personalDays + sickDays + annualDays + familyVisitDays + marriageBereavement + maternityDays + paternityDays + otherDays;

  // 剩余（换算为天）
  const remaining = (total: number, used: number) => Math.max(0, total - used);
  const personalRemain = remaining(Number(balance.personal_leave_total || 0), Number(balance.personal_leave_used || 0));
  const sickRemain = remaining(Number(balance.sick_leave_total || 0), Number(balance.sick_leave_used || 0)) / 8;
  const annualRemain = remaining(Number(balance.annual_leave_total || 0), Number(balance.annual_leave_used || 0)) / 8;
  const marriageBereavementRemain = remaining(Number(balance.marriage_leave_total || 0), Number(balance.marriage_leave_used || 0)) + remaining(Number(balance.bereavement_leave_total || 0), Number(balance.bereavement_leave_used || 0));
  const maternityRemain = remaining(Number(balance.maternity_leave_total || 0), Number(balance.maternity_leave_used || 0)) + remaining(Number(balance.nursing_leave_total || 0), Number(balance.nursing_leave_used || 0)) / 8;
  const paternityRemain = remaining(Number(balance.paternity_leave_total || 0), Number(balance.paternity_leave_used || 0));
  const otherRemain = remaining(Number(balance.compensatory_leave_total || 0), Number(balance.compensatory_leave_used || 0)) / 8;

  const fmt = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(1);

  return (
    <div className="mt-4 p-3 bg-amber-50 rounded-md border border-amber-200 text-sm text-foreground leading-relaxed space-y-2">
      <p>
        该同志本年度已请假 <strong>{fmt(totalDays)}</strong> 天（事假：<strong>{fmt(personalDays)}</strong> 天；病假：<strong>{fmt(sickDays)}</strong> 天；年假：<strong>{fmt(annualDays)}</strong> 天；探亲假：<strong>{fmt(familyVisitDays)}</strong> 天；婚丧假：<strong>{fmt(marriageBereavement)}</strong> 天；生育假：<strong>{fmt(maternityDays)}</strong> 天；陪产假：<strong>{fmt(paternityDays)}</strong> 天。其他：<strong>{fmt(otherDays)}</strong> 天。）
      </p>
      <p className="text-muted-foreground">
        剩余可用：事假 <strong>{fmt(personalRemain)}</strong> 天；病假 <strong>{fmt(sickRemain)}</strong> 天；年假 <strong>{fmt(annualRemain)}</strong> 天；婚丧假 <strong>{fmt(marriageBereavementRemain)}</strong> 天；生育假 <strong>{fmt(maternityRemain)}</strong> 天；陪产假 <strong>{fmt(paternityRemain)}</strong> 天；其他 <strong>{fmt(otherRemain)}</strong> 天
      </p>
    </div>
  );
};

export default LeaveHistorySummary;
