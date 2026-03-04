/**
 * 模拟 as_server（信任体系认证服务）
 * 用于 SSO 联调测试，运行在 10318 端口
 * 
 * 提供两个接口：
 *   POST /GeneratorChallenge - 生成随机数
 *   POST /VerifyIdentity     - 验证票据，返回 rmsid
 * 
 * 启动方式：node mock-as-server.js
 * 
 * 注意：这是测试用的模拟服务，生产环境应使用真实的 as_server
 */

const http = require('http');
const crypto = require('crypto');

const PORT = 10318;

// 存储已发放的 challenge，用于验证时匹配
const challengeStore = new Map();

// 模拟用户 rmsid 列表（可按需修改，需与 contacts 表中的 rmsid 匹配）
const MOCK_RMSID = process.env.MOCK_RMSID || 'test-user-001';

function generateChallenge() {
  return crypto.randomBytes(16).toString('hex');
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // 收集请求体
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    console.log(`[mock-as-server] ${req.method} ${pathname}`);

    // ========== GeneratorChallenge ==========
    if (pathname === '/GeneratorChallenge' && req.method === 'POST') {
      const challenge = generateChallenge();
      challengeStore.set(challenge, { createdAt: Date.now() });

      // 清理超过5分钟的旧 challenge
      const now = Date.now();
      for (const [key, val] of challengeStore) {
        if (now - val.createdAt > 5 * 60 * 1000) challengeStore.delete(key);
      }

      const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<generatorchallengeresponse>
  <challenge>${challenge}</challenge>
</generatorchallengeresponse>`;

      console.log(`[mock-as-server] 生成随机数: ${challenge}`);
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(responseXml);
      return;
    }

    // ========== VerifyIdentity ==========
    if (pathname === '/VerifyIdentity' && req.method === 'POST') {
      console.log('[mock-as-server] 收到验证请求');

      // 从请求 XML 中提取 challenge
      const challengeMatch = body.match(/<challenge>([\s\S]*?)<\/challenge>/);
      const ticketMatch = body.match(/<identityticket>([\s\S]*?)<\/identityticket>/);

      const challenge = challengeMatch ? challengeMatch[1].trim() : '';
      const ticket = ticketMatch ? ticketMatch[1].trim() : '';

      console.log(`[mock-as-server] challenge=${challenge}, ticket=${ticket ? ticket.substring(0, 20) + '...' : '(空)'}`);

      // 模拟验证：只要 ticket 非空就返回成功
      if (!ticket) {
        const errorResult = `<?xml version="1.0" encoding="UTF-8"?>
<result>1</result>
<error>票据为空</error>`;
        const encodedError = Buffer.from(errorResult).toString('base64');
        const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<verifyidentityticketresponse>
  <result>${encodedError}</result>
</verifyidentityticketresponse>`;
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end(responseXml);
        return;
      }

      // 成功响应：返回 rmsid
      const rmsid = MOCK_RMSID;
      const successResult = `<?xml version="1.0" encoding="UTF-8"?>
<tokeninfo>
  <result>0</result>
  <rmsid>${rmsid}</rmsid>
</tokeninfo>`;
      const encodedSuccess = Buffer.from(successResult).toString('base64');

      const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<verifyidentityticketresponse>
  <result>${encodedSuccess}</result>
</verifyidentityticketresponse>`;

      console.log(`[mock-as-server] 验证成功，返回 rmsid: ${rmsid}`);
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(responseXml);
      return;
    }

    // 未知路径
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`[mock-as-server] 模拟认证服务已启动，端口: ${PORT}`);
  console.log(`[mock-as-server] 模拟 rmsid: ${MOCK_RMSID}`);
  console.log(`[mock-as-server] 接口：POST /GeneratorChallenge, POST /VerifyIdentity`);
});
