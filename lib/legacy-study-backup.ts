import {z} from 'zod';
import type {GuestStudyState} from './guest-study';

export const LEGACY_GUEST_STUDY_KEY='sqe-practice:guest-study:v1';
export const LEGACY_STUDY_BACKUP_FORMAT='sqe-practice-legacy-study' as const;
export const LEGACY_STUDY_BACKUP_VERSION=1 as const;
const MAX_BYTES=20*1024*1024,MAX_RECORDS=50000;
const time=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sessionId=z.string().regex(/^[0-9a-f-]{36}$/i);
const questionId=z.string().min(1).max(512).refine(value=>!['__proto__','constructor','prototype'].includes(value));
// Additional fields (including user IDs and claimed correctness) are deliberately
// discarded. The legacy browser state never had authoritative account ownership.
const answerSchema=z.object({selected:z.string().max(512),answeredAt:time});
const sessionSchema=z.object({
 id:sessionId,mode:z.enum(['practice','exam','wrong']),status:z.enum(['active','finished']),
 questionIds:z.array(questionId).min(1).max(MAX_RECORDS),position:time,
 startedAt:time,finishedAt:time.nullable(),answers:z.record(questionId,answerSchema),
});
const stateSchema=z.object({version:z.literal(1),currentSessionId:sessionId.nullable(),sessions:z.array(sessionSchema)});
const backupSchema=z.object({
 format:z.literal(LEGACY_STUDY_BACKUP_FORMAT),formatVersion:z.literal(LEGACY_STUDY_BACKUP_VERSION),
 scope:z.literal('study-only'),exportedAt:z.string().datetime({offset:true}),study:stateSchema,
});
export type LegacyBrowserStudyBackup={
 format:typeof LEGACY_STUDY_BACKUP_FORMAT;formatVersion:typeof LEGACY_STUDY_BACKUP_VERSION;
 scope:'study-only';exportedAt:string;study:GuestStudyState;
};
export class LegacyStudyBackupError extends Error{
 constructor(message:string,public status=400){super(message);this.name='LegacyStudyBackupError';}
}
function byteLength(input:unknown){
 try{return new TextEncoder().encode(JSON.stringify(input)).byteLength;}
 catch{throw new LegacyStudyBackupError('无法读取旧浏览器做题记录。');}
}
export function isLegacyStudyBackup(input:unknown):boolean{
 return !!input&&typeof input==='object'&&!Array.isArray(input)&&(input as {format?:unknown}).format===LEGACY_STUDY_BACKUP_FORMAT;
}
/** Validate without the current question bank; exporting must not erase old IDs. */
export function parseLegacyStudyBackup(input:unknown):LegacyBrowserStudyBackup{
 if(byteLength(input)>MAX_BYTES)throw new LegacyStudyBackupError('旧浏览器备份超过 20 MB。',413);
 const parsed=backupSchema.safeParse(input);
 if(!parsed.success)throw new LegacyStudyBackupError('旧浏览器做题备份格式或版本无效，原记录未更改。');
 const value:LegacyBrowserStudyBackup=parsed.data,seen=new Set<string>();let records=value.study.sessions.length;
 for(const session of value.study.sessions){
  if(seen.has(session.id))throw new LegacyStudyBackupError('旧浏览器记录包含重复的练习编号。');
  seen.add(session.id);
  const ids=new Set(session.questionIds);
  if(ids.size!==session.questionIds.length||session.position>=session.questionIds.length)throw new LegacyStudyBackupError('旧浏览器记录中的题目列表或当前位置无效。');
  if(session.status==='finished'&&session.finishedAt===null||session.status==='active'&&session.finishedAt!==null)throw new LegacyStudyBackupError('旧浏览器记录中的练习完成时间无效。');
  for(const id of Object.keys(session.answers))if(!ids.has(id))throw new LegacyStudyBackupError('旧浏览器答案缺少对应的练习题目。');
  records+=Object.keys(session.answers).length;
 }
 if(records>MAX_RECORDS)throw new LegacyStudyBackupError('旧浏览器备份记录过多。',413);
 if(value.study.currentSessionId!==null&&!seen.has(value.study.currentSessionId))throw new LegacyStudyBackupError('旧浏览器当前练习不存在，请保留原记录后重试。');
 return value;
}
/** Only builds a file value. It never reads or writes browser storage itself. */
export function createLegacyStudyBackup(rawState:unknown,now=Date.now()):LegacyBrowserStudyBackup{
 return parseLegacyStudyBackup({format:LEGACY_STUDY_BACKUP_FORMAT,formatVersion:LEGACY_STUDY_BACKUP_VERSION,scope:'study-only',exportedAt:new Date(now).toISOString(),study:rawState});
}
/** The caller explicitly supplies the old site's storage. Reads never write back. */
export function readLegacyStudyBackup(storage:Pick<Storage,'getItem'>,now=Date.now()):LegacyBrowserStudyBackup{
 let raw:string|null;
 try{raw=storage.getItem(LEGACY_GUEST_STUDY_KEY);}catch{throw new LegacyStudyBackupError('无法读取此浏览器的做题记录，请检查存储权限。');}
 if(raw===null)throw new LegacyStudyBackupError('此浏览器没有可导出的做题记录。');
 if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)throw new LegacyStudyBackupError('旧浏览器备份超过 20 MB。',413);
 let state:unknown;try{state=JSON.parse(raw);}catch{throw new LegacyStudyBackupError('本机做题记录格式无效，原记录未更改。');}
 const backup=createLegacyStudyBackup(state,now);
 if(!backup.study.sessions.length)throw new LegacyStudyBackupError('此浏览器还没有可导出的练习。');
 return backup;
}
