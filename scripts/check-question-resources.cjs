// Exercise the merged bank and reader URLs, without touching saved user data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {questions,publicQuestions}=require('../lib/questions.ts');
const {chapterById,filterQuestions}=require('../lib/chapters.ts');
const {textbookById,linkedTextbooks,textbookReaderUrl,parseTextbookReaderTarget}=require('../lib/textbooks.ts');
const original=[...require('../lib/sra-flk2-original.json'),...require('../lib/sra-flk2-pretested.json')];
const matches=require('../lib/sra-flk2-chapter-matches.json');
assert.equal(original.length,110);
assert.equal(Object.keys(matches).length,103);
assert.equal(new Set(questions.map(q=>q.id)).size,2996);
for(const source of original){
 const q=questions.find(item=>item.id===source.id);
 for(const key of ['id','number','sourceSet','sourcePages','stem','ask'])assert.deepEqual(q[key],source[key]);
 assert.deepEqual(q.options.map(({id,en})=>({id,en})),source.options.map(({id,en})=>({id,en})));
 assert.equal(q.explanation.answer,source.explanation.answer);
 const chapter=chapterById(q.chapterId);
 assert.ok(chapter,q.id+' has a practice chapter');
 assert.equal(chapter.subjectId,q.subjectId);
 if(matches[q.id])assert.equal(q.chapterId,matches[q.id]);
 assert.ok(filterQuestions(questions,{sourceId:'sra',subjectId:q.subjectId,chapterId:q.chapterId}).some(item=>item.id===q.id));
 const refs=linkedTextbooks(q.explanation.textbookReferences);
 assert.equal(refs.filter(ref=>ref.bookId.startsWith('revise-')).length,1);
 for(const ref of refs){
  const book=textbookById(ref.bookId);
  assert.ok(book.url&&fs.existsSync(path.join(root,'public',book.url)),q.id+' has a PDF');
  const target=parseTextbookReaderTarget(textbookReaderUrl(book,ref.pageNumbers[0],q.id));
  assert.deepEqual(target,{bookId:book.id,page:ref.pageNumbers[0],sourceQuestionId:q.id});
 }
}
assert.equal(questions.find(q=>q.id==='sra-flk2-original-029').chapterId,'trusts-05');
assert.equal(questions.find(q=>q.id==='sra-flk2-original-027').chapterId,'accounts-07');
assert.equal(questions.find(q=>q.id==='sra-flk2-pretested-105').chapterId,'legal-services-sra-regulation');
assert.ok(publicQuestions().every(q=>!('explanation' in q)),'No answer or resource information leaks before grading');
console.log('PASS: 110 SRA FLK2 chapter memberships and reader links; original questions, answers and reveal boundary preserved.');
