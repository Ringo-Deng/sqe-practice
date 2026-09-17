import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const read=path=>JSON.parse(readFileSync(join(root,path),'utf8'));
const catalog=read('lib/textbooks.json');
const links=read('lib/question-textbook-links.json');
const corpus=read('data/flk1-textbook-index.json');
const questions=[
 ...read('lib/sra-flk1-original.json'),
 ...read('lib/sra-flk1-pretested.json'),
 ...read('lib/revise-flk1-assessment-2025-26.json'),
 ...Array.from({length:8},(_,index)=>({id:`demo-contract-${String(index+1).padStart(2,'0')}`,subjectId:'contract'})),
];
const questionIds=questions.map(q=>q.id);
const chapterPrefixes=new Map([
 ['revise-business-law-practice-2027|business','business'],
 ['revise-dispute-resolution-2027|dispute','dispute'],
 ['revise-contract-2027|contract','contract'],
 ['revise-tort-2027|tort','tort'],
 ['revise-legal-system-services-2027|legal-system','legal-system-lss'],
 ['revise-constitutional-administrative-2027|legal-system','legal-system-cal'],
 ['revise-legal-system-services-2027|legal-services','legal-services-lss'],
 ['revise-ethics-2027|legal-services','legal-services-ethics'],
]);

assert.equal(catalog.length,18,'The FLK1 catalog must contain 18 unique textbooks');
assert.equal(new Set(catalog.map(book=>book.id)).size,catalog.length,'Textbook IDs must be unique');
assert.equal(corpus.bookCount,catalog.length,'Corpus and reader catalog must describe the same books');
assert.equal(Object.keys(links).length,questionIds.length,'Every current question must have one link record');
assert.deepEqual(new Set(Object.keys(links)),new Set(questionIds),'Question link IDs must match the current bank');

const catalogById=new Map(catalog.map(book=>[book.id,book]));
for(const book of catalog){
 assert.ok(book.sourceFile,`${book.id}: Library source filename is missing`);
 assert.ok(book.pageUrlTemplate?.includes('{page}'),`${book.id}: page URL template is missing`);
 for(let page=1;page<=book.pageCount;page++){
  const pagePath=join(root,'public',book.pageUrlTemplate.replace('{page}',String(page)));
  assert.ok(existsSync(pagePath)&&statSync(pagePath).size>0,`${book.id}: split page ${page} is missing`);
 }
}

for(const question of questions){
 const questionId=question.id;
 const refs=links[questionId]?.textbookReferences;
 assert.equal(refs?.length,2,`${questionId}: expected a Revise and a Notes reference`);
 assert.ok(refs[0].bookId.startsWith('revise-'),`${questionId}: first reference must be Revise`);
 assert.ok(refs[1].bookId.startsWith('notes-'),`${questionId}: second reference must be Notes`);
 const expectedPrefix=chapterPrefixes.get(`${refs[0].bookId}|${question.subjectId}`);
 assert.ok(expectedPrefix,`${questionId}: no chapter prefix for ${refs[0].bookId}`);
 assert.match(links[questionId].chapterId,new RegExp(`^${expectedPrefix}-\\d{2}$`),`${questionId}: missing or invalid Revise chapter`);
 for(const ref of refs){
  const book=catalogById.get(ref.bookId);
  assert.ok(book,`${questionId}: unknown textbook ${ref.bookId}`);
  assert.ok(ref.pageNumbers.length>0,`${questionId}: ${ref.bookId} has no page`);
  assert.ok(ref.pageNumbers.every(page=>Number.isInteger(page)&&page>=1&&page<=book.pageCount),`${questionId}: ${ref.bookId} page is out of range`);
 }
}

console.log(`Passed: ${catalog.length} FLK1 textbooks, ${corpus.books.reduce((sum,book)=>sum+book.pageCount,0)} indexed pages and ${questionIds.length} linked questions.`);
