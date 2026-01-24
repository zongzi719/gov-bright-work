-- 创建 banners 存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- 允许已认证用户上传文件
CREATE POLICY "Authenticated users can upload banner images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners');

-- 允许已认证用户更新自己的文件
CREATE POLICY "Authenticated users can update banner images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'banners');

-- 允许已认证用户删除文件
CREATE POLICY "Authenticated users can delete banner images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'banners');

-- 允许公开访问读取文件
CREATE POLICY "Anyone can view banner images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners');