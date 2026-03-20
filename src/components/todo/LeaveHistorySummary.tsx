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
  family_visit_leave_total: number;
  family_visit_leave_used: number;
  marriage_leave_total: number;
  marriage_leave_used: number;
  compensatory_leave_total: number;
  compensatory_leave_used: number;
}

/**
 * 请假审批页 - 展示请假人当年度历史请假汇总和剩余假期
 * 
 * 单位换算规则 (8小时工作制):
 * - 年假/病假/调休: 以小时存储, 转天数 /8
 * - 事假/陪产假/丧假/生育假/婚假/探亲假: 以天存储
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

  // 用量（换算为天）- 9种假别分开展示
  const personalDays = Number(balance.personal_leave_used || 0);
  const sickDays = Number(balance.sick_leave_used || 0) / 8;
  const annualDays = Number(balance.annual_leave_used || 0) / 8;
  const familyVisitDays = Number(balance.family_visit_leave_used || 0);
  const marriageDays = Number(balance.marriage_leave_used || 0);
  const bereavementDays = Number(balance.bereavement_leave_used || 0);
  const maternityDays = Number(balance.maternity_leave_used || 0);
  const paternityDays = Number(balance.paternity_leave_used || 0);
  const compensatoryDays = Number(balance.compensatory_leave_used || 0) / 8;

  const totalDays = personalDays + sickDays + annualDays + familyVisitDays + marriageDays + bereavementDays + maternityDays + paternityDays + compensatoryDays;

  // 剩余（换算为天）
  const remaining = (total: number, used: number) => Math.max(0, total - used);
  const personalRemain = remaining(Number(balance.personal_leave_total || 0), Number(balance.personal_leave_used || 0));
  const sickRemain = remaining(Number(balance.sick_leave_total || 0), Number(balance.sick_leave_used || 0)) / 8;
  const annualRemain = remaining(Number(balance.annual_leave_total || 0), Number(balance.annual_leave_used || 0)) / 8;
  const familyVisitRemain = remaining(Number(balance.family_visit_leave_total || 0), Number(balance.family_visit_leave_used || 0));
  const marriageRemain = remaining(Number(balance.marriage_leave_total || 0), Number(balance.marriage_leave_used || 0));
  const bereavementRemain = remaining(Number(balance.bereavement_leave_total || 0), Number(balance.bereavement_leave_used || 0));
  const maternityRemain = remaining(Number(balance.maternity_leave_total || 0), Number(balance.maternity_leave_used || 0));
  const paternityRemain = remaining(Number(balance.paternity_leave_total || 0), Number(balance.paternity_leave_used || 0));
  const compensatoryRemain = remaining(Number(balance.compensatory_leave_total || 0), Number(balance.compensatory_leave_used || 0)) / 8;

  const fmt = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(1);

  return (
    <div className="mt-4 p-3 bg-amber-50 rounded-md border border-amber-200 text-sm text-foreground leading-relaxed space-y-2">
      <p>
        该同志本年度已请假 <strong>{fmt(totalDays)}</strong> 天（事假：<strong>{fmt(personalDays)}</strong> 天；病假：<strong>{fmt(sickDays)}</strong> 天；年假：<strong>{fmt(annualDays)}</strong> 天；探亲假：<strong>{fmt(familyVisitDays)}</strong> 天；婚假：<strong>{fmt(marriageDays)}</strong> 天；丧假：<strong>{fmt(bereavementDays)}</strong> 天；生育假：<strong>{fmt(maternityDays)}</strong> 天；陪产假：<strong>{fmt(paternityDays)}</strong> 天；调休：<strong>{fmt(compensatoryDays)}</strong> 天。）
      </p>
      <p className="text-muted-foreground">
        剩余可用：事假 <strong>{fmt(personalRemain)}</strong> 天；病假 <strong>{fmt(sickRemain)}</strong> 天；年假 <strong>{fmt(annualRemain)}</strong> 天；探亲假 <strong>{fmt(familyVisitRemain)}</strong> 天；婚假 <strong>{fmt(marriageRemain)}</strong> 天；丧假 <strong>{fmt(bereavementRemain)}</strong> 天；生育假 <strong>{fmt(maternityRemain)}</strong> 天；陪产假 <strong>{fmt(paternityRemain)}</strong> 天；调休 <strong>{fmt(compensatoryRemain)}</strong> 天
      </p>
    </div>
  );
};

export default LeaveHistorySummary;
