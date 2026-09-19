// Syllabus classification regression checks. All study history uses isolated memory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {createHash,randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);

const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,mode TEXT,status TEXT,question_ids TEXT,position INTEGER,started_at INTEGER,finished_at INTEGER); CREATE TABLE responses(session_id TEXT,question_id TEXT,selected TEXT,correct INTEGER,answered_at INTEGER,PRIMARY KEY(session_id,question_id));');
const db={prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},batch:operations=>Promise.all(operations.map(statement=>statement.run()))};
const userId='syllabus-classification-test-user';
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../../chatgpt-auth')return {getChatGPTUser:async()=>({userId})};
 if(request==='@/db/store')return {database:()=>db};
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 return nativeLoad.call(this,request,parent,isMain);
};
const {questions}=require('../lib/questions.ts');
const {chapters,chapterById,filterQuestions}=require('../lib/chapters.ts');
const {subjects,subjectById}=require('../lib/subjects.ts');
const {applyGuestStudyAction}=require('../lib/guest-study.ts');
const {newglawNotesForQuestion}=require('../lib/newglaw-notes.ts');
const api=require('../app/api/study/route.ts');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {MistakeNotebook}=require('../app/mistake-notebook.tsx');
const {QuestionLibrary}=require('../app/question-library.tsx');

const topicIds=[
 'legal-services-sra-regulation',
 'legal-services-aml',
 'legal-services-financial-services',
 'legal-services-funding',
 'legal-services-sra-principles',
 'legal-services-code-of-conduct',
];
const ids=items=>items.map(item=>typeof item==='string'?item:item.id).sort();
const byId=items=>[...items].sort((a,b)=>a.id.localeCompare(b.id));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const legal=questions.filter(question=>question.subjectId==='legal-services');
const formerEthics=questions.filter(question=>question.originalSubjectId==='flk2-ethics');
const ethicsFixtures=formerEthics.filter(question=>question.subjectId==='legal-services').slice(0,2);
const accounts=questions.filter(question=>question.subjectId==='accounts');
const nativeNow=Date.now;
let now=nativeNow();
Date.now=()=>now;

