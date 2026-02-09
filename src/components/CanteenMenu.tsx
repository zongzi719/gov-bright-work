import { useState, useEffect } from "react";
import * as dataAdapter from "@/lib/dataAdapter";

interface DayMenu {
  day: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

const defaultWeekMenu: DayMenu[] = [
  {
    day: "周一",
    breakfast: ["豆浆", "油条", "包子", "鸡蛋", "小米粥"],
    lunch: ["红烧排骨", "清炒西兰花", "番茄炒蛋", "米饭", "紫菜蛋花汤"],
    dinner: ["炸酱面", "凉拌黄瓜", "卤鸡腿", "绿豆粥"],
  },
  {
    day: "周二",
    breakfast: ["牛奶", "面包", "煎蛋", "玉米", "八宝粥"],
    lunch: ["糖醋里脊", "蒜蓉油麦菜", "宫保鸡丁", "米饭", "酸辣汤"],
    dinner: ["牛肉面", "拍黄瓜", "红烧鱼块", "小米粥"],
  },
  {
    day: "周三",
    breakfast: ["豆浆", "油条", "包子", "鸡蛋", "小米粥"],
    lunch: ["红烧排骨", "清炒西兰花", "番茄炒蛋", "米饭", "紫菜蛋花汤"],
    dinner: ["炸酱面", "凉拌黄瓜", "卤鸡腿", "绿豆粥"],
  },
  {
    day: "周四",
    breakfast: ["牛奶", "馒头", "咸菜", "鸡蛋", "南瓜粥"],
    lunch: ["回锅肉", "炒青菜", "麻婆豆腐", "米饭", "西红柿汤"],
    dinner: ["担担面", "凉拌木耳", "可乐鸡翅", "玉米粥"],
  },
  {
    day: "周五",
    breakfast: ["豆浆", "肉包", "花卷", "鸡蛋", "燕麦粥"],
    lunch: ["鱼香肉丝", "蒜蓉菠菜", "土豆丝", "米饭", "冬瓜汤"],
    dinner: ["阳春面", "凉拌海带", "红烧肉", "红豆粥"],
  },
];

const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const CanteenMenu = () => {
  const [weekMenu, setWeekMenu] = useState<DayMenu[]>(defaultWeekMenu);
  const [activeDay, setActiveDay] = useState(2); // 默认周三
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const { data, error } = await dataAdapter.getCanteenMenus();
        
        if (!error && data && data.length > 0) {
          // 将数据库数据转换为组件格式
          const formattedMenu = data.map((item: any) => ({
            day: dayLabels[item.day_of_week - 1] || `周${item.day_of_week}`,
            breakfast: item.breakfast || [],
            lunch: item.lunch || [],
            dinner: item.dinner || [],
          }));
          setWeekMenu(formattedMenu);
        }
      } catch (err) {
        console.error('Fetch canteen menus error:', err);
        // 使用默认菜谱
      }
      setLoading(false);
    };
    
    fetchMenus();
  }, []);

  const currentMenu = weekMenu[activeDay] || weekMenu[0];

  if (loading) {
    return (
      <div className="gov-card h-full flex flex-col">
        <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
          <h2 className="gov-card-title text-sm md:text-base">食堂每周菜谱</h2>
        </div>
        <div className="p-3 md:p-4 flex-1 flex items-center justify-center text-muted-foreground">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="gov-card h-full flex flex-col">
      {/* 标题栏 */}
      <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
        <h2 className="gov-card-title text-sm md:text-base">食堂每周菜谱</h2>
      </div>

      <div className="p-3 md:p-4 flex-1 overflow-auto">
        {/* 日期Tab */}
        <div className="flex gap-1 md:gap-1.5 mb-3 md:mb-4 overflow-x-auto">
          {weekMenu.map((item, index) => (
            <button
              key={item.day}
              onClick={() => setActiveDay(index)}
              className={`menu-tab text-xs md:text-sm px-2 md:px-3 py-1 md:py-1.5 flex-shrink-0 ${
                activeDay === index ? "menu-tab-active" : "menu-tab-inactive"
              }`}
            >
              {item.day}
            </button>
          ))}
        </div>

        {/* 菜谱内容 */}
        <div className="space-y-2 md:space-y-3">
          <div>
            <h4 className="text-xs md:text-sm font-bold text-accent mb-1 md:mb-1.5">早餐</h4>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {currentMenu.breakfast.length > 0 ? currentMenu.breakfast.join("、") : "暂无数据"}
            </p>
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold text-accent mb-1 md:mb-1.5">午餐</h4>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {currentMenu.lunch.length > 0 ? currentMenu.lunch.join("、") : "暂无数据"}
            </p>
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold text-accent mb-1 md:mb-1.5">晚餐</h4>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {currentMenu.dinner.length > 0 ? currentMenu.dinner.join("、") : "暂无数据"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanteenMenu;
