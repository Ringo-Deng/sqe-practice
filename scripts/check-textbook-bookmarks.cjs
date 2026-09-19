/* eslint-disable @typescript-eslint/no-require-imports -- CJS test loader transpiles the production TypeScript modules. */
// Exercise bookmark mutations using isolated Storage and SQLite, never live study data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const vm=require('node:vm');
const {DatabaseSync}=require('node:sqlite');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 return nativeLoad.call(this,request,parent,isMain);
};
const {GUEST_TEXTBOOK_BOOKMARKS_KEY,TextbookBookmarkError,parseBookmarkMutation,readGuestTextbookBookmarks,applyBookmarkMutation,mutateGuestTextbookBookmarks}=require('../lib/textbook-bookmarks.ts');
const bookA={id:'test-contract',pageCount:12},bookB={id:'test-tort',pageCount:20};
const annotationsKey='sqe-practice:guest-textbook-annotations:v1';
const annotationsRaw=JSON.stringify([{id:'existing-highlight',bookId:bookA.id,page:3,note:'Preserve this handwritten note'}]);
const firstTime=1700000000000;
let checks=0;
function check(name,run){try{run();checks++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}}
function clone(value){return JSON.parse(JSON.stringify(value));}
function freezeData(data){for(const item of data.bookmarks)Object.freeze(item);Object.freeze(data.bookmarks);return Object.freeze(data);}
function find(data,book,page){return data.bookmarks.find(item=>item.bookId===book.id&&item.page===page);}
function save(book,page,note='',revision){return {action:'save',bookId:book.id,page,note,...(revision===undefined?{}:{revision})};}
function remove(book,page,revision){return {action:'delete',bookId:book.id,page,revision};}
function expectStatus(run,status){assert.throws(run,error=>error instanceof TextbookBookmarkError&&[].concat(status).includes(error.status));}
function memoryStorage(raw){
 const values=new Map([[annotationsKey,annotationsRaw]]);
 if(raw!==undefined)values.set(GUEST_TEXTBOOK_BOOKMARKS_KEY,raw);
 const calls=[];
 return {values,calls,getItem(key){calls.push(['get',key]);return values.get(key)??null;},setItem(key,value){calls.push(['set',key]);values.set(key,String(value));}};
}
const initial=freezeData({bookmarks:[]});
const added=applyBookmarkMutation(initial,save(bookA,3,'Revisit consideration'),bookA,firstTime);
check('Add a page bookmark without changing the original data',()=>{
 assert.deepEqual(initial,{bookmarks:[]});
 assert.equal(added.bookmarks.length,1);
 assert.equal(find(added,bookA,3).note,'Revisit consideration');
 assert.equal(find(added,bookA,3).revision,0);
 assert.equal(find(added,bookA,3).createdAt,firstTime);
 assert.equal(find(added,bookA,3).updatedAt,firstTime);
});
freezeData(added);
check('A duplicate add cannot overwrite an existing note',()=>{
 expectStatus(()=>applyBookmarkMutation(added,save(bookA,3,'Accidental replacement'),bookA,firstTime+1),409);
 assert.equal(find(added,bookA,3).note,'Revisit consideration');
 assert.equal(find(added,bookA,3).revision,0);
});
const edited=applyBookmarkMutation(added,save(bookA,3,'Checked against chapter 4',0),bookA,firstTime+1000);
check('Editing a note advances its revision and preserves its creation time',()=>{
 assert.equal(edited.bookmarks.length,1);
 const item=find(edited,bookA,3);
 assert.equal(item.note,'Checked against chapter 4');
 assert.equal(item.revision,1);
 assert.equal(item.createdAt,firstTime);
 assert.equal(item.updatedAt,firstTime+1000);
 assert.equal(find(added,bookA,3).note,'Revisit consideration');
});
freezeData(edited);
check('Stale save and delete operations leave the current revision intact',()=>{
 const snapshot=clone(edited);
 expectStatus(()=>applyBookmarkMutation(edited,save(bookA,3,'Stale edit',0),bookA,firstTime+2000),409);
 expectStatus(()=>applyBookmarkMutation(edited,remove(bookA,3,0),bookA,firstTime+2000),409);
 assert.deepEqual(edited,snapshot);
});
check('Revisions must match as integers, not coerced values',()=>{
 expectStatus(()=>applyBookmarkMutation(edited,save(bookA,3,'Missing revision'),bookA),409);
 expectStatus(()=>applyBookmarkMutation(edited,remove(bookA,3,undefined),bookA),400);
 for(const revision of [null,'1',1.5,-1,NaN,Number.MAX_SAFE_INTEGER+1]){
  expectStatus(()=>applyBookmarkMutation(edited,save(bookA,3,'Invalid revision',revision),bookA),400);
  expectStatus(()=>applyBookmarkMutation(edited,remove(bookA,3,revision),bookA),400);
 }
});
const withOtherBook=applyBookmarkMutation(edited,save(bookB,3,'Tort note'),bookB,firstTime+2000);
const withOtherPage=applyBookmarkMutation(withOtherBook,save(bookA,4),bookA,firstTime+3000);
freezeData(withOtherPage);
check('The same page in another book and another page in the same book remain separate',()=>{
 assert.equal(withOtherPage.bookmarks.length,3);
 assert.equal(find(withOtherPage,bookB,3).note,'Tort note');
 assert.equal(find(withOtherPage,bookA,3).note,'Checked against chapter 4');
 assert.equal(find(withOtherPage,bookA,4).note,'');
 assert.equal(find(withOtherPage,bookB,3).revision,0);
});
const deleted=applyBookmarkMutation(withOtherPage,remove(bookA,3,1),bookA,firstTime+4000);
check('Deleting a matching revision affects only that book and page',()=>{
 assert.equal(deleted.bookmarks.length,2);
 assert.equal(find(deleted,bookA,3),undefined);
 assert.deepEqual(find(deleted,bookA,4),find(withOtherPage,bookA,4));
 assert.deepEqual(find(deleted,bookB,3),find(withOtherPage,bookB,3));
 assert.equal(withOtherPage.bookmarks.length,3);
});
check('An edit from a stale tab cannot recreate a deleted bookmark',()=>{
 expectStatus(()=>applyBookmarkMutation(deleted,save(bookA,3,'Resurrect stale note',1),bookA),404);
 expectStatus(()=>applyBookmarkMutation(deleted,remove(bookA,3,1),bookA),404);
 assert.equal(find(deleted,bookA,3),undefined);
});
check('Unknown or mismatched books and out-of-range pages are rejected',()=>{
 const snapshot=clone(withOtherPage);
 expectStatus(()=>applyBookmarkMutation(withOtherPage,save(bookA,1),undefined),400);
 expectStatus(()=>applyBookmarkMutation(withOtherPage,save(bookA,1),bookB),400);
 for(const page of [0,-1,13,1.5,'3',null,NaN,Infinity]){
  expectStatus(()=>applyBookmarkMutation(withOtherPage,save(bookA,page),bookA),400);
  expectStatus(()=>applyBookmarkMutation(withOtherPage,remove(bookA,page,1),bookA),400);
 }
 assert.deepEqual(withOtherPage,snapshot);
});
check('Both the first and last pages are valid bookmark locations',()=>{
 let data=applyBookmarkMutation(initial,save(bookA,1),bookA,firstTime);
 data=applyBookmarkMutation(data,save(bookA,bookA.pageCount),bookA,firstTime+1);
 assert.equal(data.bookmarks.length,2);
});
check('Unknown actions and non-string notes cannot silently alter bookmarks',()=>{
 expectStatus(()=>applyBookmarkMutation(added,{...save(bookA,3),action:'unknown'},bookA),400);
 for(const note of [null,42,{},[]])expectStatus(()=>applyBookmarkMutation(initial,save(bookA,1,note),bookA),400);
});
check('The note limit accepts 10,000 characters and rejects larger drafts',()=>{
 assert.equal(parseBookmarkMutation(save(bookA,1,'a'.repeat(10000))).note.length,10000);
 expectStatus(()=>applyBookmarkMutation(initial,save(bookA,1,'a'.repeat(10001)),bookA),400);
 assert.equal(parseBookmarkMutation(save(bookA,1,'  First line\nSecond line  ')).note,'First line\nSecond line');
});
check('Empty guest storage reads as an empty bookmark collection',()=>{
 const storage=memoryStorage();
 assert.deepEqual(readGuestTextbookBookmarks(storage),{bookmarks:[]});
 assert.equal(storage.calls.filter(([operation])=>operation==='set').length,0);
});
check('Guest save stores an array and survives a fresh read',()=>{
 const storage=memoryStorage();
 const result=mutateGuestTextbookBookmarks(storage,save(bookA,3,'Saved locally'),bookA,firstTime);
 const raw=storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY);
 assert.ok(Array.isArray(JSON.parse(raw)));
 assert.deepEqual(readGuestTextbookBookmarks(storage),result);
 assert.equal(storage.values.get(annotationsKey),annotationsRaw);
 assert.equal(storage.values.size,2);
 assert.ok(storage.calls.every(([,key])=>key===GUEST_TEXTBOOK_BOOKMARKS_KEY));
});
check('Guest edit and delete persist without changing the caller previous state',()=>{
 const storage=memoryStorage(JSON.stringify(withOtherPage.bookmarks));
 const previous=freezeData(readGuestTextbookBookmarks(storage));
 const snapshot=clone(previous);
 const result=mutateGuestTextbookBookmarks(storage,save(bookA,3,'Saved edit',1),bookA,firstTime+5000);
 assert.equal(find(result,bookA,3).revision,2);
 assert.deepEqual(previous,snapshot);
 assert.deepEqual(readGuestTextbookBookmarks(storage),result);
 const afterDelete=mutateGuestTextbookBookmarks(storage,remove(bookA,3,2),bookA,firstTime+6000);
 assert.equal(find(afterDelete,bookA,3),undefined);
 assert.deepEqual(readGuestTextbookBookmarks(storage),afterDelete);
 assert.equal(storage.values.get(annotationsKey),annotationsRaw);
});
check('A guest mutation reads current storage before checking revisions',()=>{
 const storage=memoryStorage(JSON.stringify(added.bookmarks));
 const stale=freezeData(readGuestTextbookBookmarks(storage));
 const latest=mutateGuestTextbookBookmarks(storage,save(bookA,3,'Saved in another tab',0),bookA,firstTime+7000);
 const raw=storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),writes=storage.calls.filter(([operation])=>operation==='set').length;
 expectStatus(()=>mutateGuestTextbookBookmarks(storage,save(bookA,3,'Overwrite from stale tab',find(stale,bookA,3).revision),bookA),409);
 expectStatus(()=>mutateGuestTextbookBookmarks(storage,remove(bookA,3,find(stale,bookA,3).revision),bookA),409);
 assert.equal(storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),raw);
 assert.equal(storage.calls.filter(([operation])=>operation==='set').length,writes);
 assert.deepEqual(readGuestTextbookBookmarks(storage),latest);
});
check('A duplicate guest add fails without writing over stored notes',()=>{
 const storage=memoryStorage(JSON.stringify(added.bookmarks)),raw=storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY);
 expectStatus(()=>mutateGuestTextbookBookmarks(storage,save(bookA,3,'Duplicate'),bookA),409);
 assert.equal(storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),raw);
 assert.equal(storage.calls.filter(([operation])=>operation==='set').length,0);
});
check('A failed storage read aborts the mutation before any write',()=>{
 const storage=memoryStorage(JSON.stringify(added.bookmarks)),raw=storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY);
 storage.getItem=()=>{throw new Error('Storage access denied');};
 expectStatus(()=>readGuestTextbookBookmarks(storage),503);
 expectStatus(()=>mutateGuestTextbookBookmarks(storage,save(bookA,4,'Must not replace old data'),bookA),503);
 assert.equal(storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),raw);
 assert.equal(storage.calls.filter(([operation])=>operation==='set').length,0);
});
check('A failed storage write throws and preserves the caller state and stored data',()=>{
 const storage=memoryStorage(JSON.stringify(added.bookmarks));
 const previous=freezeData(readGuestTextbookBookmarks(storage)),snapshot=clone(previous),raw=storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY);
 storage.setItem=()=>{throw new Error('Storage quota exceeded');};
 let current=previous;
 expectStatus(()=>{current=mutateGuestTextbookBookmarks(storage,save(bookA,3,'Unsaved edit',0),bookA,firstTime+8000);},503);
 assert.strictEqual(current,previous);
 assert.deepEqual(current,snapshot);
 assert.equal(storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),raw);
 assert.equal(storage.values.get(annotationsKey),annotationsRaw);
});
check('Invalid guest mutations do not call storage.setItem',()=>{
 const storage=memoryStorage(JSON.stringify(added.bookmarks)),raw=storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY);
 expectStatus(()=>mutateGuestTextbookBookmarks(storage,save(bookA,13),bookA),400);
 assert.equal(storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),raw);
 assert.equal(storage.calls.filter(([operation])=>operation==='set').length,0);
});
check('Malformed stored data cannot be read as empty or overwritten by a later save',()=>{
 const existing=find(added,bookA,3);
 const corruptRows=[null,{}, {...existing,bookId:''},{...existing,page:0},{...existing,revision:'0'},{...existing,note:null},{...existing,note:'a'.repeat(10001)},{...existing,createdAt:-1},{...existing,updatedAt:firstTime-1}];
 const malformed=['{','null','42','{}',...corruptRows.map(item=>JSON.stringify([existing,item])),JSON.stringify([existing,existing])];
 for(const raw of malformed){
  const storage=memoryStorage(raw);
  expectStatus(()=>readGuestTextbookBookmarks(storage),503);
  expectStatus(()=>mutateGuestTextbookBookmarks(storage,save(bookA,4,'Do not replace corrupted data'),bookA),503);
  assert.equal(storage.values.get(GUEST_TEXTBOOK_BOOKMARKS_KEY),raw);
  assert.equal(storage.calls.filter(([operation])=>operation==='set').length,0);
  assert.equal(storage.values.get(annotationsKey),annotationsRaw);
 }
});
const pureChecks=checks;
async function checkApi(name,run){try{await run();checks++;}catch(error){error.message=`${name}: ${error.message}`;throw error;}}
function compileRoute(imports){
 const file='app/api/textbook-bookmarks/route.ts',exports={};
 const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInThisContext(`(function(require,exports){${js}\n})`,{filename:file})(name=>{
  if(Object.hasOwn(imports,name))return imports[name];
  throw new Error(`Unexpected API import: ${name}`);
 },exports);
 return exports;
}
async function runApiChecks(){
 const db=new DatabaseSync(':memory:');
 try{
  for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
  let user={userId:'bookmark-user-a'},beforeRun=null;
  const binding={prepare(sql){
   const statement=db.prepare(sql);let args=[];
   return {bind(...values){args=values;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){
    if(beforeRun){const hook=beforeRun;beforeRun=null;hook(sql,args);}
    const result=statement.run(...args);return {success:true,meta:{changes:Number(result.changes)}};
   }};
  }};
  const route=compileRoute({
   '../../chatgpt-auth':{getChatGPTUser:async()=>user},
   '@/db/store':{database:()=>binding},
   '@/lib/textbooks':{textbookById:id=>[bookA,bookB].find(book=>book.id===id)},
   '@/lib/textbook-bookmarks':require('../lib/textbook-bookmarks.ts'),
  });
  async function post(body,headers={}){
   const requestHeaders=new Headers({'Content-Type':'application/json','X-Study-Action':'1'});
   for(const [name,value] of Object.entries(headers)){if(value===null)requestHeaders.delete(name);else requestHeaders.set(name,value);}
   const response=await route.POST(new Request('https://study.test/api/textbook-bookmarks',{method:'POST',headers:requestHeaders,body:JSON.stringify(body)}));
   return {status:response.status,value:await response.json()};
  }
  async function get(){const response=await route.GET();return {status:response.status,value:await response.json()};}
  function reset(){db.exec('DELETE FROM textbook_bookmarks');user={userId:'bookmark-user-a'};beforeRun=null;}
  const count=()=>db.prepare('SELECT count(*) AS count FROM textbook_bookmarks').get().count;
  db.prepare('INSERT INTO textbook_annotations (id,user_id,book_id,page,quote,note,rects,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run('preserved-highlight','bookmark-user-a',bookA.id,3,'Selected text','Existing handwritten note','[]',firstTime,firstTime);
  const previousHighlights=db.prepare('SELECT * FROM textbook_annotations').all();

  await checkApi('API rejects unauthenticated and cross-site writes',async()=>{
   reset();user=null;
   assert.equal((await get()).status,401);
   assert.equal((await post(save(bookA,3))).status,401);
   user={userId:'bookmark-user-a'};
   for(const headers of [{'X-Study-Action':null},{'Sec-Fetch-Site':'cross-site'},{'Content-Type':'text/plain'}])assert.equal((await post(save(bookA,3),headers)).status,403);
   assert.equal(count(),0);
  });
  await checkApi('API creates a bookmark and rejects duplicate creation without replacing its note',async()=>{
   reset();assert.deepEqual((await get()).value,{bookmarks:[]});
   const result=await post(save(bookA,3,'Original API note'));
   assert.equal(result.status,200);
   assert.equal(find(result.value,bookA,3).revision,0);
   assert.equal((await post(save(bookA,3,'Duplicate overwrite'))).status,409);
   assert.equal(find((await get()).value,bookA,3).note,'Original API note');
   assert.equal(count(),1);
  });
  await checkApi('Concurrent API additions cannot replace the winning insert',async()=>{
   reset();
   beforeRun=(sql)=>{
    assert.match(sql,/^INSERT OR IGNORE INTO textbook_bookmarks/);
    db.prepare('INSERT INTO textbook_bookmarks (user_id,book_id,page,note,created_at,updated_at,revision) VALUES (?,?,?,?,?,?,?)').run(user.userId,bookA.id,3,'Concurrent winner',firstTime,firstTime,0);
   };
   assert.equal((await post(save(bookA,3,'Losing insert'))).status,409);
   assert.equal(beforeRun,null);
   assert.equal(find((await get()).value,bookA,3).note,'Concurrent winner');
   assert.equal(count(),1);
  });
  await checkApi('API edits and deletes use revision checks',async()=>{
   reset();const first=await post(save(bookA,3,'Version zero'));
   const result=await post(save(bookA,3,'Version one',0));
   assert.equal(result.status,200);
   assert.equal(find(result.value,bookA,3).revision,1);
   assert.equal(find(result.value,bookA,3).createdAt,find(first.value,bookA,3).createdAt);
   assert.equal((await post(save(bookA,3,'Stale edit',0))).status,409);
   assert.equal((await post(remove(bookA,3,0))).status,409);
   assert.equal(find((await get()).value,bookA,3).note,'Version one');
   assert.equal((await post(remove(bookA,3,1))).status,200);
   assert.equal(count(),0);
   assert.equal((await post(save(bookA,3,'Stale recreate',1))).status,404);
  });
  await checkApi('API update CAS rejects a revision changed after its initial read',async()=>{
   reset();await post(save(bookA,3,'Original'));
   beforeRun=sql=>{
    assert.match(sql,/^UPDATE textbook_bookmarks SET/);
    db.prepare('UPDATE textbook_bookmarks SET note=?,revision=revision+1 WHERE user_id=? AND book_id=? AND page=?').run('Concurrent edit',user.userId,bookA.id,3);
   };
   assert.equal((await post(save(bookA,3,'Losing edit',0))).status,409);
   assert.equal(beforeRun,null);
   const item=find((await get()).value,bookA,3);
   assert.equal(item.note,'Concurrent edit');assert.equal(item.revision,1);
  });
  await checkApi('API delete CAS cannot remove a bookmark updated after its initial read',async()=>{
   reset();await post(save(bookA,3,'Original'));
   beforeRun=sql=>{
    assert.match(sql,/^DELETE FROM textbook_bookmarks/);
    db.prepare('UPDATE textbook_bookmarks SET note=?,revision=revision+1 WHERE user_id=? AND book_id=? AND page=?').run('Concurrent edit',user.userId,bookA.id,3);
   };
   assert.equal((await post(remove(bookA,3,0))).status,409);
   assert.equal(beforeRun,null);
   assert.equal(find((await get()).value,bookA,3).note,'Concurrent edit');
   assert.equal(count(),1);
  });
  await checkApi('API users cannot read, edit or delete another users bookmarks',async()=>{
   reset();await post(save(bookA,3,'Private to user A'));
   user={userId:'bookmark-user-b'};
   assert.deepEqual((await get()).value,{bookmarks:[]});
   assert.equal((await post(save(bookA,3,'Wrong owner edit',0))).status,404);
   assert.equal((await post(remove(bookA,3,0))).status,404);
   const other=await post(save(bookA,3,'Private to user B'));
   assert.equal(other.status,200);
   assert.equal(other.value.bookmarks.length,1);
   assert.equal(find(other.value,bookA,3).note,'Private to user B');
   user={userId:'bookmark-user-a'};
   const owner=(await get()).value;
   assert.equal(owner.bookmarks.length,1);
   assert.equal(find(owner,bookA,3).note,'Private to user A');
   assert.equal((await post(remove(bookA,3,0))).status,200);
   user={userId:'bookmark-user-b'};
   assert.equal(find((await get()).value,bookA,3).note,'Private to user B');
  });
  await checkApi('Imported PDF bookmarks require ownership and a valid page',async()=>{
   reset();const imported={id:'user-imported-textbook',pageCount:7};
   db.prepare('INSERT INTO user_textbooks (id,user_id,title,original_name,page_count,storage_key,size_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(imported.id,user.userId,'Imported test PDF','test.pdf',imported.pageCount,'isolated-test.pdf',1234,firstTime,firstTime);
   assert.equal((await post(save(imported,imported.pageCount,'Final imported page'))).status,200);
   for(const page of [0,imported.pageCount+1])assert.equal((await post(save(imported,page))).status,400);
   assert.equal((await post(save(bookA,bookA.pageCount+1))).status,400);
   assert.equal((await post(save({id:'missing-textbook'},1))).status,400);
   user={userId:'bookmark-user-b'};
   assert.deepEqual((await get()).value,{bookmarks:[]});
   assert.equal((await post(save(imported,1))).status,400);
   assert.equal((await post(save(imported,imported.pageCount,'Wrong owner',0))).status,400);
   assert.equal((await post(remove(imported,imported.pageCount,0))).status,400);
   user={userId:'bookmark-user-a'};
   assert.equal(find((await get()).value,imported,imported.pageCount).note,'Final imported page');
  });
  await checkApi('Bookmark API mutations preserve existing annotation rows',async()=>{
   assert.deepEqual(db.prepare('SELECT * FROM textbook_annotations').all(),previousHighlights);
  });
 }finally{db.close();}
}
runApiChecks().then(()=>console.log(`Textbook bookmark checks passed: ${pureChecks} data/storage scenarios and ${checks-pureChecks} API/SQLite scenarios covering revisions, ownership, concurrent writes, imported books, and unchanged highlights.`)).catch(error=>{console.error(error);process.exitCode=1;});