function checkClassification(){
 assert.equal(questions.length,2996,'Classification retains every imported question');
 assert.equal(new Set(questions.map(question=>question.id)).size,2996,'Question IDs remain unique');
 // Fingerprints captured from the pre-classification assembled question bank.
 assert.equal(digest(byId(questions.map(question=>({id:question.id,answer:question.explanation.answer,textbookReferences:question.explanation.textbookReferences})))),'667952db41d082e9b14c2ce4c5e9f393cc357f17f988054848d414439eda36d6','Question IDs, answers and textbook references remain unchanged');
 assert.equal(digest(byId(questions.map(question=>({id:question.id,subjectId:question.originalSubjectId??question.subjectId,chapterId:question.originalSubjectId?question.originalChapterId:question.chapterId})))),'f662c4f4afa1cf00edb36fba5080c396013d1f9c9fe94999024fffc11f45c807','Original subject and textbook chapter classification remains recoverable');
 assert.equal(questions.filter(question=>['legal-services','flk2-ethics'].includes(question.originalSubjectId)).length,301,'The original 276 legal-service and 25 FLK2-ethics questions retain provenance');
 assert.equal(legal.length,294,'Reviewed out-of-scope questions move to their primary syllabus subject');
 assert.equal(formerEthics.length,25,'Every formerly separate FLK2 ethics question is retained');
 assert.equal(subjectById('legal-services').zh,'法律服务与职业道德');
 assert.equal(subjects.some(subject=>subject.id==='flk2-ethics'),false,'The duplicate ethics subject is absent from navigation');
 assert.equal(questions.some(question=>question.subjectId==='flk2-ethics'),false);
 assert.deepEqual(ids(chapters.filter(chapter=>chapter.subjectId==='legal-services')),ids(topicIds),'Legal-services navigation exposes six unique syllabus topics');
 assert.equal(chapters.some(chapter=>chapter.subjectId==='flk2-ethics'),false);
 const memberships=topicIds.flatMap(chapterId=>filterQuestions(questions,{subjectId:'legal-services',chapterId}).map(question=>question.id));
 assert.deepEqual(ids(memberships),ids(legal),'Topics cover every merged question exactly once');
 assert.equal(new Set(memberships).size,memberships.length,'Topics do not duplicate questions');
 for(const chapterId of topicIds){
  assert.ok(chapterById(chapterId),'Each syllabus topic can start a practice session');
  assert.ok(legal.some(question=>question.chapterId===chapterId),`${chapterId} has questions`);
 }
 assert.deepEqual(topicIds.map(chapterId=>legal.filter(question=>question.chapterId===chapterId).length),[23,56,75,12,7,121],'Audited syllabus topic counts remain stable');
 for(const prefix of ['legal-services-lss','legal-services-ethics','flk2-ethics']){
  const numbers=prefix==='legal-services-lss'?[5,6,7,8]:[1,2,3,4,5,6,7,8];
  for(const number of numbers){
   const oldChapterId=`${prefix}-${String(number).padStart(2,'0')}`;
   const chapter=chapterById(oldChapterId);
   assert.ok(chapter,`Textbook chapter ${oldChapterId} remains resolvable`);
   assert.equal(chapter.number,number,'Textbook chapter numbering is preserved');
  }
 }
 for(const sourceId of ['sra','revise','qlts']){
  const filtered=filterQuestions(questions,{subjectId:'legal-services',sourceId});
  assert.deepEqual(ids(filtered),ids(legal.filter(question=>question.sourceId===sourceId)),`${sourceId}: source filters retain both original subjects`);
  assert.ok(filtered.every(question=>question.sourceId===sourceId));
 }
 assert.deepEqual(ids(filterQuestions(questions,{subjectId:'legal-services',sourceId:'all'})),ids(legal));
 assert.equal(subjectById('accounts').group,'FLK2','Solicitors accounts remains an FLK2 subject');
 const originalAccounts=accounts.filter(question=>(question.originalSubjectId??question.subjectId)==='accounts');
 assert.equal(accounts.length,138,'Three reviewed client-money and account questions join accounts');
 assert.equal(originalAccounts.length,135,'All original accounts questions remain in accounts');
 assert.equal(digest(byId(originalAccounts.map(question=>({id:question.id,chapterId:question.chapterId})))),'ffce5bbe4ad1b4ba139747807714dd2d69b9839bf9c5839e6e1c0c1fb0cae498','Accounts retains its original questions and chapters');
 assert.ok(accounts.every(question=>!memberships.includes(question.id)),'Accounts is outside the merged group');
 for(const [id,subjectId,chapterId] of [
  ['sra-flk1-original-031','legal-services','legal-services-sra-regulation'],
  ['sra-flk1-pretested-053','legal-services','legal-services-code-of-conduct'],
  ['sra-flk1-pretested-104','legal-services','legal-services-code-of-conduct'],
  ['qlts-mock-28-q060','legal-services','legal-services-aml'],
  ['revise-flk1-2025-26-s2-066','criminal-practice','criminal-practice-03'],
  ['sra-flk1-pretested-080','criminal-practice','criminal-practice-01'],
  ['qlts-mock-01-q090','business','business-02'],
  ['qlts-mock-05-q069','business','business-03'],
  ['revise-flk2-practice-s2-077','accounts','accounts-02'],
  ['revise-flk2-practice-s2-079','accounts','accounts-03'],
  ['revise-chapter-ethics-c08-q1','accounts','accounts-06'],
 ]){
  const question=questions.find(item=>item.id===id);
  assert.equal(question.subjectId,subjectId,`${id}: reviewed primary subject`);
  assert.equal(question.chapterId,chapterId,`${id}: reviewed primary syllabus topic`);
 }
 const financialNotes=newglawNotesForQuestion(questions.find(question=>question.id==='qlts-mock-01-q004'));
 assert.ok(financialNotes.some(note=>note.title==='律师与金融服务'),'New financial-services topic retains its matched study notes');
 const equalityNotes=newglawNotesForQuestion(questions.find(question=>question.id==='sra-flk1-pretested-059'));
 assert.ok(equalityNotes.some(note=>note.title==='平等、多样化与包容'),'Equality topic retains the equality study notes');
 assert.ok(equalityNotes.every(note=>!/法律援助|法援/.test(note.title)),'Incidental fee words do not replace equality notes with legal aid');
 const litigationEthicsNotes=newglawNotesForQuestion(questions.find(question=>question.id==='sra-flk1-pretested-076'));
 assert.deepEqual(litigationEthicsNotes.map(note=>note.title).sort(),['维护法治和公正司法','独立','诚信','正直'].sort(),'Combined ethics topic preserves specific litigation-context notes');
 const clientMoneyNotes=newglawNotesForQuestion(questions.find(question=>question.id==='revise-flk2-practice-s2-079'));
 assert.deepEqual(clientMoneyNotes.map(note=>note.title).sort(),['律师账务','复式记账法入门'].sort(),'Client-money question uses its reviewed accounts topic notes');
}

