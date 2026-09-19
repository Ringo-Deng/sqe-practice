/* eslint-disable @typescript-eslint/no-require-imports -- Run production React hooks and Worker routing in an isolated harness. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
const resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(request,parent,...args){
 const mapped=request.startsWith('@/')?path.join(root,request.slice(2)):request;
 const candidate=mapped.startsWith('.')?path.resolve(path.dirname(parent.filename),mapped):mapped;
 if(candidate.startsWith(root)&&!path.extname(candidate))for(const extension of ['.ts','.tsx'])if(fs.existsSync(candidate+extension))return resolve.call(this,candidate+extension,parent,...args);
 return resolve.call(this,mapped,parent,...args);
};
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
require.extensions['.css']=()=>{};
Module._load=function(request,...args){return request.endsWith('?url')?'/unused-pdf-worker.js':load.call(this,request,...args);};
const {ExpectedAccountProvider,useExpectedAccount}=require('../lib/expected-account.tsx');
const {expectedAccountHeaders}=require('../lib/expected-account-headers.ts');
const {useVocabulary}=require('../app/vocabulary-panel.tsx');
const {useTextbookAnnotations}=require('../app/use-textbook-annotations.ts');
const {useTextbookBookmarks}=require('../app/use-textbook-bookmarks.ts');
const {useTextbookCatalog}=require('../app/use-textbook-catalog.ts');
const {workspaceKey,setWorkspaceAccount}=require('../lib/study-workspace.ts');
const {activateReadingAccount,writeReadingPosition,readReadingPositions}=require('../lib/textbook-reading-position.ts');

let verifiedUser={id:'account-b',name:'B',username:'b',mustChangePassword:false,role:'user'};
let handlerCalls=0;
const result={cards:[],annotations:[],bookmarks:[],titles:{},subjects:{},imported:[],today:'2026-09-19',timeZone:'Asia/Shanghai'};
const handled=async()=>{handlerCalls++;return Response.json(result);};
const mocked=new Map([
 ['cloud/auth.ts',{getAccountUser:async()=>verifiedUser}],
 ['cloud/account-api.ts',{handleAccountRequest:handled}],
 ['cloud/backup.ts',{handleBackupRequest:handled}],
 ['cloud/reading-position-api.ts',{handleReadingPositionRequest:handled}],
 ['cloud/request-context.ts',{withVerifiedIdentity:(_user,operation)=>operation()}],
 ...['study','vocabulary','textbook-annotations','textbook-bookmarks','textbooks','textbooks/file'].map(route=>[`app/api/${route}/route.ts`,{GET:handled,POST:handled}]),
].map(([file,value])=>[path.join(root,file),value]));
Module._load=function(request,parent,...args){
 const filename=Module._resolveFilename(request,parent);
 return mocked.has(filename)?mocked.get(filename):load.call(this,request,parent,...args);
};
const worker=require('../cloud/worker.ts').default;
Module._load=load;
const origin='https://study.example',env={APP_ORIGIN:origin,ASSETS:{fetch:handled}};
const request=(route,account,method='POST')=>new Request(origin+route,{method,headers:expectedAccountHeaders(account,{Origin:origin,'Content-Type':'application/json'})});
let checks=0;
async function check(name,run){try{await run();checks++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}}
function capture(accountId){
 let value;
 function Capture(){value={accountId:useExpectedAccount(),vocabulary:useVocabulary(),annotations:useTextbookAnnotations(),bookmarks:useTextbookBookmarks(),catalog:useTextbookCatalog()};return null;}
 const component=React.createElement(Capture);
 renderToStaticMarkup(accountId===null?component:React.createElement(ExpectedAccountProvider,{accountId},component));
 return value;
}
const originalFetch=globalThis.fetch,storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');

(async()=>{
 await check('All protected API groups reject a stale account before invoking a data handler',async()=>{
  for(const route of ['/api/study','/api/vocabulary','/api/textbook-annotations','/api/textbook-bookmarks','/api/textbooks','/api/textbooks/file','/api/backup','/api/reading-positions','/api/account/logout','/api/account/change-password','/api/admin/users']){
   for(const method of ['GET','POST'])assert.equal((await worker.fetch(request(route,'account-a',method),env)).status,409,route);
  }
  assert.equal(handlerCalls,0);
 });
 await check('A claimed expected account never authenticates an anonymous visitor',async()=>{
  verifiedUser=null;
  assert.equal((await worker.fetch(request('/api/study','account-a'),env)).status,401);
  assert.equal((await worker.fetch(request('/api/admin/users','account-a'),env)).status,401);
  assert.equal(handlerCalls,0);
  verifiedUser={id:'account-b',name:'B',username:'b',mustChangePassword:false,role:'user'};
 });
 await check('Matching account requests proceed while header-free original clients retain their behavior',async()=>{
  assert.equal((await worker.fetch(request('/api/study','account-b'),env)).status,200);
  assert.equal((await worker.fetch(request('/api/study',null),env)).status,200);
  assert.equal(handlerCalls,2);
 });
 await check('Expected account checks do not bypass the initial-password gate',async()=>{
  verifiedUser={...verifiedUser,mustChangePassword:true};
  assert.equal((await worker.fetch(request('/api/study','account-b'),env)).status,403);
  verifiedUser={...verifiedUser,mustChangePassword:false};
 });
 const oldTab=capture('account-a'),newTab=capture('account-b'),legacy=capture(null);
 const sent=[];
 globalThis.fetch=async(url,options)=>{
  const headers=new Headers(options?.headers);headers.set('Origin',origin);
  sent.push({url,account:headers.get('X-Expected-Account-Id'),method:options?.method??'GET'});
  return worker.fetch(new Request(new URL(url,origin),{...options,headers}),env);
 };
 await check('Old React hook callbacks keep their original account after another provider is rendered',async()=>{
  const before=handlerCalls;
  await oldTab.vocabulary.mutate({action:'delete',id:'old-word'});
  await oldTab.annotations.mutate({action:'delete',id:'old-note'});
  await oldTab.bookmarks.mutate({action:'delete',bookId:'old-book',page:1});
  assert.equal(await oldTab.catalog.updateBook('old-book','Title','my-materials'),false);
  assert.equal(handlerCalls,before);
  assert.deepEqual(sent.slice(-4).map(item=>item.account),Array(4).fill('account-a'));
 });
 await check('Old-tab hydration cannot read the newly signed-in account data',async()=>{
  const before=handlerCalls;
  await oldTab.vocabulary.load();await oldTab.annotations.load();await oldTab.bookmarks.load();await oldTab.catalog.load();
  assert.equal(handlerCalls,before);
  assert.deepEqual(sent.slice(-4).map(item=>item.account),Array(4).fill('account-a'));
 });
 await check('Current hook callbacks and empty legacy context still reach their expected APIs',async()=>{
  await newTab.vocabulary.load();await newTab.annotations.load();await newTab.bookmarks.load();await newTab.catalog.load();
  assert.deepEqual(sent.slice(-4).map(item=>item.account),Array(4).fill('account-b'));
  assert.equal(legacy.accountId,null);await legacy.vocabulary.load();
  assert.equal(sent.at(-1).account,null);
 });
 await check('Building account headers preserves Content-Type and does not mutate callers headers',()=>{
  const initial=new Headers({'Content-Type':'application/pdf','X-Study-Action':'1'}),headers=expectedAccountHeaders('account-a',initial);
  assert.equal(headers.get('Content-Type'),'application/pdf');assert.equal(headers.get('X-Study-Action'),'1');
  assert.equal(initial.has('X-Expected-Account-Id'),false);
 });
 await check('A captured workspace key cannot move to the later globally selected account',()=>{
  setWorkspaceAccount('account-a');const key=workspaceKey(false,'account-a');setWorkspaceAccount('account-b');
  assert.equal(workspaceKey(false,'account-a'),key);assert.notEqual(workspaceKey(false),key);
 });
 await check('A stale reading callback cannot save under the newly active account',async()=>{
  const saved=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}});
  const readingRequests=[];
  globalThis.fetch=async(url,options)=>{
   readingRequests.push({url,headers:options.headers,body:options.body});
   return Response.json(options.method==='POST'?{ok:true,...JSON.parse(options.body)}:{lastBookId:'book',pages:{book:2}});
  };
  await activateReadingAccount('account-b');
  writeReadingPosition('book',99,undefined,'account-a');
  assert.equal(readReadingPositions([{id:'book',pageCount:100}]).pages.book,2);
  writeReadingPosition('book',3,undefined,'account-b');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(readingRequests.length,2);
  assert.equal(readingRequests[0].headers['X-Expected-Account-Id'],'account-b');
  assert.equal(readingRequests[1].headers['X-Expected-Account-Id'],'account-b');
  assert.equal(JSON.parse(readingRequests[1].body).page,3);
 });
 console.log(`Passed ${checks} cloud account isolation checks using production hooks and Worker routing.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 await activateReadingAccount(null);setWorkspaceAccount(null);globalThis.fetch=originalFetch;
 if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else delete globalThis.localStorage;
 Module._resolveFilename=resolve;Module._load=load;
});
