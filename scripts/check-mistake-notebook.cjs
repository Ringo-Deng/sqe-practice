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
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../../chatgpt-auth')return {getChatGPTUser:async()=>({userId:'mistake-notebook-test-user'})};
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
const ids=items=>items.map(item=>typeof item==='string'?item:item.id).sort();
const nativeNow=Date.now;
let now=nativeNow();
Date.now=()=>now;

function guestPost(){
 let state=emptyGuestStudyState();
 return async(body,status=200)=>{
  now+=1000;
  let result,error;
  try{result=applyGuestStudyAction(state,body);}catch(caught){error=caught;}
  if(error&&typeof error.status!=='number')throw error;
  assert.equal(error?.status??200,status,error?.message);
  if(error)return {error:error.message};
  state=result.state;
  return result.data;
 };
}
async function apiPost(body,status=200){
 now+=1000;
 const response=await api.POST(new Request('https://example.test/api/study',{method:'POST',headers:{'content-type':'application/json','x-study-action':'1'},body:JSON.stringify(body)}));
 const data=await response.json();
 assert.equal(response.status,status,JSON.stringify(data));
 return data;
}

async function exercise(post,label){
 const practiceId=randomUUID();
 await post({action:'start',id:practiceId,mode:'practice'});
 let data;
 for(const question of fixtures){
  const wrong=question.options.find(option=>option.id!==question.explanation.answer).id;
  data=await post({action:'answer',sessionId:practiceId,questionId:question.id,selected:wrong});
 }
 assert.equal(data.mistakes.length,4,`${label}: all initial mistakes retained`);
 const correctionSession=randomUUID();
 data=await post({action:'start',id:correctionSession,mode:'wrong',subjectId:'contract'});
 assert.deepEqual(ids(data.session.questionIds),ids([contractSra,contractRevise,correctedContract]),`${label}: subject retry combines sources and excludes other subjects`);
 data=await post({action:'answer',sessionId:correctionSession,questionId:correctedContract.id,selected:correctedContract.explanation.answer});
 assert.equal(data.mistakes.length,4,`${label}: correction preserves all-mistakes history`);
 assert.equal(data.mistakes.find(item=>item.questionId===correctedContract.id).lastCorrect,true,`${label}: latest correct answer is marked corrected`);
 assert.equal(data.stats.wrongCount,3,`${label}: corrected answer leaves pending count`);

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
 return data;
}

function checkMarkup(data){
 const render=(showCorrected,override=data)=>renderToStaticMarkup(React.createElement(MistakeNotebook,{data:override,busy:false,showCorrected,onShowCorrected(){},onRetry(){},onPractice(){}}));
 const groups=html=>[...html.matchAll(/<details\b[^>]*class="mistake-subject"[\s\S]*?<\/details>/g)].map(match=>match[0]);
 for(const showCorrected of [false,true]){
  const html=render(showCorrected),sections=groups(html);
  assert.equal(sections.length,2,'One group per subject, regardless of source');
  assert.deepEqual(sections.map(section=>section.match(/<h2>(.*?)<\/h2>/)[1]),['合同法','侵权法']);
  const contract=sections[0];
  assert.equal((contract.match(/class="mistake-item"/g)??[]).length,showCorrected?3:2,'Corrected toggle changes membership within the same subject group');
  assert.match(contract,/重练本科目（2）/,'Subject retry count uses pending mistakes only');
  assert.equal(contract.includes('已订正'),showCorrected);
  assert.doesNotMatch(html,/mistake-source|SRA 官方|Revise SQE|QLTS School/,'No source groups or source labels');
 }
 const correctedOnly={...data,mistakes:data.mistakes.map(mistake=>({...mistake,lastCorrect:true}))};
 assert.match(render(false,correctedOnly),/暂时没有待巩固的错题/);
 assert.equal(groups(render(true,correctedOnly)).length,2,'Corrected-only subjects remain in all-mistakes view');
 assert.doesNotMatch(render(true,correctedOnly),/重练本科目/,'Corrected-only groups cannot start a pending retry');
 const missing={...data,questions:[],mistakes:[data.mistakes.find(mistake=>!mistake.lastCorrect)]};
 const missingHtml=render(false,missing);
 assert.match(missingHtml,/<h2>其他科目<\/h2>/);
 assert.match(missingHtml,/题目暂不可用/);
 assert.doesNotMatch(missingHtml,/重练本科目/,'Missing questions do not create invalid subject retries');
}

async function main(){
 const guest=await exercise(guestPost(),'Guest');
 const server=await exercise(apiPost,'API');
 checkMarkup(guest);
 checkMarkup(server);
 console.log('Passed: guest and API subject retries combine SRA/Revise/QLTS mistakes, exclude other subjects and corrected answers, retain all/single retries and corrected history; SSR verifies subject grouping, corrected filters and missing-question fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Date.now=nativeNow;Module._load=nativeLoad;sqlite.close();});
