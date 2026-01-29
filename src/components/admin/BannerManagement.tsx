import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Image } from "lucide-react";
import { toast } from "sonner";

interface Banner {
  id: string;
  image_url: string;
  title: string;
  sort_order: number;
  is_active: boolean;
}

const BannerManagement = () => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    image_url: "",
    title: "导航栏背景",
  });

  useEffect(() => {
    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    const { data, error } = await supabase.from("banners").select("*").order("sort_order").limit(1).single();

    if (!error && data) {
      setBanner(data);
      setFormData({
        image_url: data.image_url,
        title: data.title || "导航栏背景",
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.image_url) {
      toast.error("请上传背景图片");
      return;
    }

    setSaving(true);
    try {
      if (banner) {
        // 更新现有记录
        const { error } = await supabase
          .from("banners")
          .update({
            image_url: formData.image_url,
            title: formData.title,
            is_active: true,
          })
          .eq("id", banner.id);

        if (error) throw error;
        toast.success("背景更新成功");
      } else {
        // 创建新记录
        const { error } = await supabase.from("banners").insert({
          image_url: formData.image_url,
          title: formData.title,
          sort_order: 1,
          is_active: true,
        });

        if (error) throw error;
        toast.success("背景设置成功");
      }
      fetchBanner();
    } catch (error: any) {
      toast.error("保存失败: " + error.message);
    } finally {
      setSaving(false);
    }
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
      const fileName = `header-bg-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("banners").upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // 获取公开URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("banners").getPublicUrl(filePath);

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

  const handleClear = async () => {
    if (!banner) return;

    if (!confirm("确定要清除导航栏背景图吗？")) return;

    const { error } = await supabase.from("banners").delete().eq("id", banner.id);

    if (error) {
      toast.error("清除失败");
      return;
    }

    toast.success("已清除背景图");
    setBanner(null);
    setFormData({ image_url: "", title: "导航栏背景" });
  };

  return (
    <div className="gov-card">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="gov-card-title">导航栏背景管理</h2>
        <p className="text-sm text-muted-foreground mt-1">设置顶部导航栏的背景图片（只允许上传一张）</p>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            {/* 当前背景预览 */}
            <div className="space-y-2">
              <Label>当前背景</Label>
              {formData.image_url ? (
                <div className="relative w-full h-24 bg-muted rounded-lg overflow-hidden border">
                  <img src={formData.image_url} alt="导航栏背景预览" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/60 flex items-center px-4">
                    <span className="text-white font-bold text-lg">xx州党政办公平台</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-24 bg-header-gradient rounded-lg flex items-center px-4 border">
                  <span className="text-white font-bold text-lg">xx州党政办公平台（默认渐变背景）</span>
                </div>
              )}
            </div>

            {/* 上传新背景 */}
            <div className="space-y-2">
              <Label>上传背景图</Label>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
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
                <span className="text-sm text-muted-foreground">建议尺寸：1920×48 像素，支持 JPG/PNG，最大 5MB</span>
              </div>
            </div>

            {/* 或输入URL */}
            <div className="space-y-2">
              <Label htmlFor="image_url">或输入图片地址</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="请输入图片URL"
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving || !formData.image_url}>
                {saving ? "保存中..." : "保存设置"}
              </Button>
              {banner && (
                <Button type="button" variant="outline" onClick={handleClear}>
                  清除背景图
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BannerManagement;
