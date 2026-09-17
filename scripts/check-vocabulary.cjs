// Exercise the actual API SQL against isolated SQLite; no live study data is used.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function compile(file,imports={}){
 const exports={};
 const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const run=vm.runInThisContext(`(function(require,exports){${js}\n})`,{filename:file});
 run(name=>{if(name in imports)return imports[name];throw Error('Unexpected import '+name);},exports);return exports;
}
const memory=compile('lib/vocabulary.ts');
assert.equal(memory.wordKey('  Separate  Legal Personality '),'separate legal personality');
assert.equal(memory.wordKey('ＣＯＮＴＲＡＣＴ'),'contract');
assert.equal(memory.reviewDate('Asia/Shanghai',Date.parse('2026-09-16T17:00:00Z')),'2026-09-17');
assert.equal(memory.reviewDate('America/Los_Angeles',Date.parse('2026-09-16T17:00:00Z')),'2026-09-16');
assert.equal(memory.addDays('2028-02-28',1),'2028-02-29');
assert.equal(memory.addDays('2026-12-31',1),'2027-01-01');
assert.equal(memory.addDays('2026-03-08',1),'2026-03-09');
for(let stage=0;stage<8;stage++){
 const good=memory.nextReview({stage},'good','2026-09-16',1000);
 assert.equal(good.nextReview,memory.addDays('2026-09-16',memory.REVIEW_INTERVALS[Math.min(stage+1,7)]));
 assert.equal(good.stage,Math.min(stage+1,7));
 const again=memory.nextReview({stage},'again','2026-09-16',1000);
 assert.equal(again.stage,stage);assert.equal(again.nextReview,'2026-09-16');assert.equal(again.queueOrder,1000);
 assert.equal(memory.nextReview({stage},'hard','2026-09-16',1000).nextReview,'2026-09-17');
}
const db=new DatabaseSync(':memory:');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
const binding={prepare(sql){const statement=db.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return{results:statement.all(...args)};},async run(){const result=statement.run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}};
let user={userId:'user-a'};
const route=compile('app/api/vocabulary/route.ts',{
 '../../chatgpt-auth':{getChatGPTUser:async()=>user},'@/db/store':{database:()=>binding},
 '@/lib/questions':{questions:[{id:'test-q',sourceId:'test',number:1,subjectId:'contract'}]},
 '@/lib/question-sources':{sourceById:()=>({name:'Test source'}),questionNumberLabel:q=>'Q'+q.number},
 '@/lib/vocabulary':memory,
});
async function post(body,headers={}){const response=await route.POST(new Request('https://study.test/api/vocabulary',{method:'POST',headers:{'Content-Type':'application/json','X-Study-Action':'1',...headers},body:JSON.stringify({...body,timeZone:'Asia/Shanghai'})}));return{status:response.status,value:await response.json()};}
async function get(){const response=await route.GET(new Request('https://study.test/api/vocabulary?timeZone=Asia%2FShanghai'));return{status:response.status,value:await response.json()};}
const draft=(word)=>({action:'add',id:crypto.randomUUID(),word,kind:'term',meaning:'Example meaning',example:'Example context',questionId:'test-q',sessionId:null});
(async()=>{
 assert.equal((await get()).value.cards.length,0);
 const a=draft('Consideration');let result=await post(a);assert.equal(result.status,200);assert.equal(result.value.cards.length,1);
 let saved=result.value.cards[0];assert.equal(saved.sourceLabel,'Test source · Q1');assert.equal(saved.stage,0);
 assert.equal((await post({...draft('  CONSIDERATION  ')})).value.duplicate,true);
 assert.equal((await get()).value.cards.length,1);
 assert.equal((await post({...draft('Illegality'),sessionId:'unowned-session'})).status,400);
 assert.equal((await post(draft('Bad request'),{'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await post({...draft('Bad kind'),kind:'bad'})).status,400);
 assert.equal((await post({...draft('Too long'),word:'a'.repeat(201)})).status,400);
 const b=draft('Estoppel');await post(b);
 result=await post({action:'rate',id:a.id,revision:saved.revision,rating:'again'});assert.equal(result.status,200);
 let due=memory.dueCards(result.value.cards,result.value.today);assert.equal(due[0].id,b.id);assert.equal(due.at(-1).id,a.id);
 // Repeated retry/concurrent tab cannot advance a card twice using a stale revision.
 assert.equal((await post({action:'rate',id:a.id,revision:saved.revision,rating:'good'})).status,409);
 saved=result.value.cards.find(c=>c.id===a.id);
 result=await post({action:'rate',id:a.id,revision:saved.revision,rating:'good'});
 saved=result.value.cards.find(c=>c.id===a.id);assert.equal(saved.stage,1);assert.equal(saved.reviewCount,2);assert.equal(saved.nextReview,memory.addDays(result.value.today,1));
 assert.equal((await post({action:'rate',id:a.id,revision:saved.revision,rating:'good'})).status,409);
 result=await post({...saved,action:'edit',meaning:'Updated meaning'});assert.equal(result.status,200);
 const reloaded=(await get()).value.cards.find(c=>c.id===a.id);assert.equal(reloaded.meaning,'Updated meaning');assert.equal(reloaded.nextReview,saved.nextReview);assert.equal(reloaded.reviewCount,2);
 user={userId:'user-b'};assert.equal((await get()).value.cards.length,0);
 assert.equal((await post({...saved,action:'edit',meaning:'Wrong owner'})).status,404);
 assert.equal((await post({...saved,action:'rate',rating:'again'})).status,404);
 await post({action:'delete',id:a.id,revision:reloaded.revision});
 const other=await post(draft('Consideration'));assert.equal(other.value.cards.length,1);assert.notEqual(other.value.cards[0].id,a.id);
 user=null;assert.equal((await get()).status,401);assert.equal((await post(a)).status,401);
 user={userId:'user-a'};assert.equal((await get()).value.cards.find(c=>c.id===a.id).meaning,'Updated meaning');
 assert.equal((await post({action:'delete',id:a.id,revision:0})).status,409);
 assert.equal((await post({action:'delete',id:a.id,revision:reloaded.revision})).status,200);
 assert.equal((await get()).value.cards.length,1);
 console.log('Vocabulary checks passed: calendar scheduling, same-day queue, CRUD/reload, deduplication, ownership, validation, and concurrent-review protection.');
 db.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
