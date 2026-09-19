// Refresh and resume checks use isolated memory, never browser study storage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {readWorkspace,writeWorkspace,restoreWorkspace,hydrateWorkspace,workspaceKey}=require('../lib/study-workspace.ts');
const questions=[0,1,2].map(index=>({id:`q${index}`,sourceId:'sra',options:[{id:'A'},{id:'B'}]}));
const active={id:'current',mode:'practice',status:'active',questionIds:questions.map(q=>q.id),position:1,answers:{q0:{selected:'A',correct:true}},startedAt:1,finishedAt:null};
const finished={...active,status:'finished',finishedAt:2,score:1};
const data=session=>({questions,session,sessions:session?[session]:[],stats:{},mistakes:[]});
const snapshot=changes=>({version:1,view:'practice',sessionId:'current',sessionStatus:'active',summary:false,localPosition:0,showZh:false,selection:null,scopes:{},...changes});
let checks=0;
async function check(name,run){await run();checks++;console.log(`PASS ${name}`);}

(async()=>{
 await check('snapshot round trip retains page, result state and all-source chapter scope',()=>{
  const memory=new Map();const storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  const original=snapshot({summary:true,scopes:{current:{subjectId:'contract',sourceId:'all',chapterId:'contract-01'}}});
  writeWorkspace(storage,workspaceKey(true),original);
  assert.equal(JSON.stringify(readWorkspace(storage,workspaceKey(true))),JSON.stringify(original));
  assert.equal(readWorkspace(storage,workspaceKey(false)),null);
 });
 await check('invalid or unavailable storage does not prevent study startup',()=>{
  for(const raw of ['{bad','null','{"version":2,"view":"practice"}','{"version":1,"view":"unknown"}'])assert.equal(readWorkspace({getItem:()=>raw},'key'),null);
  assert.equal(readWorkspace({getItem(){throw Error('blocked');}},'key'),null);
  assert.doesNotThrow(()=>writeWorkspace({setItem(){throw Error('quota');}},'key',snapshot()));
 });
 await check('existing practice resumes on first upgrade without a prior workspace snapshot',()=>{
  assert.equal(restoreWorkspace(null,data(active)).view,'practice');
  assert.equal(restoreWorkspace(null,data(finished)).summary,true);
  assert.equal(restoreWorkspace(null,data(null)).view,'library');
 });
 await check('refresh keeps completion results and finished-question review distinct',()=>{
  assert.equal(restoreWorkspace(snapshot({summary:true,sessionStatus:'finished'}),data(finished)).summary,true);
  assert.equal(restoreWorkspace(snapshot({summary:false,sessionStatus:'finished'}),data(finished)).summary,false);
  assert.equal(restoreWorkspace(snapshot({summary:true}),data(active)).summary,false);
 });
 await check('expired historical exam opens its results after refresh',()=>{
  assert.equal(restoreWorkspace(snapshot(),data({...finished,mode:'exam'})).summary,true);
  const restored=restoreWorkspace(snapshot({selection:{questionId:'q1',value:'B'}}),data({...finished,mode:'exam',answers:{q1:{selected:'',correct:false}}}));
  assert.equal(restored.selected,'','An unsaved draft must not appear as an answer after an exam has finished');
 });
 await check('saved non-practice pages survive refresh without displaying a result screen',()=>{
  for(const view of ['library','materials','wrong','memory','history']){
   const restored=restoreWorkspace(snapshot({view,summary:true}),data(finished));
   assert.equal(restored.view,view);assert.equal(restored.summary,false);
  }
 });
 await check('draft selections resume only on their original question and valid option',()=>{
  const restored=restoreWorkspace(snapshot({selection:{questionId:'q1',value:'B'},showZh:true}),data(active));
  assert.equal(restored.selected,'B');assert.equal(restored.showZh,true);
  for(const selection of [{questionId:'q0',value:'B'},{questionId:'q1',value:'Z'}])assert.equal(restoreWorkspace(snapshot({selection}),data(active)).selected,'');
  assert.equal(restoreWorkspace(snapshot({selection:{questionId:'q0',value:'B'}}),data({...active,position:0})).selected,'A');
 });
 await check('practice before the first submission also restores without a session',()=>{
  const restored=restoreWorkspace(snapshot({sessionId:null,sessionStatus:null,localPosition:1,selection:{questionId:'q1',value:'B'}}),data(null));
  assert.equal(restored.view,'practice');assert.equal(restored.localPosition,1);assert.equal(restored.selected,'B');
  assert.equal(restoreWorkspace(snapshot({sessionId:null,localPosition:100}),data(null)).localPosition,2);
 });
 await check('removed sessions return safely to the library rather than a different practice',async()=>{
  const calls=[];const result=await hydrateWorkspace(snapshot({sessionId:'removed'}),async id=>{calls.push(id);return data(active);});
  assert.deepEqual(calls,[undefined]);assert.equal(result.workspace.view,'library');
 });
 await check('a refreshed older session is explicitly hydrated instead of the newest one',async()=>{
  const older={...finished,id:'older',position:2};const latest={...active,id:'latest'};const calls=[];
  const result=await hydrateWorkspace(snapshot({sessionId:'older',sessionStatus:'finished',summary:false}),async id=>{calls.push(id);return {...data(id==='older'?older:latest),sessions:[latest,older]};});
  assert.deepEqual(calls,[undefined,'older']);assert.equal(result.data.session.id,'older');assert.equal(result.data.session.position,2);assert.equal(result.workspace.summary,false);
 });
 await check('failed hydration remains an error instead of silently opening another session',async()=>{
  await assert.rejects(hydrateWorkspace(snapshot(),async()=>{throw Error('offline');}),/offline/);
 });
 await check('real guest practice preserves answers and position across reload, then restores completion',async()=>{
  const {questions:bank}=require('../lib/questions.ts');
  const {chapters,filterQuestions}=require('../lib/chapters.ts');
  const {applyGuestStudyAction}=require('../lib/guest-study.ts');
  const chapter=chapters.find(chapter=>{const count=filterQuestions(bank,{chapterId:chapter.id,sourceId:'sra'}).length;return count>=2&&count<=5;});
  assert.ok(chapter);
  let current=applyGuestStudyAction(null,{action:'start',id:randomUUID(),mode:'practice',subjectId:chapter.subjectId,chapterId:chapter.id,sourceId:'sra'});
  const sessionId=current.data.session.id;
  const ids=current.data.session.questionIds;
  const choice=bank.find(q=>q.id===ids[0]).explanation.answer;
  current=applyGuestStudyAction(current.state,{action:'answer',sessionId,questionId:ids[0],selected:choice});
  current=applyGuestStudyAction(current.state,{action:'navigate',sessionId,position:1});
  const stored=JSON.parse(JSON.stringify(current.state));
  const request=async requested=>{current=applyGuestStudyAction(stored,{action:'hydrate',sessionId:requested});return current.data;};
  const resumed=await hydrateWorkspace(snapshot({sessionId}),request);
  assert.equal(resumed.workspace.view,'practice');assert.equal(resumed.data.session.position,1);assert.equal(resumed.data.session.answers[ids[0]].selected,choice);
  assert.deepEqual(current.state,stored);
  for(const id of ids.slice(1))current=applyGuestStudyAction(current.state,{action:'answer',sessionId,questionId:id,selected:bank.find(q=>q.id===id).explanation.answer});
  current=applyGuestStudyAction(current.state,{action:'finish',sessionId});
  const completed=restoreWorkspace(snapshot({sessionId,sessionStatus:'finished',summary:true}),current.data);
  assert.equal(completed.view,'practice');assert.equal(completed.summary,true);assert.equal(current.data.session.score,ids.length);
 });
 console.log(`${checks} workspace restoration checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
