// Focused wrong-answer regression checks using public fixtures and isolated memory only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);

const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,mode TEXT,status TEXT,question_ids TEXT,position INTEGER,started_at INTEGER,finished_at INTEGER); CREATE TABLE responses(session_id TEXT,question_id TEXT,selected TEXT,correct INTEGER,answered_at INTEGER,PRIMARY KEY(session_id,question_id));');
const db={prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},batch:operations=>Promise.all(operations.map(statement=>statement.run()))};
const userId='mistake-notebook-test-user';
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../../chatgpt-auth')return {getChatGPTUser:async()=>({userId})};
 if(request==='@/db/store')return {database:()=>db};
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 return nativeLoad.call(this,request,parent,isMain);
};
const {questions}=require('../lib/questions.ts');
const {applyGuestStudyAction,emptyGuestStudyState}=require('../lib/guest-study.ts');
const api=require('../app/api/study/route.ts');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MistakeNotebook}=require('../app/mistake-notebook.tsx');

const contractSra=questions.find(q=>q.subjectId==='contract'&&q.sourceId==='sra');
const contractRevise=questions.find(q=>q.subjectId==='contract'&&q.sourceId==='revise');
const correctedContract=questions.find(q=>q.subjectId==='contract'&&q.sourceId==='qlts');
const otherSubject=questions.find(q=>q.subjectId==='tort');
assert.ok(contractSra&&contractRevise&&correctedContract&&otherSubject,'Fixture subjects and sources must exist');
const fixtures=[contractSra,contractRevise,correctedContract,otherSubject];
const cleanQuestion=questions.find(q=>!fixtures.includes(q));
const unansweredQuestion=questions.find(q=>!fixtures.includes(q)&&q!==cleanQuestion);
const [historyQuestion,oldMistake,rapidQuestion]=questions.filter(q=>!fixtures.includes(q)&&q!==cleanQuestion&&q!==unansweredQuestion).slice(0,3);
const wrongAnswer=question=>question.options.find(option=>option.id!==question.explanation.answer).id;
const ids=items=>items.map(item=>typeof item==='string'?item:item.id).sort();
const nativeNow=Date.now;
let now=nativeNow();
let advanceClock=true;
Date.now=()=>now;

function guestDriver(){
 let state=emptyGuestStudyState();
 return {
  async post(body,status=200){
   if(advanceClock)now+=1000;
   let result,error;
   try{result=applyGuestStudyAction(state,body);}catch(caught){error=caught;}
   if(error&&typeof error.status!=='number')throw error;
   assert.equal(error?.status??200,status,error?.message);
   if(error)return {error:error.message};
   state=result.state;
   return result.data;
  },
  async reload(sessionId){
   state=JSON.parse(JSON.stringify(state));
   return this.post({action:'hydrate',...(sessionId?{sessionId}:{})});
  },
  seed(session){state.sessions.unshift(session);state.currentSessionId=session.id;},
 };
}
function apiDriver(){
 return {
  async post(body,status=200){
   if(advanceClock)now+=1000;
   const response=await api.POST(new Request('https://example.test/api/study',{method:'POST',headers:{'content-type':'application/json','x-study-action':'1'},body:JSON.stringify(body)}));
   const data=await response.json();
   assert.equal(response.status,status,JSON.stringify(data));
   return data;
  },
  async reload(sessionId){
   const response=await api.GET(new Request(`https://example.test/api/study${sessionId?`?session=${sessionId}`:''}`));
   const data=await response.json();
   assert.equal(response.status,200,JSON.stringify(data));
   return data;
  },
  seed(session){
   sqlite.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)').run(session.id,userId,session.mode,session.status,JSON.stringify(session.questionIds),session.position,session.startedAt,session.finishedAt);
   for(const [questionId,answer] of Object.entries(session.answers)){
    const question=questions.find(item=>item.id===questionId);
    sqlite.prepare('INSERT INTO responses VALUES (?,?,?,?,?)').run(session.id,questionId,answer.selected,Number(answer.selected===question.explanation.answer),answer.answeredAt);
   }
  },
 };
}

