const POSITION_KEY='sqe-practice:textbook-position:v2';
const LEGACY_POSITION_KEY='sqe-practice:textbook-position:v1';
const RESERVED_IDS=new Set(['__proto__','constructor','prototype']);

type ReadStorage=Pick<Storage,'getItem'>;
type WriteStorage=Pick<Storage,'getItem'|'setItem'>;
export type ReadingPositions={lastBookId:string|null;pages:Record<string,number>};
type PendingPosition={page:number;token:string};
type AccountPositions=ReadingPositions&{pending:Record<string,PendingPosition>};
export type ReadingSyncStatus={accountId:string|null;state:'idle'|'loading'|'synced'|'pending'|'error';pendingCount:number;message:string|null};
let activeAccount:string|null=null,activePositions:AccountPositions|null=null,activation=0;
let accountAbort:AbortController|null=null,saveSequence:Promise<void>=Promise.resolve();
let hydrationBooks:Set<string>|null=null;
let syncStatus:ReadingSyncStatus={accountId:null,state:'idle',pendingCount:0,message:null};
const syncListeners=new Set<(status:ReadingSyncStatus)=>void>();

export function getReadingSyncStatus():ReadingSyncStatus{return {...syncStatus};}
export function subscribeReadingSync(listener:(status:ReadingSyncStatus)=>void){
 syncListeners.add(listener);listener(getReadingSyncStatus());
 return ()=>{syncListeners.delete(listener);};
}
function reportSync(state:ReadingSyncStatus['state'],message:string|null=null){
 syncStatus={accountId:activeAccount,state,pendingCount:Object.keys(activePositions?.pending??{}).length,message};
 for(const listener of syncListeners){try{listener(getReadingSyncStatus());}catch{/* A UI callback must not interrupt saving. */}}
}
const accountKey=(userId:string)=>`${POSITION_KEY}:account:${encodeURIComponent(userId)}`;

