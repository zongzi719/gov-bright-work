import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 获取 as_server 地址，优先使用环境变量，否则使用默认值
const getAsServerUrl = (): string => {
  return Deno.env.get("CJ_GOV_AS_SERVER_URL") || "http://localhost:10318";
};

const getAppServerId = (): string => {
  return Deno.env.get("CJ_GOV_APP_SERVER_ID") || "cjgov-app-001";
};

// 解析 XML 中指定标签的值（简易解析）
function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

// Base64 解码
function base64Decode(str: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(str), (c) => c.charCodeAt(0)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // ========== 1. 获取随机数（challenge） ==========
    if (path === "challenge") {
      const asServerUrl = getAsServerUrl();
      console.log(`[SSO] Requesting challenge from ${asServerUrl}/GeneratorChallenge`);

      const resp = await fetch(`${asServerUrl}/GeneratorChallenge`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
      });

      if (!resp.ok) {
        throw new Error(`as_server returned ${resp.status}`);
      }

      const xmlText = await resp.text();
      console.log("[SSO] Challenge response:", xmlText);

      // 从响应中提取 challenge 值
      const challenge = extractXmlValue(xmlText, "challenge");

      return new Response(
        JSON.stringify({ success: true, challenge, raw: xmlText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== 2. 验证票据（verify） ==========
    if (path === "verify") {
      const body = await req.json();
      const { challenge, identityTicket } = body;

      if (!challenge || !identityTicket) {
        return new Response(
          JSON.stringify({ success: false, error: "缺少 challenge 或 identityTicket 参数" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const asServerUrl = getAsServerUrl();
      const appServerId = getAppServerId();

      // 构造验证请求 XML
      const verifyXml = `<?xml version="1.0" encoding="UTF-8"?>
<verifyidentityticketreq version="1">
  <challenge>${challenge}</challenge>
  <identityticket>${identityTicket}</identityticket>
  <appserverid>${appServerId}</appserverid>
</verifyidentityticketreq>`;

      console.log(`[SSO] Verifying ticket at ${asServerUrl}/VerifyIdentity`);

      const resp = await fetch(`${asServerUrl}/VerifyIdentity`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: verifyXml,
      });

      if (!resp.ok) {
        throw new Error(`as_server returned ${resp.status}`);
      }

      const xmlText = await resp.text();
      console.log("[SSO] Verify response received");

      // 解析响应，提取 result（base64 编码的原文）
      const resultBase64 = extractXmlValue(xmlText, "result");

      if (!resultBase64) {
        return new Response(
          JSON.stringify({ success: false, error: "验证响应中无 result 数据" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Base64 解码得到原文 XML
      const resultXml = base64Decode(resultBase64);
      console.log("[SSO] Decoded result XML:", resultXml);

      // 检查验证结果
      const resultCode = extractXmlValue(resultXml, "result");
      if (resultCode !== "0") {
        const errorMsg = extractXmlValue(resultXml, "error");
        return new Response(
          JSON.stringify({ success: false, error: errorMsg || "票据验证失败", resultCode }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 提取用户标识 rmsid
      const rmsid = extractXmlValue(resultXml, "rmsid");
      console.log("[SSO] Extracted rmsid:", rmsid);

      if (!rmsid) {
        return new Response(
          JSON.stringify({ success: false, error: "无法从验证结果中提取用户标识 rmsid" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 在 contacts 表中查找匹配的用户
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("id, name, mobile, position, department, organization_id, security_level, is_leader, rmsid")
        .eq("rmsid", rmsid)
        .eq("is_active", true)
        .single();

      if (contactError || !contact) {
        console.error("[SSO] User not found for rmsid:", rmsid, contactError);
        return new Response(
          JSON.stringify({ success: false, error: `未找到匹配的用户（rmsid: ${rmsid}）`, rmsid }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 获取组织名称
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", contact.organization_id)
        .single();

      console.log("[SSO] User matched:", contact.name);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: contact.id,
            name: contact.name,
            mobile: contact.mobile,
            position: contact.position,
            department: contact.department,
            organization: org?.name || "",
            organization_id: contact.organization_id,
            security_level: contact.security_level || "一般",
            is_leader: contact.is_leader || false,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "未知的请求路径，支持: /challenge, /verify" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SSO] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