function checkCounts(data,question,correct,wrong,label){
 assert.deepEqual(data.questionStats[question.id]??{correct:0,wrong:0},{correct,wrong},`${label}: ${question.id} cumulative counts`);
}
function summary(data){return {questionStats:data.questionStats,mistakes:data.mistakes,stats:data.stats};}

async function exercise(driver,label){
 const post=(body,status)=>driver.post(body,status);
 let data=await driver.reload();
 checkCounts(data,cleanQuestion,0,0,label);
 const practiceId=randomUUID();
 await post({action:'start',id:practiceId,mode:'practice'});
 for(const question of fixtures){
  data=await post({action:'answer',sessionId:practiceId,questionId:question.id,selected:wrongAnswer(question)});
  checkCounts(data,question,0,1,label);
 }
 data=await post({action:'answer',sessionId:practiceId,questionId:cleanQuestion.id,selected:cleanQuestion.explanation.answer});
 checkCounts(data,cleanQuestion,1,0,label);
 assert.equal(data.mistakes.length,4,`${label}: all initial mistakes retained`);
 const beforeDuplicate=summary(data);
 data=await post({action:'answer',sessionId:practiceId,questionId:contractSra.id,selected:contractSra.explanation.answer});
 assert.deepEqual(summary(data),beforeDuplicate,`${label}: duplicate practice submission cannot rewrite or count an answer twice`);
 const correctionSession=randomUUID();
 data=await post({action:'start',id:correctionSession,mode:'wrong',subjectId:'contract'});
 assert.deepEqual(ids(data.session.questionIds),ids([contractSra,contractRevise,correctedContract]),`${label}: subject retry combines sources and excludes other subjects`);
 data=await post({action:'answer',sessionId:correctionSession,questionId:correctedContract.id,selected:correctedContract.explanation.answer});
 assert.equal(data.mistakes.length,3,`${label}: one correct retry removes the question immediately`);
 assert.equal(data.mistakes.some(item=>item.questionId===correctedContract.id),false,`${label}: corrected question is absent from the notebook payload`);
 assert.equal(data.stats.wrongCount,3,`${label}: correction also updates the notebook count`);
 checkCounts(data,correctedContract,1,1,label);
 assert.deepEqual(summary(await driver.reload(correctionSession)),summary(data),`${label}: saved correction and cumulative history survive reload`);
 const markupData=data;

 data=await post({action:'start',id:randomUUID(),mode:'wrong',subjectId:'contract'});
 assert.deepEqual(ids(data.session.questionIds),ids([contractSra,contractRevise]),`${label}: corrected answers excluded from subject retry`);
 assert.equal(new Set(data.session.questionIds.map(id=>questions.find(question=>question.id===id).sourceId)).size,2,`${label}: retry remains cross-source`);
 data=await post({action:'start',id:randomUUID(),mode:'wrong'});
 assert.deepEqual(ids(data.session.questionIds),ids([contractSra,contractRevise,otherSubject]),`${label}: retry-all preserves all pending subjects`);
 data=await post({action:'start',id:randomUUID(),mode:'wrong',questionId:contractRevise.id});
 assert.deepEqual(data.session.questionIds,[contractRevise.id],`${label}: individual retry remains scoped to one question`);
 const invalidSubject=await post({action:'start',id:randomUUID(),mode:'wrong',subjectId:'missing-subject'},400);
 assert.match(invalidSubject.error,/有效科目/);
 const correctedRetry=await post({action:'start',id:randomUUID(),mode:'wrong',questionId:correctedContract.id},400);
 assert.match(correctedRetry.error,/没有需要重练/);

 const ordinaryPractice=randomUUID();
 await post({action:'start',id:ordinaryPractice,mode:'practice'});
 data=await post({action:'answer',sessionId:ordinaryPractice,questionId:contractSra.id,selected:contractSra.explanation.answer});
 assert.equal(data.mistakes.some(item=>item.questionId===contractSra.id),false,`${label}: ordinary practice also clears a mistake`);
 checkCounts(data,contractSra,1,1,label);
 data=await post({action:'answer',sessionId:ordinaryPractice,questionId:correctedContract.id,selected:wrongAnswer(correctedContract)});
 assert.equal(data.mistakes.find(item=>item.questionId===correctedContract.id)?.wrongCount,2,`${label}: a later wrong answer re-enters the notebook with its full wrong count`);
 checkCounts(data,correctedContract,1,2,label);
 assert.deepEqual(summary(await driver.reload(practiceId)),summary(data),`${label}: loading an old session preserves latest notebook membership and lifetime counts`);
 assert.equal((await driver.reload(practiceId)).session.answers[contractSra.id].correct,false,`${label}: corrections do not rewrite older answers`);

 // Legacy exam sessions remain readable, but new exam sessions are no longer started in the UI.
 const examId=randomUUID(),beforeExam=summary(data);
 now+=1000; // Seed the exam after the prior graded answer, independently of reload timing.
 driver.seed({id:examId,mode:'exam',status:'active',questionIds:[correctedContract.id,cleanQuestion.id,unansweredQuestion.id],position:0,startedAt:now,finishedAt:null,answers:{}});
 await post({action:'answer',sessionId:examId,questionId:correctedContract.id,selected:wrongAnswer(correctedContract)});
 await post({action:'answer',sessionId:examId,questionId:correctedContract.id,selected:correctedContract.explanation.answer});
 data=await post({action:'answer',sessionId:examId,questionId:cleanQuestion.id,selected:wrongAnswer(cleanQuestion)});
 assert.deepEqual(summary(data),beforeExam,`${label}: unfinished exam answers do not leak results into counters or clear mistakes`);
 assert.equal(data.session.answers[correctedContract.id].correct,undefined,`${label}: unfinished exam answer correctness remains hidden`);
 data=await post({action:'finish',sessionId:examId});
 checkCounts(data,correctedContract,2,2,label);
 checkCounts(data,cleanQuestion,1,1,label);
 checkCounts(data,unansweredQuestion,0,0,label);
 assert.equal(data.mistakes.some(item=>item.questionId===correctedContract.id),false,`${label}: graded exam correction clears the notebook`);
 assert.equal(data.session.answers[unansweredQuestion.id].selected,'',`${label}: unanswered exam question remains a recorded omission`);
 assert.equal(data.stats.answered,beforeExam.stats.answered+2,`${label}: blank exam rows are not submitted attempts`);
 const afterExam=summary(data);
 assert.deepEqual(summary(await post({action:'finish',sessionId:examId})),afterExam,`${label}: finishing twice does not count twice`);
 assert.deepEqual(summary(await driver.reload(examId)),afterExam,`${label}: completed exam counts survive reload`);

 // Session-list pagination must not discard cumulative attempts or old unresolved mistakes.
 const seedAnswer=(question,selected)=>{
  now+=1000;
  const id=randomUUID();
  driver.seed({id,mode:'practice',status:'finished',questionIds:[question.id],position:0,startedAt:now,finishedAt:now,answers:{[question.id]:{selected,answeredAt:now}}});
  return id;
 };
 seedAnswer(oldMistake,wrongAnswer(oldMistake));
 let latestHistoryId;
 for(let attempt=0;attempt<101;attempt++)latestHistoryId=seedAnswer(historyQuestion,historyQuestion.explanation.answer);
 data=await driver.reload(latestHistoryId);
 assert.equal(data.sessions.length,100,`${label}: displayed recent-session list remains bounded`);
 checkCounts(data,historyQuestion,101,0,label);
 checkCounts(data,oldMistake,0,1,label);
 assert.equal(data.mistakes.some(item=>item.questionId===oldMistake.id),true,`${label}: an unresolved mistake survives beyond the recent 100 sessions`);
 const afterHistoryId=randomUUID();
 await post({action:'start',id:afterHistoryId,mode:'practice'});
 data=await post({action:'answer',sessionId:afterHistoryId,questionId:historyQuestion.id,selected:historyQuestion.explanation.answer});
 checkCounts(data,historyQuestion,102,0,label);
 assert.deepEqual(summary(await driver.reload(afterHistoryId)),summary(data),`${label}: creating and reloading session 100+ preserves accumulated history`);

 // Reverse UUID order exposes timestamp ties; each later submission must win.
 advanceClock=false;
 try{
  const rapidIds=['ffffffff-ffff-ffff-ffff-fffffffffff1','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1','dddddddd-dddd-dddd-dddd-ddddddddddd1'];
  for(const [index,id] of rapidIds.entries()){
   await post({action:'start',id,mode:'practice'});
   data=await post({action:'answer',sessionId:id,questionId:rapidQuestion.id,selected:index===1?rapidQuestion.explanation.answer:wrongAnswer(rapidQuestion)});
   assert.equal(data.mistakes.some(item=>item.questionId===rapidQuestion.id),index!==1,`${label}: latest answer wins when submissions share the same clock millisecond`);
  }
  checkCounts(data,rapidQuestion,1,2,label);
  assert.deepEqual(summary(await driver.reload(rapidIds[2])),summary(data),`${label}: timestamp-tie order survives reload`);
 }finally{advanceClock=true;}
 return {data,markupData};
}