function browserStorage():Storage|undefined{
 try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}
}
function isRecord(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function safeId(value:unknown):value is string{
 return typeof value==='string'&&value.trim().length>0&&!RESERVED_IDS.has(value);
}
function validPage(value:unknown):value is number{
 return typeof value==='number'&&Number.isSafeInteger(value);
}
function readJson(storage:ReadStorage|undefined,key:string):unknown{
 try{return JSON.parse(storage?.getItem(key)??'null');}catch{return null;}
}
function emptyAccountPositions():AccountPositions{return {lastBookId:null,pages:{},pending:{}};}
function readAccountPositions(storage:ReadStorage|undefined,userId:string):AccountPositions{
 const raw=readJson(storage,accountKey(userId)),result=emptyAccountPositions();
 if(!isRecord(raw))return result;
 if(isRecord(raw.pages))for(const [bookId,page] of Object.entries(raw.pages))if(safeId(bookId)&&validPage(page)&&page>=1)result.pages[bookId]=page;
 if(isRecord(raw.pending))for(const [bookId,value] of Object.entries(raw.pending)){
  if(safeId(bookId)&&isRecord(value)&&validPage(value.page)&&value.page>=1&&typeof value.token==='string'&&value.token.length<=200){
   result.pending[bookId]={page:value.page,token:value.token};result.pages[bookId]=value.page;
  }
 }
 if(safeId(raw.lastBookId)&&result.pages[raw.lastBookId]!==undefined)result.lastBookId=raw.lastBookId;
 return result;
}
function saveAccountPositions(storage:WriteStorage|undefined,userId:string,positions:AccountPositions){
 try{if(!storage)return false;storage.setItem(accountKey(userId),JSON.stringify(positions));return true;}catch{return false;}
}
function cloudPositions(value:unknown):ReadingPositions{
 if(!isRecord(value)||!isRecord(value.pages)||(value.lastBookId!==null&&!safeId(value.lastBookId)))throw Error('云端阅读位置格式无效。');
 const pages:Record<string,number>={};
 for(const [bookId,page] of Object.entries(value.pages)){
  if(!safeId(bookId)||!validPage(page)||page<1)throw Error('云端阅读位置格式无效。');
  pages[bookId]=page;
 }
 return {lastBookId:typeof value.lastBookId==='string'&&pages[value.lastBookId]!==undefined?value.lastBookId:null,pages};
}

/** Call before mounting the account workspace. Legacy/guest keys are untouched. */
export async function activateReadingAccount(userId:string|null):Promise<void>{
 const nextAccount=typeof userId==='string'&&userId.trim()?userId:null;
 const previous=nextAccount!==null&&nextAccount===activeAccount?activePositions:null;
 const run=++activation;accountAbort?.abort();accountAbort=null;saveSequence=Promise.resolve();hydrationBooks=null;
 activeAccount=nextAccount;activePositions=null;
 if(nextAccount===null){reportSync('idle');return;}
 const storage=browserStorage();
 activePositions=previous??readAccountPositions(storage,nextAccount);
 const controller=new AbortController(),touched=new Set<string>();accountAbort=controller;hydrationBooks=touched;
 reportSync('loading');
 try{
  const response=await fetch('/api/reading-positions',{credentials:'same-origin',cache:'no-store',headers:{'X-Reading-Account':nextAccount,'X-Expected-Account-Id':nextAccount},signal:controller.signal});
  if(!response.ok)throw Error('暂时无法读取云端阅读位置，已保留此账号的本机位置。');
  const remote=cloudPositions(await response.json());
  if(run!==activation||activeAccount!==nextAccount)return;
  const local=activePositions??emptyAccountPositions(),pages={...remote.pages};
  // Failed writes remain local across reload/login. Do not replace them with an
  // older cloud snapshot, and do not silently push them over another device.
  for(const [bookId,pending] of Object.entries(local.pending))pages[bookId]=pending.page;
  for(const bookId of touched)if(local.pages[bookId]!==undefined)pages[bookId]=local.pages[bookId];
  const keepLast=!!local.lastBookId&&(!!local.pending[local.lastBookId]||touched.has(local.lastBookId));
  activePositions={pages,lastBookId:keepLast?local.lastBookId:remote.lastBookId,pending:local.pending};
  const saved=saveAccountPositions(storage,nextAccount,activePositions);
  if(!saved)reportSync('error','云端位置已读取，但浏览器无法保存本机副本。');
  else if(Object.keys(activePositions.pending).length)reportSync('pending','部分阅读位置尚未同步，已保留在本机。联网后重新翻页可再次保存。');
  else reportSync('synced');
 }catch{
  if(run===activation&&activeAccount===nextAccount)reportSync('error','暂时无法读取云端阅读位置，已保留此账号的本机位置。');
 }finally{if(run===activation)hydrationBooks=null;}
}

function queueCloudPosition(userId:string,bookId:string,pending:PendingPosition,storage:WriteStorage|undefined,localSaved:boolean){
 const run=activation,signal=accountAbort?.signal;
 saveSequence=saveSequence.then(async()=>{
  if(run!==activation||activeAccount!==userId||activePositions?.pending[bookId]?.token!==pending.token)return;
  try{
   const response=await fetch('/api/reading-positions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Study-Action':'1','X-Reading-Account':userId,'X-Expected-Account-Id':userId},body:JSON.stringify({bookId,page:pending.page}),signal});
   if(!response.ok)throw Error('Save failed');
   const confirmation:unknown=await response.json();
   if(!isRecord(confirmation)||confirmation.ok!==true||confirmation.bookId!==bookId||confirmation.page!==pending.page)throw Error('Save was not confirmed');
   if(run!==activation||activeAccount!==userId)return;
   if(activePositions?.pending[bookId]?.token===pending.token){
    const nextPending={...activePositions.pending};delete nextPending[bookId];
    activePositions={...activePositions,pending:nextPending};
    saveAccountPositions(storage,userId,activePositions);
   }
   reportSync(Object.keys(activePositions?.pending??{}).length?'pending':'synced');
  }catch{
   if(run===activation&&activeAccount===userId)reportSync('error',localSaved?'阅读位置尚未同步，已保留在本机。联网后重新翻页可再次保存。':'阅读位置未能保存到云端或本机，请保持当前页面并重试。');
  }
 });
}
function readStoredPositions(storage:ReadStorage|undefined){
 const current=readJson(storage,POSITION_KEY),legacy=readJson(storage,LEGACY_POSITION_KEY);
 const pages:Record<string,number>={};
 const legacyBookId=isRecord(legacy)&&safeId(legacy.bookId)?legacy.bookId:null;
 // The first v2 write also preserves a reading position left by the old reader.
 if(legacyBookId&&isRecord(legacy))pages[legacyBookId]=validPage(legacy.page)?Math.max(1,legacy.page):1;
 if(isRecord(current)&&isRecord(current.pages)){
  for(const [id,page] of Object.entries(current.pages)){
   if(safeId(id)&&validPage(page))pages[id]=Math.max(1,page);
  }
 }
 const lastBookId=isRecord(current)&&safeId(current.lastBookId)?current.lastBookId:legacyBookId;
 return {lastBookId,legacyBookId,pages};
}

