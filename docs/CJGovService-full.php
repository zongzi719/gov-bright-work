<?php

namespace App\Services\OtherPlatformApi\GovernmentService;

use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client;

class CJGovService
{
    // 信任体系 RMS 编码（本系统编码）
    private string $rmsId;

    // 本系统证书路径（PEM 格式），用于 PKCS#7 签名
    private string $certFile;
    private string $keyFile;

    // 主动拉取接口地址
    private string $getUserInfoUrl;
    private string $getDepartmentInfoUrl;

    // 单点登录接口地址
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

    // -------------------------------------------------------------------------
    // 被动接收：信任体系推送过来的消息订阅
    // -------------------------------------------------------------------------

    /**
     * 政务服务平台-消息订阅接口（被动接收推送，解析 envelope XML）
     *
     * @param array $param  包含 rawBody（请求原始 XML 字符串）
     */
    public function messageSubscription(array $param): array
    {
        try {
            Log::channel('cj_message_subscription')->info('CJ项目-收到消息订阅接口请求', $param);
            $rawXml    = $param['rawBody'] ?? '';
            $resources = $this->parseEnvelope($rawXml);
            Log::channel('cj_message_subscription')->info('CJ项目-解析消息订阅接口请求成功', ['resources' => $resources]);

            foreach ($resources as $resource) {
                if ($resource['type'] === 'User') {
                    $this->handleUserResource($resource);
                } elseif ($resource['type'] === 'Organization') {
                    $this->handleOrganizationResource($resource);
                } else {
                    Log::channel('cj_message_subscription')->info('CJ项目-忽略非User/Organization资源', [
                        'type' => $resource['type'],
                        'no'   => $resource['no'],
                    ]);
                }
            }

            $responseEnvelopeXml = $this->buildResponseEnvelope('0', '处理成功');
            return ['code' => 0, 'message' => '消息订阅接口处理成功', 'data' => $responseEnvelopeXml];
        } catch (\Exception $e) {
            Log::channel('cj_message_subscription')->error('CJ项目-消息订阅接口处理失败: ' . $e->getMessage());
            $responseEnvelopeXml = $this->buildResponseEnvelope('1', $e->getMessage());
            return ['code' => 1, 'message' => '消息订阅接口处理失败', 'data' => $responseEnvelopeXml];
        }
    }

    // -------------------------------------------------------------------------
    // envelope 构建（响应用）
    // -------------------------------------------------------------------------

    /**
     * 构建响应 envelope XML
     *
     * 拼装流程：
     *   1. 拼出 result XML 作为 content
     *   2. 封装进 signatureContent XML，做 BASE64
     *   3. 封装进 envelope XML 返回
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

    // -------------------------------------------------------------------------
    // envelope 解析（接收推送时使用）
    // -------------------------------------------------------------------------

    /**
     * 解析 envelope XML，返回 resource 数组。
     *
     * 每个元素结构：
     *   type       - resource 的 type 属性（User / Organization）
     *   no         - resource 的 no 属性（唯一编码）
     *   name       - name 子节点（名称）
     *   status     - status 子节点（0在用 1停用 2销毁）
     *   parent_org - oid=1.2.156.10197.6.1.2.301.2.106 的值（Organization 父组织编码）
     *   belong_org - oid=1.2.156.10197.6.1.2.301.2.107 的值（User 所属组织编码）
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
            // TODO: 使用对方公钥证书完善验签逻辑，验证失败应抛出异常
            $this->pkcs7Verify($signatureContentB64, $signature);
        }

        // step2: BASE64 解码，得到 signatureContent XML
        $signatureContentXml = base64_decode($signatureContentB64);
        if ($signatureContentXml === false || $signatureContentXml === '') {
            throw new \RuntimeException('signatureContent BASE64 解码失败');
        }

        // step3: 解析 signatureContent XML，content 里的 resources 是直接嵌套子节点
        $sc        = $this->loadXml($signatureContentXml);
        $resources = $sc->content->resources ?? null;
        if ($resources === null) {
            throw new \RuntimeException('signatureContent 中未找到 resources 节点');
        }

        // step4: 遍历 resource，只取 User 和 Organization
        $result = [];
        foreach ($resources->resource as $resource) {
            $resourceType = (string)$resource['type'];

            if (!in_array($resourceType, ['User', 'Organization'], true)) {
                continue;
            }

            // 从 properties 里按 OID 提取需要的属性
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

    // -------------------------------------------------------------------------
    // 业务处理：User / Organization
    // -------------------------------------------------------------------------

    /**
     * 处理用户资源（status 0/1 新增或修改，status 2 删除）
     */
    private function handleUserResource(array $resource): void
    {
        Log::channel('cj_message_subscription')->info('CJ项目-处理用户资源', $resource);
        // TODO: 根据 $resource['no'] 查询本地数据库，没有则新增，有则修改，status=2 则删除
    }

