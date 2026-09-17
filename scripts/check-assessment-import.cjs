// Exercise the real study API against an isolated in-memory database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,mode TEXT,status TEXT,question_ids TEXT,position INTEGER,started_at INTEGER,finished_at INTEGER); CREATE TABLE responses(session_id TEXT,question_id TEXT,selected TEXT,correct INTEGER,answered_at INTEGER,PRIMARY KEY(session_id,question_id));');
const db={prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},batch:operations=>Promise.all(operations.map(statement=>statement.run()))};
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../../chatgpt-auth')return {getChatGPTUser:async()=>({userId:'import-test-user'})};
 if(request==='@/db/store')return {database:()=>db};
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 return nativeLoad.call(this,request,parent,isMain);
};
const api=require('../app/api/study/route.ts');
const {questions,publicQuestions}=require('../lib/questions.ts');
const originalRevise=require('../lib/revise-flk1-assessment-2025-26.json');
const originalFlk2=require('../lib/sra-flk2-original.json');
const pretestedFlk2=require('../lib/sra-flk2-pretested.json');
const reviseFlk2=require('../lib/revise-flk2-practice-assessment.json');
const originalQlts=require('../lib/qlts-mock-exams-1-5.json');
const qltsSource=require('../lib/qlts-mock-exams-1-5-source.json');
const translations=require('../lib/revise-assessment-translations.json');
const {filterQuestions,chapterById}=require('../lib/chapters.ts');
const {linkedTextbooks}=require('../lib/textbooks.ts');
async function post(body,status=200){
 const response=await api.POST(new Request('https://example.test/api/study',{method:'POST',headers:{'content-type':'application/json','x-study-action':'1'},body:JSON.stringify(body)}));
 const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
}
async function get(session){const response=await api.GET(new Request('https://example.test/api/study?session='+session));assert.equal(response.status,200);return response.json();}
async function main(){
 const imported=questions.filter(q=>q.sourceSet?.startsWith('revise-flk1-2025-26-'));
 const importedFlk2=questions.filter(q=>q.sourceSet?.startsWith('revise-flk2-practice-'));
 const importedQlts=questions.filter(q=>q.sourceId==='qlts');
 assert.equal(imported.length,180);
 assert.equal(importedFlk2.length,180);
 assert.equal(importedQlts.length,445);
 assert.equal(qltsSource.importedQuestions,importedQlts.length);
 assert.deepEqual(importedQlts.map(q=>q.id),originalQlts.map(q=>q.id));
 for(const mock of qltsSource.mocks){
  const items=filterQuestions(questions,{sourceId:'qlts',sourceSet:`qlts-mock-exam-${mock.mock}`});
  assert.equal(items.length,mock.importedQuestions);
  assert.ok(items.every(q=>q.sourcePages?.length&&q.explanation.en&&q.options.some(option=>option.id===q.explanation.answer)));
 }
 assert.equal(originalFlk2.length,45);
 assert.equal(pretestedFlk2.length,65);
 assert.deepEqual(Object.keys(translations).sort(),imported.map(q=>q.id).sort());
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 assert.ok(imported.every(q=>chapterById(q.chapterId)), 'Every FLK1 Revise question must resolve to a chapter');
 assert.ok(importedFlk2.every(q=>chapterById(q.chapterId)), 'Every FLK2 Revise question must resolve to a chapter');
 assert.ok([...originalFlk2,...pretestedFlk2].every(q=>q.explanation.answer&&q.options.length===5&&q.subjectId));
 assert.ok([...originalFlk2,...pretestedFlk2].every(q=>questions.some(item=>item.id===q.id)));
 assert.deepEqual(originalFlk2.map(q=>q.number),Array.from({length:45},(_,i)=>i+1));
 assert.deepEqual(pretestedFlk2.map(q=>q.number),Array.from({length:65},(_,i)=>i+46));
 assert.ok(publicQuestions().every(q=>!('explanation' in q)&&!('knowledge' in q)));
 for(const q of imported){
  const original=originalRevise.find(item=>item.id===q.id);
  for(const field of ['stem','ask','id','number','sourceSet','sourceSession'])assert.equal(q[field],original[field]);
  assert.deepEqual(q.options.map(({id,en})=>({id,en})),original.options.map(({id,en})=>({id,en})));
  for(const field of ['answer','en','publisherReference','originalPdfPages'])assert.deepEqual(q.explanation[field],original.explanation[field]);
  for(const value of [q.stemZh,q.askZh,q.explanation.zh])assert.match(value,/[\u3400-\u9fff]/,q.id+' missing Chinese');
  for(const option of q.options){assert.ok(option.zh.trim(),q.id+' missing option');if(/[a-z]/i.test(option.en))assert.match(option.zh,/[\u3400-\u9fff]/,q.id+' untranslated option');}
  assert.deepEqual(q.options.map(o=>o.id),['A','B','C','D','E']);
  assert.equal(q.explanation.kind,'publisher-original');
  assert.ok(q.explanation.en.startsWith('The correct answer was '+q.explanation.answer+'.'));
  assert.ok(q.explanation.publisherReference.text.startsWith('See Revise SQE:'));
  if(q.subjectId==='contract'){assert.ok(chapterById(q.chapterId));assert.equal(linkedTextbooks(q.explanation.textbookReferences).length,2);}
 }
 for(const session of [1,2])assert.deepEqual(filterQuestions(questions,{sourceId:'revise',sourceSet:`revise-flk1-2025-26-session-${session}`}).map(q=>q.number),Array.from({length:90},(_,i)=>i+1));
 for(const session of [1,2])assert.deepEqual(filterQuestions(questions,{sourceId:'revise',sourceSet:`revise-flk2-practice-session-${session}`}).map(q=>q.number),Array.from({length:90},(_,i)=>i+1));
 const oldId=crypto.randomUUID(),practiceId=crypto.randomUUID(),examId=crypto.randomUUID(),qltsPracticeId=crypto.randomUUID(),qltsExamId=crypto.randomUUID();
 const oldQuestion=questions.find(q=>q.sourceId==='sra');
 await post({action:'start',id:oldId,mode:'practice',sourceId:'sra'});
 await post({action:'answer',sessionId:oldId,questionId:oldQuestion.id,selected:oldQuestion.explanation.answer});
 let data=await post({action:'start',id:practiceId,mode:'practice',sourceId:'revise',sourceSet:'revise-flk1-2025-26-session-1'});
 assert.equal(data.session.questionIds.length,90);
 const first=imported.find(q=>q.sourceSession===1&&q.number===1);
 data=await post({action:'answer',sessionId:practiceId,questionId:first.id,selected:first.explanation.answer});
 assert.equal(data.session.score,1);
 assert.equal(data.questions.find(q=>q.id===first.id).explanation.en,first.explanation.en);
 assert.equal(data.questions.find(q=>q.id===first.id).explanation.zh,translations[first.id].explanationZh);
 assert.equal(data.questions.find(q=>q.id===first.id).stemZh,translations[first.id].stemZh);
 assert.ok(data.questions.filter(q=>q.id!==first.id).every(q=>!q.explanation));
 data=await post({action:'start',id:examId,mode:'exam',sourceId:'revise',sourceSet:'revise-flk1-2025-26-session-2'});
 assert.equal(data.session.questionIds.length,90);
 const second=imported.find(q=>q.sourceSession===2&&q.number===1);
 assert.notEqual(first.id,second.id);
 data=await post({action:'answer',sessionId:examId,questionId:second.id,selected:second.explanation.answer});
 assert.ok(data.questions.every(q=>!q.explanation));
 assert.equal(data.session.answers[second.id].correct,undefined);
 data=await post({action:'finish',sessionId:examId});
 assert.equal(data.session.score,1);assert.equal(data.session.status,'finished');
 assert.equal(Object.keys(data.session.answers).length,90);
 assert.equal(data.questions.find(q=>q.id===second.id).explanation.en,second.explanation.en);
 assert.equal(data.questions.find(q=>q.id===second.id).explanation.zh,translations[second.id].explanationZh);
 data=await post({action:'start',id:qltsPracticeId,mode:'practice',sourceId:'qlts',sourceSet:'qlts-mock-exam-1'});
 assert.equal(data.session.questionIds.length,90);
 const qltsFirst=importedQlts.find(q=>q.sourceSession===1&&q.number===1);
 data=await post({action:'answer',sessionId:qltsPracticeId,questionId:qltsFirst.id,selected:qltsFirst.explanation.answer});
 assert.equal(data.session.score,1);
 assert.equal(data.questions.find(q=>q.id===qltsFirst.id).explanation.en,qltsFirst.explanation.en);
 assert.equal(data.questions.find(q=>q.id===qltsFirst.id).stemZh,'');
 data=await post({action:'start',id:qltsExamId,mode:'exam',sourceId:'qlts',sourceSet:'qlts-mock-exam-3'});
 assert.equal(data.session.questionIds.length,86);
 const qltsExamFirst=importedQlts.find(q=>q.sourceSession===3&&q.number===1);
 data=await post({action:'answer',sessionId:qltsExamId,questionId:qltsExamFirst.id,selected:qltsExamFirst.explanation.answer});
 assert.ok(data.questions.every(q=>!q.explanation));
 data=await post({action:'finish',sessionId:qltsExamId});
 assert.equal(data.session.score,1);
 assert.equal(data.questions.find(q=>q.id===qltsExamFirst.id).explanation.en,qltsExamFirst.explanation.en);
 await post({action:'answer',sessionId:practiceId,questionId:second.id,selected:'A'},400);
 await post({action:'start',id:crypto.randomUUID(),mode:'practice',sourceSet:'missing'},400);
 data=await get(oldId);assert.equal(data.session.score,1);assert.equal(data.session.answers[oldQuestion.id].selected,oldQuestion.explanation.answer);
 data=await get(practiceId);assert.equal(data.session.score,1);
 console.log('Passed: SRA and Revise regressions plus five QLTS mock sets (445 source-backed questions), answer keys, scoring, exam answer protection, invalid set rejection and existing study history.');
 sqlite.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