export function readReadingPositions(books:readonly {id:string;pageCount:number}[],storage?:ReadStorage):ReadingPositions{
 const stored=activeAccount?{...(storage?readAccountPositions(storage,activeAccount):activePositions??readAccountPositions(browserStorage(),activeAccount)),legacyBookId:null}:readStoredPositions(storage??browserStorage());
 const catalog=new Map(books.filter(book=>safeId(book.id)&&validPage(book.pageCount)&&book.pageCount>0).map(book=>[book.id,book.pageCount]));
 const pages:Record<string,number>={};
 for(const [id,page] of Object.entries(stored.pages)){
  const pageCount=catalog.get(id);
  if(pageCount!==undefined)pages[id]=Math.min(pageCount,page);
 }
 const lastBookId=stored.lastBookId&&catalog.has(stored.lastBookId)?stored.lastBookId:stored.legacyBookId&&catalog.has(stored.legacyBookId)?stored.legacyBookId:null;
 return {lastBookId,pages};
}

export function writeReadingPosition(bookId:string,page:number,storage?:WriteStorage,expectedAccountId?:string|null):void{
 if(expectedAccountId!==undefined&&expectedAccountId!==activeAccount)return;
 if(!safeId(bookId)||!validPage(page))return;
 const target=storage??browserStorage();
 if(activeAccount){
  const userId=activeAccount,position=Math.max(1,page),current=activePositions??readAccountPositions(target,userId);
  const pending={page:position,token:crypto.randomUUID()};
  activePositions={lastBookId:bookId,pages:{...current.pages,[bookId]:position},pending:{...current.pending,[bookId]:pending}};
  hydrationBooks?.add(bookId);
  const saved=saveAccountPositions(target,userId,activePositions);
  reportSync(saved?'pending':'error',saved?null:'浏览器无法保存本机阅读位置，正在尝试同步到云端。');
  queueCloudPosition(userId,bookId,pending,target,saved);return;
 }
 if(!target)return;
 const {pages}=readStoredPositions(target);
 const position=Math.max(1,page);
 pages[bookId]=position;
 try{target.setItem(POSITION_KEY,JSON.stringify({lastBookId:bookId,pages}));}catch{/* Reading remains available when browser storage is full or denied. */}
 // Keep the previous reader usable if the application is rolled back.
 try{target.setItem(LEGACY_POSITION_KEY,JSON.stringify({bookId,page:position}));}catch{/* The v2 save may still have succeeded. */}
}
