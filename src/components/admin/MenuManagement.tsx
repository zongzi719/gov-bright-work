import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface CanteenMenu {
  id: string;
  day_of_week: number;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const MenuManagement = () => {
  const [menus, setMenus] = useState<CanteenMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<CanteenMenu | null>(null);
  const [formData, setFormData] = useState({
    breakfast: "",
    lunch: "",
    dinner: "",
  });

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    const { data, error } = await supabase
      .from("canteen_menus")
      .select("*")
      .order("day_of_week");

    if (error) {
      toast.error("获取菜谱失败");
      return;
    }

    setMenus(data || []);
    setLoading(false);
  };

  const handleEdit = (menu: CanteenMenu) => {
    setEditingMenu(menu);
    setFormData({
      breakfast: menu.breakfast.join("、"),
      lunch: menu.lunch.join("、"),
      dinner: menu.dinner.join("、"),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingMenu) return;

    const updateData = {
      breakfast: formData.breakfast.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
      lunch: formData.lunch.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
      dinner: formData.dinner.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
    };

    const { error } = await supabase
      .from("canteen_menus")
      .update(updateData)
      .eq("id", editingMenu.id);

    if (error) {
      toast.error("更新失败");
      return;
    }

    toast.success("更新成功");
    setDialogOpen(false);
    fetchMenus();
  };

  const handleAddDay = async (dayOfWeek: number) => {
    const { error } = await supabase.from("canteen_menus").insert({
      day_of_week: dayOfWeek,
      breakfast: [],
      lunch: [],
      dinner: [],
    });

    if (error) {
      toast.error("添加失败");
      return;
    }

    toast.success("添加成功");
    fetchMenus();
  };

  // 获取缺失的日期
  const existingDays = menus.map((m) => m.day_of_week);
  const missingDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !existingDays.includes(d));

  return (
    <div className="gov-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="gov-card-title">食堂菜谱管理</h2>
        {missingDays.length > 0 && (
          <div className="flex gap-2">
            {missingDays.map((day) => (
              <Button
                key={day}
                size="sm"
                variant="outline"
                onClick={() => handleAddDay(day)}
              >
                添加{dayNames[day]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : menus.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无菜谱</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">日期</TableHead>
                <TableHead>早餐</TableHead>
                <TableHead>午餐</TableHead>
                <TableHead>晚餐</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menus.map((menu) => (
                <TableRow key={menu.id}>
                  <TableCell className="font-medium">{dayNames[menu.day_of_week]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {menu.breakfast.join("、") || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {menu.lunch.join("、") || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {menu.dinner.join("、") || "-"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(menu)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              编辑{editingMenu ? dayNames[editingMenu.day_of_week] : ""}菜谱
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="breakfast">早餐（用顿号或逗号分隔）</Label>
              <Input
                id="breakfast"
                value={formData.breakfast}
                onChange={(e) => setFormData({ ...formData, breakfast: e.target.value })}
                placeholder="豆浆、油条、包子"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lunch">午餐（用顿号或逗号分隔）</Label>
              <Input
                id="lunch"
                value={formData.lunch}
                onChange={(e) => setFormData({ ...formData, lunch: e.target.value })}
                placeholder="红烧排骨、清炒西兰花、米饭"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dinner">晚餐（用顿号或逗号分隔）</Label>
              <Input
                id="dinner"
                value={formData.dinner}
                onChange={(e) => setFormData({ ...formData, dinner: e.target.value })}
                placeholder="炸酱面、凉拌黄瓜、绿豆粥"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuManagement;
