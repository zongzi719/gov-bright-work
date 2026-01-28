import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface NoticeImage {
  id: string;
  image_url: string;
  title: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const NoticeImageManagement = () => {
  const [images, setImages] = useState<NoticeImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<NoticeImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    image_url: "",
    title: "",
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from("notice_images")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("获取图片列表失败");
      return;
    }

    setImages(data || []);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }

    // 检查文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `notice-${Date.now()}.${fileExt}`;
      const filePath = `notice-images/${fileName}`;

      // 上传到 banners 存储桶
      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 获取公开 URL
      const { data: { publicUrl } } = supabase.storage
        .from("banners")
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("图片上传成功");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("图片上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image_url) {
      toast.error("请上传图片");
      return;
    }

    if (editingImage) {
      const { error } = await supabase
        .from("notice_images")
        .update(formData)
        .eq("id", editingImage.id);

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
    } else {
      const { error } = await supabase.from("notice_images").insert(formData);

      if (error) {
        toast.error("添加失败");
        return;
      }
      toast.success("添加成功");
    }

    setDialogOpen(false);
    resetForm();
    fetchImages();
  };

  const handleEdit = (image: NoticeImage) => {
    setEditingImage(image);
    setFormData({
      image_url: image.image_url,
      title: image.title,
      sort_order: image.sort_order,
      is_active: image.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这张图片吗？")) return;

    const { error } = await supabase.from("notice_images").delete().eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("删除成功");
    fetchImages();
  };

  const resetForm = () => {
    setEditingImage(null);
    setFormData({
      image_url: "",
      title: "",
      sort_order: 0,
      is_active: true,
    });
  };

  return (
    <div className="gov-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="gov-card-title">通知公告轮播图管理</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              添加图片
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingImage ? "编辑图片" : "添加图片"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>上传图片</Label>
                <div className="flex flex-col gap-2">
                  {formData.image_url ? (
                    <div className="relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                      <img
                        src={formData.image_url}
                        alt="预览"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => setFormData({ ...formData, image_url: "" })}
                      >
                        移除
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center justify-center py-4">
                        {uploading ? (
                          <div className="text-sm text-muted-foreground">上传中...</div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">点击上传图片</span>
                            <span className="text-xs text-muted-foreground mt-1">支持 JPG、PNG，最大 5MB</span>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">标题（可选）</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="请输入图片标题"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">排序</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="数字越小越靠前"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">启用</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={uploading}>保存</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : images.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无轮播图片</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">预览</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className="w-20">排序</TableHead>
                <TableHead className="w-16">状态</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.map((image) => (
                <TableRow key={image.id}>
                  <TableCell>
                    <div className="w-20 h-12 bg-muted rounded overflow-hidden">
                      <img
                        src={image.image_url}
                        alt={image.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{image.title || "-"}</TableCell>
                  <TableCell>{image.sort_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${image.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {image.is_active ? "启用" : "禁用"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(image)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(image.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default NoticeImageManagement;
