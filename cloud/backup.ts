import {z} from 'zod';
import {isLegacyStudyBackup,LegacyStudyBackupError} from '../lib/legacy-study-backup';
import {BACKUP_APPLICATION, BACKUP_SCHEMA_VERSION, BACKUP_TABLES, type BackupData, type BackupRestoreResult, type BackupTable, type StudyBackup} from './backup-types';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_ROWS = 50000;
// This namespace is never a valid uploaded file key. Restoring metadata cannot
// grant access to a bucket object named by an untrusted backup.
export const UNRESTORED_FILE_PREFIX = 'unrestored-backup/';
const BATCH_JSON_BYTES = 256 * 1024;
const encoder = new TextEncoder();

export class BackupError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'BackupError'; }
}

const id = z.string().min(1).max(512);
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const common = {created_at: time, updated_at: time, revision: time};
const sessionSchema = z.object({
  id, user_id: id, mode: z.enum(['practice', 'exam', 'wrong']), status: z.enum(['active', 'finished']),
  question_ids: z.string().max(1024 * 1024), position: time, started_at: time, finished_at: time.nullable(),
}).strict();
const responseSchema = z.object({session_id: id, question_id: id, selected: z.string().max(512), correct: z.union([z.literal(0), z.literal(1)]), answered_at: time}).strict();
const vocabularySchema = z.object({
  id, user_id: id, word: z.string().min(1).max(200), word_key: z.string().min(1).max(400), kind: z.enum(['term', 'word']),
  meaning: z.string().max(4000), example: z.string().max(6000), question_id: id.nullable(), session_id: id.nullable(),
  subject_id: id.nullable(), source_label: z.string().max(2000), stage: time, next_review: date, review_count: time,
  last_reviewed_at: time.nullable(), last_reviewed_date: date.nullable(), queue_date: date.nullable(), queue_order: time, ...common,
}).strict();
const annotationSchema = z.object({
  id, user_id: id, book_id: id, page: time.min(1), quote: z.string().max(8000), note: z.string().max(10000),
  color: z.literal('yellow'), rects: z.string().max(64000), source_question_id: id.nullable(), ...common,
}).strict();
const titleSchema = z.object({user_id: id, book_id: id, title: z.string().max(2000), subject_id: id.nullable(), updated_at: time, revision: time}).strict();
const bookmarkSchema = z.object({user_id: id, book_id: id, page: time.min(1), note: z.string().max(10000), ...common}).strict();
const textbookSchema = z.object({
  id, user_id: id, title: z.string().max(2000), subject_id: id, original_name: z.string().max(2000), page_count: time.min(1),
  storage_key: z.string().max(2000), size_bytes: time, ...common,
}).strict();
const readingBookId = z.string().min(1).max(200).refine(value => value.trim().length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value) && !/[\u0000-\u001f\u007f]/.test(value));
const readingPositionSchema = z.object({user_id: id, book_id: readingBookId, page: time.min(1).max(100000), updated_at: time}).strict();
const dataSchemas = {
  sessions: sessionSchema, responses: responseSchema, vocabulary: vocabularySchema,
  textbook_annotations: annotationSchema, textbook_titles: titleSchema,
  textbook_bookmarks: bookmarkSchema, user_textbooks: textbookSchema, reading_positions: readingPositionSchema,
};
const backupSchema = z.object({
  application: z.literal(BACKUP_APPLICATION), schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().datetime({offset: true}), sourceAccountId: id,
  data: z.object({
    sessions: z.array(sessionSchema), responses: z.array(responseSchema), vocabulary: z.array(vocabularySchema),
    textbook_annotations: z.array(annotationSchema), textbook_titles: z.array(titleSchema),
    textbook_bookmarks: z.array(bookmarkSchema), user_textbooks: z.array(textbookSchema), reading_positions: z.array(readingPositionSchema),
  }).strict(),
  files: z.object({included: z.literal(false), kind: z.literal('metadata-only'), count: time}).strict(),
}).strict();
const legacyBackupSchema = backupSchema.extend({schemaVersion: z.literal(1), data: backupSchema.shape.data.omit({reading_positions: true})});
const importBackupSchema = z.discriminatedUnion('schemaVersion', [backupSchema, legacyBackupSchema]);

function account(userId: string) {
  if (!id.safeParse(userId).success) throw new BackupError('请先登录，再管理学习备份。', 401);
}
function unique(rows: unknown[], key: (row: Record<string, unknown>) => string) {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = key(row as Record<string, unknown>);
    if (seen.has(value)) throw new BackupError('备份中包含重复记录，请重新导出。');
    seen.add(value);
  }
}

