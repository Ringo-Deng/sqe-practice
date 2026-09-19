// Deterministic navigation checks using synthetic questions, never saved study data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {chapters,chapterById}=require('../lib/chapters.ts');
const {getNextChapter}=require('../lib/next-chapter.ts');

function question(id,chapterId,sourceId='sra',sourceSet,extra={}){
 return {id,chapterId,sourceId,sourceSet,subjectId:chapterById(chapterId)?.subjectId??'contract',number:1,stem:'Fixture',ask:'Fixture?',options:[],...extra};
}
function completed(items,extra={}){
 return {id:'completed-session',mode:'practice',status:'finished',questionIds:items.map(item=>item.id),position:items.length-1,startedAt:1,finishedAt:2,answers:Object.fromEntries(items.map(item=>[item.id,{selected:'A',correct:true}])),score:items.length,...extra};
}
function scope(chapterId,extra={}){
 return {subjectId:chapterById(chapterId).subjectId,sourceId:'sra',chapterId,...extra};
}
let checked=0;
function check(name,run){run();checked++;console.log(`PASS ${name}`);}

check('first and middle chapters advance in library order',()=>{
 const items=[question('first','contract-01'),question('middle','contract-02'),question('third','contract-03')];
 assert.equal(getNextChapter(completed([items[0]]),items,scope('contract-01')).chapterId,'contract-02');
 assert.equal(getNextChapter(completed([items[1]]),items,scope('contract-02')).chapterId,'contract-03');
});
check('last chapter never wraps back to earlier questions',()=>{
 const items=[question('first','contract-01'),question('last','contract-10')];
 assert.equal(getNextChapter(completed([items[1]]),items,scope('contract-10')),null);
});
check('empty chapters are skipped and the populated chapter count is accurate',()=>{
 const items=[question('first','contract-01'),question('fourth-a','contract-04'),question('fourth-b','contract-04')];
 const result=getNextChapter(completed([items[0]]),items,scope('contract-01'));
 assert.equal(result.chapterId,'contract-04');
 assert.equal(result.questionCount,2);
 assert.equal(result.chapter,chapterById('contract-04'));
});
check('a specific source skips chapters populated only by another source',()=>{
 const items=[question('first','contract-01'),question('other-source','contract-02','revise'),question('same-source','contract-03')];
 const result=getNextChapter(completed([items[0]]),items,scope('contract-01'));
 assert.equal(result.chapterId,'contract-03');
 assert.equal(result.sourceId,'sra');
});
check('explicit all-source practice does not narrow to the current source',()=>{
 const items=[question('first','contract-01'),question('second','contract-02','revise')];
 for(const sourceId of ['all',undefined]){
  const result=getNextChapter(completed([items[0]]),items,scope('contract-01',{sourceId}));
  assert.equal(result.chapterId,'contract-02');
  assert.equal(result.sourceId,'all');
 }
});
check('a selected assessment set is retained while skipping unavailable chapters',()=>{
 const items=[question('first','contract-01','revise','set-a'),question('second-b','contract-02','revise','set-b'),question('third-a','contract-03','revise','set-a')];
 const result=getNextChapter(completed([items[0]]),items,scope('contract-01',{sourceId:'revise',sourceSet:'set-a'}));
 assert.equal(result.chapterId,'contract-03');
 assert.equal(result.sourceSet,'set-a');
});
check('an explicit scope without an assessment filter remains unrestricted',()=>{
 const items=[question('first','contract-01','revise','set-a'),question('second','contract-02','revise','set-b')];
 const result=getNextChapter(completed([items[0]]),items,scope('contract-01',{sourceId:'revise'}));
 assert.equal(result.chapterId,'contract-02');
 assert.equal(result.sourceSet,undefined);
});
check('same-subject progression crosses textbooks without sorting chapter numbers',()=>{
 const items=[question('last-system','legal-system-lss-04'),question('first-constitution','legal-system-cal-01')];
 const result=getNextChapter(completed([items[0]]),items,scope('legal-system-lss-04'));
 assert.equal(result.chapterId,'legal-system-cal-01');
 assert.notEqual(result.chapter.bookId,chapterById('legal-system-lss-04').bookId);
});
check('legal syllabus topics follow the displayed order across topic groups',()=>{
 const legal=chapters.filter(chapter=>chapter.subjectId==='legal-services');
 const items=[question('funding',legal[3].id),question('principles',legal[4].id)];
 assert.equal(getNextChapter(completed([items[0]]),items,scope(legal[3].id)).chapterId,legal[4].id);
});
check('legacy subsets infer a unique chapter, source and assessment set',()=>{
 const items=[question('first-a','contract-01','revise','set-a'),question('first-b','contract-01','revise','set-a'),question('second-b','contract-02','revise','set-b'),question('third-a','contract-03','revise','set-a'),question('first-other','contract-01','revise','set-b')];
 const result=getNextChapter(completed(items.slice(0,2)),items);
 assert.equal(result.chapterId,'contract-03');
 assert.equal(result.sourceId,'revise');
 assert.equal(result.sourceSet,'set-a');
});
check('legacy whole chapters do not infer an accidental assessment restriction',()=>{
 const items=[question('first-a','contract-01','revise','chapter-01'),question('first-b','contract-01','revise','chapter-01'),question('second','contract-02','revise','chapter-02')];
 const result=getNextChapter(completed(items.slice(0,2)),items);
 assert.equal(result.chapterId,'contract-02');
 assert.equal(result.sourceId,'revise');
 assert.equal(result.sourceSet,undefined);
});
check('legacy mixed-source sessions retain all sources without picking the last question',()=>{
 const items=[question('first-sra','contract-01'),question('first-revise','contract-01','revise'),question('second-qlts','contract-02','qlts')];
 const result=getNextChapter(completed(items.slice(0,2)),items);
 assert.equal(result.chapterId,'contract-02');
 assert.equal(result.sourceId,'all');
});
check('related legal topics do not replace primary library chapter membership',()=>{
 const items=[question('aml','legal-services-aml','sra',undefined,{relatedChapterIds:['legal-services-funding']}),question('financial','legal-services-financial-services')];
 assert.equal(getNextChapter(completed([items[0]]),items).chapterId,'legal-services-financial-services');
 assert.equal(getNextChapter(completed([items[0]]),items,scope('legal-services-funding')),null);
});
check('mixed chapters, mixed subjects and missing question IDs are not guessed',()=>{
 const items=[question('one','contract-01'),question('two','contract-02'),question('tort','tort-01'),question('later','contract-03')];
 assert.equal(getNextChapter(completed(items.slice(0,2)),items),null);
 assert.equal(getNextChapter(completed([items[0],items[2]]),items),null);
 assert.equal(getNextChapter(completed([items[0],question('missing','contract-01')]),items),null);
});
check('whole-subject and incompatible explicit scopes return to the library',()=>{
 const items=[question('first','contract-01'),question('second','contract-02')];
 const session=completed([items[0]]);
 assert.equal(getNextChapter(session,items,{subjectId:'contract',sourceId:'sra'}),null);
 assert.equal(getNextChapter(session,items,scope('contract-01',{subjectId:'tort'})),null);
 assert.equal(getNextChapter(session,items,scope('contract-01',{sourceId:'revise'})),null);
 assert.equal(getNextChapter(session,items,scope('contract-01',{sourceSet:'unknown'})),null);
 assert.equal(getNextChapter(session,items,{chapterId:'unknown'}),null);
});
check('active or empty sessions cannot advance; finished exam and wrong sessions can',()=>{
 const items=[question('first','contract-01'),question('second','contract-02')];
 assert.equal(getNextChapter(null,items),null);
 assert.equal(getNextChapter(completed([]),items),null);
 assert.equal(getNextChapter(completed([items[0]],{status:'active'}),items),null);
 for(const mode of ['exam','wrong'])assert.equal(getNextChapter(completed([items[0]],{mode}),items).chapterId,'contract-02');
});
check('input questions and completed session remain unchanged',()=>{
 const items=[question('first','contract-01'),question('second','contract-02')];
 const session=completed([items[0]]);
 const before=JSON.stringify({items,session});
 getNextChapter(session,items,scope('contract-01'));
 assert.equal(JSON.stringify({items,session}),before);
});
check('real legacy source-specific chapter groups advance exactly like library chapter buttons',()=>{
 const {questions}=require('../lib/questions.ts');
 const {filterQuestions}=require('../lib/chapters.ts');
 let groupCount=0;
 for(const sourceId of new Set(questions.map(item=>item.sourceId)))for(const chapter of chapters){
  const selectedScope={subjectId:chapter.subjectId,sourceId,chapterId:chapter.id};
  const items=filterQuestions(questions,selectedScope);
  if(!items.length)continue;
  const session=completed(items);
  assert.deepEqual(getNextChapter(session,questions),getNextChapter(session,questions,selectedScope),`${sourceId} / ${chapter.id}`);
  groupCount++;
 }
 assert.ok(groupCount>200,'The real bank must cover source-specific chapter groups');
});

console.log(`Next-chapter checks passed: ${checked} scenarios.`);
