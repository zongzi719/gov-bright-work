import { useState } from "react";

interface DayMenu {
  day: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

const weekMenu: DayMenu[] = [
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

const CanteenMenu = () => {
  const [activeDay, setActiveDay] = useState(2); // 默认周三

  const currentMenu = weekMenu[activeDay];

  return (
    <div className="gov-card">
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">食堂每周菜谱</h2>
      </div>

      <div className="p-5">
        {/* 日期Tab */}
        <div className="flex gap-1.5 mb-5">
          {weekMenu.map((item, index) => (
            <button
              key={item.day}
              onClick={() => setActiveDay(index)}
              className={`menu-tab ${
                activeDay === index ? "menu-tab-active" : "menu-tab-inactive"
              }`}
            >
              {item.day}
            </button>
          ))}
        </div>

        {/* 菜谱内容 */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-bold text-accent mb-2">早餐</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentMenu.breakfast.join("、")}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-accent mb-2">午餐</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentMenu.lunch.join("、")}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-accent mb-2">晚餐</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentMenu.dinner.join("、")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CanteenMenu;