/** Validates the full archive without consulting the current question catalogue. */
export function validateBackup(input: unknown): StudyBackup {
  let bytes: number;
  try { bytes = encoder.encode(JSON.stringify(input)).byteLength; }
  catch { throw new BackupError('无法读取备份格式。'); }
  if (bytes > MAX_BACKUP_BYTES) throw new BackupError('备份超过 20 MB，尚未恢复任何内容。', 413);
  const parsed = importBackupSchema.safeParse(input);
  if (!parsed.success) throw new BackupError('备份格式或版本不受支持，尚未恢复任何内容。');
  const backup: StudyBackup = parsed.data.schemaVersion === 1
    ? {...parsed.data, schemaVersion: BACKUP_SCHEMA_VERSION, data: {...parsed.data.data, reading_positions: []}}
    : parsed.data;
  if (BACKUP_TABLES.reduce((count, table) => count + backup.data[table].length, 0) > MAX_BACKUP_ROWS) {
    throw new BackupError('备份记录过多，尚未恢复任何内容。', 413);
  }
  if (backup.files.count !== backup.data.user_textbooks.length) throw new BackupError('教材文件清单数量不一致。');
  const sessionQuestions = new Map<string, Set<string>>();
  for (const session of backup.data.sessions) {
    let questions: unknown;
    try { questions = JSON.parse(session.question_ids); } catch { throw new BackupError('练习题目列表格式无效。'); }
    if (!Array.isArray(questions) || !questions.length || questions.some(value => !id.safeParse(value).success) || new Set(questions).size !== questions.length || session.position >= questions.length) {
      throw new BackupError('练习题目列表或当前位置无效。');
    }
    sessionQuestions.set(session.id, new Set(questions as string[]));
  }
  for (const response of backup.data.responses) {
    if (!sessionQuestions.get(response.session_id)?.has(response.question_id)) throw new BackupError('答案缺少对应的练习或题目记录。');
  }
  for (const annotation of backup.data.textbook_annotations) {
    let rects: unknown;
    try { rects = JSON.parse(annotation.rects); } catch { throw new BackupError('教材批注坐标格式无效。'); }
    const rectSchema = z.array(z.object({x: z.number().finite(), y: z.number().finite(), width: z.number().finite(), height: z.number().finite()}).strict()).max(100);
    if (!rectSchema.safeParse(rects).success) throw new BackupError('教材批注坐标格式无效。');
  }
  for (const table of BACKUP_TABLES) {
    // Source ownership is informational only; every write is bound to userId.
    for (const row of backup.data[table]) {
      if ('user_id' in row && row.user_id !== backup.sourceAccountId) throw new BackupError('备份混合了不同账号的记录。');
      if ('updated_at' in row && 'created_at' in row && row.updated_at < row.created_at) throw new BackupError('备份记录时间无效。');
    }
    unique(backup.data[table], row => table === 'responses' ? JSON.stringify([row.session_id, row.question_id])
      : table === 'textbook_bookmarks' ? JSON.stringify([row.book_id, row.page])
      : table === 'textbook_titles' || table === 'reading_positions' ? String(row.book_id) : String(row.id));
  }
  unique(backup.data.vocabulary, row => String(row.word_key));
  return backup;
}

/** One D1 batch gives the exported tables one transactional snapshot. */
export async function exportBackup(db: D1Database, userId: string): Promise<StudyBackup> {
  account(userId);
  const statements = BACKUP_TABLES.map(table => db.prepare(table === 'responses'
    ? `SELECT r.* FROM responses r JOIN sessions s ON s.id=r.session_id WHERE s.user_id=? ORDER BY r.session_id,r.question_id LIMIT ${MAX_BACKUP_ROWS + 1}`
    : `SELECT * FROM ${table} WHERE user_id=? ORDER BY ${table === 'textbook_titles' || table === 'reading_positions' ? 'book_id' : table === 'textbook_bookmarks' ? 'book_id,page' : 'id'} LIMIT ${MAX_BACKUP_ROWS + 1}`).bind(userId));
  const results = await db.batch(statements);
  const data = Object.fromEntries(BACKUP_TABLES.map((table, index) => [table, results[index].results])) as BackupData;
  return validateBackup({application: BACKUP_APPLICATION, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), sourceAccountId: userId, data, files: {included: false, kind: 'metadata-only', count: data.user_textbooks.length}});
}

function chunks(rows: unknown[]) {
  const result: string[] = [];
  let current: string[] = [], size = 2;
  for (const row of rows) {
    const json = JSON.stringify(row), bytes = encoder.encode(json).byteLength + 1;
    if (current.length && (current.length >= 100 || size + bytes > BATCH_JSON_BYTES)) {
      result.push(`[${current.join(',')}]`); current = []; size = 2;
    }
    current.push(json); size += bytes;
  }
  if (current.length) result.push(`[${current.join(',')}]`);
  return result;
}

