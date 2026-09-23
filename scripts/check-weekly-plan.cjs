// Isolated planner and real guest-data checks; never touches browser storage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {emptyWeeklyPlan,buildPlanRange,parseWeeklyPlan,updatePlanWeek,weeklyPlanKey,dailyAnswerCounts}=require('../lib/weekly-plan.ts');
let checks=0;
function check(name,run){run();checks++;console.log(`PASS ${name}`);}
const blank={version:1,weeks:[],archived:[]};
check('default plan is blank and spans six months across years',()=>{
 const plan=emptyWeeklyPlan(new Date(2026,8,23));
 assert.equal(plan.weeks[0].start,'2026-09-07');assert.equal(plan.weeks.at(-1).start,'2027-02-22');
 assert.ok(plan.weeks.every(w=>!w.content&&!w.done));
});
check('cross-year and leap-month ranges use Mondays without duplicate weeks',()=>{
 const plan=buildPlanRange(blank,'2027-12','2028-02');
 assert.equal(plan.weeks[0].start,'2027-12-06');assert.equal(plan.weeks.at(-1).start,'2028-02-28');
 assert.equal(plan.weeks.length,13);assert.deepEqual(parseWeeklyPlan(JSON.stringify(plan)),plan);
 for(const [a,b] of [['2026-13','2027-01'],['2027-02','2027-01'],['1999-12','2026-01']])assert.throws(()=>buildPlanRange(blank,a,b));
});
check('shrinking, saving and expanding restores text and independent completion',()=>{
 let plan=buildPlanRange(blank,'2026-09','2026-11');
 const start=plan.weeks[0].start,other=plan.weeks[1].start;
 const original=plan;
 plan=updatePlanWeek(plan,start,{content:'Contract\n复习 <b>自由文字</b>',done:true});
 assert.equal(original.weeks[0].content,'');assert.equal(plan.weeks[1].done,false);
 plan=parseWeeklyPlan(JSON.stringify(buildPlanRange(plan,'2026-10','2026-11')));
 assert.ok(plan.archived.some(w=>w.start===start&&w.done));
 plan=buildPlanRange(plan,'2026-09','2026-11');
 assert.equal(plan.weeks[0].content,'Contract\n复习 <b>自由文字</b>');assert.equal(plan.weeks[0].done,true);
 assert.equal(plan.weeks.find(w=>w.start===other).content,'');
 assert.equal(updatePlanWeek(plan,start,{content:' '}).weeks[0].done,false);
});
check('malformed imports are rejected and storage is isolated by account',()=>{
 const plan=buildPlanRange(blank,'2026-09','2026-09');
 for(const bad of ['null','{bad',JSON.stringify({...plan,weeks:[]}),JSON.stringify({...plan,archived:[plan.weeks[0]]}),JSON.stringify({...plan,weeks:plan.weeks.slice(0,1).concat(plan.weeks.slice(2))}),JSON.stringify({...plan,weeks:[{start:'2026-09-08',content:'',done:false}]})])assert.throws(()=>parseWeeklyPlan(bad));
 assert.equal(parseWeeklyPlan(null),null);
 assert.equal(new Set(['guest','account:a','account:b'].map(weeklyPlanKey)).size,3);
});
check('actual timestamps aggregate in local dates, including midnight and DST',()=>{
 const old=process.env.TZ;process.env.TZ='Asia/Shanghai';
 assert.deepEqual(dailyAnswerCounts([Date.parse('2026-09-22T15:59:59Z'),Date.parse('2026-09-22T16:00:00Z'),Date.parse('2026-09-22T16:00:00Z'),NaN,0,-1]),{'2026-09-22':1,'2026-09-23':2});
 process.env.TZ='America/New_York';
 assert.deepEqual(dailyAnswerCounts([Date.parse('2026-11-01T05:30:00Z'),Date.parse('2026-11-01T06:30:00Z')]),{'2026-11-01':2});
 if(old===undefined)delete process.env.TZ;else process.env.TZ=old;
});
const {applyGuestStudyAction}=require('../lib/guest-study.ts');
const {questions}=require('../lib/questions.ts');
const question=questions.find(q=>q.sourceId==='sra');
check('real submissions count repeated attempts and use answer time, not session start',()=>{
 let current={state:null};
 for(let i=0;i<2;i++){
  current=applyGuestStudyAction(current.state,{action:'start',id:randomUUID(),mode:'practice',sourceId:'sra'});
  current.state.sessions[0].startedAt=Date.now()-86400000;
  current=applyGuestStudyAction(current.state,{action:'answer',sessionId:current.data.session.id,questionId:question.id,selected:question.options[0].id});
 }
 assert.equal(current.data.answerActivity.length,2);assert.equal(current.data.plannerScope,'guest');
 assert.ok(current.data.answerActivity.every(t=>t>Date.now()-60000));
 assert.equal(applyGuestStudyAction(JSON.parse(JSON.stringify(current.state)),{action:'hydrate'}).data.answerActivity.length,2);
});
check('activity includes old sessions beyond the recent list and excludes blank, unfinished, estimated timestamps',()=>{
 const now=Date.now();
 const session=(i,extra={})=>({id:randomUUID(),mode:'practice',status:'finished',questionIds:[question.id],position:0,startedAt:now-i*1000,finishedAt:now,answers:{[question.id]:{selected:'A',answeredAt:now-i*1000}},...extra});
 const sessions=Array.from({length:105},(_,i)=>session(i));
 sessions.push(session(106,{answers:{[question.id]:{selected:'',answeredAt:now}}}));
 sessions.push(session(107,{mode:'exam',status:'active',startedAt:now,finishedAt:null}));
 sessions.push(session(108,{answers:{[question.id]:{selected:'A'}}}));
 let result=applyGuestStudyAction({version:1,currentSessionId:null,sessions},{action:'hydrate'});
 assert.equal(result.data.sessions.length,100);assert.equal(result.data.answerActivity.length,105);
 result=applyGuestStudyAction(JSON.parse(JSON.stringify(result.state)),{action:'hydrate'});
 assert.equal(result.data.answerActivity.length,105,'Estimated timestamps must stay excluded after reload');
});
console.log(`${checks} weekly planner checks passed.`);
