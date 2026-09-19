// Deterministic resume checks; only fixture records are used and none are saved.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {getLibraryResume}=require('../lib/library-resume.ts');
const {questions:bank}=require('../lib/questions.ts');
const {chapterById}=require('../lib/chapters.ts');
const {sourceById}=require('../lib/question-sources.ts');

const question=(id,extra={})=>({id,sourceId:'revise',subjectId:'contract',chapterId:'contract-01',number:1,stem:'Fixture',stemZh:'测试',ask:'Fixture?',askZh:'测试？',options:[],...extra});
const questions=[question('first'),question('current',{subjectId:'tort',chapterId:'tort-02',sourceId:'qlts'}),question('last',{chapterId:'contract-02'})];
const session=(id,extra={})=>({id,mode:'practice',status:'active',questionIds:questions.map(item=>item.id),position:1,startedAt:100,finishedAt:null,answers:{},...extra});
const data=(current=null,sessions=[],items=questions)=>({questions:items,session:current,sessions,stats:{answered:0,correct:0,accuracy:null,wrongCount:0,subjects:[]},mistakes:[]});
let checks=0;
const check=(name,run)=>{run();checks++;console.log(`PASS ${name}`);};

check('reopened older session is preferred over newer history',()=>{
 const old=session('reopened',{startedAt:1}),newer=session('newer',{startedAt:300});
 const result=getLibraryResume(data(old,[newer,old]));
 assert.equal(result.session,old);
 assert.equal(result.position,1,'The original saved position is retained rather than seeking unanswered questions');
});
check('unsorted fallback chooses most recent completion or start',()=>{
 const older=session('old',{startedAt:1}),finished=session('finished',{startedAt:2,finishedAt:500,status:'finished'}),active=session('active',{startedAt:300});
 for(const history of [[older,active,finished],[finished,older,active],[active,finished,older]]){
  const result=getLibraryResume(data(null,history));
  assert.equal(result.session,finished);
  assert.equal(result.finished,true,'An older active group must not displace the most recent result');
 }
 assert.equal(getLibraryResume(data(null,[finished,session('latest',{startedAt:600})])).session.id,'latest');
});
check('no records produces no entry',()=>{
 assert.equal(getLibraryResume(data()),null);
 assert.equal(getLibraryResume(data(null,[],[])),null);
});
check('invalid current session falls back to a usable history record',()=>{
 const fallback=session('fallback');
 const result=getLibraryResume(data(session('bad',{position:20}),[session('new-invalid',{questionIds:['missing'],position:0,startedAt:999}),fallback]));
 assert.equal(result.session,fallback);
});
check('missing current and non-current questions both exclude damaged groups',()=>{
 const valid=session('valid');
 for(const ids of [['first','missing','last'],['missing','current','last']]){
  assert.equal(getLibraryResume(data(session('damaged',{questionIds:ids}))),null);
  assert.equal(getLibraryResume(data(null,[session('damaged',{questionIds:ids,startedAt:999}),valid])).session,valid);
 }
});
check('invalid positions and malformed question sequences are rejected without repair',()=>{
 for(const position of [-1,3,1.5,NaN,Infinity,'1'])assert.equal(getLibraryResume(data(session('invalid',{position}))),null);
 for(const questionIds of [[],null,'first',['first','first'],['first',42]])assert.equal(getLibraryResume(data(session('invalid',{questionIds,position:0}))),null);
 for(const extra of [{id:''},{status:'broken'},{mode:'broken'}])assert.equal(getLibraryResume(data(session('invalid',extra))),null);
});
check('cross-subject and cross-source groups describe the actual current question',()=>{
 const result=getLibraryResume(data(session('mixed')));
 assert.equal(result.question,questions[1]);
 assert.equal(result.position,1);
 assert.equal(result.total,3);
 assert.equal(result.subjectLabel,'侵权法');
 assert.equal(result.chapterLabel,'第 2 章 · 过失：因果关系、损害遥远性与损失');
 assert.equal(result.sourceLabel,'QLTS');
});
check('real bank question resolves its current chapter and source',()=>{
 const item=bank.find(item=>item.subjectId==='contract'&&item.chapterId==='contract-01'&&item.sourceId==='revise');
 assert.ok(item,'The real imported bank has a matching chapter question');
 const result=getLibraryResume(data(session('real',{questionIds:[item.id],position:0}),[],[item]));
 assert.equal(result.question,item);
 assert.equal(result.subjectLabel,'合同法');
 assert.equal(result.chapterLabel,`第 ${chapterById(item.chapterId).number} 章 · ${chapterById(item.chapterId).zh}`);
 assert.equal(result.sourceLabel,sourceById(item.sourceId).name);
});
check('syllabus uses topic labels and absent chapters stay absent',()=>{
 const topic=question('topic',{subjectId:'legal-services',chapterId:'legal-services-aml',sourceId:'sra'});
 const result=getLibraryResume(data(session('topic-session',{questionIds:[topic.id],position:0}),[],[topic]));
 assert.equal(result.chapterLabel,'专题 2 · 反洗钱');
 assert.equal(result.subjectLabel,'法律服务与职业道德');
 assert.equal(result.sourceLabel,'SRA 官方');
 for(const chapterId of [undefined,'removed-chapter']){
  const item=question('no-chapter',{chapterId});
  assert.equal(getLibraryResume(data(session('no-chapter',{questionIds:[item.id],position:0}),[],[item])).chapterLabel,'');
 }
});
check('wrong-answer and exam sessions preserve mode and position',()=>{
 for(const mode of ['wrong','exam']){
  const original=session(mode,{mode,position:2});
  const result=getLibraryResume(data(original));
  assert.equal(result.session,original);
  assert.equal(result.session.mode,mode);
  assert.equal(result.question,questions[2]);
  assert.equal(result.position,2);
  assert.equal(result.finished,false);
 }
});
check('selected finished sessions remain available as results',()=>{
 const current=session('selected-finished',{status:'finished',finishedAt:200,position:2});
 const result=getLibraryResume(data(current,[session('newer-active',{startedAt:999})]));
 assert.equal(result.session,current);
 assert.equal(result.finished,true);
 assert.equal(result.position,2);
});
check('answered counts only nonempty answers within the original group',()=>{
 const current=session('answers',{answers:{first:{selected:'A',correct:false},current:{selected:' '},last:{selected:'C',correct:true},outside:{selected:'B'}}});
 assert.equal(getLibraryResume(data(current)).answered,2);
 for(const answers of [{first:{selected:''},current:{selected:null},last:{selected:7}},undefined])assert.equal(getLibraryResume(data(session('empty-answers',{answers}))).answered,0);
});
check('history, question order and original session data are never changed',()=>{
 const current=session('immutable',{answers:{first:{selected:'B'}}});
 const history=[current,session('newest',{startedAt:500})];
 const input=data(null,history),before=JSON.stringify(input);
 Object.freeze(current.questionIds);Object.freeze(current.answers);Object.freeze(current);Object.freeze(history);Object.freeze(input.questions);
 getLibraryResume(input);
 assert.equal(JSON.stringify(input),before);
});

console.log(`Library resume checks passed: ${checks} scenarios.`);
