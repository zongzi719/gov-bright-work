# Laravel 政务服务平台接口 - 完整参考文档

> 此文档保存了原 Laravel 项目中政务服务平台对接的完整代码，供重写为 Node.js/React 时参考。

---

## 1. 路由定义 (routes/api_general.php)

```php
Route::namespace("GovernmentService")->name("governmentService.")->prefix("governmentService")->group(function (){
    Route::post('message/subscription', [CJGovController::class, 'messageSubscription']);
    Route::post("getDepartmentInfo", [CJGovController::class, 'getDepartmentInfo']);
    Route::post("getUserInfo", [CJGovController::class, 'getUserInfo']);
    Route::post("sso/challenge", [CJGovController::class, 'getChallenge']);
    Route::post("sso/verifyTicket", [CJGovController::class, 'verifyTicket']);
});
```

---

## 2. 控制器 (CJGovController.php)

```php
<?php

namespace App\Http\Controllers\OtherPlatformApi\GovernmentService;

use App\Services\OtherPlatformApi\GovernmentService\CJGovService;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;

class CJGovController extends Controller 
{
    private $cjGovService;

    public function __construct()
    {
        $this->cjGovService = new CJGovService();
    }

    public function messageSubscription(Request $request)
    {
        $rawXml = $request->input('request', '');
        $rs = $this->cjGovService->messageSubscription(['rawBody' => $rawXml]);
        Log::channel('cj_message_subscription')->info('CJ项目-返回响应报文', ['data' => $rs['data']]);
        return response($rs['data'], 200)->header('Content-Type', 'application/xml; charset=utf-8');
    }

    public function getChallenge(Request $request)
    {
        $rs = $this->cjGovService->getChallenge();
        return $this->success($rs);
    }

    public function verifyTicket(Request $request)
    {
        $param = $request->only(['challenge', 'identityticket']);
        $rs    = $this->cjGovService->verifyTicket($param);
        return $this->success($rs);
    }

    public function getDepartmentInfo(Request $request)
    {
        $param = $request->input();
        $rs = $this->cjGovService->getDepartmentInfo($param);
        Log::channel('cj_get_department_info')->info('CJ项目-返回响应报文', ['data' => $rs['data']]);
        return response($rs['data'], 200)->header('Content-Type', 'application/xml; charset=utf-8');
    }

    public function getUserInfo(Request $request)
    {
        $param = $request->input();
        $rs = $this->cjGovService->getUserInfo($param);
        Log::channel('cj_get_user_info')->info('CJ项目-返回响应报文', ['data' => $rs['data']]);
        return response($rs['data'], 200)->header('Content-Type', 'application/xml; charset=utf-8');
    }
}
```

---

## 3. 配置文件 (config/cj_gov.php)

```php
<?php
return [
    'app_code' => env('CJ_GOV_APP_CODE', '86b3f025-9f36-4ea9-ae12-50d758eba122'),
    'rms_id' => env('CJ_GOV_RMS_ID', '3751f35b-e8b1-41a7-b7fd-948bc25f1c93'),
    'get_user_info_url' => env('CJ_GOV_GET_USER_INFO_URL', 'http://172.17.0.1:30318/GetUserInfoJson'),
    'get_department_info_url' => env('CJ_GOV_GET_DEPARTMENT_INFO_URL', 'http://172.17.0.1:30318/GetOrganizationInfoJson'),
    'challenge_url'     => env('CJ_GOV_CHALLENGE_URL',     'http://172.17.0.1:10318/GeneratorChallenge'),
    'verify_ticket_url' => env('CJ_GOV_VERIFY_TICKET_URL', 'http://172.17.0.1:10318/VerifyIdentity'),
    'app_server_id' => env('CJ_GOV_APP_SERVER_ID', ''),
    'cert_file' => env('CJ_GOV_CERT_FILE', storage_path('certs/cj_gov.crt')),
    'key_file'  => env('CJ_GOV_KEY_FILE', storage_path('certs/cj_gov.key')),
];
```

---

## 4. 服务层完整代码 (CJGovService.php) - 478行