function checkMarkup(data){
 const render=(override=data)=>renderToStaticMarkup(React.createElement(MistakeNotebook,{data:override,busy:false,onRetry(){},onPractice(){}}));
 const groups=html=>[...html.matchAll(/<details\b[^>]*class="mistake-subject"[\s\S]*?<\/details>/g)].map(match=>match[0]);
 const html=render(),sections=groups(html);
 assert.equal(sections.length,2,'One group per subject, regardless of source');
 assert.deepEqual(sections.map(section=>section.match(/<h2>(.*?)<\/h2>/)[1]),['合同法','侵权法']);
 const contract=sections[0];
 assert.equal((contract.match(/class="mistake-item"/g)??[]).length,2,'Subject group contains only remaining mistakes');
 assert.match(contract,/<summary>[\s\S]*aria-label="重练合同法的 2 道错题"[\s\S]*重练本科目[\s\S]*<\/summary>/,'Subject retry is visible in the collapsed header and names the remaining mistakes');
 assert.doesNotMatch(contract,/<h3>/,'Individual mistakes do not repeat topic titles');
 assert.doesNotMatch(html,/mistake-tabs|待巩固|已订正|mistake-status|role="tab"/,'Removed categories and status badges are absent');
 assert.doesNotMatch(html,/mistake-source|SRA 官方|Revise SQE|QLTS School/,'No source groups or source labels');
 const correctedOnly={...data,mistakes:data.mistakes.map(mistake=>({...mistake,lastCorrect:true}))};
 assert.match(render(correctedOnly),/暂时没有错题/);
 assert.equal(groups(render(correctedOnly)).length,0,'Legacy corrected payload entries stay outside the notebook');
 assert.doesNotMatch(render(correctedOnly),/重练本科目/,'Legacy corrected-only groups cannot start a retry');
 assert.match(render({...data,mistakes:[]}),/答错的题目会自动收录，答对后自动移出。/);
 const missing={...data,questions:[],mistakes:[data.mistakes.find(mistake=>!mistake.lastCorrect)]};
 const missingHtml=render(missing);
 assert.match(missingHtml,/<h2>其他科目<\/h2>/);
 assert.match(missingHtml,/题目暂不可用/);
 assert.doesNotMatch(missingHtml,/重练本科目/,'Missing questions do not create invalid subject retries');
}

async function main(){
 const guest=await exercise(guestDriver(),'Guest');
 const server=await exercise(apiDriver(),'API');
 assert.deepEqual(summary(guest.data),summary(server.data),'Guest and API produce identical notebook membership, counters and summary statistics');
 checkMarkup(guest.markupData);
 checkMarkup(server.markupData);
 console.log('Passed: guest/API cumulative correct and wrong counts, correction removal, wrong-again re-entry, duplicate-submit protection, reload, exam boundaries, history beyond 100 sessions, same-millisecond ordering and API parity; subject, all and single-question retries retained; SSR verifies simplified categories, legacy corrections and missing-question fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Date.now=nativeNow;Module._load=nativeLoad;sqlite.close();});
