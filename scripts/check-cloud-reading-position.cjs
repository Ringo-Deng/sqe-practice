/* eslint-disable @typescript-eslint/no-require-imports -- The isolated harness loads production TypeScript modules. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {activateReadingAccount,readReadingPositions,writeReadingPosition,getReadingSyncStatus,subscribeReadingSync}=require('../lib/textbook-reading-position.ts');
const {setWorkspaceAccount,workspaceKey}=require('../lib/study-workspace.ts');
const {handleReadingPositionRequest}=require('../cloud/reading-position-api.ts');
const books=[{id:'contract',pageCount:120},{id:'tort',pageCount:80}];
const legacy='sqe-practice:textbook-position:v2';
const key=account=>`${legacy}:account:${encodeURIComponent(account)}`;
const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),originalFetch=globalThis.fetch;
const positions=(page=8,book='contract')=>({lastBookId:book,pages:{[book]:page}});
const success=body=>Response.json({ok:true,...body});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let n=0;n<8;n++)await tick();}
function memory(initial={}){
 const values=new Map(Object.entries(initial));
 const result={values,getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);}};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:result});return result;
}
let checks=0;
async function check(name,run){
 await activateReadingAccount(null);setWorkspaceAccount(null);
 try{await run();checks++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}
}
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(fs.readFileSync(path.join(__dirname,'../cloud/reading-position-migration.sql'),'utf8'));
 return {sql,prepare(query){return {bindings:[],bind(...bindings){this.bindings=bindings;return this;},async all(){return {results:sql.prepare(query).all(...this.bindings).map(row=>({...row}))};},async run(){return sql.prepare(query).run(...this.bindings);}};},close(){sql.close();}};
}
const get=(account='a')=>new Request('https://study.example/api/reading-positions',{headers:{'X-Reading-Account':account}});
const post=(body,account='a',headers={})=>new Request('https://study.example/api/reading-positions',{method:'POST',headers:{'Content-Type':'application/json','X-Reading-Account':account,...headers},body:typeof body==='string'?body:JSON.stringify(body)});

(async()=>{
 await check('Cloud hydration uses the account namespace and never imports guest reading data',async()=>{
  const storage=memory({[legacy]:JSON.stringify(positions(99))});
  globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/reading-positions');assert.equal(options.headers['X-Reading-Account'],'a');return Response.json(positions(12));};
  await activateReadingAccount('a');
  assert.deepEqual(readReadingPositions(books),positions(12));
  assert.equal(JSON.parse(storage.getItem(legacy)).pages.contract,99);
  assert.equal(JSON.parse(storage.getItem(key('a'))).pages.contract,12);
  assert.equal(getReadingSyncStatus().state,'synced');
 });
 await check('Account switches isolate book pages and logout retains each saved namespace',async()=>{
  const storage=memory();globalThis.fetch=async(url,options)=>Response.json(options.headers['X-Reading-Account']==='a'?positions(15):positions(20,'tort'));
  await activateReadingAccount('a');await activateReadingAccount('b');
  assert.deepEqual(readReadingPositions(books),positions(20,'tort'));
  assert.equal(readReadingPositions(books).pages.contract,undefined);
  await activateReadingAccount(null);
  assert.equal(getReadingSyncStatus().accountId,null);
  assert.notEqual(storage.getItem(key('a')),null);assert.notEqual(storage.getItem(key('b')),null);
  assert.deepEqual(readReadingPositions(books),{lastBookId:null,pages:{}});
 });
 await check('Workspace keys isolate cloud accounts while preserving old guest and Sites keys',()=>{
  assert.equal(workspaceKey(false),'sqe-practice:workspace:v1:account');
  const guest=workspaceKey(true);setWorkspaceAccount('a');const first=workspaceKey(false);
  setWorkspaceAccount('b');assert.notEqual(workspaceKey(false),first);assert.equal(workspaceKey(true),guest);
  setWorkspaceAccount('a:b/中文');assert.match(workspaceKey(false),/a%3Ab%2F/);
  setWorkspaceAccount(null);assert.equal(workspaceKey(false),'sqe-practice:workspace:v1:account');
 });
 await check('Page writes remain synchronous locally and clear the pending marker only after acknowledgement',async()=>{
  const storage=memory(),save=deferred();let captured;
  globalThis.fetch=async(url,options)=>{if(options.method==='POST'){captured=options;return save.promise;}return Response.json(positions());};
  await activateReadingAccount('a');writeReadingPosition('contract',21);
  assert.equal(readReadingPositions(books).pages.contract,21);assert.equal(getReadingSyncStatus().pendingCount,1);
  assert.equal(JSON.parse(storage.getItem(key('a'))).pending.contract.page,21);
  await tick();assert.equal(captured.headers['X-Reading-Account'],'a');assert.deepEqual(JSON.parse(captured.body),{bookId:'contract',page:21});
  save.resolve(success({bookId:'contract',page:21}));await settle();
  assert.equal(getReadingSyncStatus().state,'synced');assert.deepEqual(JSON.parse(storage.getItem(key('a'))).pending,{});
 });
 await check('Network failure survives logout and stale cloud hydration without an automatic overwrite retry',async()=>{
  const storage=memory();let posts=0;
  globalThis.fetch=async(url,options)=>{if(options.method==='POST'){posts++;throw Error('offline');}return Response.json(positions(5));};
  await activateReadingAccount('a');writeReadingPosition('contract',30);await settle();
  assert.equal(getReadingSyncStatus().state,'error');assert.equal(getReadingSyncStatus().pendingCount,1);
  await activateReadingAccount(null);await activateReadingAccount('a');
  assert.equal(readReadingPositions(books).pages.contract,30);assert.equal(getReadingSyncStatus().state,'pending');assert.equal(posts,1);
  assert.equal(JSON.parse(storage.getItem(key('a'))).pending.contract.page,30);
  globalThis.fetch=async(url,options)=>success(JSON.parse(options.body));
  writeReadingPosition('contract',31);await settle();assert.equal(getReadingSyncStatus().state,'synced');
 });
 await check('A failed GET retains only the current accounts local snapshot',async()=>{
  memory({[key('a')]:JSON.stringify({...positions(44),pending:{}}),[key('b')]:JSON.stringify({...positions(77,'tort'),pending:{}}),[legacy]:JSON.stringify(positions(111))});
  globalThis.fetch=async()=>{throw Error('offline');};
  await activateReadingAccount('a');assert.deepEqual(readReadingPositions(books),positions(44));assert.equal(getReadingSyncStatus().state,'error');
 });
 await check('Concurrent login hydrations cannot apply an earlier accounts late response',async()=>{
  memory();const first=deferred();
  globalThis.fetch=async(url,options)=>options.headers['X-Reading-Account']==='a'?first.promise:Response.json(positions(60,'tort'));
  const activationA=activateReadingAccount('a');await activateReadingAccount('b');
  first.resolve(Response.json(positions(111)));await activationA;
  assert.equal(getReadingSyncStatus().accountId,'b');assert.deepEqual(readReadingPositions(books),positions(60,'tort'));
 });
 await check('Rapid page saves are ordered and a stale acknowledgement cannot clear a newer pending page',async()=>{
  memory();const first=deferred(),sent=[];
  globalThis.fetch=async(url,options)=>{
   if(options.method!=='POST')return Response.json(positions());
   const body=JSON.parse(options.body);sent.push(body.page);return sent.length===1?first.promise:success(body);
  };
  await activateReadingAccount('a');writeReadingPosition('contract',40);await tick();writeReadingPosition('contract',41);
  await tick();assert.deepEqual(sent,[40]);assert.equal(getReadingSyncStatus().pendingCount,1);
  first.resolve(success({bookId:'contract',page:40}));await settle();
  assert.deepEqual(sent,[40,41]);assert.equal(readReadingPositions(books).pages.contract,41);assert.equal(getReadingSyncStatus().state,'synced');
 });
 await check('Queued writes from a previous login do not run with the next accounts credentials',async()=>{
  memory();const first=deferred(),sent=[];
  globalThis.fetch=async(url,options)=>{
   if(options.method!=='POST')return Response.json(positions(options.headers['X-Reading-Account']==='a'?8:70));
   sent.push({account:options.headers['X-Reading-Account'],body:JSON.parse(options.body)});return first.promise;
  };
  await activateReadingAccount('a');writeReadingPosition('contract',40);await tick();writeReadingPosition('contract',41);
  await activateReadingAccount('b');first.resolve(success({bookId:'contract',page:40}));await settle();
  assert.equal(sent.length,1);assert.equal(getReadingSyncStatus().accountId,'b');assert.equal(readReadingPositions(books).pages.contract,70);
 });
 await check('Hydration cannot replace a page written and acknowledged while its GET was in flight',async()=>{
  memory();const load=deferred();globalThis.fetch=async(url,options)=>options.method==='POST'?success(JSON.parse(options.body)):load.promise;
  const activating=activateReadingAccount('a');writeReadingPosition('contract',33);await settle();
  load.resolve(Response.json(positions(9)));await activating;
  assert.equal(readReadingPositions(books).pages.contract,33);
 });
 await check('A misleading HTTP 200 without a matching save acknowledgement leaves pending data intact',async()=>{
  memory();globalThis.fetch=async(url,options)=>options.method==='POST'?new Response('<html>fallback</html>'):Response.json(positions());
  await activateReadingAccount('a');writeReadingPosition('contract',32);await settle();
  assert.equal(getReadingSyncStatus().state,'error');assert.equal(getReadingSyncStatus().pendingCount,1);
 });
 await check('Unavailable local storage still allows a cloud save and an honest failure status',async()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});
  globalThis.fetch=async(url,options)=>options.method==='POST'?success(JSON.parse(options.body)):Response.json(positions());
  await activateReadingAccount('a');assert.equal(getReadingSyncStatus().state,'error');
  writeReadingPosition('contract',29);await settle();assert.equal(getReadingSyncStatus().state,'synced');assert.equal(readReadingPositions(books).pages.contract,29);
  globalThis.fetch=async()=>{throw Error('offline');};writeReadingPosition('contract',30);await settle();assert.match(getReadingSyncStatus().message,/未能保存到云端或本机/);
 });
 await check('Status subscriptions immediately report state and unsubscribe cleanly',async()=>{
  memory();globalThis.fetch=async()=>Response.json(positions());const statuses=[];
  const unsubscribe=subscribeReadingSync(status=>statuses.push(status));assert.equal(statuses.length,1);
  await activateReadingAccount('a');assert.deepEqual(statuses.slice(-2).map(status=>status.state),['loading','synced']);
  unsubscribe();const count=statuses.length;await activateReadingAccount(null);assert.equal(statuses.length,count);
 });
 await check('The API stores independent per-user pages and latest-book ordering',async()=>{
  const db=database();
  assert.equal((await handleReadingPositionRequest(post({bookId:'contract',page:12}),db,'a')).status,200);
  await handleReadingPositionRequest(post({bookId:'tort',page:7}),db,'a');
  await handleReadingPositionRequest(post({bookId:'contract',page:99},'b'),db,'b');
  const accountA=await handleReadingPositionRequest(get(),db,'a');assert.equal(accountA.headers.get('cache-control'),'no-store');
  assert.deepEqual(await accountA.json(),{lastBookId:'tort',pages:{tort:7,contract:12}});
  assert.deepEqual(await (await handleReadingPositionRequest(get('b'),db,'b')).json(),positions(99));
  await handleReadingPositionRequest(post({bookId:'contract',page:13}),db,'a');
  assert.deepEqual(await (await handleReadingPositionRequest(get(),db,'a')).json(),{lastBookId:'contract',pages:{contract:13,tort:7}});db.close();
 });
 await check('The API rejects stale-account writes, invalid pages, reserved IDs and account injection',async()=>{
  const db=database();
  assert.equal((await handleReadingPositionRequest(post({bookId:'contract',page:1},'a'),db,'b')).status,409);
  assert.equal((await handleReadingPositionRequest(post({bookId:'contract',page:1}),db,'')).status,401);
  for(const body of [{bookId:'contract',page:0},{bookId:'contract',page:1.5},{bookId:'contract',page:'2'},{bookId:'contract',page:100001},{bookId:'__proto__',page:2},{bookId:'x'.repeat(201),page:2},{bookId:'contract',page:2,userId:'b'}])assert.equal((await handleReadingPositionRequest(post(body),db,'a')).status,400);
  assert.equal(db.sql.prepare('SELECT count(*) AS n FROM reading_positions').get().n,0);db.close();
 });
 await check('The API validates encoding, method, content type and actual request size',async()=>{
  const db=database();
  assert.equal((await handleReadingPositionRequest(post('{broken'),db,'a')).status,400);
  assert.equal((await handleReadingPositionRequest(post({},'a',{'Content-Type':'text/plain'}),db,'a')).status,415);
  assert.equal((await handleReadingPositionRequest(post(' '.repeat(2049)),db,'a')).status,413);
  assert.equal((await handleReadingPositionRequest(post('{}','a',{'Content-Length':'2049'}),db,'a')).status,413);
  assert.equal((await handleReadingPositionRequest(new Request('https://study.example/api/reading-positions',{method:'DELETE'}),db,'a')).status,405);db.close();
 });
 await check('The API accepts safely formatted future book IDs without discarding data',async()=>{
  const db=database();assert.equal((await handleReadingPositionRequest(post({bookId:'future-edition-2030',page:55}),db,'a')).status,200);
  assert.deepEqual(await (await handleReadingPositionRequest(get(),db,'a')).json(),positions(55,'future-edition-2030'));db.close();
 });
 await check('Reading position migration can safely be applied twice',()=>{
  const db=database();db.sql.exec(fs.readFileSync(path.join(__dirname,'../cloud/reading-position-migration.sql'),'utf8'));assert.equal(db.sql.prepare('SELECT count(*) AS n FROM reading_positions').get().n,0);db.close();
 });
 await check('The API reports database failure without returning private diagnostics',async()=>{
  const response=await handleReadingPositionRequest(get(),{prepare(){throw Error('private database details');}},'a');
  assert.equal(response.status,503);assert.equal((await response.text()).includes('private database details'),false);
 });
 process.stdout.write(`Cloud reading positions: ${checks} isolated checks passed.\n`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 await activateReadingAccount(null);setWorkspaceAccount(null);globalThis.fetch=originalFetch;
 if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;
});
