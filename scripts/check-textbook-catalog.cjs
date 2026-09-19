/* eslint-disable @typescript-eslint/no-require-imports -- Isolated loader exercises the production TypeScript modules. */
// Uses in-memory browser stores and SQLite only; never reads or writes live study data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;}
require.extensions['.ts']=(module,file)=>module._compile(transpile(file),file);
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 if(request.startsWith('.')&&parent?.filename){const file=path.resolve(path.dirname(parent.filename),request);if(!path.extname(file)&&fs.existsSync(`${file}.ts`))request=`${file}.ts`;}
 return nativeLoad.call(this,request,parent,isMain);
};
function compile(file,imports){
 const exports={};
 vm.runInThisContext(`(function(require,exports){${transpile(path.join(root,file))}\n})`,{filename:file})(name=>{
  if(Object.hasOwn(imports,name))return imports[name];
  throw new Error(`Unexpected import: ${name}`);
 },exports);
 return exports;
}
const catalog=require('../lib/textbook-catalog.ts');
const {textbooks}=require('../lib/textbooks.ts');
const {subjects}=require('../lib/subjects.ts');
const book=textbooks[0],other=textbooks[1],subject=subjects.find(item=>item.id!==book.subjectId).id;
const imported={id:'guest-pdf',title:'Original upload',shortTitle:'Original upload',subjectId:'my-materials',pageCount:8,url:'blob:unchanged-pdf',sha256:'guest-guest-pdf',version:'本机 PDF',pageUrlTemplate:'',originalName:'original.pdf',sizeBytes:1234,createdAt:1700000000000,imported:true};
let checks=0;
async function check(name,run){try{await run();checks++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}}
function memoryStorage(initial=[]){const values=new Map(initial);return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};}
async function checkData(){
 await check('Legacy title overrides survive merge and subject changes retain the original PDF identity',()=>{
  const legacy={titles:{[book.id]:'My earlier title'},imported:[imported]};
  assert.equal(catalog.mergeTextbookCatalog(legacy).find(item=>item.id===book.id).title,'My earlier title');
  const changed=catalog.updateTextbookCatalog(legacy,book.id,'  Updated   title  ',subject);
  const result=catalog.mergeTextbookCatalog(changed).find(item=>item.id===book.id);
  assert.equal(result.title,'Updated title');assert.equal(result.subjectId,subject);
  for(const key of ['id','url','sha256','pageUrlTemplate','pageCount'])assert.equal(result[key],book[key]);
  assert.equal(legacy.titles[book.id],'My earlier title');
  assert.strictEqual(changed.imported[0],imported);
  const changedImport=catalog.updateTextbookCatalog(changed,imported.id,'Imported notes',subject).imported[0];
  assert.equal(changedImport.title,'Imported notes');assert.equal(changedImport.subjectId,subject);
  for(const key of ['id','url','sha256','pageUrlTemplate','pageCount','originalName','createdAt','sizeBytes'])assert.equal(changedImport[key],imported[key]);
  assert.equal(imported.subjectId,'my-materials');
 });
 await check('All supported subjects and uncategorized are valid; malformed updates are rejected',()=>{
  for(const value of [...subjects.map(item=>item.id),'my-materials'])assert.equal(catalog.validateTextbookMetadata('Title',value).subjectId,value);
  for(const value of ['',null,23,{},'not-a-subject'])assert.throws(()=>catalog.validateTextbookMetadata('Title',value));
  for(const title of ['',null,[],42,'   '])assert.throws(()=>catalog.validateTextbookMetadata(title,subject));
  assert.throws(()=>catalog.updateTextbookCatalog({titles:{},imported:[]},'missing','Title',subject));
  assert.equal(catalog.mergeTextbookCatalog({titles:{},subjects:{[book.id]:'invalid'},imported:[]})[0].subjectId,book.subjectId);
 });
 await check('Guest metadata persists across reads while preserving legacy names and unrelated study storage',()=>{
  const oldTitles=JSON.stringify({[book.id]:'Earlier name',[other.id]:'Other earlier name'});
  const storage=memoryStorage([[catalog.GUEST_TEXTBOOK_TITLES_KEY,oldTitles],['sqe-practice:guest-textbook-bookmarks:v1','preserved bookmarks'],['sqe-practice:guest-textbook-annotations:v1','preserved notes']]);
  catalog.saveGuestTextbookMetadata(storage,book.id,'New name',subject);
  const reread=catalog.readGuestTextbookMetadata(storage);
  assert.equal(reread.titles[book.id],'New name');assert.equal(reread.titles[other.id],'Other earlier name');assert.equal(reread.subjects[book.id],subject);
  assert.equal(storage.getItem(catalog.GUEST_TEXTBOOK_TITLES_KEY),oldTitles);
  assert.equal(storage.getItem('sqe-practice:guest-textbook-bookmarks:v1'),'preserved bookmarks');
  assert.equal(storage.getItem('sqe-practice:guest-textbook-annotations:v1'),'preserved notes');
  catalog.saveGuestTextbookMetadata(storage,other.id,'Other new name','my-materials');
  assert.equal(catalog.readGuestTextbookMetadata(storage).titles[book.id],'New name');
 });
 await check('Invalid or inaccessible guest storage cannot be silently replaced by an edit',()=>{
  for(const raw of ['{','null','[]',JSON.stringify({[book.id]:{title:'Saved',subjectId:'invalid'}})]){
   const storage=memoryStorage([[catalog.GUEST_TEXTBOOK_METADATA_KEY,raw]]);
   assert.throws(()=>catalog.saveGuestTextbookMetadata(storage,book.id,'Replacement',subject));
   assert.equal(storage.getItem(catalog.GUEST_TEXTBOOK_METADATA_KEY),raw);
  }
  const storage=memoryStorage();storage.getItem=()=>{throw Error('Denied');};let writes=0;storage.setItem=()=>{writes++;};
  assert.throws(()=>catalog.saveGuestTextbookMetadata(storage,book.id,'Replacement',subject));assert.equal(writes,0);
  const full=memoryStorage();full.setItem=()=>{throw Error('Quota exceeded');};
  assert.throws(()=>catalog.saveGuestTextbookMetadata(full,book.id,'Replacement',subject));
 });
}