```php
<?php

namespace App\Services\OtherPlatformApi\GovernmentService;

use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client;

class CJGovService
{
    private string $rmsId;
    private string $certFile;
    private string $keyFile;
    private string $getUserInfoUrl;
    private string $getDepartmentInfoUrl;
    private string $challengeUrl;
    private string $verifyTicketUrl;
    private string $appServerId;

    public function __construct()
    {
        $this->rmsId          = config('cj_gov.rms_id', 'YOUR_RMS_ID');
        $this->certFile       = config('cj_gov.cert_file', storage_path('certs/cj_gov.crt'));
        $this->keyFile        = config('cj_gov.key_file', storage_path('certs/cj_gov.key'));
        $this->getUserInfoUrl      = config('cj_gov.get_user_info_url', 'http://192.168.5.66:30318/GetUserInfoJson');
        $this->getDepartmentInfoUrl = config('cj_gov.get_department_info_url', 'http://192.168.5.66:30318/GetOrganizationInfoJson');
        $this->challengeUrl        = config('cj_gov.challenge_url',     '');
        $this->verifyTicketUrl     = config('cj_gov.verify_ticket_url', '');
        $this->appServerId         = config('cj_gov.app_server_id',     '');
    }

    // =========================================================================
    // 模块1：消息订阅（被动接收 RMS 推送）
    // =========================================================================

    /**
     * 消息订阅入口：解析 envelope XML，遍历 resources 处理 User/Organization
     */
    public function messageSubscription(array $param): array
    {
        try {
            $rawXml    = $param['rawBody'] ?? '';
            $resources = $this->parseEnvelope($rawXml);

            foreach ($resources as $resource) {
                if ($resource['type'] === 'User') {
                    $this->handleUserResource($resource);
                } elseif ($resource['type'] === 'Organization') {
                    $this->handleOrganizationResource($resource);
                }
            }

            $responseEnvelopeXml = $this->buildResponseEnvelope('0', '处理成功');
            return ['code' => 0, 'message' => '消息订阅接口处理成功', 'data' => $responseEnvelopeXml];
        } catch (\Exception $e) {
            $responseEnvelopeXml = $this->buildResponseEnvelope('1', $e->getMessage());
            return ['code' => 1, 'message' => '消息订阅接口处理失败', 'data' => $responseEnvelopeXml];
        }
    }

    // =========================================================================
    // 模块2：主动拉取用户/部门信息
    // =========================================================================

    public function getUserInfo($param)
    {
        try {
            $contentXml  = $this->buildResourcesXml('User', $param);
            $envelopeXml = $this->buildEnvelope($contentXml);
            $responseXml = $this->sendRequest($envelopeXml, $this->getUserInfoUrl);

            $resources = $this->parseEnvelope($responseXml);
            $users = array_values(array_filter($resources, fn($r) => $r['type'] === 'User'));

            return ['code' => 0, 'message' => '获取用户信息成功', 'data' => $responseXml];
        } catch (\Exception $e) {
            return ['code' => 1, 'message' => '获取用户信息失败', 'data' => $this->buildResponseEnvelope('1', $e->getMessage())];
        }
    }

    public function getDepartmentInfo($param)
    {
        try {
            $contentXml  = $this->buildResourcesXml('Organization', $param);
            $envelopeXml = $this->buildEnvelope($contentXml);
            $responseXml = $this->sendRequest($envelopeXml, $this->getDepartmentInfoUrl);

            $resources    = $this->parseEnvelope($responseXml);
            $departments  = array_values(array_filter($resources, fn($r) => $r['type'] === 'Organization'));

            return ['code' => 0, 'message' => '获取部门信息成功', 'data' => $responseXml];
        } catch (\Exception $e) {
            return ['code' => 1, 'message' => '获取部门信息失败', 'data' => $this->buildResponseEnvelope('1', $e->getMessage())];
        }
    }

    // =========================================================================
    // 模块3：单点登录 (SSO)
    // =========================================================================

    /**
     * 获取随机数 - POST 到 AS 服务的 GeneratorChallenge 接口
     * 请求体为空，返回纯文本 challenge 字符串
     */
    public function getChallenge(): array
    {
        try {
            $client   = new Client(['timeout' => 10]);
            $response = $client->post($this->challengeUrl, ['body' => '']);
            $challenge = trim((string)$response->getBody());
            return ['code' => 0, 'message' => '获取随机数成功', 'data' => $challenge];
        } catch (\Exception $e) {
            return ['code' => 1, 'message' => '获取随机数失败: ' . $e->getMessage()];
        }
    }

    /**
     * 验证票据 - 发送 XML 到 AS 服务的 VerifyIdentity 接口
     * 
     * 请求格式（text/xml）：
     *   <verifyidentityticketreq version="1">
     *     <challenge>随机数</challenge>
     *     <identityticket>票据</identityticket>
     *     <appserverid>资源系统编码</appserverid>
     *   </verifyidentityticketreq>
     * 
     * 响应解析：两层结构
     *   第1层：<verifyidentityticketresp> → result 节点（BASE64编码）
     *   第2层：BASE64解码 → <verifyidentityticketresult>
     *     - result=0 成功, result=1 失败
     *     - userinfo.rmsid: 标准模式为纯rmsid；定制模式为 base64(xml)
     *     - userinfo.name: 用户姓名
     * 
     * rmsid 定制模式兼容：
     *   如果 rmsid 解码后包含 <user>，则再解析取 rmsid 和 account
     */
    public function verifyTicket(array $param): array
    {
        try {
            $challenge      = $param['challenge']      ?? '';
            $identityTicket = $param['identityticket'] ?? '';

            $appServerId    = htmlspecialchars($this->appServerId, ENT_XML1);
            $challengeEsc   = htmlspecialchars($challenge,        ENT_XML1);
            $ticketEsc      = htmlspecialchars($identityTicket,   ENT_XML1);

            $requestXml = <<<XML
<verifyidentityticketreq version="1">
    <challenge>{$challengeEsc}</challenge>
    <identityticket>{$ticketEsc}</identityticket>
    <appserverid>{$appServerId}</appserverid>
</verifyidentityticketreq>
XML;

            $client      = new Client(['timeout' => 30]);
            $response    = $client->post($this->verifyTicketUrl, [
                'headers' => ['Content-Type' => 'text/xml; charset=utf-8'],
                'body'    => $requestXml,
            ]);
            $responseXml = (string)$response->getBody();

            // 第1层：解析 verifyidentityticketresp
            $resp      = $this->loadXml($responseXml);
            $resultB64 = (string)($resp->result ?? '');
            if ($resultB64 === '') {
                throw new \RuntimeException('响应中未找到 result 节点');
            }

            // 第2层：BASE64 解码后解析 verifyidentityticketresult
            $resultXml  = base64_decode($resultB64);
            $result     = $this->loadXml($resultXml);
            $resultCode = (string)($result->result ?? '1');

            if ($resultCode !== '0') {
                $error = (string)($result->error ?? '未知错误');
                throw new \RuntimeException('票据验证失败: ' . $error);
            }

            // 解析 rmsid（兼容标准模式和定制模式）
            $rmsidRaw = (string)($result->userinfo->rmsid ?? '');
            $account  = '';
            $rmsid    = $rmsidRaw;

            // 定制模式：rmsid 是 base64(<user>xml</user>)
            $decoded = base64_decode($rmsidRaw, true);
            if ($decoded !== false && str_contains($decoded, '<user>')) {
                $userXml = $this->loadXml($decoded);
                $rmsid   = (string)($userXml->rmsid  ?? $rmsidRaw);
                $account = (string)($userXml->account ?? '');
            }

            $name = (string)($result->userinfo->name ?? '');

            return [
                'code'    => 0,
                'message' => '票据验证成功',
                'data'    => [
                    'rmsid'   => $rmsid,
                    'name'    => $name,
                    'account' => $account,
                ],
            ];
        } catch (\Exception $e) {
            return ['code' => 1, 'message' => $e->getMessage()];
        }
    }

    // =========================================================================
    // XML 构建方法
    // =========================================================================

    /**
     * 构建响应 envelope XML（用于消息订阅的响应和错误响应）
     * 
     * 结构：envelope → signatureContent(BASE64) → result
     */
    private function buildResponseEnvelope(string $code, string $message): string
    {
        $status     = ($code === '0') ? '0' : '1';
        $failReason = ($code === '0') ? '' : htmlspecialchars($message, ENT_XML1);
        $nonce      = $this->generateNonce();

        $signatureContentXml = <<<XML
<signatureContent>
    <nonce>{$nonce}</nonce>
    <content>
        <result version="1.0">
            <status>{$status}</status>
            <failReason>{$failReason}</failReason>
        </result>
    </content>
</signatureContent>
XML;
        $signatureContentB64 = base64_encode($signatureContentXml);

        return <<<XML
<envelope version="1.0">
    <type>0</type>
    <signAlgOid></signAlgOid>
    <signature></signature>
    <signatureContent>{$signatureContentB64}</signatureContent>
</envelope>
XML;
    }

    /**
     * 构建请求 resources XML（主动拉取用）
     * no 留空 = 查全量；传入 no = 查单条
     */
    private function buildResourcesXml(string $resourceType, array $param): string
    {
        $source = htmlspecialchars($this->rmsId, ENT_XML1);
        $no     = htmlspecialchars($param['no'] ?? '', ENT_XML1);
        $rmsid  = htmlspecialchars($param['rmsid'] ?? $this->rmsId, ENT_XML1);

        return <<<XML
<resources source="{$source}" version="1.0">
    <operation>
        <resourcetype>{$resourceType}</resourcetype>
        <sequenceno></sequenceno>
        <from></from>
        <to></to>
        <receiver></receiver>
        <requesttype>query</requesttype>
        <memo></memo>
        <reshare></reshare>
        <reoperate></reoperate>
    </operation>
    <resource type="{$resourceType}" no="{$no}" rmsid="{$rmsid}" version="1.0" />
</resources>
XML;
    }

    /**
     * 封装 content XML 为 envelope XML（type=0 明文，signatureContent 做 BASE64）
     */
    private function buildEnvelope(string $contentXml): string
    {
        $nonce = $this->generateNonce();

        $signatureContentXml = <<<XML
<signatureContent>
    <nonce>{$nonce}</nonce>
    <content>
        {$contentXml}
    </content>
</signatureContent>
XML;
        $signatureContentB64 = base64_encode($signatureContentXml);

        return <<<XML
<envelope version="1.0">
    <type>0</type>
    <signAlgOid></signAlgOid>
    <signature></signature>
    <signatureContent>{$signatureContentB64}</signatureContent>
</envelope>
XML;
    }

    // =========================================================================
    // XML 解析方法
    // =========================================================================

    /**
     * 解析 envelope XML，返回 resource 数组
     * 
     * 每个元素结构：
     *   type       - User / Organization
     *   no         - 唯一编码
     *   name       - 名称
     *   status     - 0在用 1停用 2销毁
     *   parent_org - OID 1.2.156.10197.6.1.2.301.2.106 的值（Organization 父组织编码）
     *   belong_org - OID 1.2.156.10197.6.1.2.301.2.107 的值（User 所属组织编码）
     */
    private function parseEnvelope(string $envelopeXml): array
    {
        // step1: 解析最外层 envelope
        $env = $this->loadXml($envelopeXml);
        $securityType        = (int)($env->type ?? 0);
        $signatureContentB64 = (string)($env->signatureContent ?? '');

        // 验签（type >= 1 时）
        if ($securityType >= 1) {
            $signature = (string)($env->signature ?? '');
            $this->pkcs7Verify($signatureContentB64, $signature);
        }

        // step2: BASE64 解码 signatureContent
        $signatureContentXml = base64_decode($signatureContentB64);
        if ($signatureContentXml === false || $signatureContentXml === '') {
            throw new \RuntimeException('signatureContent BASE64 解码失败');
        }

        // step3: 解析 signatureContent，提取 resources
        $sc        = $this->loadXml($signatureContentXml);
        $resources = $sc->content->resources ?? null;
        if ($resources === null) {
            throw new \RuntimeException('signatureContent 中未找到 resources 节点');
        }

        // step4: 遍历 resource，提取 User 和 Organization
        $result = [];
        foreach ($resources->resource as $resource) {
            $resourceType = (string)$resource['type'];
            if (!in_array($resourceType, ['User', 'Organization'], true)) {
                continue;
            }

            // 从 properties 里按 OID 提取属性
            $parentOrg = null;
            $belongOrg = null;
            foreach ($resource->properties->property ?? [] as $prop) {
                $oid = (string)$prop['oid'];
                if ($oid === '1.2.156.10197.6.1.2.301.2.106') {
                    $parentOrg = (string)$prop['value'];
                } elseif ($oid === '1.2.156.10197.6.1.2.301.2.107') {
                    $belongOrg = (string)$prop['value'];
                }
            }

            $result[] = [
                'type'       => $resourceType,
                'no'         => (string)$resource['no'],
                'name'       => (string)$resource->name,
                'status'     => (int)$resource->status,
                'parent_org' => $parentOrg,
                'belong_org' => $belongOrg,
            ];
        }

        return $result;
    }

    // =========================================================================
    // 业务处理 & 工具方法
    // =========================================================================

    private function handleUserResource(array $resource): void
    {
        // TODO: 根据 $resource['no'] 查询本地数据库，没有则新增，有则修改，status=2 则删除
    }

    private function handleOrganizationResource(array $resource): void
    {
        // TODO: 根据 $resource['no'] 查询本地数据库，没有则新增，有则修改，status=2 则删除
    }

    private function pkcs7Verify(string $data, string $signatureB64): void
    {
        // TODO: 使用对方公钥证书验证签名
    }

    private function generateNonce(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    private function loadXml(string $xml): \SimpleXMLElement
    {
        libxml_use_internal_errors(true);
        $obj = simplexml_load_string($xml);
        if ($obj === false) {
            $errors = array_map(fn($e) => $e->message, libxml_get_errors());
            libxml_clear_errors();
            throw new \RuntimeException('XML 解析失败: ' . implode('; ', $errors));
        }
        return $obj;
    }

    private function sendRequest(string $envelopeXml, string $url): string
    {
        $client   = new Client(['timeout' => 30]);
        $response = $client->post($url, [
            'form_params' => ['request' => $envelopeXml],
        ]);
        return (string)$response->getBody();
    }
}
```

