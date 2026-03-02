# Laravel 政务服务平台接口 - 参考文档

> 此文档保存了原 Laravel 项目中政务服务平台对接的完整代码，供重写为 Node.js/React 时参考。

---

## 1. 路由定义 (routes/api_general.php)

```php
<?php

use App\Http\Controllers\OtherPlatformApi\GovernmentService\CJGovController;
Route::namespace("GovernmentService")->name("governmentService.")->prefix("governmentService")->group(function (){
    //政务服务平台-消息订阅接口
    Route::post('message/subscription', [CJGovController::class, 'messageSubscription']);
    //获取政务服务平台的部门信息
    Route::post("getDepartmentInfo", [CJGovController::class, 'getDepartmentInfo']);
    //获取政务服务平台的用户信息
    Route::post("getUserInfo", [CJGovController::class, 'getUserInfo']);
    //单点登录-获取随机数
    Route::post("sso/challenge", [CJGovController::class, 'getChallenge']);
    //单点登录-验证票据
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

    /**
     * 政务服务平台-消息订阅接口
     * 对方用 application/x-www-form-urlencoded POST，XML 在 request 字段里
     * 直接返回 envelope XML 字符串，不能包在 JSON 里
     */
    public function messageSubscription(Request $request)
    {
        $rawXml = $request->input('request', '');
        $rs = $this->cjGovService->messageSubscription(['rawBody' => $rawXml]);
        Log::channel('cj_message_subscription')->info('CJ项目-返回响应报文', ['data' => $rs['data']]);
        return response($rs['data'], 200)->header('Content-Type', 'application/xml; charset=utf-8');
    }

    /**
     * 单点登录 - 获取随机数
     */
    public function getChallenge(Request $request)
    {
        $rs = $this->cjGovService->getChallenge();
        return $this->success($rs);
    }

    /**
     * 单点登录 - 验证票据
     */
    public function verifyTicket(Request $request)
    {
        $param = $request->only(['challenge', 'identityticket']);
        $rs    = $this->cjGovService->verifyTicket($param);
        return $this->success($rs);
    }

    /**
     * 获取政务服务平台的部门信息
     */
    public function getDepartmentInfo(Request $request)
    {
        $param = $request->input();
        $rs = $this->cjGovService->getDepartmentInfo($param);
        Log::channel('cj_get_department_info')->info('CJ项目-返回响应报文', ['data' => $rs['data']]);
        return response($rs['data'], 200)->header('Content-Type', 'application/xml; charset=utf-8');
    }

    /**
     * 获取政务服务平台的用户信息
     */
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
    // 本应用在信任体系中的编码
    'app_code' => env('CJ_GOV_APP_CODE', '86b3f025-9f36-4ea9-ae12-50d758eba122'),

    // 本应用的 RMS 编码
    'rms_id' => env('CJ_GOV_RMS_ID', '3751f35b-e8b1-41a7-b7fd-948bc25f1c93'),

    // 主动拉取用户信息接口地址
    'get_user_info_url' => env('CJ_GOV_GET_USER_INFO_URL', 'http://172.17.0.1:30318/GetUserInfoJson'),

    // 主动拉取部门信息接口地址
    'get_department_info_url' => env('CJ_GOV_GET_DEPARTMENT_INFO_URL', 'http://172.17.0.1:30318/GetOrganizationInfoJson'),

    // 单点登录 - 身份认证服务地址
    'challenge_url'     => env('CJ_GOV_CHALLENGE_URL',     'http://172.17.0.1:10318/GeneratorChallenge'),
    'verify_ticket_url' => env('CJ_GOV_VERIFY_TICKET_URL', 'http://172.17.0.1:10318/VerifyIdentity'),

    // 单点登录 - 资源系统编码
    'app_server_id' => env('CJ_GOV_APP_SERVER_ID', ''),

    // 本应用签名证书路径
    'cert_file' => env('CJ_GOV_CERT_FILE', storage_path('certs/cj_gov.crt')),
    'key_file'  => env('CJ_GOV_KEY_FILE', storage_path('certs/cj_gov.key')),
];
```

---

## 4. 服务层 (CJGovService.php) - 前60行（已读取部分）

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

    /**
     * 政务服务平台-消息订阅接口（被动接收推送，解析 envelope XML）
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
                    // ... 其他类型处理
                }
            }
            // ... 返回响应 envelope XML
        } catch (\Exception $e) {
            // ... 异常处理
        }
    }

    // 更多方法: parseEnvelope(), buildEnvelope(), getChallenge(), verifyTicket(),
    // getDepartmentInfo(), getUserInfo(), handleUserResource(), handleOrganizationResource() 等
    // 完整代码共 478 行
}
```

> ⚠️ **注意**: CJGovService.php 完整文件有 478 行，上传时被截断。如需完整服务层代码，请重新上传完整文件。

---

## 5. 功能模块总结

### 模块1：消息订阅接口（被动接收）
- 接收 RMS 推送的用户/组织变更数据
- 解析 3 层 XML 结构（envelope → signatureContent → resources）
- 提取用户/组织信息并存库
- 返回处理结果的 envelope XML

### 模块2：主动拉取接口
- `getUserInfo`: 主动拉取用户信息
- `getDepartmentInfo`: 主动拉取部门信息
- 构建请求 envelope XML，发送到 RMS 服务
- 解析响应 envelope XML，提取资源数据

### 模块3：单点登录（SSO）
- `getChallenge`: 调用 AS 服务获取随机数
- `verifyTicket`: 验证前端提交的票据，返回用户信息
- 支持标准模式和定制模式（rmsid 是 base64 编码的 XML）

### 技术要点
- XML 处理：3层嵌套结构，signatureContent 层需要 BASE64 编解码
- PKCS#7 签名验证：目前是 TODO，生产环境需实现
- HTTP 请求：使用 `application/x-www-form-urlencoded`，XML 放在 `request` 字段
- 错误处理：所有异常都要捕获并返回标准格式

---

## 6. 环境变量配置

```env
CJ_GOV_APP_CODE=86b3f025-9f36-4ea9-ae12-50d758eba122
CJ_GOV_RMS_ID=3751f35b-e8b1-41a7-b7fd-948bc25f1c93
CJ_GOV_GET_USER_INFO_URL=http://172.17.0.1:30318/GetUserInfoJson
CJ_GOV_GET_DEPARTMENT_INFO_URL=http://172.17.0.1:30318/GetOrganizationInfoJson
CJ_GOV_CHALLENGE_URL=http://172.17.0.1:10318/GeneratorChallenge
CJ_GOV_VERIFY_TICKET_URL=http://172.17.0.1:10318/VerifyIdentity
CJ_GOV_APP_SERVER_ID=
```
