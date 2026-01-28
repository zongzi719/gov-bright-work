import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DayMenu {
  day: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

const defaultMenu: DayMenu[] = [
  { day: "周一", breakfast: ["豆浆", "油条", "包子"], lunch: ["红烧排骨", "清炒西兰花", "米饭"], dinner: ["炸酱面", "凉拌黄瓜"] },
  { day: "周二", breakfast: ["牛奶", "面包", "煎蛋"], lunch: ["糖醋里脊", "蒜蓉油麦菜", "米饭"], dinner: ["牛肉面", "拍黄瓜"] },
  { day: "周三", breakfast: ["豆浆", "油条", "包子"], lunch: ["红烧排骨", "清炒西兰花", "米饭"], dinner: ["炸酱面", "凉拌黄瓜"] },
  { day: "周四", breakfast: ["牛奶", "馒头", "咸菜"], lunch: ["回锅肉", "炒青菜", "米饭"], dinner: ["担担面", "凉拌木耳"] },
  { day: "周五", breakfast: ["豆浆", "肉包", "花卷"], lunch: ["鱼香肉丝", "蒜蓉菠菜", "米饭"], dinner: ["阳春面", "凉拌海带"] },
];

const CanteenMenu = () => {
  const [activeDay, setActiveDay] = useState(0);
  const [menuData, setMenuData] = useState<DayMenu[]>(defaultMenu);

  useEffect(() => {
    // 根据当前星期几设置默认选中
    const today = new Date().getDay();
    const dayIndex = today === 0 ? 4 : Math.min(today - 1, 4); // 周日显示周五，否则显示对应日期
    setActiveDay(dayIndex);

    // 从数据库获取菜谱数据
    fetchMenuData();
  }, []);

  const fetchMenuData = async () => {
    const { data, error } = await supabase
      .from("canteen_menus")
      .select("day_of_week, breakfast, lunch, dinner")
      .order("day_of_week");

    if (!error && data && data.length > 0) {
      const dayNames = ["周一", "周二", "周三", "周四", "周五"];
      const menus = data.slice(0, 5).map((item, idx) => ({
        day: dayNames[item.day_of_week - 1] || dayNames[idx],
        breakfast: item.breakfast || [],
        lunch: item.lunch || [],
        dinner: item.dinner || [],
      }));
      setMenuData(menus);
    }
  };

  const currentMenu = menuData[activeDay];

  return (
    <div className="gov-card flex flex-col">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="gov-card-title text-base">食堂每周菜谱</h2>
      </div>

      <div className="p-4">
        {/* 日期Tab */}
        <div className="flex gap-1 mb-3">
          {menuData.map((item, index) => (
            <button
              key={item.day}
              onClick={() => setActiveDay(index)}
              className={`menu-tab flex-1 text-xs ${
                activeDay === index ? "menu-tab-active" : "menu-tab-inactive"
              }`}
            >
              {item.day}
            </button>
          ))}
        </div>

        {/* 菜谱内容 */}
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-primary font-medium w-10 flex-shrink-0">早餐</span>
            <span className="text-muted-foreground">{currentMenu.breakfast.join("、") || "暂无"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary font-medium w-10 flex-shrink-0">午餐</span>
            <span className="text-muted-foreground">{currentMenu.lunch.join("、") || "暂无"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-primary font-medium w-10 flex-shrink-0">晚餐</span>
            <span className="text-muted-foreground">{currentMenu.dinner.join("、") || "暂无"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanteenMenu;
