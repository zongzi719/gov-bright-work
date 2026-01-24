import { useEffect, useState, useRef } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "./TablePagination";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Upload, Image } from "lucide-react";
import { toast } from "sonner";

interface Banner {
  id: string;
  image_url: string;
  title: string;
  sort_order: number;
  is_active: boolean;
}

const BannerManagement = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    image_url: "",
    title: "",
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("sort_order");

    if (error) {
      toast.error("获取轮播图失败");
      return;
    }

    setBanners(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingBanner) {
      const { error } = await supabase
        .from("banners")
        .update(formData)
        .eq("id", editingBanner.id);

      if (error) {
        toast.error("更新失败");
        return;
      }
      toast.success("更新成功");
    } else {
      const { error } = await supabase.from("banners").insert(formData);

      if (error) {
        toast.error("添加失败");
        return;
      }
      toast.success("添加成功");
    }

    setDialogOpen(false);
    resetForm();
    fetchBanners();
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      image_url: banner.image_url,
      title: banner.title,
      sort_order: banner.sort_order,
      is_active: banner.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这张轮播图吗？")) return;

    const { error } = await supabase.from("banners").delete().eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }

    toast.success("删除成功");
    fetchBanners();
  };

  const resetForm = () => {
    setEditingBanner(null);
    setFormData({
      image_url: "",
      title: "",
      sort_order: 0,
      is_active: true,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    // 验证文件大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过5MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 获取公开URL
      const { data: { publicUrl } } = supabase.storage
        .from("banners")
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("图片上传成功");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("上传失败: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="gov-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="gov-card-title">轮播图管理</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              添加轮播图
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBanner ? "编辑轮播图" : "添加轮播图"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>上传图片</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? "上传中..." : "选择图片"}
                  </Button>
                  {formData.image_url && (
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      已上传
                    </span>
                  )}
                </div>
                {formData.image_url && (
                  <div className="mt-2 relative w-full h-32 bg-muted rounded-lg overflow-hidden">
                    <img
                      src={formData.image_url}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">或输入图片地址</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="请输入图片URL"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="请输入轮播图标题"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">排序（数字越小越靠前）</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
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
                <Button type="submit">保存</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : banners.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无轮播图</div>
        ) : (
          <BannerTable banners={banners} onEdit={handleEdit} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
};

// 抽取表格组件以支持分页
const BannerTable = ({ 
  banners, 
  onEdit, 
  onDelete 
}: { 
  banners: Banner[]; 
  onEdit: (banner: Banner) => void; 
  onDelete: (id: string) => void; 
}) => {
  const pagination = usePagination(banners);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">预览</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-20">排序</TableHead>
            <TableHead className="w-20">状态</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.map((banner) => (
            <TableRow key={banner.id}>
              <TableCell>
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-16 h-10 object-cover rounded"
                />
              </TableCell>
              <TableCell className="font-medium">{banner.title}</TableCell>
              <TableCell>{banner.sort_order}</TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-1 rounded ${banner.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {banner.is_active ? "启用" : "禁用"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(banner)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(banner.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        canGoNext={pagination.canGoNext}
        canGoPrevious={pagination.canGoPrevious}
        onPageChange={pagination.setCurrentPage}
        onPageSizeChange={pagination.setPageSize}
        goToNextPage={pagination.goToNextPage}
        goToPreviousPage={pagination.goToPreviousPage}
      />
    </>
  );
};

export default BannerManagement;
