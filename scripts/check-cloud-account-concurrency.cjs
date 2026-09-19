/* eslint-disable @typescript-eslint/no-require-imports -- Exercise production handlers and Better Auth against isolated SQLite. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
}).outputText, file);
const {handleAccountRequest} = require('../cloud/account-api.ts');
const {getAccountUser} = require('../cloud/auth.ts');
const {verifyPassword} = require('better-auth/crypto');
const origin = 'https://study.example';
const oldPassword = 'Original-study-password';
const newPassword = 'Changed-study-password';
const resetPassword = 'Admin-reset-study-password';
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(fs.readFileSync(path.join(__dirname, '../cloud/auth-migration.sql'), 'utf8'));
  const execute = (query, bindings) => {
    const statement = sql.prepare(query);
    const results = statement.columns().length ? statement.all(...bindings).map(row => ({...row})) : [];
    const changes = statement.columns().length ? sql.prepare('SELECT changes() AS n').get().n : Number(statement.run(...bindings).changes);
    return {success: true, results, meta: {changes}};
  };
  const db = {
    sql, beforeStatement: null, beforeBatch: null,
    prepare(query) {
      return {
        query, bindings: [], bind(...bindings) { return {...this, bindings}; },
        async all() { await db.beforeStatement?.(query); return execute(query, this.bindings); },
        async run() { await db.beforeStatement?.(query); return execute(query, this.bindings); },
        async first(column) { const row = (await this.all()).results[0] ?? null; return column && row ? row[column] : row; },
        async raw() { return (await this.all()).results.map(row => Object.values(row)); },
      };
    },
    async batch(statements) {
      await db.beforeBatch?.(statements);
      sql.exec('BEGIN');
      try { const result = statements.map(statement => execute(statement.query, statement.bindings)); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
    async exec(query) { sql.exec(query); return {count: 1, duration: 0}; },
  };
  return db;
}
const cookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function fixture() {
  const db = database();
  const env = {DB: db, APP_ORIGIN: origin, BETTER_AUTH_SECRET: 'local-regression-secret-not-used-in-production-123', BOOTSTRAP_TOKEN: 'local-regression-bootstrap-not-used-in-production-123'};
  const call = (route, body, cookie = '', extra = {}) => handleAccountRequest(new Request(origin + route, {
    method: body === undefined ? 'GET' : 'POST', headers: {Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'cf-connecting-ip': '127.0.0.1', ...extra},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  }), env);
  assert.equal((await call('/api/account/setup', {token: env.BOOTSTRAP_TOKEN, username: 'admin', name: 'Admin', password: oldPassword})).status, 201);
  const admin = cookies(await call('/api/account/login', {username: 'admin', password: oldPassword}));
  assert.equal((await call('/api/account/change-password', {currentPassword: oldPassword, newPassword}, admin)).status, 200);
  const created = await call('/api/admin/users', {username: 'student', name: 'Student', password: oldPassword}, admin);
  assert.equal(created.status, 201);
  const userId = (await created.json()).user.id;
  const student = cookies(await call('/api/account/login', {username: 'student', password: oldPassword}));
  const user = cookie => getAccountUser(new Request(origin + '/api/account', {headers: {Cookie: cookie}}), env);
  const change = (password = newPassword, cookie = student) => call('/api/account/change-password', {currentPassword: oldPassword, newPassword: password}, cookie);
  const reset = () => call(`/api/admin/users/${userId}/reset-password`, {password: resetPassword}, admin);
  const hash = () => db.sql.prepare("SELECT password FROM auth_account WHERE userId=? AND providerId='credential'").get(userId).password;
  return {db, env, call, admin, student, userId, user, change, reset, hash, close: () => db.sql.close()};
}
function pauseChanges(db, count = 1) {
  const reached = deferred(), release = deferred();
  let calls = 0;
  db.beforeBatch = async statements => {
    if (statements[0].query.startsWith('UPDATE auth_account SET password=') && statements[0].query.includes('julianday')) {
      calls++;
      if (calls === count) reached.resolve();
      await release.promise;
    }
  };
  return {reached: reached.promise, release: () => release.resolve()};
}
let checks = 0;
async function check(name, run) {
  const f = await fixture();
  try { await run(f); checks++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
  finally { f.close(); }
}

// Keep the process alive and fail if an expected scheduling barrier is not hit.
const watchdog = setTimeout(() => { console.error('Account concurrency checks timed out.'); process.exit(1); }, 60000);
(async () => {
  await check('Successful password change preserves the current session and revokes only other sessions', async f => {
    const other = cookies(await f.call('/api/account/login', {username: 'student', password: oldPassword}));
    const response = await f.change();
    assert.equal(response.status, 200);
    assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal((await f.user(f.student)).mustChangePassword, false);
    assert.equal(await f.user(other), null);
    assert.equal(await verifyPassword({hash: f.hash(), password: newPassword}), true);
    assert.equal(f.db.sql.prepare('SELECT passwordResetVersion FROM auth_user WHERE id=?').get(f.userId).passwordResetVersion, 1);
  });
  await check('Admin reset wins after the old password has been verified but before the change commits', async f => {
    const pause = pauseChanges(f.db), changing = f.change();
    await pause.reached;
    assert.equal((await f.reset()).status, 200);
    pause.release();
    const response = await changing;
    assert.equal(response.status, 409); assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal(await verifyPassword({hash: f.hash(), password: resetPassword}), true);
    assert.equal(await f.user(f.student), null);
    assert.equal(f.db.sql.prepare('SELECT mustChangePassword FROM auth_user WHERE id=?').get(f.userId).mustChangePassword, 1);
  });
  await check('Two verified concurrent changes permit exactly one credential and gate update', async f => {
    const pause = pauseChanges(f.db, 2), first = f.change(), second = f.change('Second-changed-study-password');
    await pause.reached; pause.release();
    const responses = await Promise.all([first, second]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const winner = responses[0].status === 200 ? newPassword : 'Second-changed-study-password';
    assert.equal(await verifyPassword({hash: f.hash(), password: winner}), true);
    assert.equal(f.db.sql.prepare('SELECT passwordResetVersion FROM auth_user WHERE id=?').get(f.userId).passwordResetVersion, 1);
    assert.equal((await f.user(f.student)).mustChangePassword, false);
    for (const response of responses) assert.deepEqual(response.headers.getSetCookie(), []);
  });
  await check('Logout during password hashing prevents the pending credential change', async f => {
    const oldHash = f.hash(), pause = pauseChanges(f.db), changing = f.change();
    await pause.reached;
    assert.equal((await f.call('/api/account/logout', {}, f.student)).status, 200);
    pause.release();
    assert.equal((await changing).status, 409); assert.equal(f.hash(), oldHash);
    assert.equal(await f.user(f.student), null);
  });
  await check('Session expiry during password hashing prevents the pending credential change', async f => {
    const oldHash = f.hash(), pause = pauseChanges(f.db), changing = f.change();
    await pause.reached;
    f.db.sql.prepare('UPDATE auth_session SET expiresAt=? WHERE userId=?').run('2000-01-01T00:00:00.000Z', f.userId);
    pause.release();
    assert.equal((await changing).status, 409); assert.equal(f.hash(), oldHash);
  });
  await check('Disabled users cannot finish an already verified password change', async f => {
    const oldHash = f.hash(), pause = pauseChanges(f.db), changing = f.change();
    await pause.reached;
    assert.equal((await f.call(`/api/admin/users/${f.userId}/disable`, {}, f.admin)).status, 200);
    pause.release();
    assert.equal((await changing).status, 409); assert.equal(f.hash(), oldHash);
    assert.equal(await f.user(f.student), null);
  });
  await check('A failed gate update rolls back the password and session transaction', async f => {
    const oldHash = f.hash();
    const other = cookies(await f.call('/api/account/login', {username: 'student', password: oldPassword}));
    f.db.sql.exec("CREATE TRIGGER reject_change BEFORE UPDATE OF mustChangePassword ON auth_user BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END");
    const response = await f.change();
    assert.equal(response.status, 503); assert.deepEqual(response.headers.getSetCookie(), []); assert.equal(f.hash(), oldHash);
    assert.equal((await f.user(f.student)).mustChangePassword, true); assert.notEqual(await f.user(other), null);
  });
  await check('Admin reset during old-password login cannot resurrect a revoked session', async f => {
    const reached = deferred(), release = deferred();
    f.db.beforeStatement = async query => {
      if (/^insert into "auth_session"/i.test(query)) { reached.resolve(); await release.promise; }
    };
    const loggingIn = f.call('/api/account/login', {username: 'student', password: oldPassword});
    await reached.promise;
    assert.equal((await f.reset()).status, 200);
    release.resolve();
    const response = await loggingIn;
    assert.equal(response.status, 401); assert.deepEqual(response.headers.getSetCookie(), []);
    assert.equal(f.db.sql.prepare('SELECT count(*) AS n FROM auth_session WHERE userId=?').get(f.userId).n, 0);
    assert.equal(await verifyPassword({hash: f.hash(), password: resetPassword}), true);
  });
  console.log(`Passed ${checks} account concurrency checks using production handlers and Better Auth.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
