/* eslint-disable @typescript-eslint/no-require-imports -- Isolated SQLite harness loads the production TypeScript. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
}).outputText, file);
const {exportBackup, restoreBackup, validateBackup, handleBackupRequest, BackupError, MAX_BACKUP_BYTES, UNRESTORED_FILE_PREFIX} = require('../cloud/backup.ts');
const {BACKUP_TABLES} = require('../cloud/backup-types.ts');
let checks = 0;
async function check(name, run) {
  try { await run(); checks++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}
const clone = value => JSON.parse(JSON.stringify(value));

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const file of fs.readdirSync(path.join(root, 'drizzle')).filter(name => name.endsWith('.sql')).sort()) sql.exec(fs.readFileSync(path.join(root, 'drizzle', file), 'utf8'));
  sql.exec(fs.readFileSync(path.join(root, 'cloud/reading-position-migration.sql'), 'utf8'));
  const history = [];
  return {
    sql, history,
    prepare(query) { return {query, bindings: [], bind(...bindings) { return {...this, bindings}; }}; },
    async batch(statements) {
      history.push(statements);
      sql.exec('BEGIN');
      try {
        const results = statements.map(({query, bindings}) => {
          const statement = sql.prepare(query);
          if (statement.columns().length) return {success: true, results: statement.all(...bindings).map(row => ({...row})), meta: {changes: 0}};
          const result = statement.run(...bindings);
          return {success: true, results: [], meta: {changes: Number(result.changes)}};
        });
        sql.exec('COMMIT'); return results;
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
    close() { sql.close(); },
  };
}
const timestamp = 1700000000000;
const common = {created_at: timestamp, updated_at: timestamp, revision: 2};
function archive(user = 'account-a') {
  return {
    application: 'sqe-practice', schemaVersion: 2, exportedAt: '2026-09-19T00:00:00.000Z', sourceAccountId: user,
    data: {
      sessions: [{id: 'session-a', user_id: user, mode: 'practice', status: 'active', question_ids: '["unknown-future-question","unanswered-question"]', position: 1, started_at: timestamp, finished_at: null}],
      responses: [{session_id: 'session-a', question_id: 'unknown-future-question', selected: 'D', correct: 1, answered_at: timestamp + 100}],
      vocabulary: [{id: 'word-a', user_id: user, word: 'Offer', word_key: 'offer', kind: 'word', meaning: '要约', example: 'An offer', question_id: 'unknown-future-question', session_id: 'session-a', subject_id: 'contracts', source_label: 'Study note', stage: 4, next_review: '2026-10-01', review_count: 8, last_reviewed_at: timestamp, last_reviewed_date: '2026-09-19', queue_date: null, queue_order: 0, ...common}],
      textbook_annotations: [{id: 'annotation-a', user_id: user, book_id: 'book-a', page: 7, quote: 'Offer and acceptance', note: 'Keep this note', color: 'yellow', rects: '[{"x":0.1,"y":0.2,"width":0.3,"height":0.1}]', source_question_id: 'unknown-future-question', ...common}],
      textbook_titles: [{user_id: user, book_id: 'built-in-book', title: 'My renamed book', subject_id: 'contracts', updated_at: timestamp, revision: 3}],
      textbook_bookmarks: [{user_id: user, book_id: 'book-a', page: 7, note: 'Read again', ...common}],
      user_textbooks: [{id: 'book-a', user_id: user, title: 'Imported contract book', subject_id: 'contracts', original_name: 'contract.pdf', page_count: 50, storage_key: 'textbooks/real-source-file.pdf', size_bytes: 54321, ...common}],
      reading_positions: [{user_id: user, book_id: 'book-a', page: 17, updated_at: timestamp + 200}],
    },
    files: {included: false, kind: 'metadata-only', count: 1},
  };
}
function seed(db, backup) {
  for (const table of BACKUP_TABLES) for (const row of backup.data[table]) {
    const columns = Object.keys(row);
    db.sql.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map(column => row[column]));
  }
}
const count = (db, table) => db.sql.prepare(`SELECT count(*) AS count FROM ${table}`).get().count;
const request = (value, extra = {}) => new Request('https://study.example/api/backup', {method: 'POST', headers: {'Content-Type': 'application/json', ...extra}, body: typeof value === 'string' ? value : JSON.stringify(value)});

(async () => {
  await check('Export returns every original database field and only the authenticated account', async () => {
    const db = database(), source = archive(); seed(db, source);
    db.sql.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)').run('private-session', 'account-b', 'practice', 'active', '["private-question"]', 0, timestamp, null);
    db.sql.prepare('INSERT INTO responses VALUES (?,?,?,?,?)').run('private-session', 'private-question', 'A', 0, timestamp);
    const exported = await exportBackup(db, 'account-a');
    assert.equal(exported.schemaVersion, 2);
    assert.deepEqual(exported.data, source.data);
    assert.deepEqual(exported.files, {included: false, kind: 'metadata-only', count: 1});
    assert.equal(db.history.length, 1, 'All export tables share a batch snapshot');
    assert.equal(JSON.stringify(exported).includes('private-question'), false);
    db.close();
  });
  await check('Restore rebinds all ownership, preserves unknown questions, and marks file metadata unavailable', async () => {
    const db = database(), result = await restoreBackup(db, 'new-account', archive());
    const restored = await exportBackup(db, 'new-account');
    for (const table of BACKUP_TABLES) {
      assert.equal(result.tables[table].inserted, 1);
      for (const row of restored.data[table]) if ('user_id' in row) assert.equal(row.user_id, 'new-account');
    }
    assert.equal(restored.data.sessions[0].question_ids, archive().data.sessions[0].question_ids);
    assert.equal(restored.data.responses[0].answered_at, timestamp + 100);
    assert.equal(restored.data.user_textbooks[0].storage_key, `${UNRESTORED_FILE_PREFIX}book-a`);
    assert.deepEqual(result.files.requiresUpload, [{id: 'book-a', title: 'Imported contract book', originalName: 'contract.pdf', sizeBytes: 54321}]);
    db.close();
  });
  await check('Repeated restore is idempotent for every stable key', async () => {
    const db = database(); await restoreBackup(db, 'account-a', archive());
    const result = await restoreBackup(db, 'account-a', archive());
    for (const table of BACKUP_TABLES) assert.deepEqual(result.tables[table], {received: 1, inserted: 0, skipped: 1});
    db.close();
  });
  await check('Existing target records, newer learning state and real file pointers are never overwritten', async () => {
    const db = database(), current = archive();
    current.data.vocabulary[0].meaning = 'Latest meaning'; current.data.vocabulary[0].review_count = 100;
    current.data.textbook_bookmarks[0].note = 'Latest handwritten note'; current.data.sessions[0].position = 0;
    current.data.responses[0].selected = 'E'; seed(db, current);
    const result = await restoreBackup(db, 'account-a', archive());
    assert.deepEqual((await exportBackup(db, 'account-a')).data, current.data);
    assert.deepEqual(result.files.requiresUpload, []);
    db.close();
  });
  await check('Cross-account global IDs cannot transfer ownership or receive another users answers', async () => {
    const db = database(), foreign = archive('account-b'); seed(db, foreign);
    // The foreign session has no answer for this second question.
    const incoming = archive(); incoming.data.responses.push({session_id: 'session-a', question_id: 'unanswered-question', selected: 'A', correct: 0, answered_at: timestamp});
    const result = await restoreBackup(db, 'account-a', incoming);
    for (const table of ['sessions', 'responses', 'vocabulary', 'textbook_annotations', 'user_textbooks']) assert.equal(result.tables[table].inserted, 0);
    assert.deepEqual((await exportBackup(db, 'account-b')).data, foreign.data);
    assert.equal(count(db, 'responses'), 1);
    db.close();
  });
  await check('Per-account keys let independent users keep their own book titles and page notes', async () => {
    const db = database(); seed(db, archive('account-b'));
    await restoreBackup(db, 'account-a', archive());
    assert.equal(count(db, 'textbook_titles'), 2); assert.equal(count(db, 'textbook_bookmarks'), 2);
    assert.equal(db.sql.prepare('SELECT note FROM textbook_bookmarks WHERE user_id=?').get('account-a').note, 'Read again');
    db.close();
  });
  await check('A matching normalized vocabulary key deduplicates even when the card UUID differs', async () => {
    const db = database(); seed(db, archive()); const incoming = archive(); incoming.data.vocabulary[0].id = 'different-word-id';
    const result = await restoreBackup(db, 'account-a', incoming);
    assert.equal(result.tables.vocabulary.inserted, 0); assert.equal(count(db, 'vocabulary'), 1); db.close();
  });
  await check('Additional answers merge only into questions belonging to the targets existing session', async () => {
    const db = database(), existing = archive(); existing.data.sessions[0].question_ids = '["unknown-future-question"]'; existing.data.sessions[0].position = 0; seed(db, existing);
    const incoming = archive(); incoming.data.responses.push({session_id: 'session-a', question_id: 'unanswered-question', selected: 'A', correct: 0, answered_at: timestamp});
    const result = await restoreBackup(db, 'account-a', incoming);
    assert.equal(result.tables.responses.inserted, 0); assert.equal(count(db, 'responses'), 1); db.close();
  });
  await check('One failing statement rolls back earlier restored sessions and answers', async () => {
    const db = database();
    db.sql.exec("CREATE TRIGGER reject_vocabulary BEFORE INSERT ON vocabulary BEGIN SELECT RAISE(ABORT, 'simulated full storage'); END");
    await assert.rejects(() => restoreBackup(db, 'account-a', archive()));
    for (const table of BACKUP_TABLES) assert.equal(count(db, table), 0);
    db.close();
  });
  await check('Large record groups are chunked but remain in one transaction', async () => {
    const db = database(), incoming = archive();
    for (let n = 0; n < 250; n++) incoming.data.sessions.push({...incoming.data.sessions[0], id: `session-${n}`});
    await restoreBackup(db, 'account-a', incoming);
    assert.equal(count(db, 'sessions'), 251);
    assert.equal(db.history.length, 1);
    assert.equal(db.history[0].filter(statement => statement.query.startsWith('INSERT INTO sessions ')).length, 3);
    db.close();
  });
  await check('Unsupported versions, injected tables, mixed owners and orphan responses are rejected before writes', async () => {
    const cases = [
      value => { value.schemaVersion = 3; },
      value => { value.application = 'another-app'; },
      value => { value.data.auth_users = []; },
      value => { value.data.sessions[0].user_id = 'someone-else'; },
      value => { value.data.responses[0].session_id = 'missing-session'; },
      value => { value.data.sessions[0].question_ids = '["q","q"]'; },
      value => { value.data.sessions[0].position = 999; },
      value => { value.data.textbook_annotations[0].rects = 'broken json'; },
      value => { value.files.included = true; },
      value => { value.files.count = 999; },
      value => { value.data.sessions.push(clone(value.data.sessions[0])); },
    ];
    const db = database();
    for (const edit of cases) { const input = archive(); edit(input); await assert.rejects(() => restoreBackup(db, 'account-a', input), error => error instanceof BackupError); }
    assert.equal(db.history.length, 0); assert.equal(count(db, 'sessions'), 0); db.close();
  });
  await check('Untrusted storage keys never become readable uploaded file references', async () => {
    const db = database(), input = archive(); input.data.user_textbooks[0].storage_key = 'textbooks/another-users-secret.pdf';
    await restoreBackup(db, 'account-a', input);
    assert.equal(db.sql.prepare('SELECT storage_key FROM user_textbooks').get().storage_key, `${UNRESTORED_FILE_PREFIX}book-a`); db.close();
  });
  await check('The HTTP export is a non-cacheable JSON download that explicitly excludes PDFs', async () => {
    const db = database(); seed(db, archive()); const response = await handleBackupRequest(new Request('https://study.example/backup'), db, 'account-a');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-disposition'), /attachment.*\.json/);
    assert.equal((await response.json()).files.included, false); db.close();
  });
  await check('The HTTP restore returns counts and no uploaded PDF claim', async () => {
    const db = database(); const response = await handleBackupRequest(request(archive()), db, 'account-a');
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.tables.responses.inserted, 1); assert.equal(result.files.restored, false); db.close();
  });
  await check('Missing account, malformed JSON, wrong content type and unsupported methods fail safely', async () => {
    const db = database();
    assert.equal((await handleBackupRequest(request(archive()), db, '')).status, 401);
    assert.equal((await handleBackupRequest(request('{broken'), db, 'account-a')).status, 400);
    assert.equal((await handleBackupRequest(request(archive(), {'Content-Type': 'text/plain'}), db, 'account-a')).status, 415);
    assert.equal((await handleBackupRequest(new Request('https://study.example/backup', {method: 'DELETE'}), db, 'account-a')).status, 405);
    assert.equal(db.history.length, 0); db.close();
  });
  await check('Both declared and actual streamed byte limits reject oversized bodies before writes', async () => {
    const db = database();
    assert.equal((await handleBackupRequest(request('{}', {'Content-Length': String(MAX_BACKUP_BYTES + 1)}), db, 'account-a')).status, 413);
    assert.equal((await handleBackupRequest(request(' '.repeat(MAX_BACKUP_BYTES + 1)), db, 'account-a')).status, 413);
    assert.equal(db.history.length, 0); db.close();
  });
  await check('Oversized direct restore inputs cannot bypass the Request size limit', () => {
    const value = archive(); value.untrusted = 'x'.repeat(MAX_BACKUP_BYTES);
    assert.throws(() => validateBackup(value), error => error.status === 413);
  });
  await check('An empty archive never erases current progress', async () => {
    const db = database(), current = archive(); seed(db, current);
    const empty = archive(); for (const table of BACKUP_TABLES) empty.data[table] = []; empty.files.count = 0;
    await restoreBackup(db, 'account-a', empty);
    assert.deepEqual((await exportBackup(db, 'account-a')).data, current.data); db.close();
  });
  await check('Database failures become a clear HTTP failure after transaction rollback', async () => {
    const db = database(); db.sql.exec("CREATE TRIGGER reject_vocabulary BEFORE INSERT ON vocabulary BEGIN SELECT RAISE(ABORT, 'sensitive diagnostic'); END");
    const response = await handleBackupRequest(request(archive()), db, 'account-a');
    assert.equal(response.status, 503); assert.equal((await response.text()).includes('sensitive diagnostic'), false);
    assert.equal(count(db, 'sessions'), 0); db.close();
  });
  await check('Old version 1 archives restore without removing current account reading positions', async () => {
    const db = database(), input = archive(); input.schemaVersion = 1; delete input.data.reading_positions;
    assert.equal(validateBackup(input).schemaVersion, 2);
    assert.deepEqual(validateBackup(input).data.reading_positions, []);
    db.sql.prepare('INSERT INTO reading_positions VALUES (?,?,?,?)').run('account-a', 'current-book', 91, timestamp + 500);
    const result = await restoreBackup(db, 'account-a', input);
    assert.deepEqual(result.tables.reading_positions, {received: 0, inserted: 0, skipped: 0});
    assert.deepEqual((await exportBackup(db, 'account-a')).data.reading_positions, [{user_id: 'account-a', book_id: 'current-book', page: 91, updated_at: timestamp + 500}]);
    db.close();
  });
  await check('Version 2 requires its reading list while version 1 cannot smuggle extra tables', () => {
    const input = archive(); delete input.data.reading_positions;
    assert.throws(() => validateBackup(input), error => error.status === 400);
    const misleading = archive(); misleading.schemaVersion = 1;
    assert.throws(() => validateBackup(misleading), error => error.status === 400);
  });
  await check('Reading positions export only the source account and restore with destination ownership', async () => {
    const db = database(); seed(db, archive());
    db.sql.prepare('INSERT INTO reading_positions VALUES (?,?,?,?)').run('account-b', 'private-book', 72, timestamp + 400);
    const exported = await exportBackup(db, 'account-a');
    assert.deepEqual(exported.data.reading_positions, archive().data.reading_positions);
    const result = await restoreBackup(db, 'account-c', exported);
    assert.equal(result.tables.reading_positions.inserted, 1);
    assert.deepEqual((await exportBackup(db, 'account-c')).data.reading_positions, [{user_id: 'account-c', book_id: 'book-a', page: 17, updated_at: timestamp + 200}]);
    assert.equal(db.sql.prepare('SELECT page FROM reading_positions WHERE user_id=? AND book_id=?').get('account-b', 'private-book').page, 72);
    db.close();
  });
  await check('Reading restore keeps existing target pages and adds missing or unknown books', async () => {
    const db = database(), input = archive();
    db.sql.prepare('INSERT INTO reading_positions VALUES (?,?,?,?)').run('account-a', 'book-a', 40, timestamp);
    input.data.reading_positions.push({user_id: 'account-a', book_id: 'unpublished-book-edition', page: 66, updated_at: timestamp + 300});
    const result = await restoreBackup(db, 'account-a', input);
    assert.deepEqual(result.tables.reading_positions, {received: 2, inserted: 1, skipped: 1});
    const exported = await exportBackup(db, 'account-a');
    assert.deepEqual(exported.data.reading_positions, [{user_id: 'account-a', book_id: 'book-a', page: 40, updated_at: timestamp}, {user_id: 'account-a', book_id: 'unpublished-book-edition', page: 66, updated_at: timestamp + 300}]);
    db.close();
  });
  await check('Malformed, duplicated and mixed-account reading records are rejected before any restore writes', async () => {
    const db = database();
    const changes = [
      input => { input.data.reading_positions[0].page = 0; },
      input => { input.data.reading_positions[0].page = 100001; },
      input => { input.data.reading_positions[0].book_id = '__proto__'; },
      input => { input.data.reading_positions[0].user_id = 'account-b'; },
      input => { input.data.reading_positions.push(clone(input.data.reading_positions[0])); },
    ];
    for (const change of changes) { const input = archive(); change(input); await assert.rejects(() => restoreBackup(db, 'account-a', input), error => error.status === 400); }
    assert.equal(db.history.length, 0); db.close();
  });
  await check('A reading-position failure also rolls back the earlier seven restored tables', async () => {
    const db = database();
    db.sql.exec("CREATE TRIGGER reject_reading BEFORE INSERT ON reading_positions BEGIN SELECT RAISE(ABORT, 'simulated reading failure'); END");
    await assert.rejects(() => restoreBackup(db, 'account-a', archive()));
    for (const table of BACKUP_TABLES) assert.equal(count(db, table), 0);
    db.close();
  });
  process.stdout.write(`Cloud backup: ${checks} checks passed using isolated in-memory SQLite.\n`);
})().catch(error => { console.error(error); process.exitCode = 1; });