async function checkApi(){
 const db=new DatabaseSync(':memory:'),now=1700000000000;
 const migrations=fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort();
 try{
  for(const file of migrations.filter(file=>!file.startsWith('0005_')))db.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
  db.prepare('INSERT INTO textbook_titles (user_id,book_id,title,updated_at) VALUES (?,?,?,?)').run('user-a',book.id,'Old personalized title',now);
  db.prepare('INSERT INTO user_textbooks (id,user_id,title,original_name,page_count,storage_key,size_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run('user-import','user-a','Old import','old.pdf',8,'private/old.pdf',1234,now,now);
  db.prepare('INSERT INTO textbook_annotations (id,user_id,book_id,page,quote,note,rects,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run('annotation','user-a',book.id,2,'quote','handwritten note','[]',now,now);
  db.prepare('INSERT INTO textbook_bookmarks (user_id,book_id,page,note,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('user-a','user-import',4,'bookmark note',now,now);
  const annotations=db.prepare('SELECT * FROM textbook_annotations').all(),bookmarks=db.prepare('SELECT * FROM textbook_bookmarks').all();
  const previousImport=db.prepare('SELECT * FROM user_textbooks').get();
  db.exec(fs.readFileSync(path.join(root,'drizzle/0005_textbook_subjects.sql'),'utf8'));
  let user={userId:'user-a'};
  const binding={prepare(sql){const statement=db.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async all(){return {results:statement.all(...args)};},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};}};}};
  const route=compile('app/api/textbooks/route.ts',{'cloudflare:workers':{env:{}},'../../chatgpt-auth':{getChatGPTUser:async()=>user},'@/db/store':{database:()=>binding},'@/lib/textbooks':require('../lib/textbooks.ts'),'@/lib/textbook-catalog':catalog});
  async function get(){const response=await route.GET();return {status:response.status,value:await response.json()};}
  async function post(body,headers={}){const response=await route.POST(new Request('https://study.test/api/textbooks',{method:'POST',headers:{'Content-Type':'application/json','X-Study-Action':'1',...headers},body:JSON.stringify(body)}));return {status:response.status,value:await response.json()};}
  await check('Subject migration preserves existing titles, imported PDF records and study records',async()=>{
   const result=await get();assert.equal(result.status,200);assert.equal(result.value.titles[book.id],'Old personalized title');assert.deepEqual(result.value.subjects,{});
   assert.equal(result.value.imported[0].subjectId,'my-materials');
   const current=db.prepare('SELECT * FROM user_textbooks').get();for(const key of Object.keys(previousImport))assert.equal(current[key],previousImport[key]);
  });
  await check('Authenticated built-in subject edits persist and legacy rename preserves their subject',async()=>{
   const result=await post({action:'update',id:book.id,title:'Personal book',subjectId:subject});assert.equal(result.status,200);
   assert.equal(result.value.titles[book.id],'Personal book');assert.equal(result.value.subjects[book.id],subject);
   assert.equal((await get()).value.subjects[book.id],subject);
   assert.equal((await post({action:'rename',id:book.id,title:'Renamed again'})).status,200);
   const current=await get();assert.equal(current.value.titles[book.id],'Renamed again');assert.equal(current.value.subjects[book.id],subject);
   assert.equal((await post({action:'update',id:book.id,title:'Uncategorized',subjectId:'my-materials'})).value.subjects[book.id],'my-materials');
  });
  await check('Authenticated imported subject edits retain PDF URLs, storage keys and names',async()=>{
   const previous=(await get()).value.imported[0];
   const result=await post({action:'update',id:'user-import',title:'My import',subjectId:subject});assert.equal(result.status,200);
   const updated=result.value.imported[0];assert.equal(updated.title,'My import');assert.equal(updated.subjectId,subject);
   for(const key of ['id','url','sha256','pageUrlTemplate','originalName','pageCount','sizeBytes','createdAt'])assert.equal(updated[key],previous[key]);
   assert.equal(db.prepare('SELECT storage_key FROM user_textbooks WHERE id=?').get('user-import').storage_key,'private/old.pdf');
   assert.equal((await post({action:'rename',id:'user-import',title:'Rename import'})).value.imported[0].subjectId,subject);
  });
  await check('Invalid subjects, missing books and cross-site requests cannot change metadata',async()=>{
   const before=await get();
   for(const subjectId of [null,'unknown',{},42])assert.equal((await post({action:'update',id:book.id,title:'Invalid',subjectId})).status,400);
   assert.equal((await post({action:'update',id:book.id,title:'',subjectId:subject})).status,400);
   assert.equal((await post({action:'update',id:'missing',title:'Missing',subjectId:subject})).status,404);
   assert.equal((await post({action:'update',id:book.id,title:'Cross site',subjectId:subject},{'Sec-Fetch-Site':'cross-site'})).status,403);
   assert.deepEqual(await get(),before);
  });
  await check('Users cannot read or edit another users imported books or override their built-in subjects',async()=>{
   const owner=await get();user={userId:'user-b'};
   assert.deepEqual((await get()).value,{titles:{},subjects:{},imported:[]});
   assert.equal((await post({action:'update',id:'user-import',title:'Other user',subjectId:subject})).status,404);
   assert.equal((await post({action:'update',id:book.id,title:'B personal title',subjectId:subject})).status,200);
   user={userId:'user-a'};assert.deepEqual(await get(),owner);
   user=null;assert.equal((await get()).status,401);assert.equal((await post({action:'update',id:book.id,title:'Anonymous',subjectId:subject})).status,401);
  });
  await check('Metadata API edits preserve all annotations and bookmarks',()=>{
   assert.deepEqual(db.prepare('SELECT * FROM textbook_annotations').all(),annotations);assert.deepEqual(db.prepare('SELECT * FROM textbook_bookmarks').all(),bookmarks);
  });
 }finally{db.close();}
}

