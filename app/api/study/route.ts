import { getChatGPTUser } from '../../chatgpt-auth';
import { database } from '@/db/store';
import { questions,publicQuestions } from '@/lib/questions';
import {examDurationMs} from '@/lib/study-timing';
import {subjectById} from '@/lib/subjects';
import {sourceById} from '@/lib/question-sources';
import {chapterById,filterQuestions} from '@/lib/chapters';
import type {Session,StudyData} from '@/lib/study-types';
export const dynamic='force-dynamic';
type Row={id:string;user_id:string;mode:Session['mode'];status:Session['status'];question_ids:string;position:number;started_at:number;finished_at:number|null};
type AnswerRow={session_id:string;question_id:string;selected:string;correct:number;answered_at:number};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
async function sessionRow(user:string,id?:string|null):Promise<Row|null>{const db=database();return id?db.prepare('SELECT * FROM sessions WHERE id=? AND user_id=?').bind(id,user).first<Row>():db.prepare('SELECT * FROM sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 1').bind(user).first<Row>();}
async function finish(row:Row){const db=database();const ids=JSON.parse(row.question_ids) as string[];const now=Date.now();await db.batch([...ids.map(id=>db.prepare('INSERT OR IGNORE INTO responses (session_id,question_id,selected,correct,answered_at) VALUES (?,?,?,?,?)').bind(row.id,id,'',0,now)),db.prepare("UPDATE sessions SET status='finished',finished_at=? WHERE id=? AND user_id=? AND status='active'").bind(now,row.id,row.user_id)]);}
async function expire(row:Row|null){if(row?.mode==='exam'&&row.status==='active'&&Date.now()>=row.started_at+examDurationMs(JSON.parse(row.question_ids))){await finish(row);return sessionRow(row.user_id,row.id);}return row;}
async function payload(user:string,id?:string|null):Promise<StudyData>{const db=database();const availableIds=new Set(questions.map(q=>q.id));const validRow=(row:Row)=>JSON.parse(row.question_ids).every((questionId:string)=>availableIds.has(questionId));const currentCandidate=await expire(await sessionRow(user,id));const current=currentCandidate&&validRow(currentCandidate)?currentCandidate:null;const rows=(await db.prepare('SELECT * FROM sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 100').bind(user).all<Row>()).results.filter(validRow);const answers=(await db.prepare('SELECT r.* FROM responses r JOIN sessions s ON s.id=r.session_id WHERE s.user_id=? ORDER BY r.answered_at DESC,r.session_id DESC').bind(user).all<AnswerRow>()).results.filter(a=>availableIds.has(a.question_id));
const serial=(r:Row):Session=>{const visible=r.mode!=='exam'||r.status==='finished';const list=answers.filter(a=>a.session_id===r.id);return{id:r.id,mode:r.mode,status:r.status,questionIds:JSON.parse(r.question_ids),position:r.position,startedAt:r.started_at,finishedAt:r.finished_at,answers:Object.fromEntries(list.map(a=>[a.question_id,{selected:a.selected,...(visible?{correct:!!a.correct}:{})}])),...(visible?{score:list.filter(a=>a.correct).length}:{})};};
const s=current?serial(current):null;
const graded=(await db.prepare("SELECT r.* FROM responses r JOIN sessions s ON s.id=r.session_id WHERE s.user_id=? AND (s.mode!='exam' OR s.status='finished') ORDER BY r.answered_at DESC,r.session_id DESC").bind(user).all<AnswerRow>()).results.filter(a=>availableIds.has(a.question_id));
const mistakes:StudyData['mistakes']=[];
for(const q of questions){const related=graded.filter(a=>a.question_id===q.id);const count=related.filter(a=>!a.correct).length;if(count)mistakes.push({questionId:q.id,wrongCount:count,selected:related[0].selected,lastCorrect:!!related[0].correct,topic:q.explanation.topic});}
const correct=graded.filter(a=>a.correct).length;
const unseenQuestions=publicQuestions();
return{questions:questions.map((q,index)=>{const visible=s?.answers[q.id]&&(s.mode!=='exam'||s.status==='finished');return visible?q:unseenQuestions[index];}),session:s,sessions:rows.map(serial),stats:{answered:graded.length,correct,accuracy:graded.length?Math.round(correct/graded.length*100):null,wrongCount:mistakes.filter(m=>!m.lastCorrect).length},mistakes};}
export async function GET(request:Request){const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再保存和读取学习记录。'},401);try{return json(await payload(user.userId,new URL(request.url).searchParams.get('session')));}catch(e){console.error('Study load failed',e);return json({error:'暂时无法读取记录，请重试。'},503);}}
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再保存学习记录。'},401);
if(request.headers.get('x-study-action')!=='1'||!request.headers.get('content-type')?.includes('application/json')||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请求无效，请刷新后重试。'},403);
let body:Record<string,unknown>;try{const text=await request.text();if(text.length>10000)return json({error:'请求过大。'},400);body=JSON.parse(text);if(!body||typeof body!=='object')throw Error();}catch{return json({error:'请求格式无效。'},400);}
try{const db=database();const action=body.action;const sessionId=typeof body.sessionId==='string'?body.sessionId:null;
if(action==='start'){
 if(typeof body.id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.id)||!['practice','exam','wrong'].includes(String(body.mode)))return json({error:'练习设置无效。'},400);
 if(body.subjectId!==undefined&&(typeof body.subjectId!=='string'||!subjectById(body.subjectId)))return json({error:'请选择有效科目。'},400);
 if(body.sourceId!==undefined&&(typeof body.sourceId!=='string'||!sourceById(body.sourceId)))return json({error:'请选择有效题目来源。'},400);
 if(body.sourceSet!==undefined&&(typeof body.sourceSet!=='string'||!questions.some(q=>q.sourceSet===body.sourceSet)))return json({error:'请选择有效的试卷场次。'},400);
 if(body.chapterId!==undefined&&(typeof body.chapterId!=='string'||!chapterById(body.chapterId)||!body.subjectId||chapterById(body.chapterId)?.subjectId!==body.subjectId))return json({error:'请选择有效的科目与章节。'},400);
 const filtered=filterQuestions(questions,{subjectId:body.subjectId as string|undefined,sourceId:body.sourceId as string|undefined,chapterId:body.chapterId as string|undefined,sourceSet:body.sourceSet as string|undefined});
 let ids=filtered.map(q=>q.id);
 if(!ids.length)return json({error:'所选来源、科目或章节尚未导入题目。'},400);
 if(body.mode==='wrong'){const data=await payload(user.userId);ids=data.mistakes.filter(m=>!m.lastCorrect).map(m=>m.questionId);if(body.subjectId)ids=ids.filter(id=>questions.find(q=>q.id===id)?.subjectId===body.subjectId);if(body.sourceId)ids=ids.filter(id=>questions.find(q=>q.id===id)?.sourceId===body.sourceId);if(body.chapterId||body.sourceSet)ids=ids.filter(id=>filtered.some(q=>q.id===id));if(typeof body.questionId==='string')ids=ids.filter(id=>id===body.questionId);if(!ids.length)return json({error:'暂时没有需要重练的错题。'},400);}
 await db.prepare('INSERT OR IGNORE INTO sessions (id,user_id,mode,status,question_ids,position,started_at) VALUES (?,?,?,?,?,?,?)').bind(body.id,user.userId,body.mode,'active',JSON.stringify(ids),0,Date.now()).run();
 const owned=await sessionRow(user.userId,body.id);if(!owned)return json({error:'练习编号冲突，请重新开始。'},409);return json(await payload(user.userId,body.id));
}
let row=await sessionRow(user.userId,sessionId);if(!sessionId||!row)return json({error:'找不到这次练习。'},404);row=await expire(row);if(!row)throw Error('Lost session');
if(action==='navigate'){if(!Number.isInteger(body.position)||Number(body.position)<0||Number(body.position)>=JSON.parse(row.question_ids).length)return json({error:'题号无效。'},400);await db.prepare('UPDATE sessions SET position=? WHERE id=? AND user_id=?').bind(body.position,row.id,user.userId).run();return json(await payload(user.userId,row.id));}
if(row.status==='finished')return json(await payload(user.userId,row.id));
if(action==='answer'){
 const q=questions.find(q=>q.id===body.questionId);if(!q||!JSON.parse(row.question_ids).includes(q.id)||!q.options.some(o=>o.id===body.selected))return json({error:'请选择有效答案。'},400);
 const correct=body.selected===q.explanation.answer?1:0;
 if(row.mode==='exam')await db.prepare("INSERT INTO responses (session_id,question_id,selected,correct,answered_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE id=? AND user_id=? AND status='active' AND started_at+?>?) ON CONFLICT(session_id,question_id) DO UPDATE SET selected=excluded.selected,correct=excluded.correct,answered_at=excluded.answered_at").bind(row.id,q.id,body.selected,correct,Date.now(),row.id,user.userId,examDurationMs(JSON.parse(row.question_ids)),Date.now()).run();
 else await db.prepare('INSERT OR IGNORE INTO responses (session_id,question_id,selected,correct,answered_at) VALUES (?,?,?,?,?)').bind(row.id,q.id,body.selected,correct,Date.now()).run();
 return json(await payload(user.userId,row.id));
}
if(action==='finish'){if(row.mode!=='exam'){const count=await db.prepare('SELECT COUNT(*) AS n FROM responses WHERE session_id=?').bind(row.id).first<{n:number}>();if(count?.n!==JSON.parse(row.question_ids).length)return json({error:'请先完成本组题目。'},400);}await finish(row);return json(await payload(user.userId,row.id));}
return json({error:'未知操作。'},400);
}catch(e){console.error('Study save failed',e);return json({error:'这次操作未能确认保存，请重试。'},503);}}