    /**
     * 处理组织架构资源（status 0/1 新增或修改，status 2 删除）
     */
    private function handleOrganizationResource(array $resource): void
    {
        Log::channel('cj_message_subscription')->info('CJ项目-处理组织架构资源', $resource);
        // TODO: 根据 $resource['no'] 查询本地数据库，没有则新增，有则修改，status=2 则删除
    }

    // -------------------------------------------------------------------------
    // PKCS#7 验签（占位，实际需实现）
    // -------------------------------------------------------------------------

    private function pkcs7Verify(string $data, string $signatureB64): void
    {
        // TODO: 使用对方公钥证书验证签名，验证失败应抛出异常
        Log::channel('cj_message_subscription')->info('CJ项目-PKCS#7 验签（TODO: 实现验签逻辑）');
    }

    // -------------------------------------------------------------------------
    // 工具方法
    // -------------------------------------------------------------------------

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

    public function getUserInfo($param)
    {
        try {
            Log::channel('cj_get_user_info')->info('CJ项目-主动拉取用户信息', $param);

            $contentXml  = $this->buildResourcesXml('User', $param);
            $envelopeXml = $this->buildEnvelope($contentXml);
            $responseXml = $this->sendRequest($envelopeXml, $this->getUserInfoUrl);

            Log::channel('cj_get_user_info')->info('CJ项目-主动拉取用户信息-原始响应', ['response' => $responseXml]);

            $resources = $this->parseEnvelope($responseXml);
            $users = array_values(array_filter($resources, fn($r) => $r['type'] === 'User'));

            Log::channel('cj_get_user_info')->info('CJ项目-主动拉取用户信息成功', ['count' => count($users)]);
            return ['code' => 0, 'message' => '获取用户信息成功', 'data' => $responseXml];
        } catch (\Exception $e) {
            Log::channel('cj_get_user_info')->error('CJ项目-主动拉取用户信息失败: ' . $e->getMessage());
            return ['code' => 1, 'message' => '获取用户信息失败', 'data' => $this->buildResponseEnvelope('1', $e->getMessage())];
        }
    }

    // -------------------------------------------------------------------------
    // 主动拉取：构建请求报文
    // -------------------------------------------------------------------------

    /**
     * 构建 resources XML（查询请求的 content 内容）
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
     * 把 content XML 封装成 envelope XML（type=0 明文）
     * signatureContent 层做 BASE64，不含 XML 声明头
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

    /**
     * 发送 HTTP 请求，XML 放在 request 字段（application/x-www-form-urlencoded）
     */
    private function sendRequest(string $envelopeXml, string $url): string
    {
        $client   = new Client(['timeout' => 30]);
        $response = $client->post($url, [
            'form_params' => ['request' => $envelopeXml],
        ]);
        return (string)$response->getBody();
    }

    // -------------------------------------------------------------------------
    // 单点登录
    // -------------------------------------------------------------------------

