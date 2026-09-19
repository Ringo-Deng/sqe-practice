import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { accountOrigin, createAuth, getAccountUser, publicAccountUser, type AccountEnv, type AccountUser } from './auth';
export { getAccountUser } from './auth';
export type { AccountEnv, AccountUser } from './auth';

class AccountError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function json(value: unknown, status = 200, source?: Headers): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' });
  if (source) {
    const cookieHeaders = source as Headers & { getAll?: (name: string) => string[] };
    const cookies = typeof source.getSetCookie === 'function' ? source.getSetCookie() : cookieHeaders.getAll?.('Set-Cookie') ?? [];
    for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  }
  return Response.json(value, { status, headers });
}

function checkWriteRequest(request: Request, env: AccountEnv) {
  if (request.headers.get('origin') !== accountOrigin(env) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AccountError('请求来源无效，请从本站重新操作。', 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new AccountError('请使用 JSON 请求。', 415);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError('请求内容不能为空。');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new AccountError('请求内容过大。', 413); }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new AccountError('请求内容格式无效。'); }
}

function validUsername(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.]{3,30}$/.test(value)) throw new AccountError('账号须为 3–30 位英文字母、数字、下划线或点。');
  return value.toLowerCase();
}

function validName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(value)) throw new AccountError('姓名须为 1–100 个字符。');
  return value.trim();
}

function validPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new AccountError('密码长度须为 12–128 个字符。');
  return value;
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function limit(env: AccountEnv, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hashed = await digest(key);
  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM cloud_auth_limits WHERE window_start < ?').bind(now - 86400000),
    env.DB.prepare(`INSERT INTO cloud_auth_limits (key,count,window_start) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<=? THEN 1 ELSE count+1 END,
      window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END RETURNING count`)
      .bind(hashed, now, now - windowMs, now - windowMs),
  ]);
  if (Number((results[1].results[0] as { count: number } | undefined)?.count ?? max + 1) > max) throw new AccountError('操作过于频繁，请稍后再试。', 429);
}