async function checkGuestHook(){
 const savedGlobals={localStorage:global.localStorage,indexedDB:global.indexedDB,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 const stored={...imported,blob:new Blob(['%PDF-test']),updatedAt:imported.createdAt,revision:0};delete stored.subjectId;
 const rows=new Map([[stored.id,stored]]),state=[];let cursor=0,created=0,revoked=0;
 const react={
  useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},
  useRef(initial){const index=cursor++;if(!(index in state))state[index]={current:initial};return state[index];},
  useCallback:fn=>fn,useMemo:fn=>fn(),useEffect:()=>{}
 };
 function requestFor(value){const request={};queueMicrotask(()=>{request.result=value;request.onsuccess?.();});return request;}
 global.localStorage=memoryStorage([[catalog.GUEST_TEXTBOOK_TITLES_KEY,JSON.stringify({[book.id]:'Earlier guest title'})]]);
 global.indexedDB={open(){return requestFor({close(){},transaction(){const tx={};tx.objectStore=()=>({getAll:()=>requestFor([...rows.values()]),get:id=>requestFor(rows.get(id)),put(value){rows.set(value.id,value);queueMicrotask(()=>tx.oncomplete?.());}});return tx;}});}};
 URL.createObjectURL=()=>`blob:fixture-${++created}`;URL.revokeObjectURL=()=>{revoked++;};
 const toast={success(){},error(){},loading(){}};
 const {useTextbookCatalog}=compile('app/use-textbook-catalog.ts',{'react':react,'sonner':{toast},'@/lib/textbook-pdf':{loadPdfEngine:async()=>{throw Error('Metadata edits must not load PDF engine');}},'@/lib/textbook-catalog':catalog,'@/lib/textbooks':require('../lib/textbooks.ts')});
 function render(){cursor=0;return useTextbookCatalog(true);}
 try{
  let controller=render();await controller.load();controller=render();
  const before=controller.books.find(item=>item.id===stored.id);
  await check('Guest hook edits built-in and imported metadata without recreating or revoking PDF URLs',async()=>{
   assert.equal(before.subjectId,'my-materials');assert.equal(created,1);assert.equal(revoked,0);
   assert.equal(await controller.updateBook(book.id,'Guest built-in',subject),true);controller=render();
   assert.equal(controller.books.find(item=>item.id===book.id).subjectId,subject);
   assert.equal(await controller.updateBook(stored.id,'Guest imported',subject),true);controller=render();
   const updated=controller.books.find(item=>item.id===stored.id);
   assert.equal(updated.title,'Guest imported');assert.equal(updated.subjectId,subject);assert.equal(updated.url,before.url);assert.equal(updated.sha256,before.sha256);
   assert.equal(created,1);assert.equal(revoked,0);assert.strictEqual(rows.get(stored.id).blob,stored.blob);
   assert.equal(rows.get(stored.id).revision,1);assert.equal(rows.get(stored.id).createdAt,stored.createdAt);
  });
  await check('Guest hook subject edits and legacy rename survive a fresh catalog load',async()=>{
   assert.equal(await controller.rename(stored.id,'Guest renamed'),true);controller=render();
   assert.equal(controller.books.find(item=>item.id===stored.id).subjectId,subject);
   await controller.load();controller=render();
   assert.equal(controller.books.find(item=>item.id===book.id).title,'Guest built-in');assert.equal(controller.books.find(item=>item.id===book.id).subjectId,subject);
   assert.equal(controller.books.find(item=>item.id===stored.id).title,'Guest renamed');assert.equal(controller.books.find(item=>item.id===stored.id).subjectId,subject);
  });
 }finally{global.localStorage=savedGlobals.localStorage;global.indexedDB=savedGlobals.indexedDB;URL.createObjectURL=savedGlobals.create;URL.revokeObjectURL=savedGlobals.revoke;}
}
(async()=>{await checkData();await checkApi();await checkGuestHook();console.log(`Textbook catalog checks passed: ${checks} metadata, guest persistence, migration, API ownership and PDF URL stability scenarios.`);})().catch(error=>{console.error(error);process.exitCode=1;});
