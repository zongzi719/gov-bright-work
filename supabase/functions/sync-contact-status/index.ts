import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 使用服务端密钥创建 Supabase 客户端
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 调用数据库函数同步状态
    const { data, error } = await supabase.rpc("sync_contact_status");

    if (error) {
      console.error("同步联系人状态失败:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const result = data?.[0] || { updated_count: 0, details: [] };
    
    console.log(`状态同步完成: 更新了 ${result.updated_count} 条记录`);
    if (result.updated_count > 0) {
      console.log("详情:", JSON.stringify(result.details));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated_count: result.updated_count,
        details: result.details,
        synced_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (err) {
    console.error("Edge Function 执行错误:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
