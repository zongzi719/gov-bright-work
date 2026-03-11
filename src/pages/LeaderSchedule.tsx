import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { zhCN } from "date-fns/locale";
import * as dataAdapter from "@/lib/dataAdapter";
import { normalizeDate, normalizeTime } from "@/lib/utils";

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

const LeaderSchedulePage = () => {
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
    const { data: permData, error } = await dataAdapter.getLeaderSchedulePermissions(userId);

    if (error) {
      console.error("查询权限失败:", error);
      setAllowedLeaderIds([]);
      setPermissionsLoaded(true);
      return;
    }

    if (permData && permData.length > 0) {
      // 检查是否有can_view_all权限
      const hasViewAll = permData.some((p: any) => p.can_view_all);
      if (hasViewAll) {
        setAllowedLeaderIds(null);
      } else {
        // 收集所有被授权的leader_id
        const leaderIds = permData
          .filter((p: any) => p.leader_id)
          .map((p: any) => p.leader_id as string);
        setAllowedLeaderIds(leaderIds);
      }
    } else {
      setAllowedLeaderIds([]); // 无权限
    }
    setPermissionsLoaded(true);
  };

  // 只获取领导状态为"是"的人员，并根据权限过滤（服务端过滤）
  const fetchLeaders = async (leaderIds: string[] | null) => {
    // 无权限时不获取任何领导
    if (leaderIds !== null && leaderIds.length === 0) {
      setLeaders([]);
      return;
    }

    const { data, error } = await dataAdapter.getLeaders();
    
    if (error) {
      console.error("获取领导列表失败:", error);
      setLeaders([]);
      return;
    }

    if (data) {
      // 客户端过滤权限
      let filtered = data;
      if (leaderIds !== null && leaderIds.length > 0) {
        filtered = data.filter((l: Leader) => leaderIds.includes(l.id));
      }
      setLeaders(filtered);
    }
  };

  const fetchLeaderSchedules = async (leaderIds: string[] | null) => {
    setLoading(true);
    const weekEnd = addDays(currentWeekStart, 6);
    
    // 无权限时不获取任何数据
    if (leaderIds !== null && leaderIds.length === 0) {
      setLeaderSchedules([]);
      setLoading(false);
      return;
    }

    const { data, error } = await dataAdapter.getLeaderSchedulesByWeek(
      format(currentWeekStart, "yyyy-MM-dd"),
      format(weekEnd, "yyyy-MM-dd")
    );

    if (error) {
      console.error("获取领导日程失败:", error);
      setLeaderSchedules([]);
      setLoading(false);
      return;
    }

    if (data) {
      // 客户端过滤权限
      let filtered = data as LeaderSchedule[];
      if (leaderIds !== null && leaderIds.length > 0) {
        filtered = data.filter((s: LeaderSchedule) => leaderIds.includes(s.leader_id));
      }
      setLeaderSchedules(filtered);
    }
    setLoading(false);
  };

  const getSchedulesForLeaderAndDay = (leaderId: string, date: Date): LeaderSchedule[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return leaderSchedules.filter(
      (s) => s.leader_id === leaderId && normalizeDate(s.schedule_date) === dateStr
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
              <div key={key} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${value.bg}`} />
                <span className="text-sm text-muted-foreground">{value.label}</span>
              </div>
            ))}
          </div>

          {!permissionsLoaded || loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无领导信息</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* 表头 - 红色背景 */}
              <div className="grid bg-red-800 text-white" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                <div className="p-2 border-r border-red-700 text-center font-medium">姓名</div>
                {weekDays.map((day, idx) => (
                  <div key={idx} className="p-2 border-r border-red-700 last:border-r-0 text-center">
                    <div className="font-medium">{weekDayNames[idx]}</div>
                    <div className="text-sm opacity-80">{format(day, "MM/dd")}</div>
                  </div>
                ))}
              </div>

              {/* 上午/下午子表头 */}
              <div className="grid bg-muted border-b" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                <div className="p-1 border-r text-center text-xs text-muted-foreground"></div>
                {weekDays.map((_, idx) => (
                  <div key={idx} className="grid grid-cols-2 border-r last:border-r-0">
                    <div className="p-1 text-center text-xs border-r">上午</div>
                    <div className="p-1 text-center text-xs">下午</div>
                  </div>
                ))}
              </div>

              {/* 领导行 */}
              {leaders.map((leader) => (
                <div key={leader.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                  <div className="p-2 border-r bg-muted/50 flex items-center justify-center">
                    <span className="font-medium text-sm">{leader.name}</span>
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const daySchedules = getSchedulesForLeaderAndDay(leader.id, day);
                    return (
                      <div key={dayIdx} className="relative border-r last:border-r-0 min-h-[60px] p-1">
                        {/* 时间刻度虚线 */}
                        <div className="absolute inset-0 grid grid-cols-10">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="border-r border-dashed border-muted-foreground/20 last:border-r-0"></div>
                          ))}
                        </div>
                        {/* 日程卡片 */}
                        <div className="relative z-10 space-y-1">
                          {daySchedules.map((s) => {
                            const typeStyle = scheduleTypeColors[s.schedule_type] || {
                              bg: "bg-gray-500",
                              text: "text-white",
                            };
                            return (
                              <div
                                key={s.id}
                                className={`${typeStyle.bg} ${typeStyle.text} rounded px-1.5 py-0.5 text-xs`}
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
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
};

export default LeaderSchedulePage;
