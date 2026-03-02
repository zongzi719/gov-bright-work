// 政务服务平台 - 消息订阅接口（无需鉴权，供信任体系直接调用）

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============ XML 工具方法 ============

function generateNonce(): string {
  const hex = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Deno 环境下的 Base64 编解码（支持 UTF-8）
function toBase64(str: string): string {
  return btoa(
    new TextEncoder()
      .encode(str)
      .reduce((acc, byte) => acc + String.fromCharCode(byte), "")
  );
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/** 构建响应 envelope XML */
function buildResponseEnvelope(code: string, message: string): string {
  const status = code === "0" ? "0" : "1";
  const failReason = code === "0" ? "" : escapeXml(message);
  const nonce = generateNonce();

  const signatureContentXml = `<signatureContent>
    <nonce>${nonce}</nonce>
    <content>
        <result version="1.0">
            <status>${status}</status>
            <failReason>${failReason}</failReason>
        </result>
    </content>
</signatureContent>`;

  const signatureContentB64 = toBase64(signatureContentXml);

  return `<envelope version="1.0">
    <type>0</type>
    <signAlgOid></signAlgOid>
    <signature></signature>
    <signatureContent>${signatureContentB64}</signatureContent>
</envelope>`;
}

// ============ 简易 XML 解析 ============

/** 获取 XML 节点文本内容 */
function getXmlText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/** 获取 XML 节点属性值 */
function getXmlAttr(xml: string, attr: string): string {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

interface ParsedResource {
  type: string;
  no: string;
  name: string;
  status: number;
  parent_org: string | null;
  belong_org: string | null;
}

/**
 * 解析 envelope XML，返回 resource 数组
 * 
 * 3层结构：
 *   envelope → signatureContent(BASE64) → content/resources/resource
 */
function parseEnvelope(envelopeXml: string): ParsedResource[] {
  // step1: 解析最外层 envelope
  const securityType = parseInt(getXmlText(envelopeXml, "type") || "0", 10);
  const signatureContentB64 = getXmlText(envelopeXml, "signatureContent");

  if (!signatureContentB64) {
    throw new Error("envelope 中未找到 signatureContent 节点");
  }

  // 验签占位（type >= 1 时）
  if (securityType >= 1) {
    const signature = getXmlText(envelopeXml, "signature");
    console.log("[PKCS#7] TODO: 验签逻辑待实现", { securityType, signature: signature.substring(0, 50) });
  }

  // step2: BASE64 解码 signatureContent
  let signatureContentXml: string;
  try {
    signatureContentXml = fromBase64(signatureContentB64);
  } catch {
    throw new Error("signatureContent BASE64 解码失败");
  }

  if (!signatureContentXml) {
    throw new Error("signatureContent BASE64 解码结果为空");
  }

  console.log("[parseEnvelope] signatureContent 解码成功, 长度:", signatureContentXml.length);

  // step3: 提取 content 中的 resources
  const contentXml = getXmlText(signatureContentXml, "content");
  if (!contentXml) {
    throw new Error("signatureContent 中未找到 content 节点");
  }

  const resourcesXml = getXmlText(contentXml, "resources");
  if (!resourcesXml) {
    throw new Error("content 中未找到 resources 节点");
  }

  // step4: 遍历所有 resource 节点
  const result: ParsedResource[] = [];
  const resourceRegex = /<resource\s[^>]*>[\s\S]*?<\/resource>/gi;
  const resourceMatches = resourcesXml.match(resourceRegex) || [];

  for (const resourceXml of resourceMatches) {
    const resourceType = getXmlAttr(resourceXml, "type");
    if (resourceType !== "User" && resourceType !== "Organization") {
      console.log("[parseEnvelope] 跳过非 User/Organization 资源:", resourceType);
      continue;
    }

    // 从 properties 按 OID 提取属性
    let parentOrg: string | null = null;
    let belongOrg: string | null = null;

    const propertyRegex = /<property\s[^>]*\/>/gi;
    const propertyMatches = resourceXml.match(propertyRegex) || [];

    for (const propXml of propertyMatches) {
      const oid = getXmlAttr(propXml, "oid");
      const value = getXmlAttr(propXml, "value");
      if (oid === "1.2.156.10197.6.1.2.301.2.106") {
        parentOrg = value;
      } else if (oid === "1.2.156.10197.6.1.2.301.2.107") {
        belongOrg = value;
      }
    }

    result.push({
      type: resourceType,
      no: getXmlAttr(resourceXml, "no"),
      name: getXmlText(resourceXml, "name"),
      status: parseInt(getXmlText(resourceXml, "status") || "0", 10),
      parent_org: parentOrg,
      belong_org: belongOrg,
    });
  }

  return result;
}

// ============ 主处理逻辑 ============

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 支持两种请求格式：
    // 1. application/x-www-form-urlencoded（标准信任体系格式），XML 在 request 字段
    // 2. application/xml 或 text/xml（直接发 XML body）
    const contentType = req.headers.get("content-type") || "";
    let rawXml = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      // 不能使用 URLSearchParams，因为它会将 base64 中的 + 号转换为空格，
      // 导致 signatureContent 的 base64 解码结果被破坏
      rawXml = extractFormValue(body, "request");
    } else if (contentType.includes("xml")) {
      rawXml = await req.text();
    } else {
      // 尝试作为文本解析
      const body = await req.text();
      if (body.includes("request=")) {
        rawXml = extractFormValue(body, "request");
      } else {
        rawXml = body;
      }
    }

    console.log("[messageSubscription] 收到请求, Content-Type:", contentType, ", XML长度:", rawXml.length);

    if (!rawXml) {
      throw new Error("未收到有效的 XML 数据");
    }

    // 解析 envelope
    const resources = parseEnvelope(rawXml);
    console.log("[messageSubscription] 解析成功, 资源数量:", resources.length);

    // 处理每个资源
    for (const resource of resources) {
      if (resource.type === "User") {
        console.log("[handleUser]", JSON.stringify(resource));
        // TODO: 存入数据库
      } else if (resource.type === "Organization") {
        console.log("[handleOrganization]", JSON.stringify(resource));
        // TODO: 存入数据库
      }
    }

    // 返回成功的 envelope XML
    const responseXml = buildResponseEnvelope("0", "处理成功");
    console.log("[messageSubscription] 返回响应报文");

    return new Response(responseXml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("[messageSubscription] 处理失败:", e.message);

    const responseXml = buildResponseEnvelope("1", e.message);
    return new Response(responseXml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  }
});
