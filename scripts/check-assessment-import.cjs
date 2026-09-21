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
const originalQlts=[...require('../lib/qlts-mock-exams-1-5.json'),...require('../lib/qlts-mock-exams-6-10.json'),...require('../lib/qlts-mock-exams-11-15.json'),...require('../lib/qlts-mock-exams-16-20.json'),...require('../lib/qlts-mock-exams-21-30.json')];
const qltsSourceFiles=[require('../lib/qlts-mock-exams-1-5-source.json'),require('../lib/qlts-mock-exams-6-10-source.json'),require('../lib/qlts-mock-exams-11-15-source.json'),require('../lib/qlts-mock-exams-16-20-source.json'),require('../lib/qlts-mock-exams-21-30-source.json')];
const qltsSource={importedQuestions:qltsSourceFiles.reduce((sum,source)=>sum+source.importedQuestions,0),mocks:qltsSourceFiles.flatMap(source=>source.mocks)};
const qltsTranslations={...require('../lib/qlts-mock-exams-1-5-translations.json'),...require('../lib/qlts-mock-exams-6-10-translations.json'),...require('../lib/qlts-mock-exams-11-15-translations.json'),...require('../lib/qlts-mock-exams-16-20-translations.json'),...require('../lib/qlts-mock-exams-21-30-translations.json')};
const qltsChapterMatches=require('../lib/qlts-chapter-matches.json');
const qltsCurrentLawReviews=[require('../lib/qlts-mock-exams-6-10-removed.json'),require('../lib/qlts-mock-exams-11-15-removed.json'),require('../lib/qlts-mock-exams-16-20-removed.json'),require('../lib/qlts-mock-exams-21-30-removed.json')];
const translations=require('../lib/revise-assessment-translations.json');
const {filterQuestions,chapterById}=require('../lib/chapters.ts');
const {linkedTextbooks}=require('../lib/textbooks.ts');
const {applyGuestStudyAction,emptyGuestStudyState}=require('../lib/guest-study.ts');
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
 const currentLawExclusions=qltsCurrentLawReviews.flatMap(review=>review.categories).flatMap(category=>category.questionIds);
 assert.equal(currentLawExclusions.length,qltsCurrentLawReviews.reduce((sum,review)=>sum+review.removedQuestions,0));
 assert.ok(currentLawExclusions.every(id=>!importedQlts.some(question=>question.id===id)));
 assert.equal(importedQlts.length,1762);
 assert.equal(qltsSource.importedQuestions,importedQlts.length);
 assert.deepEqual(importedQlts.map(q=>q.id),originalQlts.map(q=>q.id));
 assert.deepEqual(Object.keys(qltsTranslations).sort(),importedQlts.map(q=>q.id).sort());
 assert.deepEqual(Object.keys(qltsChapterMatches.matches).sort(),importedQlts.map(q=>q.id).sort());
 assert.ok(importedQlts.every(q=>q.chapterId&&chapterById(q.chapterId)&&chapterById(q.chapterId).subjectId===q.subjectId));
 for(const mock of qltsSource.mocks){
  const items=filterQuestions(questions,{sourceId:'qlts',sourceSet:`qlts-mock-exam-${mock.mock}`});
  assert.equal(items.length,mock.importedQuestions);
  assert.ok(items.every(q=>q.sourcePages?.length&&q.explanation.en&&q.options.some(option=>option.id===q.explanation.answer)));
  assert.ok(items.every(q=>q.askZh&&q.options.every(option=>option.zh)&&q.explanation.zh));
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
 const flk2BookIds={
  'Trusts Law':'revise-trusts-2027','Property Practice':'revise-property-practice-2027',
  'Solicitors Accounts':'revise-solicitors-accounts-2027','Land Law':'revise-land-law-2027',
  'Ethics and Professional Conduct':'revise-ethics-2027','Criminal Law':'revise-criminal-law-2027',
  'Criminal Practice':'revise-criminal-practice-2027','Wills and the Administration of Estates':'revise-wills-estates-2027',
 };
 const {textbookById,textbookReaderUrl,parseTextbookReaderTarget}=require('../lib/textbooks.ts');
 for(const q of importedFlk2){
  const original=reviseFlk2.find(item=>item.id===q.id);
  for(const field of ['answer','en','publisherReference','originalPdfPages'])assert.deepEqual(q.explanation[field],original.explanation[field]);
  const citation=original.explanation.publisherReference;
  const ref=linkedTextbooks(q.explanation.textbookReferences).find(item=>item.bookId===flk2BookIds[citation.book]);
  assert.ok(ref,q.id+' missing publisher textbook link');
  assert.equal(ref.pageNumbers.length,citation.chapters.length,q.id+' must retain every cited chapter');
  for(const chapter of citation.chapters)assert.ok(ref.chapter.includes(`Chapter ${chapter}:`),q.id+' wrong chapter');
  const book=textbookById(ref.bookId);
  assert.ok(fs.existsSync(path.join(root,'public',book.url)),q.id+' PDF missing');
  const target=parseTextbookReaderTarget(textbookReaderUrl(book,ref.pageNumbers[0],q.id));
  assert.equal(target.bookId,ref.bookId);
  assert.equal(target.page,ref.pageNumbers[0]);
  assert.equal(target.sourceQuestionId,q.id);
 }
 assert.deepEqual(questions.find(q=>q.id==='revise-flk2-practice-s1-001').explanation.textbookReferences[0].pageNumbers,[25]);
 assert.deepEqual(questions.find(q=>q.id==='revise-flk2-practice-s1-057').explanation.textbookReferences[0].pageNumbers,[30,66,86]);
 for(const session of [1,2])assert.deepEqual(filterQuestions(questions,{sourceId:'revise',sourceSet:`revise-flk2-practice-session-${session}`}).map(q=>q.number),Array.from({length:90},(_,i)=>i+1));
 const oldId=crypto.randomUUID(),practiceId=crypto.randomUUID(),secondPracticeId=crypto.randomUUID(),qltsPracticeId=crypto.randomUUID(),qltsSecondId=crypto.randomUUID();
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
 data=await post({action:'start',id:secondPracticeId,mode:'practice',sourceId:'revise',sourceSet:'revise-flk1-2025-26-session-2'});
 assert.equal(data.session.questionIds.length,90);
 const second=imported.find(q=>q.sourceSession===2&&q.number===1);
 assert.notEqual(first.id,second.id);
 data=await post({action:'answer',sessionId:secondPracticeId,questionId:second.id,selected:second.explanation.answer});
 assert.equal(data.session.score,1);
 assert.equal(data.session.answers[second.id].correct,true);
 assert.equal(data.questions.find(q=>q.id===second.id).explanation.en,second.explanation.en);
 assert.equal(data.questions.find(q=>q.id===second.id).explanation.zh,translations[second.id].explanationZh);
 data=await post({action:'start',id:qltsPracticeId,mode:'practice',sourceId:'qlts',sourceSet:'qlts-mock-exam-16'});
 assert.equal(data.session.questionIds.length,84);
 const qltsFirst=importedQlts.find(q=>q.sourceSession===16);
 data=await post({action:'answer',sessionId:qltsPracticeId,questionId:qltsFirst.id,selected:qltsFirst.explanation.answer});
 assert.equal(data.session.score,1);
 assert.equal(data.questions.find(q=>q.id===qltsFirst.id).explanation.en,qltsFirst.explanation.en);
 assert.equal(data.questions.find(q=>q.id===qltsFirst.id).stemZh,qltsTranslations[qltsFirst.id].stemZh);
 assert.equal(data.questions.find(q=>q.id===qltsFirst.id).explanation.zh,qltsTranslations[qltsFirst.id].explanationZh);
 data=await post({action:'start',id:qltsSecondId,mode:'practice',sourceId:'qlts',sourceSet:'qlts-mock-exam-20'});
 assert.equal(data.session.questionIds.length,34);
 const qltsExamFirst=importedQlts.find(q=>q.sourceSession===20);
 data=await post({action:'answer',sessionId:qltsSecondId,questionId:qltsExamFirst.id,selected:qltsExamFirst.explanation.answer});
 assert.equal(data.session.score,1);
 assert.equal(data.questions.find(q=>q.id===qltsExamFirst.id).explanation.en,qltsExamFirst.explanation.en);
 assert.equal(data.questions.find(q=>q.id===qltsExamFirst.id).explanation.zh,qltsTranslations[qltsExamFirst.id].explanationZh);
 let guestState=emptyGuestStudyState();
 for(const mock of qltsSource.mocks.filter(item=>item.mock>=21)){
  const sessionId=crypto.randomUUID();
  if(mock.importedQuestions===0){
   await post({action:'start',id:sessionId,mode:'practice',sourceId:'qlts',sourceSet:`qlts-mock-exam-${mock.mock}`},400);
   continue;
  }
  data=await post({action:'start',id:sessionId,mode:'practice',sourceId:'qlts',sourceSet:`qlts-mock-exam-${mock.mock}`});
  assert.equal(data.session.questionIds.length,mock.importedQuestions);
  assert.ok(data.questions.every(q=>!q.explanation));
  const first=importedQlts.find(q=>q.sourceSession===mock.mock);
  data=await post({action:'answer',sessionId,questionId:first.id,selected:first.explanation.answer});
  assert.equal(data.session.score,1);
  assert.equal(data.session.answers[first.id].correct,true);
  const answered=data.questions.find(q=>q.id===first.id);
  assert.equal(answered.explanation.en,first.explanation.en);
  assert.equal(answered.explanation.zh,qltsTranslations[first.id].explanationZh);
  assert.equal(answered.stemZh,qltsTranslations[first.id].stemZh);
  assert.ok(data.questions.filter(q=>q.id!==first.id).every(q=>!q.explanation));
  const reopened=await get(sessionId);
  assert.equal(reopened.session.score,1);
  assert.equal(reopened.session.answers[first.id].selected,first.explanation.answer);
  const guestId=crypto.randomUUID();
  let guest=applyGuestStudyAction(guestState,{action:'start',id:guestId,mode:'practice',sourceId:'qlts',sourceSet:`qlts-mock-exam-${mock.mock}`});
  assert.equal(guest.data.session.questionIds.length,mock.importedQuestions);
  assert.ok(guest.data.questions.every(q=>!q.explanation));
  guest=applyGuestStudyAction(guest.state,{action:'answer',sessionId:guestId,questionId:first.id,selected:first.explanation.answer});
  assert.equal(guest.data.session.score,1);
  assert.equal(guest.data.questions.find(q=>q.id===first.id).explanation.zh,qltsTranslations[first.id].explanationZh);
  guestState=JSON.parse(JSON.stringify(guest.state));
  const restored=applyGuestStudyAction(guestState,{action:'hydrate',sessionId:guestId});
  assert.equal(restored.data.session.answers[first.id].correct,true);
  assert.equal(restored.data.session.score,1);
 }
 await post({action:'answer',sessionId:practiceId,questionId:second.id,selected:'A'},400);
 await post({action:'start',id:crypto.randomUUID(),mode:'practice',sourceSet:'missing'},400);
 data=await get(oldId);assert.equal(data.session.score,1);assert.equal(data.session.answers[oldQuestion.id].selected,oldQuestion.explanation.answer);
 data=await get(practiceId);assert.equal(data.session.score,1);
 console.log('Passed: SRA and Revise regressions plus QLTS source sets 1-30 (bilingual, current-law-screened questions), all new mocks in API and GitHub Pages guest mode, answer keys, scoring, post-answer explanations, saved-session hydration, invalid set rejection and existing study history.');
 sqlite.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