function wrongAnswer(question){return question.options.find(option=>option.id!==question.explanation.answer).id;}
function legacySessions(){
 const legalFixture=legal.find(question=>question.originalSubjectId==='legal-services');
 assert.ok(legalFixture&&accounts[0]&&formerEthics.length===25&&ethicsFixtures.length===2,'Legacy history fixtures are available');
 const sessions=[formerEthics,[legalFixture],[accounts[0]]].map((items,index)=>{
  const startedAt=now-100000+index*1000;
  return {id:randomUUID(),mode:'practice',status:'finished',questionIds:items.map(question=>question.id),position:items.length-1,startedAt,finishedAt:startedAt+500,answers:Object.fromEntries(items.map((question,questionIndex)=>[question.id,{selected:index===0&&!ethicsFixtures.includes(question)?question.explanation.answer:wrongAnswer(question),answeredAt:startedAt+questionIndex+1}]))};
 });
 return {sessions,legalFixture};
}

function guestDriver(sessions){
 let state={version:1,currentSessionId:sessions[0].id,sessions};
 return {
  async post(body,status=200){
   now+=1000;
   let result,error;
   try{result=applyGuestStudyAction(state,body);}catch(caught){error=caught;}
   if(error&&typeof error.status!=='number')throw error;
   assert.equal(error?.status??200,status,error?.message);
   if(error)return {error:error.message};
   state=result.state;return result.data;
  },
  async load(sessionId){return this.post({action:'hydrate',sessionId});},
 };
}

function apiDriver(sessions){
 for(const session of sessions){
  sqlite.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)').run(session.id,userId,session.mode,session.status,JSON.stringify(session.questionIds),session.position,session.startedAt,session.finishedAt);
  for(const [questionId,answer] of Object.entries(session.answers)){
   const question=questions.find(item=>item.id===questionId);
   sqlite.prepare('INSERT INTO responses VALUES (?,?,?,?,?)').run(session.id,questionId,answer.selected,Number(answer.selected===question.explanation.answer),answer.answeredAt);
  }
 }
 return {
  async post(body,status=200){
   now+=1000;
   const response=await api.POST(new Request('https://example.test/api/study',{method:'POST',headers:{'content-type':'application/json','x-study-action':'1'},body:JSON.stringify(body)}));
   const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
  },
  async load(sessionId){
   const response=await api.GET(new Request(`https://example.test/api/study?session=${sessionId}`));
   const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
  },
 };
}

function checkStats(data,label,fixtures,extraAttempts=[]){
 const attempts=[...fixtures.sessions.flatMap(session=>Object.entries(session.answers).map(([questionId,answer])=>({questionId,correct:answer.selected===questions.find(question=>question.id===questionId).explanation.answer}))),...extraAttempts];
 const answered=attempts.length,correct=attempts.filter(attempt=>attempt.correct).length;
 assert.equal(data.stats.answered,answered,`${label}: attempt total is retained without double counting`);
 assert.equal(data.stats.correct,correct,`${label}: correct-answer total is retained`);
 assert.equal(data.stats.subjects.some(subject=>subject.subjectId==='flk2-ethics'),false,`${label}: no stale ethics statistics group`);
 const legalStat=data.stats.subjects.find(subject=>subject.subjectId==='legal-services');
 for(const subject of subjects){
  const expected=attempts.filter(attempt=>questions.find(question=>question.id===attempt.questionId).subjectId===subject.id);
  const actual=data.stats.subjects.find(item=>item.subjectId===subject.id);
  assert.equal(actual.answered,expected.length,`${label}: ${subject.id} gets only its historical attempts`);
  assert.equal(actual.correct,expected.filter(attempt=>attempt.correct).length);
 }
 assert.equal(legalStat.chapters.reduce((sum,chapter)=>sum+chapter.answered,0),legalStat.answered,`${label}: topic totals count each historical attempt once`);
 assert.ok(legalStat.chapters.every(chapter=>topicIds.includes(chapter.chapterId)),`${label}: historical attempts have syllabus topics`);
 assert.equal(data.stats.subjects.reduce((sum,subject)=>sum+subject.answered,0),answered);
}

