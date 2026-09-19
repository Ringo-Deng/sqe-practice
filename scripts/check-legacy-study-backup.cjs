/* eslint-disable @typescript-eslint/no-require-imports -- Isolated migration tests load production TypeScript. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {LEGACY_GUEST_STUDY_KEY,createLegacyStudyBackup,readLegacyStudyBackup,parseLegacyStudyBackup,LegacyStudyBackupError}=require('../lib/legacy-study-backup.ts');
const {prepareLegacyStudyImport}=require('../cloud/legacy-study-import.ts');
const {restoreBackup,exportBackup,handleBackupRequest}=require('../cloud/backup.ts');
const {questions}=require('../lib/questions.ts');
const root=path.resolve(__dirname,'..'),q1=questions[0],q2=questions[1];
const sessionA='11111111-1111-4111-8111-111111111111',sessionB='22222222-2222-4222-8222-222222222222';
const time=1700000000000,wrong=q2.options.find(option=>option.id!==q2.explanation.answer).id;
const clone=value=>JSON.parse(JSON.stringify(value));
function state(){return {version:1,currentSessionId:sessionA,sessions:[{id:sessionA,mode:'practice',status:'active',questionIds:[q1.id,q2.id],position:1,startedAt:time,finishedAt:null,answers:{[q1.id]:{selected:q1.explanation.answer,answeredAt:time+100},[q2.id]:{selected:wrong,answeredAt:time+200}}}]};}
function database(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
 sql.exec(fs.readFileSync(path.join(root,'cloud/reading-position-migration.sql'),'utf8'));
 let batches=0;
 return {sql,get batches(){return batches;},prepare(query){return {bindings:[],bind(...bindings){return {...this,bindings};},query};},async batch(statements){
  batches++;sql.exec('BEGIN');try{const results=statements.map(({query,bindings})=>{const prepared=sql.prepare(query);if(prepared.columns().length)return {results:prepared.all(...bindings).map(row=>({...row})),meta:{changes:0}};return {results:[],meta:{changes:Number(prepared.run(...bindings).changes)}};});sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}
 },close(){sql.close();}};
}
let checks=0;
async function check(name,run){try{await run();checks++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}}

(async()=>{
 await check('Export reads exactly the guest study key and preserves the complete raw history without writing',()=>{
  const original=state(),raw=JSON.stringify(original),calls=[];
  const storage={getItem(key){calls.push(key);assert.equal(key,LEGACY_GUEST_STUDY_KEY);return raw;},setItem(){throw Error('Must never write');}};
  const backup=readLegacyStudyBackup(storage,time+999);
  assert.deepEqual(calls,[LEGACY_GUEST_STUDY_KEY]);assert.equal(backup.format,'sqe-practice-legacy-study');assert.equal(backup.formatVersion,1);assert.equal(backup.scope,'study-only');
  assert.deepEqual(backup.study,original);assert.equal(backup.exportedAt,new Date(time+999).toISOString());assert.equal(raw,JSON.stringify(original));
 });
 await check('Missing, empty, unreadable and damaged browser storage report errors instead of exporting emptiness',()=>{
  for(const raw of [null,'{broken',JSON.stringify({version:1,currentSessionId:null,sessions:[]}),JSON.stringify({version:2,currentSessionId:null,sessions:[]})])assert.throws(()=>readLegacyStudyBackup({getItem(){return raw;}}),error=>error instanceof LegacyStudyBackupError);
  assert.throws(()=>readLegacyStudyBackup({getItem(){throw Error('denied');}}),/存储权限/);
 });
 await check('Browser export retains unknown question IDs for explicit server-side migration reporting',()=>{
  const original=state();original.sessions[0].questionIds.push('removed-question');original.sessions[0].answers['removed-question']={selected:'A',answeredAt:time+300};
  const backup=createLegacyStudyBackup(original);assert.deepEqual(backup.study,original);
 });
 await check('More than one hundred sessions survive export and migration preparation',()=>{
  const original=state();for(let n=0;n<125;n++)original.sessions.push({...clone(original.sessions[0]),id:randomUUID(),startedAt:time+n});
  const backup=createLegacyStudyBackup(original),prepared=prepareLegacyStudyImport(backup,'account-a');
  assert.equal(backup.study.sessions.length,126);assert.equal(prepared.backup.data.sessions.length,126);assert.equal(prepared.backup.data.responses.length,252);
 });
 await check('Cloud migration grades from the actual server question bank and ignores forged owners or scores',async()=>{
  const db=database(),input=createLegacyStudyBackup(state());
  input.userId='victim';input.sourceAccountId='victim';input.study.user_id='victim';input.study.sessions[0].user_id='victim';input.study.sessions[0].score=999;
  input.study.sessions[0].answers[q1.id].correct=false;input.study.sessions[0].answers[q2.id].correct=true;
  const result=await restoreBackup(db,'account-a',input),restored=await exportBackup(db,'account-a');
  assert.equal(restored.data.sessions[0].user_id,'account-a');assert.equal(restored.data.responses.find(row=>row.question_id===q1.id).correct,1);assert.equal(restored.data.responses.find(row=>row.question_id===q2.id).correct,0);
  assert.equal(restored.data.responses.find(row=>row.question_id===q1.id).answered_at,time+100);assert.equal(restored.data.sessions[0].started_at,time);assert.equal(restored.data.sessions[0].position,1);
  assert.equal(result.migration.scope,'study-only');assert.equal(result.tables.sessions.inserted,1);assert.equal(result.tables.responses.inserted,2);db.close();
 });
 await check('Finished historical exams retain their finish time and blank unanswered responses',()=>{
  const original=state();Object.assign(original.sessions[0],{mode:'exam',status:'finished',finishedAt:time+900});original.sessions[0].answers[q2.id]={selected:'',answeredAt:time+900};
  const prepared=prepareLegacyStudyImport(createLegacyStudyBackup(original),'account-a');
  assert.equal(prepared.backup.data.sessions[0].finished_at,time+900);assert.equal(prepared.backup.data.responses.find(row=>row.question_id===q2.id).selected,'');assert.equal(prepared.backup.data.responses.find(row=>row.question_id===q2.id).correct,0);
 });
 await check('Unknown questions, invalid options and fully unknown sessions are explicitly reported',async()=>{
  const db=database(),original=state();original.sessions[0].questionIds=[q1.id,'unknown-middle',q2.id];original.sessions[0].position=1;
  original.sessions[0].answers['unknown-middle']={selected:'A',answeredAt:time+300};original.sessions[0].answers[q2.id].selected='invalid-option';
  original.sessions.push({id:sessionB,mode:'practice',status:'active',questionIds:['fully-removed'],position:0,startedAt:time,finishedAt:null,answers:{'fully-removed':{selected:'B',answeredAt:time+400}}});
  const result=await restoreBackup(db,'account-a',createLegacyStudyBackup(original));
  assert.deepEqual(result.migration.unknownQuestionIds,['fully-removed','unknown-middle']);assert.deepEqual(result.migration.skippedSessions,[{sessionId:sessionB,reason:'no-known-questions'}]);
  assert.equal(result.migration.skippedAnswers.length,3);assert.equal(result.migration.skippedAnswers.filter(item=>item.reason==='unknown-question').length,2);assert.equal(result.migration.skippedAnswers.filter(item=>item.reason==='invalid-option').length,1);
  const restored=await exportBackup(db,'account-a');assert.deepEqual(JSON.parse(restored.data.sessions[0].question_ids),[q1.id,q2.id]);assert.equal(restored.data.sessions[0].position,1);assert.equal(restored.data.responses.length,1);db.close();
 });
 await check('Migration never overwrites existing account answers or duplicates repeated imports',async()=>{
  const db=database(),input=createLegacyStudyBackup(state());await restoreBackup(db,'account-a',input);
  db.sql.prepare('UPDATE responses SET selected=?,correct=?,answered_at=? WHERE session_id=? AND question_id=?').run('new-target-answer',0,time+999,sessionA,q1.id);
  const result=await restoreBackup(db,'account-a',input);
  assert.equal(result.tables.sessions.inserted,0);assert.equal(result.tables.responses.inserted,0);assert.equal(db.sql.prepare('SELECT selected FROM responses WHERE session_id=? AND question_id=?').get(sessionA,q1.id).selected,'new-target-answer');db.close();
 });
 await check('A legacy session ID already owned by another account never gains new answers or changes owners',async()=>{
  const db=database(),input=createLegacyStudyBackup(state());await restoreBackup(db,'account-b',input);
  db.sql.prepare('DELETE FROM responses WHERE session_id=? AND question_id=?').run(sessionA,q2.id);
  const result=await restoreBackup(db,'account-a',input);
  assert.equal(result.tables.sessions.inserted,0);assert.equal(result.tables.responses.inserted,0);assert.equal(db.sql.prepare('SELECT user_id FROM sessions WHERE id=?').get(sessionA).user_id,'account-b');assert.equal(db.sql.prepare('SELECT count(*) AS n FROM responses').get().n,1);db.close();
 });
 await check('Legacy migration cannot import extra notes, PDFs, auth data or reading positions',async()=>{
  const db=database(),input=createLegacyStudyBackup(state());input.data={auth_users:[{id:'evil'}],vocabulary:[{id:'evil'}]};input.files={included:true};input.study.textbook_annotations=[{id:'evil'}];
  const result=await restoreBackup(db,'account-a',input);
  for(const table of ['vocabulary','textbook_annotations','textbook_titles','textbook_bookmarks','user_textbooks','reading_positions'])assert.deepEqual(result.tables[table],{received:0,inserted:0,skipped:0});db.close();
 });
 await check('Invalid raw structures fail before the database is touched',async()=>{
  const changes=[input=>{input.formatVersion=2;},input=>{input.study.sessions[0].position=99;},input=>{input.study.sessions[0].answers['not-in-session']={selected:'A',answeredAt:time};},input=>{input.study.sessions.push(clone(input.study.sessions[0]));},input=>{input.study.sessions[0].answers[q1.id].answeredAt='not-a-time';},input=>{input.study.currentSessionId=sessionB;}];
  const db=database();for(const change of changes){const input=createLegacyStudyBackup(state());change(input);await assert.rejects(()=>restoreBackup(db,'account-a',input),error=>error.status===400);}assert.equal(db.batches,0);db.close();
 });
 await check('Failure during migrated answer insertion rolls back migrated sessions',async()=>{
  const db=database();db.sql.exec("CREATE TRIGGER reject_answer BEFORE INSERT ON responses BEGIN SELECT RAISE(ABORT,'simulated failure'); END");
  await assert.rejects(()=>restoreBackup(db,'account-a',createLegacyStudyBackup(state())));assert.equal(db.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,0);db.close();
 });
 await check('The existing backup HTTP endpoint accepts the tagged legacy format and returns a migration report',async()=>{
  const db=database(),request=new Request('https://study.example/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(createLegacyStudyBackup(state()))});
  const response=await handleBackupRequest(request,db,'account-a');assert.equal(response.status,200);const body=await response.json();assert.equal(body.migration.format,'sqe-practice-legacy-study');assert.equal(body.tables.responses.inserted,2);db.close();
 });
 await check('Legacy size checks apply before conversion or storage reads can produce an oversized export',()=>{
  const input=createLegacyStudyBackup(state());input.extra='x'.repeat(20*1024*1024);
  assert.throws(()=>parseLegacyStudyBackup(input),error=>error.status===413);
  assert.throws(()=>readLegacyStudyBackup({getItem(){return ' '.repeat(20*1024*1024+1);}}),error=>error.status===413);
 });
 process.stdout.write(`Legacy study migration: ${checks} isolated checks passed using the real server question bank.\n`);
})().catch(error=>{console.error(error);process.exitCode=1;});
