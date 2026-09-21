// Validate the supplementary layer against raw SRA answers and both grading paths.
// All history stays in memory; this check never reads or changes user study records.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,mode TEXT,status TEXT,question_ids TEXT,position INTEGER,started_at INTEGER,finished_at INTEGER); CREATE TABLE responses(session_id TEXT,question_id TEXT,selected TEXT,correct INTEGER,answered_at INTEGER,PRIMARY KEY(session_id,question_id));');
const db={prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},batch:ops=>Promise.all(ops.map(op=>op.run()))};
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../../chatgpt-auth')return {getChatGPTUser:async()=>({userId:'sra-review-test'})};
 if(request==='@/db/store')return {database:()=>db};
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 // Match the app bundler: prefer TS modules over same-name JSON data files.
 const resolved=request.startsWith('.')?path.resolve(path.dirname(parent.filename),request):request;
 if(path.isAbsolute(resolved)&&!path.extname(resolved)){
  for(const ext of ['.ts','.tsx'])if(fs.existsSync(resolved+ext)){request=resolved+ext;break;}
 }
 return nativeLoad.call(this,request,parent,isMain);
};
const originals=require('../lib/sra-flk2-original.json');
const pretested=require('../lib/sra-flk2-pretested.json');
const raw=[...originals,...pretested];
const reviews=require('../lib/sra-flk2-supplementary-reviews.json');
const {questions,publicQuestions}=require('../lib/questions.ts');
const {applySraFlk2SupplementaryReview}=require('../lib/sra-flk2-review-overlay.ts');
const {applyGuestStudyAction,emptyGuestStudyState}=require('../lib/guest-study.ts');
const {AnswerReview}=require('../app/answer-review.tsx');
const {renderToStaticMarkup}=require('react-dom/server');
const React=require('react');
const api=require('../app/api/study/route.ts');
async function post(body){const response=await api.POST(new Request('http://localhost/api/study',{method:'POST',headers:{'Content-Type':'application/json','x-study-action':'1'},body:JSON.stringify(body)}));assert.equal(response.status,200);return response.json();}
async function main(){
 assert.deepEqual(Object.keys(reviews),raw.slice(0,60).map(q=>q.id));
 const snapshot=JSON.stringify(raw);
 for(const original of raw){
  const reviewed=applySraFlk2SupplementaryReview(original);
  if(!reviews[original.id]){assert.equal(reviewed,original);continue;}
  const merged=questions.find(q=>q.id===original.id),review=reviews[original.id];
  assert.deepEqual({...reviewed,explanation:original.explanation},original,'Only explanation fields may change');
  for(const key of ['answer','source','sourceUrl','en','ruleEn'])assert.equal(reviewed.explanation[key],original.explanation[key]);
  assert.deepEqual(Object.keys(review.optionZh),original.options.map(o=>o.id));
  for(const text of [review.zh,review.ruleZh,review.warning,...Object.values(review.optionZh)]){
   assert.ok(text.trim().length>0,original.id+' substantive text');
   assert.doesNotMatch(text,/本选项不是 SRA 官方答案|SRA 官方正确答案|未提供逐项解析/);
  }
  assert.match(review.supplementaryReview.reviewedAt,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(review.supplementaryReview.sources.length);
  for(const source of review.supplementaryReview.sources){assert.equal(new URL(source.url).protocol,'https:');assert.ok(source.label);}
  assert.throws(()=>applySraFlk2SupplementaryReview({...original,explanation:{...original.explanation,answer:'Z'}}),/answer mismatch/);
  const html=renderToStaticMarkup(React.createElement(AnswerReview,{question:merged,answer:{selected:original.explanation.answer}}));
  assert.ok(html.includes('补充解析（非 SRA 官方）'));
  assert.ok(html.includes('SRA 官方答案表'));
  for(const source of review.supplementaryReview.sources)assert.ok(html.includes(source.url.replaceAll('&','&amp;')));
 }
 assert.equal(JSON.stringify(raw),snapshot,'Raw source objects stay unchanged');
 assert.equal(questions.filter(q=>q.explanation.supplementaryReview).length,60);
 assert.equal(questions.filter(q=>q.id.startsWith('sra-flk2-')&&q.explanation.zh.includes('未提供逐项解析')).length,50);
 assert.ok(publicQuestions().every(q=>!('explanation' in q)&&!('supplementaryReview' in q)));
 for(const q of [raw[0],raw[15],raw[21],raw[24],raw[26],raw[28],raw[29],raw[30],raw[31],raw[32],raw[36],raw[39],raw[40],raw[44],raw[45],raw[47],raw[48],raw[49],raw[53],raw[54],raw[56],raw[59]]){
 const sessionId=randomUUID(),settings={action:'start',id:sessionId,mode:'practice',sourceId:'sra',sourceSet:q.sourceSet};
 let guest=applyGuestStudyAction(emptyGuestStudyState(),settings);
 let data=await post(settings);
 for(const payload of [guest.data,data])assert.ok(payload.questions.every(item=>!item.explanation));
 const answer={action:'answer',sessionId,questionId:q.id,selected:q.explanation.answer};
 guest=applyGuestStudyAction(guest.state,answer);data=await post(answer);
 for(const payload of [guest.data,data]){
  const revealed=payload.questions.find(item=>item.id===q.id);
  assert.equal(revealed.explanation.zh,reviews[q.id].zh);
  assert.deepEqual(revealed.explanation.supplementaryReview,reviews[q.id].supplementaryReview);
  assert.ok(payload.questions.filter(item=>item.id!==q.id).every(item=>!item.explanation));
 }
 const restored=applyGuestStudyAction(guest.state,{action:'hydrate',sessionId});
 assert.equal(restored.data.questions.find(item=>item.id===q.id).explanation.zh,reviews[q.id].zh);
 }
 console.log('PASS: 60 source-aligned reviews, 300 option explanations, visible provenance, immutable official answers, guest/API reveal boundaries; 50 FLK2 placeholders remain.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