/** Additive restore: no UPDATE, DELETE, ownership changes or catalogue filtering. */
export async function restoreBackup(db: D1Database, userId: string, input: unknown): Promise<BackupRestoreResult> {
  account(userId);
  let migration:BackupRestoreResult['migration'];
  if(isLegacyStudyBackup(input)){
    try{
      const {prepareLegacyStudyImport}=await import('./legacy-study-import');
      const converted=prepareLegacyStudyImport(input,userId);input=converted.backup;migration=converted.migration;
    }catch(error){if(error instanceof LegacyStudyBackupError)throw new BackupError(error.message,error.status);throw error;}
  }
  const backup = validateBackup(input);
  const statements: D1PreparedStatement[] = [], owners: BackupTable[] = [];
  for (const table of BACKUP_TABLES) {
    const columns = Object.keys(dataSchemas[table].shape);
    for (const json of chunks(backup.data[table])) {
      const values = columns.map(column => column === 'user_id' ? '?'
        : table === 'user_textbooks' && column === 'storage_key' ? `? || json_extract(item.value,'$.id')`
        : `json_extract(item.value,'$.${column}')`);
      // A session ID belonging to another account may conflict globally. Never
      // attach answers to that session, even when its ID appears in the archive.
      const condition = table === 'responses'
        ? `EXISTS (SELECT 1 FROM sessions s WHERE s.id=json_extract(item.value,'$.session_id') AND s.user_id=? AND EXISTS (SELECT 1 FROM json_each(s.question_ids) q WHERE q.value=json_extract(item.value,'$.question_id')))`
        : '1';
      const bindings: string[] = [];
      for (const column of columns) {
        if (column === 'user_id') bindings.push(userId);
        else if (table === 'user_textbooks' && column === 'storage_key') bindings.push(UNRESTORED_FILE_PREFIX);
      }
      bindings.push(json);
      if (table === 'responses') bindings.push(userId);
      statements.push(db.prepare(`INSERT INTO ${table} (${columns.join(',')}) SELECT ${values.join(',')} FROM json_each(?) item WHERE ${condition} ON CONFLICT DO NOTHING`).bind(...bindings));
      owners.push(table);
    }
  }
  statements.push(db.prepare(`SELECT id,title,original_name AS originalName,size_bytes AS sizeBytes FROM user_textbooks WHERE user_id=? AND storage_key LIKE ? ORDER BY id`).bind(userId, `${UNRESTORED_FILE_PREFIX}%`));
  // D1 executes the entire batch as one transaction, including all chunks. A
  // failed statement rolls back preceding writes instead of leaving half a restore.
  const results = await db.batch(statements);
  const tables = Object.fromEntries(BACKUP_TABLES.map(table => [table, {received: backup.data[table].length, inserted: 0, skipped: 0}])) as BackupRestoreResult['tables'];
  owners.forEach((table, index) => { tables[table].inserted += results[index].meta.changes; });
  BACKUP_TABLES.forEach(table => { tables[table].skipped = tables[table].received - tables[table].inserted; });
  return {ok: true, mode: 'merge-preserve-existing', ...(migration?{migration}:{}), tables, files: {restored: false, requiresUpload: results[results.length - 1].results as BackupRestoreResult['files']['requiresUpload']}};
}

async function readBackup(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim();
  if (contentType !== 'application/json') throw new BackupError('请选择 JSON 格式的学习备份。', 415);
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BACKUP_BYTES) throw new BackupError('备份超过 20 MB。', 413);
  if (!request.body) throw new BackupError('备份内容为空。');
  const reader = request.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BACKUP_BYTES) { await reader.cancel(); throw new BackupError('备份超过 20 MB。', 413); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new BackupError('备份不是有效的 JSON 文件。'); }
}

/** The caller authenticates userId and applies its normal origin/CSRF policy. */
export async function handleBackupRequest(request: Request, db: D1Database, userId: string): Promise<Response> {
  const headers = {'Cache-Control': 'no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff'};
  try {
    account(userId);
    if (request.method === 'GET') {
      const backup = await exportBackup(db, userId);
      return Response.json(backup, {headers: {...headers, 'Content-Disposition': `attachment; filename="sqe-study-backup-${backup.exportedAt.slice(0, 10)}.json"`}});
    }
    if (request.method === 'POST') return Response.json(await restoreBackup(db, userId, await readBackup(request)), {headers});
    return Response.json({error: '此备份接口只支持导出和恢复。'}, {status: 405, headers: {...headers, Allow: 'GET, POST'}});
  } catch (error) {
    if (error instanceof BackupError) return Response.json({error: error.message}, {status: error.status, headers});
    return Response.json({error: '暂时无法完成备份操作，请重试。'}, {status: 503, headers});
  }
}