async function setupRequired(env: AccountEnv): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT
    EXISTS(SELECT 1 FROM cloud_account_bootstrap WHERE id=1 AND completed_at IS NOT NULL) AS completed,
    EXISTS(SELECT 1 FROM auth_user WHERE role='admin') AS has_admin`).first<{ completed: number; has_admin: number }>();
  return !row?.completed && !row?.has_admin;
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function bootstrap(env: AccountEnv, body: Record<string, unknown>) {
  if (!env.BOOTSTRAP_TOKEN || env.BOOTSTRAP_TOKEN.length < 32) throw new AccountError('管理员初始化尚未配置。', 503);
  if (typeof body.token !== 'string' || body.token.length > 512 || !await safeEqual(body.token, env.BOOTSTRAP_TOKEN)) throw new AccountError('初始化凭证无效。', 403);
  const username = validUsername(body.username), name = validName(body.name), password = validPassword(body.password);
  const claim = crypto.randomUUID(), now = Date.now();
  const acquired = await env.DB.prepare(`INSERT INTO cloud_account_bootstrap (id,claim_token,claimed_at,expires_at)
    SELECT 1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM auth_user WHERE role='admin')
    ON CONFLICT(id) DO UPDATE SET claim_token=excluded.claim_token,claimed_at=excluded.claimed_at,expires_at=excluded.expires_at
    WHERE completed_at IS NULL AND expires_at<=? AND NOT EXISTS(SELECT 1 FROM auth_user WHERE role='admin')`)
    .bind(claim, now, now + 120000, now).run();
  if (!acquired.meta.changes) throw new AccountError('管理员已初始化，或初始化正在进行；如上次中断，请两分钟后重试。', 409);
  try {
    // Keep Better Auth's unmodified scrypt format and work factor. All three
    // writes below commit atomically; an expired/replaced claim cannot create a user.
    const hashed = await hashPassword(password);
    const id = crypto.randomUUID(), accountId = crypto.randomUUID(), timestamp = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(`INSERT INTO auth_user (id,name,email,emailVerified,createdAt,updatedAt,username,displayUsername,role,banned,mustChangePassword)
        SELECT ?,?,?,0,?,?,?,?,'admin',0,0 FROM cloud_account_bootstrap
        WHERE id=1 AND claim_token=? AND completed_at IS NULL AND expires_at>?`)
        .bind(id, name, `${id}@accounts.invalid`, timestamp, timestamp, username, username, claim, Date.now()),
      env.DB.prepare(`INSERT INTO auth_account (id,accountId,providerId,userId,password,createdAt,updatedAt)
        SELECT ?,?,'credential',?,?,?,? FROM auth_user WHERE id=?`)
        .bind(accountId, id, id, hashed, timestamp, timestamp, id),
      env.DB.prepare(`UPDATE cloud_account_bootstrap SET completed_at=?,user_id=?
        WHERE id=1 AND claim_token=? AND completed_at IS NULL AND EXISTS(SELECT 1 FROM auth_account WHERE userId=?)`)
        .bind(Date.now(), id, claim, id),
    ]);
    if (!results[0].meta.changes || !results[1].meta.changes || !results[2].meta.changes) throw new AccountError('初始化占用已过期，请重新操作。', 409);
    return { ok: true };
  } catch (error) {
    // Only the owner can release an incomplete claim; never reopen completed setup.
    await env.DB.prepare('DELETE FROM cloud_account_bootstrap WHERE id=1 AND claim_token=? AND completed_at IS NULL').bind(claim).run();
    throw error;
  }
}

async function checkedAuthResponse(response: Response): Promise<Record<string, unknown>> {
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof value.code === 'string' ? value.code : '';
    if (code.includes('SESSION_NOT_FRESH')) throw new AccountError('请重新登录后再修改密码。', 401);
    if (code.includes('USERNAME_IS_ALREADY_TAKEN') || code.includes('USER_ALREADY_EXISTS')) throw new AccountError('该账号已存在。', 409);
    if (response.status === 429) throw new AccountError('操作过于频繁，请稍后再试。', 429);
    throw new AccountError('操作未成功，请确认账号、密码及登录状态。', response.status >= 500 ? 503 : response.status);
  }
  return value;
}

function requireReadyAdmin(user: AccountUser | null): AccountUser {
  if (!user) throw new AccountError('请先登录。', 401);
  if (user.mustChangePassword) throw new AccountError('请先修改初始密码。', 403);
  if (user.role !== 'admin') throw new AccountError('需要管理员权限。', 403);
  return user;
}

export async function handleAccountRequest(request: Request, env: AccountEnv): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const accountPaths = ['/api/account', '/api/account/login', '/api/account/logout', '/api/account/change-password', '/api/account/clear-study', '/api/account/setup'];
  const adminAction = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(disable|enable|reset-password)$/);
  if (!accountPaths.includes(pathname) && pathname !== '/api/admin/users' && !adminAction) return null;
  try {
    if (request.method === 'GET' && pathname === '/api/account') {
      const response = await createAuth(env).api.getSession({ headers: request.headers, query: { disableCookieCache: true }, asResponse: true });
      if (!response.ok) await checkedAuthResponse(response);
      const value = await response.json() as { user?: unknown } | null;
      return json({ user: publicAccountUser(value?.user), setupRequired: await setupRequired(env) }, 200, response.headers);
    }
    if (request.method === 'GET' && pathname === '/api/admin/users') {
      requireReadyAdmin(await getAccountUser(request, env));
      const rows = await env.DB.prepare('SELECT id,username,name,banned,createdAt,mustChangePassword FROM auth_user ORDER BY createdAt DESC,id').all<{ id: string; username: string; name: string; banned: number | null; createdAt: string; mustChangePassword: number | null }>();
      return json({ users: rows.results.map(row => ({ id: row.id, username: row.username, name: row.name, disabled: !!row.banned, createdAt: row.createdAt, mustChangePassword: row.mustChangePassword !== 0 })) });
    }
    if (request.method !== 'POST' || pathname === '/api/account') return json({ error: '不支持此请求方式。' }, 405);
    checkWriteRequest(request, env);
    const body = await readBody(request);
    const ip = request.headers.get('cf-connecting-ip') ?? 'unavailable';
    if (pathname === '/api/account/setup') {
      await limit(env, `setup:${ip}`, 5, 15 * 60000);
      return json(await bootstrap(env, body), 201);
    }
    const auth = createAuth(env);
    if (pathname === '/api/account/login') {
      await limit(env, `login-ip:${ip}`, 20, 5 * 60000);
      const username = validUsername(body.username);
      await limit(env, `login-user:${username}`, 10, 5 * 60000);
      if (typeof body.password !== 'string' || !body.password || body.password.length > 128) throw new AccountError('账号或密码不正确。', 401);
      const before = await env.DB.prepare('SELECT id,passwordResetVersion FROM auth_user WHERE username=? AND COALESCE(banned,0)=0').bind(username).first<{ id: string; passwordResetVersion: number }>();
      const response = await auth.api.signInUsername({ headers: request.headers, body: { username, password: body.password }, asResponse: true });
      const value = await checkedAuthResponse(response);
      // A reset can revoke sessions while Better Auth is still verifying an old
      // password. Never release the session created by that stale login attempt.
      const current = before && await env.DB.prepare('SELECT id FROM auth_user WHERE id=? AND passwordResetVersion=? AND COALESCE(banned,0)=0').bind(before.id, before.passwordResetVersion).first<{ id: string }>();
      if (!current) {
        if (typeof value.token === 'string') await env.DB.prepare('DELETE FROM auth_session WHERE token=?').bind(value.token).run();
        throw new AccountError('账号刚被管理员更新，请使用最新密码重新登录。', 401);
      }
      return json({ user: publicAccountUser(value.user) }, 200, response.headers);
    }
    if (pathname === '/api/account/logout') {
      const response = await auth.api.signOut({ headers: request.headers, asResponse: true });
      await checkedAuthResponse(response);
      return json({ ok: true }, 200, response.headers);
    }
    const user = await getAccountUser(request, env);
    if (!user) throw new AccountError('请先登录。', 401);
    await limit(env, `account-write:${user.id}`, 30, 60000);
    if (pathname === '/api/account/change-password') {
      const newPassword = validPassword(body.newPassword);
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128) throw new AccountError('请填写当前密码。');
      if (newPassword === body.currentPassword) throw new AccountError('新密码须与当前密码不同。');
      const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true, disableRefresh: true } });
      if (!session || session.user.id !== user.id) throw new AccountError('请重新登录。', 401);
      if (Date.now() - new Date(session.session.createdAt).getTime() >= 3600000) throw new AccountError('请重新登录后再修改密码。', 401);
      const credential = await env.DB.prepare(`SELECT a.id,a.password,u.passwordResetVersion FROM auth_account a JOIN auth_user u ON u.id=a.userId
        WHERE a.userId=? AND a.providerId='credential' AND COALESCE(u.banned,0)=0`).bind(user.id).first<{ id: string; password: string; passwordResetVersion: number }>();
      if (!credential?.password || !await verifyPassword({ hash: credential.password, password: body.currentPassword })) throw new AccountError('当前密码不正确。', 400);
      const hashed = await hashPassword(newPassword), timestamp = new Date().toISOString();
      // Password, version, first-login gate and session revocation share one D1
      // transaction. Every side effect is conditional on the same winning hash.
      // Keep only the already verified current session; no new Cookie is issued.
      const changed = await env.DB.batch([
        env.DB.prepare(`UPDATE auth_account SET password=?,updatedAt=? WHERE id=? AND userId=? AND password=?
          AND EXISTS(SELECT 1 FROM auth_user WHERE id=? AND passwordResetVersion=? AND COALESCE(banned,0)=0)
          AND EXISTS(SELECT 1 FROM auth_session WHERE id=? AND userId=? AND julianday(expiresAt)>julianday(?))`)
          .bind(hashed, timestamp, credential.id, user.id, credential.password, user.id, credential.passwordResetVersion, session.session.id, user.id, timestamp),
        env.DB.prepare(`UPDATE auth_user SET mustChangePassword=0,passwordResetVersion=passwordResetVersion+1,updatedAt=? WHERE id=? AND passwordResetVersion=? AND COALESCE(banned,0)=0
          AND EXISTS(SELECT 1 FROM auth_account WHERE id=? AND userId=? AND password=?)`)
          .bind(timestamp, user.id, credential.passwordResetVersion, credential.id, user.id, hashed),
        env.DB.prepare(`DELETE FROM auth_session WHERE userId=? AND id<>?
          AND EXISTS(SELECT 1 FROM auth_account WHERE id=? AND userId=? AND password=?)
          AND EXISTS(SELECT 1 FROM auth_user WHERE id=? AND passwordResetVersion=?)`)
          .bind(user.id, session.session.id, credential.id, user.id, hashed, user.id, credential.passwordResetVersion + 1),
      ]);
      if (!changed[0].meta.changes || !changed[1].meta.changes) throw new AccountError('账号或登录状态已更新，请重新登录后再修改密码。', 409);
      return json({ user: { ...user, mustChangePassword: false } });
    }
    if (pathname === '/api/account/clear-study') {
      if (user.mustChangePassword) throw new AccountError('请先修改初始密码，再开始学习。', 403);
      if (body.confirmation !== 'CLEAR_STUDY_RECORDS') throw new AccountError('请重新确认清空做题记录。');
      const cleared = await env.DB.batch([
        env.DB.prepare('DELETE FROM responses WHERE session_id IN (SELECT id FROM sessions WHERE user_id=?)').bind(user.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id),
      ]);
      return json({ ok: true, sessions: cleared[1].meta.changes ?? 0, responses: cleared[0].meta.changes ?? 0 });
    }
    requireReadyAdmin(user);
    if (pathname === '/api/admin/users') {
      const username = validUsername(body.username), name = validName(body.name), password = validPassword(body.password);
      const response = await auth.api.createUser({ headers: request.headers, body: { email: `${crypto.randomUUID()}@accounts.invalid`, name, password, role: 'user', data: { username, displayUsername: username } }, asResponse: true });
      const value = await checkedAuthResponse(response);
      return json({ user: publicAccountUser(value.user) }, 201, response.headers);
    }
    if (adminAction) {
      const targetId = decodeURIComponent(adminAction[1]), action = adminAction[2];
      if (targetId === user.id && action !== 'enable') throw new AccountError('不能停用或重置当前管理员自己的账号；请使用修改密码。');
      const target = await env.DB.prepare('SELECT id,role FROM auth_user WHERE id=?').bind(targetId).first<{ id: string; role: string | null }>();
      if (!target) throw new AccountError('未找到该账号。', 404);
      // The first release manages student accounts only; do not disable the sole admin.
      if (target.role?.split(',').includes('admin')) throw new AccountError('此入口不修改管理员账号。', 403);
      if (action === 'reset-password') {
        const password = validPassword(body.password);
        const hashed = await hashPassword(password);
        // Credential, forced-change flag and revocation are one transaction.
        await env.DB.batch([
          env.DB.prepare('UPDATE auth_account SET password=?,updatedAt=? WHERE userId=? AND providerId=\'credential\'').bind(hashed, new Date().toISOString(), targetId),
          env.DB.prepare(`INSERT INTO auth_account (id,accountId,providerId,userId,password,createdAt,updatedAt)
            SELECT ?,?,'credential',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM auth_account WHERE userId=? AND providerId='credential')`)
            .bind(crypto.randomUUID(), targetId, targetId, hashed, new Date().toISOString(), new Date().toISOString(), targetId),
          env.DB.prepare('UPDATE auth_user SET mustChangePassword=1,passwordResetVersion=passwordResetVersion+1,updatedAt=? WHERE id=?').bind(new Date().toISOString(), targetId),
          env.DB.prepare('DELETE FROM auth_session WHERE userId=?').bind(targetId),
        ]);
        return json({ ok: true });
      }
      const response = action === 'disable'
        ? await auth.api.banUser({ headers: request.headers, body: { userId: targetId, banReason: '管理员停用账号' }, asResponse: true })
        : await auth.api.unbanUser({ headers: request.headers, body: { userId: targetId }, asResponse: true });
      await checkedAuthResponse(response);
      return json({ ok: true }, 200, response.headers);
    }
    return null;
  } catch (error) {
    if (error instanceof AccountError) return json({ error: error.message }, error.status);
    // Do not log request bodies, credentials, session tokens or auth-library errors.
    console.error('Account operation failed');
    return json({ error: '账号服务暂时不可用，请稍后重试。' }, 503);
  }
}
