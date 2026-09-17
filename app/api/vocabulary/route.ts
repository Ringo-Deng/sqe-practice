import {getChatGPTUser} from '../../chatgpt-auth';
import {database} from '@/db/store';
import {questions} from '@/lib/questions';
import {sourceById,questionNumberLabel} from '@/lib/question-sources';
import {wordKey,validTimeZone,reviewDate,nextReview} from '@/lib/vocabulary';
import type {VocabularyCard,Rating} from '@/lib/vocabulary';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
const columns=`id,word,kind,meaning,example,question_id AS questionId,session_id AS sessionId,subject_id AS subjectId,source_label AS sourceLabel,stage,next_review AS nextReview,review_count AS reviewCount,last_reviewed_at AS lastReviewedAt,last_reviewed_date AS lastReviewedDate,queue_date AS queueDate,queue_order AS queueOrder,created_at AS createdAt,updated_at AS updatedAt,revision`;
async function payload(userId:string,timeZone:string,extra:Record<string,unknown>={}){
 const cards=(await database().prepare(`SELECT ${columns} FROM vocabulary WHERE user_id=? ORDER BY created_at DESC,id`).bind(userId).all<VocabularyCard>()).results;
 return {cards,today:reviewDate(timeZone),timeZone,...extra};
}
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再读取单词表。'},401);
 try{return json(await payload(user.userId,validTimeZone(new URL(request.url).searchParams.get('timeZone'))));}
 catch(e){console.error('Vocabulary load failed',e);return json({error:'暂时无法读取单词表，请重试。'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再保存单词。'},401);
 if(request.headers.get('x-study-action')!=='1'||!request.headers.get('content-type')?.includes('application/json')||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请求无效，请刷新后重试。'},403);
 let body:Record<string,unknown>;
 try{const text=await request.text();if(text.length>15000)throw Error();body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json({error:'单词内容格式无效或过长。'},400);}
 if(typeof body.id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.id))return json({error:'单词编号无效。'},400);
 const timeZone=validTimeZone(body.timeZone),today=reviewDate(timeZone),now=Date.now();
 try{
  const db=database();
  const existing=await db.prepare(`SELECT ${columns} FROM vocabulary WHERE id=? AND user_id=?`).bind(body.id,user.userId).first<VocabularyCard>();
  if(body.action==='add'||body.action==='edit'){
   if(typeof body.word!=='string'||!body.word.trim()||body.word.length>200||typeof body.meaning!=='string'||body.meaning.length>4000||typeof body.example!=='string'||body.example.length>6000||!['word','term'].includes(String(body.kind)))return json({error:'请填写词语（最多 200 字）；释义最多 4,000 字，原句最多 6,000 字。'},400);
   const word=body.word.trim().replace(/\s+/g,' '),key=wordKey(word);
   const duplicate=await db.prepare('SELECT id FROM vocabulary WHERE user_id=? AND word_key=?').bind(user.userId,key).first<{id:string}>();
   if(duplicate&&duplicate.id!==body.id)return json(await payload(user.userId,timeZone,{savedId:duplicate.id,duplicate:true}));
   if(body.action==='edit'){
    if(!existing)return json({error:'这个词已被删除，请刷新单词表。'},404);
    if(body.revision!==existing.revision)return json({error:'这个词已在其他页面更新，请刷新后重新编辑。'},409);
    const result=await db.prepare('UPDATE vocabulary SET word=?,word_key=?,kind=?,meaning=?,example=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=?').bind(word,key,body.kind,body.meaning.trim(),body.example.trim(),now,body.id,user.userId,body.revision).run();
    if(!result.meta.changes)return json({error:'这个词已更新，请刷新后重试。'},409);
   }else{
    // A repeated add with the same id does not overwrite a saved review schedule.
    if(existing)return json(await payload(user.userId,timeZone,{savedId:existing.id,duplicate:true}));
    const q=typeof body.questionId==='string'?questions.find(q=>q.id===body.questionId):undefined;
    if(body.questionId!=null&&!q)return json({error:'来源题目无效。'},400);
    let sessionId:string|null=null;
    if(body.sessionId!=null){
     if(typeof body.sessionId!=='string'||!q)return json({error:'来源练习无效。'},400);
     const session=await db.prepare('SELECT question_ids FROM sessions WHERE id=? AND user_id=?').bind(body.sessionId,user.userId).first<{question_ids:string}>();
     if(!session||!JSON.parse(session.question_ids).includes(q.id))return json({error:'来源练习无效。'},400);
     sessionId=body.sessionId;
    }
    await db.prepare('INSERT OR IGNORE INTO vocabulary (id,user_id,word,word_key,kind,meaning,example,question_id,session_id,subject_id,source_label,next_review,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(body.id,user.userId,word,key,body.kind,body.meaning.trim(),body.example.trim(),q?.id??null,sessionId,q?.subjectId??null,q?`${sourceById(q.sourceId)?.name??q.sourceId} · ${questionNumberLabel(q)}`:'',today,now,now).run();
    const saved=await db.prepare('SELECT id FROM vocabulary WHERE user_id=? AND word_key=?').bind(user.userId,key).first<{id:string}>();
    if(!saved)return json({error:'单词编号冲突，请关闭后重新添加。'},409);
    return json(await payload(user.userId,timeZone,{savedId:saved.id,duplicate:saved.id!==body.id}));
   }
   return json(await payload(user.userId,timeZone,{savedId:body.id}));
  }
  if(body.action==='delete'&&!existing)return json(await payload(user.userId,timeZone));
  if(!existing)return json({error:'找不到这个词，请刷新单词表。'},404);
  if(!Number.isInteger(body.revision)||body.revision!==existing.revision)return json({error:'这个词已更新，请刷新单词表后重试。'},409);
  if(body.action==='delete'){
   const result=await db.prepare('DELETE FROM vocabulary WHERE id=? AND user_id=? AND revision=?').bind(body.id,user.userId,body.revision).run();
   if(!result.meta.changes)return json({error:'这个词已更新，请刷新后重试。'},409);
  }else if(body.action==='rate'){
   if(!['again','hard','good'].includes(String(body.rating)))return json({error:'请选择复习结果。'},400);
   if(existing.nextReview>today)return json({error:'这个词尚未到复习时间，请刷新单词表。'},409);
   const next=nextReview(existing,body.rating as Rating,today,now);
   const result=await db.prepare('UPDATE vocabulary SET stage=?,next_review=?,queue_date=?,queue_order=?,last_reviewed_at=?,last_reviewed_date=?,review_count=review_count+1,updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=?').bind(next.stage,next.nextReview,next.queueDate,next.queueOrder,now,today,now,body.id,user.userId,body.revision).run();
   if(!result.meta.changes)return json({error:'复习结果已更新，请刷新后继续。'},409);
  }else return json({error:'未知操作。'},400);
  return json(await payload(user.userId,timeZone));
 }catch(e){console.error('Vocabulary save failed',e);return json({error:'这次操作未能确认保存，内容仍保留，请重试。'},503);}
}