    /**
     * 获取随机数（GeneratorChallenge）
     * 后端调 AS 服务获取随机数，返回给前端；前端用它调 WebSocket 接口拿票据
     */
    public function getChallenge(): array
    {
        try {
            Log::channel('cj_get_challenge')->info('CJ项目-SSO获取随机数');
            $client   = new Client(['timeout' => 10]);
            Log::channel('cj_get_challenge')->info('CJ项目-SSO获取随机数-请求 AS 服务', ['url' => $this->challengeUrl]);
            // 请求体必须为空
            $response = $client->post($this->challengeUrl, ['body' => '']);
            $challenge = trim((string)$response->getBody());
            Log::channel('cj_get_challenge')->info('CJ项目-SSO获取随机数成功', ['challenge' => $challenge]);
            return ['code' => 0, 'message' => '获取随机数成功', 'data' => $challenge];
        } catch (\Exception $e) {
            Log::channel('cj_get_challenge')->error('CJ项目-SSO获取随机数失败: ' . $e->getMessage());
            return ['code' => 1, 'message' => '获取随机数失败: ' . $e->getMessage()];
        }
    }

    /**
     * 验证票据（VerifyIdentityTicket）
     *
     * @param array $param  challenge（随机数）、identityticket（前端票据）
     * @return array  成功时 data 包含 rmsid / name / account
     */
    public function verifyTicket(array $param): array
    {
        try {
            $challenge      = $param['challenge']      ?? '';
            $identityTicket = $param['identityticket'] ?? '';

            Log::channel('cj_verify_ticket')->info('CJ项目-SSO验证票据', ['challenge' => $challenge]);

            // 构建请求 XML
            $appServerId    = htmlspecialchars($this->appServerId, ENT_XML1);
            $challengeEsc   = htmlspecialchars($challenge,        ENT_XML1);
            $ticketEsc      = htmlspecialchars($identityTicket,   ENT_XML1);
            Log::channel('cj_verify_ticket')->info('CJ项目-SSO验证票据-构建请求 XML', ['challenge' => $challengeEsc, 'ticket' => $ticketEsc, 'appServerId' => $appServerId]);

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
            Log::channel('cj_verify_ticket')->info('CJ项目-SSO验证票据-原始响应', ['response' => $responseXml]);

            // 第一层：解析 verifyidentityticketresp
            $resp      = $this->loadXml($responseXml);
            $resultB64 = (string)($resp->result ?? '');
            if ($resultB64 === '') {
                throw new \RuntimeException('响应中未找到 result 节点');
            }

            // 第二层：BASE64 解码后再解析 verifyidentityticketresult
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

            // 定制模式：rmsid 是 base64(xml)，解码后再取 rmsid/account
            $decoded = base64_decode($rmsidRaw, true);
            if ($decoded !== false && str_contains($decoded, '<user>')) {
                $userXml = $this->loadXml($decoded);
                $rmsid   = (string)($userXml->rmsid  ?? $rmsidRaw);
                $account = (string)($userXml->account ?? '');
            }

            $name = (string)($result->userinfo->name ?? '');
            Log::channel('cj_verify_ticket')->info('CJ项目-SSO验证票据成功', ['rmsid' => $rmsid]);

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
            Log::channel('cj_verify_ticket')->error('CJ项目-SSO验证票据失败: ' . $e->getMessage());
            return ['code' => 1, 'message' => $e->getMessage()];
        }
    }

    public function getDepartmentInfo($param)
    {
        try {
            Log::channel('cj_get_department_info')->info('CJ项目-主动拉取部门信息', $param);

            $contentXml  = $this->buildResourcesXml('Organization', $param);
            $envelopeXml = $this->buildEnvelope($contentXml);
            $responseXml = $this->sendRequest($envelopeXml, $this->getDepartmentInfoUrl);

            Log::channel('cj_get_department_info')->info('CJ项目-主动拉取部门信息-原始响应', ['response' => $responseXml]);

            $resources    = $this->parseEnvelope($responseXml);
            $departments  = array_values(array_filter($resources, fn($r) => $r['type'] === 'Organization'));

            Log::channel('cj_get_department_info')->info('CJ项目-主动拉取部门信息成功', ['count' => count($departments)]);
            return ['code' => 0, 'message' => '获取部门信息成功', 'data' => $responseXml];
        } catch (\Exception $e) {
            Log::channel('cj_get_department_info')->error('CJ项目-主动拉取部门信息失败: ' . $e->getMessage());
            return ['code' => 1, 'message' => '获取部门信息失败', 'data' => $this->buildResponseEnvelope('1', $e->getMessage())];
        }
    }
}
