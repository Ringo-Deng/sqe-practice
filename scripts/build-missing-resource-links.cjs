// Complete links using reviewed chapters and the existing Notes page corpus.
// Run after installing dependencies: node scripts/build-missing-resource-links.cjs
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {questions}=require('../lib/questions.ts');
const {chapterById}=require('../lib/chapters.ts');
const {textbooks}=require('../lib/textbooks.ts');
const corpus=require('../data/flk1-textbook-index.json');
const filename=path.join(root,'lib/question-textbook-links.json');
const links=JSON.parse(fs.readFileSync(filename,'utf8'));
const syllabusBookChapters={
 'legal-services-sra-regulation':'legal-services-lss-05',
 'legal-services-aml':'legal-services-lss-06',
 'legal-services-financial-services':'legal-services-lss-07',
 'legal-services-funding':'legal-services-lss-08',
 'legal-services-sra-principles':'legal-services-ethics-01',
 'legal-services-code-of-conduct':'legal-services-ethics-02',
};

function textbookChapter(q){
 let id=q.chapterId;
 if(id==='legal-services-code-of-conduct'&&/^(legal-services-ethics|flk2-ethics)-0[2-8]$/.test(q.originalChapterId??''))id=q.originalChapterId;
 else id=syllabusBookChapters[id]??id;
 const chapter=chapterById(id);
 if(!chapter||chapter.kind==='syllabus')throw Error(`${q.id}: no reviewed textbook chapter`);
 return chapter;
}

const stop=new Set('a an and are as at be been being but by can client correct could court did do does for from had has have he her him his how if in into is it its law legal may more most must no not of on one only or other our question s said she should so some such than that the their them then there these they this those to under up was were what when where which who will with would year years you your'.split(' '));
function tokens(text){return (text.toLowerCase().replace(/[’‘]/g,"'").match(/[a-z][a-z0-9'-]{1,}/g)??[]).filter(word=>!stop.has(word));}
function counts(text){const result=new Map();for(const token of tokens(text))result.set(token,(result.get(token)??0)+1);return result;}
const noteIndexes=corpus.books.filter(book=>book.kind==='notes').map(book=>{
 const pages=book.pages.map(page=>({page,counts:counts(`${page.heading} ${page.heading} ${page.text}`)}));
 const df=new Map();for(const page of pages){page.length=[...page.counts.values()].reduce((a,b)=>a+b,0);for(const token of page.counts.keys())df.set(token,(df.get(token)??0)+1);}
 return {book,pages,df,average:pages.reduce((sum,page)=>sum+page.length,0)/pages.length};
});
function notesFor(q,chapter){
 const eligible=noteIndexes.filter(index=>index.book.subjectId===q.subjectId&&(
  q.subjectId!=='legal-services'||index.book.id===(chapter.bookId==='revise-ethics-2027'?'notes-ethics-9':'notes-legal-services-10')
 ));
 if(!eligible.length)return null;
 const answer=q.options.find(option=>option.id===q.explanation.answer)?.en??'';
 const query=counts(`${chapter.en} ${chapter.en} ${q.stem} ${q.ask} ${answer} ${q.explanation.topic} ${q.explanation.en}`);
 let best=null;
 for(const index of eligible){
  const n=index.pages.length;
  for(const page of index.pages){
   let score=0;
   for(const [token,frequency] of query){
    const tf=page.counts.get(token)??0;if(!tf)continue;
    const df=index.df.get(token)??0;
    score+=Math.log(1+(n-df+0.5)/(df+0.5))*tf*2.2/(tf+1.2*(0.25+0.75*page.length/index.average))*(1+Math.min(frequency-1,2)*0.18);
   }
   if(!best||score>best.score)best={score,book:index.book,page:page.page};
  }
 }
 if(!best||best.score<=0)throw Error(`${q.id}: no matching Notes page`);
 return {book:best.book.title,bookId:best.book.id,chapter:'主题笔记',pages:String(best.page.page),pageNumbers:[best.page.page],section:best.page.heading,note:'按科目及考点关键词匹配的补充笔记；非出版社指定页码'};
}

async function main(){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const chapterPages=new Map();let addedTextbooks=0,addedNotes=0;
 for(const q of questions){
  const existing=q.explanation.textbookReferences??[];
  const refs=[...existing];
  const chapter=textbookChapter(q);
  if(!refs.some(ref=>ref.bookId?.startsWith('revise-'))){
   const book=textbooks.find(book=>book.id===chapter.bookId);
   if(!book?.url)throw Error(`${q.id}: missing PDF`);
   if(!chapterPages.has(book.id)){
    const task=getDocument({data:new Uint8Array(fs.readFileSync(path.join(root,'public',book.url))),disableFontFace:true});
    const pdf=await task.promise;
    const pages=new Map();
    for(const entry of await pdf.getOutline()??[]){
     const match=/^(\d+)\s+/.exec(entry.title);if(!match)continue;
     const dest=typeof entry.dest==='string'?await pdf.getDestination(entry.dest):entry.dest;
     if(!dest)throw Error(`${book.id}: bookmark has no page`);
     const page=(typeof dest[0]==='number'?dest[0]:await pdf.getPageIndex(dest[0]))+1;
     pages.set(Number(match[1]),page);
    }
    chapterPages.set(book.id,pages);await task.destroy();
   }
   const page=chapterPages.get(book.id).get(chapter.number);
   if(!Number.isInteger(page)||page<1||page>book.pageCount)throw Error(`${q.id}: invalid chapter destination`);
   refs.push({book:book.title,bookId:book.id,chapter:`Chapter ${chapter.number}: ${chapter.en}`,pages:String(page),pageNumbers:[page],section:'相关教材章节（按既有考点分类；非出版社指定阅读页）'});
   addedTextbooks++;
  }
  if(!refs.some(ref=>ref.bookId?.startsWith('notes-'))){const note=notesFor(q,chapter);if(note){refs.push(note);addedNotes++;}}
  if(refs.length!==existing.length)links[q.id]={...links[q.id],textbookReferences:refs};
 }
 fs.writeFileSync(filename,JSON.stringify(links,null,2)+'\n');
 console.log(`Added ${addedTextbooks} Revise chapter links and ${addedNotes} Notes links; existing references preserved.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
