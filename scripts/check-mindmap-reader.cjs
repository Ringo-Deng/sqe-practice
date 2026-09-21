const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {createHash}=require('node:crypto');
const vm=require('node:vm');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {textbooks,textbookById,textbookPageSource,parseTextbookReaderTarget}=require('../lib/textbooks.ts');
const {mindMapBooks}=require('../lib/mindmap-documents.ts');
const {mindMapPageUrl,mindMapsForQuestion}=require('../lib/mindmaps.ts');
const {mutateGuestTextbookBookmarks}=require('../lib/textbook-bookmarks.ts');
assert.equal(textbooks.length,25,'Keep the existing textbook shelf intact');
assert.equal(mindMapBooks.length,12);
let count=0;
for(const book of mindMapBooks){
 assert.equal(textbookById(book.id),book);
 assert.equal(createHash('sha256').update(fs.readFileSync('public'+book.url)).digest('hex'),book.sha256);
 let end=0;
 for(let page=1;page<=book.pageCount;page++){
  const source=textbookPageSource(book,page);
  assert.equal(source.pageNumber,1);assert.equal(source.documentPages,1);
  const start=(page-1)*book.pdfSlice.height;assert.equal(start,end);
  end=Math.min(start+book.pdfSlice.height,book.pdfSlice.totalHeight);
  assert(end>start);count++;
 }
 assert.equal(end,book.pdfSlice.totalHeight,'Slices cover the whole original without gaps');
 for(const y of [0,1108,book.pdfSlice.height,book.pdfSlice.totalHeight,Number.POSITIVE_INFINITY]){
  const link=mindMapPageUrl(book.id.slice(8),y,'测试章节','test-question');
  const target=parseTextbookReaderTarget(link);assert(target);
  assert.equal(target.bookId,book.id);assert(target.page>=1&&target.page<=book.pageCount);
  assert(target.offset>=0&&target.offset<1);assert.equal(target.sourceQuestionId,'test-question');
  if(Number.isFinite(y))assert(Math.abs((target.page-1)*book.pdfSlice.height+target.offset*Math.min(book.pdfSlice.height,book.pdfSlice.totalHeight-(target.page-1)*book.pdfSlice.height)-Math.min(book.pdfSlice.totalHeight-1,Math.max(0,y-90)))<0.001);
 }
 const memory=new Map();const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const saved=mutateGuestTextbookBookmarks(storage,{action:'save',bookId:book.id,page:book.pageCount,note:'Last segment'},book);
 assert.equal(saved.bookmarks[0].page,book.pageCount);
}
for(const base of ['https://ringo-deng.github.io/sqe-practice/','https://example.com/']){
 let result;
 const location={href:base+'mindmaps/index.html?map=contract&top=1108&focus=Offer',search:'?map=contract&top=1108&focus=Offer',replace:url=>{result=url;}};
 vm.runInNewContext(fs.readFileSync('public/mindmaps/reader.js','utf8'),{URL,URLSearchParams,location});
 const url=new URL(result);assert.equal(url.pathname,new URL(base).pathname);assert.equal(url.searchParams.get('reader'),'mindmap');assert.equal(url.searchParams.get('top'),'1108');assert.equal(url.searchParams.get('focus'),'Offer');
}
assert.equal(mindMapsForQuestion({id:'sra-flk1-original-001',subjectId:'contract',chapterId:'contract-01'})[0].id,'contract');
assert.equal(parseTextbookReaderTarget('?reader=mindmap&map=missing'),null);
assert.equal(parseTextbookReaderTarget('?reader=textbook&book=revise-contract-2027&page=20').page,20);
console.log(`PASS: 12 original PDFs, ${count} gap-free segments, chapter coordinates, bookmarks, old-link redirects and textbook isolation.`);
