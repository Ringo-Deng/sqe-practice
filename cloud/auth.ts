import { betterAuth } from 'better-auth';
import { admin, username } from 'better-auth/plugins';

export type AccountEnv = {
  DB: D1Database;
  APP_ORIGIN: string;
  BETTER_AUTH_SECRET: string;
  BOOTSTRAP_TOKEN?: string;
  LOCAL_DEV?: string;
};

export type AccountUser = {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
};

export function accountOrigin(env: AccountEnv): string {
  const url = new URL(env.APP_ORIGIN);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if ((url.protocol !== 'https:' && !(local && env.LOCAL_DEV === 'true' && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_ORIGIN must be one explicit HTTPS origin (HTTP is allowed only for local development).');
  }
  return url.origin;
}

export function createAuth(env: AccountEnv) {
  const origin = accountOrigin(env);
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }
  // Native D1 uses Better Auth's built-in Kysely adapter; do not use the minimal import.
  return betterAuth({
    appName: 'SQE Practice',
    baseURL: origin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      modelName: 'auth_user',
      additionalFields: {
        mustChangePassword: { type: 'boolean', defaultValue: true, required: false, input: false },
      },
    },
    session: {
      modelName: 'auth_session',
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    advanced: {
      useSecureCookies: origin.startsWith('https:'),
      cookiePrefix: 'sqe-account',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    // The application exposes only its account wrappers, which also rate-limit
    // direct auth.api calls. Keep the library limiter for accidental handler use.
    rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limit' },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 }), admin()],
    disabledPaths: ['/sign-up/email', '/delete-user', '/admin/remove-user', '/admin/impersonate-user'],
    telemetry: { enabled: false },
  });
}

export function publicAccountUser(value: unknown): AccountUser | null {
  if (!value || typeof value !== 'object') return null;
  const user = value as Record<string, unknown>;
  if (typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.username !== 'string' || user.banned) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: typeof user.role === 'string' && user.role.split(',').includes('admin') ? 'admin' : 'user',
    mustChangePassword: user.mustChangePassword !== false,
  };
}

export async function getAccountUser(request: Request, env: AccountEnv): Promise<AccountUser | null> {
  const session = await createAuth(env).api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  return publicAccountUser(session?.user);
}
