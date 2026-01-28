import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Leader {
  id: string;
  name: string;
  position: string | null;
}

interface LeaderSchedule {
  id: string;
  leader_id: string;
  title: string;
  location: string | null;
  schedule_date: string;
  start_time: string;
  end_time: string;
  schedule_type: string;
  notes: string | null;
  leader?: Leader;
}

const scheduleTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  internal_meeting: { bg: "bg-blue-600", text: "text-white", label: "内部会议" },
  party_activity: { bg: "bg-red-700", text: "text-white", label: "党政重要活动" },
  research_trip: { bg: "bg-amber-500", text: "text-white", label: "调研/外出" },
};

const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const LeaderSchedule = () => {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leaderSchedules, setLeaderSchedules] = useState<LeaderSchedule[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [loading, setLoading] = useState(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [allowedLeaderIds, setAllowedLeaderIds] = useState<string[] | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // 获取当前用户可查看的领导列表
  const fetchUserPermissions = async () => {
    const storedUser = localStorage.getItem("frontendUser");
    if (!storedUser) {
      setAllowedLeaderIds([]);
      setPermissionsLoaded(true);
      return;
    }

    const user = JSON.parse(storedUser);
    const userId = user.id;
    
    // 如果是领导，可以查看所有领导日程
    if (user.is_leader) {
      setAllowedLeaderIds(null); // null表示可以查看所有
      setPermissionsLoaded(true);
      return;
    }

    if (!userId) {
      setAllowedLeaderIds([]);
      setPermissionsLoaded(true);
      return;
    }

    // 查询该用户的权限记录
    const { data: permData } = await supabase
      .from("leader_schedule_permissions")
      .select("leader_id, can_view_all")
      .eq("user_id", userId);

    if (permData && permData.length > 0) {
      // 检查是否有can_view_all权限
      const hasViewAll = permData.some(p => p.can_view_all);
      if (hasViewAll) {
        setAllowedLeaderIds(null);
      } else {
        // 收集所有被授权的leader_id
        const leaderIds = permData
          .filter(p => p.leader_id)
          .map(p => p.leader_id as string);
        setAllowedLeaderIds(leaderIds);
      }
    } else {
      setAllowedLeaderIds([]); // 无权限
    }
    setPermissionsLoaded(true);
  };

  // 只获取领导状态为"是"的人员，并根据权限过滤（服务端过滤）
  const fetchLeaders = async (leaderIds: string[] | null) => {
    let query = supabase
      .from("contacts")
      .select("id, name, position")
      .eq("is_active", true)
      .eq("is_leader", true);

    // 服务端过滤：只获取有权限查看的领导
    if (leaderIds !== null && leaderIds.length > 0) {
      query = query.in("id", leaderIds);
    } else if (leaderIds !== null && leaderIds.length === 0) {
      // 无权限时不获取任何领导
      setLeaders([]);
      return;
    }
    // leaderIds === null 表示可查看全部，不加过滤条件

    const { data } = await query.order("sort_order");

    if (data) {
      setLeaders(data);
    }
  };

  const fetchLeaderSchedules = async (leaderIds: string[] | null) => {
    setLoading(true);
    const weekEnd = addDays(currentWeekStart, 6);
    
    let query = supabase
      .from("leader_schedules")
      .select("*, leader:contacts(id, name, position)")
      .gte("schedule_date", format(currentWeekStart, "yyyy-MM-dd"))
      .lte("schedule_date", format(weekEnd, "yyyy-MM-dd"));

    // 服务端过滤：只获取有权限查看的领导日程
    if (leaderIds !== null && leaderIds.length > 0) {
      query = query.in("leader_id", leaderIds);
    } else if (leaderIds !== null && leaderIds.length === 0) {
      // 无权限时不获取任何数据
      setLeaderSchedules([]);
      setLoading(false);
      return;
    }
    // leaderIds === null 表示可查看全部，不加过滤条件

    const { data } = await query.order("schedule_date").order("start_time");

    if (data) {
      setLeaderSchedules(data as LeaderSchedule[]);
    }
    setLoading(false);
  };

  const getSchedulesForLeaderAndDay = (leaderId: string, date: Date): LeaderSchedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return leaderSchedules.filter(
      (s) => s.leader_id === leaderId && s.schedule_date === dateStr
    );
  };

  const handlePrevWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  useEffect(() => {
    if (permissionsLoaded) {
      fetchLeaders(allowedLeaderIds);
      fetchLeaderSchedules(allowedLeaderIds);
    }
  }, [permissionsLoaded]);

  useEffect(() => {
    // 周切换时重新获取日程，需等权限加载完成
    if (permissionsLoaded) {
      fetchLeaderSchedules(allowedLeaderIds);
    }
  }, [currentWeekStart]);

  return (
    <PageLayout>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>领导日程</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {format(currentWeekStart, "yyyy年M月d日", { locale: zhCN })} -{" "}
              {format(addDays(currentWeekStart, 6), "M月d日", { locale: zhCN })}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 图例 */}
          <div className="flex gap-4 mb-4 flex-wrap">
            {Object.entries(scheduleTypeColors).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${value.bg}`} />
                <span className="text-xs text-muted-foreground">{value.label}</span>
              </div>
            ))}
          </div>

          {!permissionsLoaded || loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无领导信息</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border p-2 text-left font-medium w-24">领导</th>
                    {weekDays.map((day, idx) => (
                      <th key={idx} className="border p-2 text-center font-medium min-w-[120px]">
                        <div>{weekDayNames[idx]}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(day, "M/d", { locale: zhCN })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((leader) => (
                    <tr key={leader.id} className="hover:bg-muted/30">
                      <td className="border p-2">
                        <div className="font-medium text-sm">{leader.name}</div>
                        <div className="text-xs text-muted-foreground">{leader.position}</div>
                      </td>
                      {weekDays.map((day, idx) => {
                        const schedules = getSchedulesForLeaderAndDay(leader.id, day);
                        return (
                          <td key={idx} className="border p-1 align-top">
                            <div className="space-y-1">
                              {schedules.map((s) => {
                                const typeStyle = scheduleTypeColors[s.schedule_type] || {
                                  bg: "bg-gray-500",
                                  text: "text-white",
                                };
                                return (
                                  <div
                                    key={s.id}
                                    className={`${typeStyle.bg} ${typeStyle.text} rounded px-1.5 py-1 text-xs`}
                                    title={`${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} ${s.title}${s.location ? ` @ ${s.location}` : ""}`}
                                  >
                                    <div className="font-medium truncate">{s.title}</div>
                                    <div className="opacity-80 text-[10px]">
                                      {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default LeaderSchedule;