---

## 5. 环境变量配置

```env
CJ_GOV_APP_CODE=86b3f025-9f36-4ea9-ae12-50d758eba122
CJ_GOV_RMS_ID=3751f35b-e8b1-41a7-b7fd-948bc25f1c93
CJ_GOV_GET_USER_INFO_URL=http://172.17.0.1:30318/GetUserInfoJson
CJ_GOV_GET_DEPARTMENT_INFO_URL=http://172.17.0.1:30318/GetOrganizationInfoJson
CJ_GOV_CHALLENGE_URL=http://172.17.0.1:10318/GeneratorChallenge
CJ_GOV_VERIFY_TICKET_URL=http://172.17.0.1:10318/VerifyIdentity
CJ_GOV_APP_SERVER_ID=
```

---

## 6. 关键技术要点总结

| 要点 | 说明 |
|------|------|
| XML 3层嵌套 | `envelope` → `signatureContent`(BASE64) → `content/resources` |
| 消息订阅请求格式 | `application/x-www-form-urlencoded`，XML 放在 `request` 字段 |
| SSO 验证票据请求格式 | `text/xml; charset=utf-8`，直接发 XML body |
| SSO challenge | POST 空 body 到 AS 服务，返回纯文本 |
| rmsid 定制模式 | rmsid 可能是 `base64(<user><rmsid>...</rmsid><account>...</account></user>)` |
| OID 映射 | `1.2.156.10197.6.1.2.301.2.106` = 父组织编码，`1.2.156.10197.6.1.2.301.2.107` = 所属组织编码 |
| resource status | 0=在用，1=停用，2=销毁 |
| PKCS#7 签名 | 目前 TODO，type>=1 时需验签 |