function checkLibraryMarkup(data,label){
 const nativeUseState=React.useState;
 let stateIndex=0,html;
 // Select a deterministic source/subject without changing the product interface.
 React.useState=initial=>nativeUseState(stateIndex++===0?'all':stateIndex===2?'legal-services':initial);
 try{html=renderToStaticMarkup(React.createElement(QuestionLibrary,{data,busy:false,onStart(){},onResume(){}}));}
 finally{React.useState=nativeUseState;}
 assert.equal((html.match(/<h3>法律服务与职业道德<\/h3>/g)??[]).length,1,`${label}: one combined subject card`);
 assert.equal((html.match(/<h3>律师账目<\/h3>/g)??[]).length,1,`${label}: accounts subject card is retained`);
 assert.doesNotMatch(html,/职业道德（FLK2）|Ethics and Professional Conduct \(FLK2\)/,`${label}: no separate FLK2 ethics subject card`);
 assert.match(html,/FLK1 \/ 跨科职业道德/,`${label}: cross-exam ethics scope is visible`);
 const groups=[...html.matchAll(/<section class="chapter-book"[^>]*aria-label="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(groups,['法律服务 · FLK1','职业道德与专业行为 · FLK1 / FLK2'],`${label}: syllabus groups have explicit headings`);
 assert.deepEqual([...html.matchAll(/<span class="chapter-number">(\d+)<\/span>/g)].map(match=>match[1]),['01','02','03','04','05','06'],`${label}: topic numbering runs once from 01 to 06`);
 assert.equal((html.match(/class="chapter-card /g)??[]).length,6,`${label}: six practice topics render`);
 for(const chapter of chapters.filter(item=>item.subjectId==='legal-services')){
  assert.ok(html.includes(`<h4>${chapter.zh}</h4>`),`${label}: ${chapter.id} has a visible title`);
  assert.ok(html.includes(`专题${chapter.zh}`),`${label}: practice action identifies a syllabus topic`);
 }
}

async function exercise(driver,fixtures,label){
 const post=(body,status)=>driver.post(body,status);
 let data=await driver.load(fixtures.sessions[0].id);
 assert.deepEqual(data.session.questionIds,fixtures.sessions[0].questionIds,`${label}: old FLK2 ethics session loads by its original question IDs`);
 assert.equal(data.session.status,'finished');
 assert.equal(data.session.score,23);
 assert.equal(Object.keys(data.session.answers).length,25);
 assert.ok(formerEthics.every(question=>data.questions.find(item=>item.id===question.id)?.originalSubjectId==='flk2-ethics'));
 checkStats(data,label,fixtures);
 assert.equal(data.mistakes.length,4);
 assert.equal(data.stats.wrongCount,4);

 for(const chapterId of topicIds){
  for(const sourceId of [undefined,'sra','revise','qlts']){
   const expected=legal.filter(question=>question.chapterId===chapterId&&(!sourceId||question.sourceId===sourceId));
   const body={action:'start',id:randomUUID(),mode:'practice',subjectId:'legal-services',chapterId,...(sourceId?{sourceId}:{})};
   data=await post(body,expected.length?200:400);
   if(expected.length)assert.deepEqual(ids(data.session.questionIds),ids(expected),`${label}: topic and ${sourceId??'all'} source filters are honored`);
   else assert.match(data.error,/尚未导入/);
  }
 }
 const sourceSet=legal.find(question=>question.sourceSet)?.sourceSet;
 assert.ok(sourceSet,'A named question set is available');
 data=await post({action:'start',id:randomUUID(),mode:'practice',subjectId:'legal-services',sourceSet});
 assert.deepEqual(ids(data.session.questionIds),ids(legal.filter(question=>question.sourceSet===sourceSet)),`${label}: source-set filtering survives the merge`);
 data=await post({action:'start',id:randomUUID(),mode:'practice',subjectId:'legal-services'});
 assert.deepEqual(ids(data.session.questionIds),ids(legal),`${label}: merged subject starts each classified question once`);
 data=await post({action:'start',id:randomUUID(),mode:'practice',subjectId:'accounts'});
 assert.deepEqual(ids(data.session.questionIds),ids(accounts),`${label}: accounts practice remains separate`);
 const invalid=await post({action:'start',id:randomUUID(),mode:'practice',subjectId:'accounts',chapterId:topicIds[0]},400);
 assert.match(invalid.error,/有效的科目与章节/);

 data=await post({action:'start',id:randomUUID(),mode:'wrong',subjectId:'legal-services'});
 assert.deepEqual(ids(data.session.questionIds),ids([...ethicsFixtures,fixtures.legalFixture]),`${label}: pending wrong answers merge across historical subjects`);
 const retryId=data.session.id;
 data=await post({action:'answer',sessionId:retryId,questionId:ethicsFixtures[1].id,selected:wrongAnswer(ethicsFixtures[1])});
 assert.equal(data.mistakes.find(item=>item.questionId===ethicsFixtures[1].id).wrongCount,2,`${label}: repeated mistakes retain their true attempt count`);
 data=await post({action:'answer',sessionId:retryId,questionId:ethicsFixtures[0].id,selected:ethicsFixtures[0].explanation.answer});
 checkStats(data,label,fixtures,[{questionId:ethicsFixtures[1].id,correct:false},{questionId:ethicsFixtures[0].id,correct:true}]);
 assert.equal(data.mistakes.length,4,`${label}: corrections retain all four historical mistake IDs`);
 assert.equal(new Set(data.mistakes.map(item=>item.questionId)).size,4,`${label}: merged mistakes contain no duplicates`);
 assert.equal(data.stats.wrongCount,3,`${label}: corrected question leaves the pending count`);
 assert.equal(data.mistakes.find(item=>item.questionId===ethicsFixtures[0].id).lastCorrect,true);
 const history=await driver.load(fixtures.sessions[0].id);
 assert.equal(history.session.score,23,`${label}: later corrections do not rewrite an old session score`);
 assert.deepEqual(history.session.questionIds,fixtures.sessions[0].questionIds);
 data=await post({action:'start',id:randomUUID(),mode:'wrong',subjectId:'legal-services'});
 assert.deepEqual(ids(data.session.questionIds),ids([ethicsFixtures[1],fixtures.legalFixture]),`${label}: merged retry excludes corrections and accounts`);
 const html=renderToStaticMarkup(React.createElement(MistakeNotebook,{data,busy:false,showCorrected:true,onShowCorrected(){},onRetry(){},onPractice(){}}));
 const headings=[...html.matchAll(/<h2>(.*?)<\/h2>/g)].map(match=>match[1]);
 assert.equal(headings.filter(heading=>heading==='法律服务与职业道德').length,1,`${label}: one merged wrong-answer group`);
 assert.equal(headings.filter(heading=>heading==='律师账目').length,1,`${label}: accounts has its own wrong-answer group`);
 assert.doesNotMatch(html,/职业道德（FLK2）/);
 checkLibraryMarkup(data,label);
}

async function main(){
 checkClassification();
 const guestFixtures=legacySessions();
 await exercise(guestDriver(guestFixtures.sessions),guestFixtures,'Guest');
 const apiFixtures=legacySessions();
 await exercise(apiDriver(apiFixtures.sessions),apiFixtures,'API');
 console.log(`Passed: 2996 original question IDs, answers and textbook links retained; six disjoint syllabus topics cover ${legal.length} merged questions; source filters and topic practice work in guest/API; all 25 old FLK2 ethics IDs, sessions, scores and mistake histories survive without double counting; all 135 original accounts questions remain separate (${accounts.length} accounts questions after classification corrections); SSR verifies subject cards, two syllabus groups and 01–06 topic numbering; financial/equality notes remain matched.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Date.now=nativeNow;Module._load=nativeLoad;sqlite.close();});
