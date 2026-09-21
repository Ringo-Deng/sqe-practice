import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {normalizeInlineQuestionText} from '../lib/question-text.ts';
import {chapterById} from '../lib/chapters.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const datasets={
 sraFlk1Original:readJson('lib/sra-flk1-original.json'),
 sraFlk1Pretested:readJson('lib/sra-flk1-pretested.json'),
 sraFlk2Original:readJson('lib/sra-flk2-original.json'),
 sraFlk2Pretested:readJson('lib/sra-flk2-pretested.json'),
 reviseFlk1:readJson('lib/revise-flk1-assessment-2025-26.json'),
 reviseFlk2:readJson('lib/revise-flk2-practice-assessment.json'),
 reviseChapters:readJson('lib/revise-chapter-questions.json'),
 qltsMocks:[...readJson('lib/qlts-mock-exams-1-5.json'),...readJson('lib/qlts-mock-exams-6-10.json'),...readJson('lib/qlts-mock-exams-11-15.json'),...readJson('lib/qlts-mock-exams-16-20.json'),...readJson('lib/qlts-mock-exams-21-30.json')],
};
const qltsSourceFiles=[readJson('lib/qlts-mock-exams-1-5-source.json'),readJson('lib/qlts-mock-exams-6-10-source.json'),readJson('lib/qlts-mock-exams-11-15-source.json'),readJson('lib/qlts-mock-exams-16-20-source.json'),readJson('lib/qlts-mock-exams-21-30-source.json')];
const qltsSource={
 importedQuestions:qltsSourceFiles.reduce((sum,source)=>sum+source.importedQuestions,0),
 mocks:qltsSourceFiles.flatMap(source=>source.mocks),
};
const qltsTranslations={...readJson('lib/qlts-mock-exams-1-5-translations.json'),...readJson('lib/qlts-mock-exams-6-10-translations.json'),...readJson('lib/qlts-mock-exams-11-15-translations.json'),...readJson('lib/qlts-mock-exams-16-20-translations.json'),...readJson('lib/qlts-mock-exams-21-30-translations.json')};
const qltsChapterMatches=readJson('lib/qlts-chapter-matches.json');
const qltsCurrentLawReviews=[readJson('lib/qlts-mock-exams-6-10-removed.json'),readJson('lib/qlts-mock-exams-11-15-removed.json'),readJson('lib/qlts-mock-exams-16-20-removed.json'),readJson('lib/qlts-mock-exams-21-30-removed.json')];
const reviseTranslations=readJson('lib/revise-assessment-translations.json');
const staticTranslations=readJson('lib/static-question-translations.json');
const questionNumbers=readJson('lib/question-numbers.json');
const textbooks=readJson('lib/textbooks.json').filter(book=>book.id.startsWith('revise-'));

assert.equal(datasets.reviseFlk1.length,180);
assert.equal(datasets.reviseFlk2.length,180);
assert.equal(datasets.reviseChapters.length,654);
for(const items of [datasets.reviseFlk1,datasets.reviseFlk2]){
 for(const session of [1,2])assert.deepEqual(items.filter(item=>item.sourceSession===session).map(item=>item.number),Array.from({length:90},(_,index)=>index+1));
}

const legacy=[datasets.sraFlk1Original,datasets.sraFlk1Pretested,datasets.sraFlk2Original,datasets.sraFlk2Pretested,datasets.reviseFlk1,datasets.reviseFlk2,datasets.reviseChapters].flat();
const expectedQNumbers={
 1:Array.from({length:90},(_,index)=>index+1),
 2:Array.from({length:90},(_,index)=>index+1),
 3:Array.from({length:90},(_,index)=>index+1).filter(number=>![24,25,26,27].includes(number)),
 4:Array.from({length:90},(_,index)=>index+1).filter(number=>number!==75),
 5:Array.from({length:90},(_,index)=>index+1),
 ...Object.fromEntries(qltsSource.mocks.filter(mock=>mock.mock>=6).map(mock=>{
  const removed=new Set(qltsCurrentLawReviews.flatMap(review=>review.categories).flatMap(category=>category.questionIds).filter(id=>id.startsWith(`qlts-mock-${String(mock.mock).padStart(2,'0')}-q`)).map(id=>Number(id.slice(-3))));
  const sourceQuestions=mock.sourceQuestions??mock.importedQuestions+(mock.excludedQuestions?.length??0);
  return [mock.mock,Array.from({length:sourceQuestions},(_,index)=>index+1).filter(number=>!removed.has(number))];
 })),
};
const currentLawExclusions=qltsCurrentLawReviews.flatMap(review=>review.categories).flatMap(category=>category.questionIds);
assert.equal(currentLawExclusions.length,qltsCurrentLawReviews.reduce((sum,review)=>sum+review.removedQuestions,0));
assert.equal(new Set(currentLawExclusions).size,currentLawExclusions.length);
assert.ok(currentLawExclusions.every(id=>!datasets.qltsMocks.some(question=>question.id===id)));
const latestQltsSource=readJson('lib/qlts-mock-exams-21-30-source.json');
assert.equal(latestQltsSource.sourceQuestions,531);
assert.equal(latestQltsSource.importedQuestions,400);
assert.equal(latestQltsSource.removedQuestions,131);
assert.equal(latestQltsSource.mocks.length,10);
assert.equal(datasets.qltsMocks.length,1762);
assert.equal(qltsSource.importedQuestions,datasets.qltsMocks.length);
assert.deepEqual(Object.keys(qltsTranslations).sort(),datasets.qltsMocks.map(question=>question.id).sort());
assert.equal(qltsChapterMatches.matchedQuestions,datasets.qltsMocks.length);
assert.deepEqual(Object.keys(qltsChapterMatches.matches).sort(),datasets.qltsMocks.map(question=>question.id).sort());
for(const question of datasets.qltsMocks){
 const match=qltsChapterMatches.matches[question.id];
 const chapter=chapterById(match.chapterId);
 assert.ok(chapter,`${question.id}: unknown QLTS chapter ${match.chapterId}`);
 assert.equal(chapter.subjectId,match.subjectId,`${question.id}: QLTS subject/chapter mismatch`);
}
for(const mock of qltsSource.mocks){
 const items=datasets.qltsMocks.filter(question=>question.sourceSession===mock.mock);
 assert.equal(items.length,mock.importedQuestions,`QLTS Mock ${mock.mock}: manifest count mismatch`);
 assert.deepEqual(items.map(question=>question.number),expectedQNumbers[mock.mock],`QLTS Mock ${mock.mock}: unexpected question sequence`);
}

const all=[...legacy,...datasets.qltsMocks];
assert.equal(all.length,2996);
assert.equal(new Set(all.map(question=>question.id)).size,all.length);
const reservedNumbers=Object.values(questionNumbers);
assert.ok(reservedNumbers.every(number=>Number.isSafeInteger(number)&&number>0),'Invalid system question number');
assert.equal(new Set(reservedNumbers).size,reservedNumbers.length,'Duplicate system question number');
for(const question of all)assert.ok(Object.hasOwn(questionNumbers,question.id),`${question.id}: missing system question number`);
for(const question of all){
 assert.ok(question.stem.trim()||question.sourceId==='qlts',`${question.id}: missing stem`);
 assert.ok(question.ask.trim(),`${question.id}: missing ask`);
 const expectedOptionIds='ABCDE'.slice(0,question.options.length).split('');
 assert.ok([4,5].includes(question.options.length),`${question.id}: invalid option count`);
 assert.deepEqual(question.options.map(option=>option.id),expectedOptionIds,`${question.id}: invalid options`);
 assert.match(question.explanation.answer,/^[A-E]$/,`${question.id}: invalid answer`);
 assert.ok(expectedOptionIds.includes(question.explanation.answer),`${question.id}: answer outside available options`);
 if(question.sourceId==='qlts')assert.ok(question.explanation.en.trim(),`${question.id}: missing explanation`);
}

const translatedRecords=legacy.map(question=>{
 const translation=reviseTranslations[question.id]??staticTranslations[question.id];
 return translation?{
  ...question,
  stemZh:question.stemZh||translation.stemZh,
  askZh:question.askZh||translation.askZh,
  options:question.options.map(option=>({...option,zh:option.zh||translation.options[option.id]})),
  explanation:{...question.explanation,zh:question.explanation.zh||translation.explanationZh||''},
 }:question;
});
const staticBilingual=translatedRecords.filter(question=>question.stemZh?.trim()&&question.askZh?.trim()&&question.options.every(option=>option.zh?.trim())).length;
assert.equal(Object.keys(staticTranslations).length,944);
assert.equal(staticBilingual,legacy.length);
for(const question of translatedRecords){
 const translatedValues=[question.stemZh,question.askZh,...question.options.map(option=>option.zh)];
 assert.match(translatedValues.join(' '),/\p{Script=Han}/u,`${question.id}: missing Chinese translation`);
 for(const value of translatedValues){
  assert.ok(value.trim(),`${question.id}: empty translated question text`);
 }
 if(staticTranslations[question.id])assert.ok(translatedValues.every(value=>!/\n/.test(value)),`${question.id}: generated translation contains a line break`);
 if(question.explanation.en?.trim())assert.match(question.explanation.zh,/\p{Script=Han}/u,`${question.id}: missing Chinese explanation`);
}

const translatedQltsRecords=datasets.qltsMocks.map(question=>{
 const translation=qltsTranslations[question.id];
 return {
  ...question,
  stemZh:translation.stemZh,
  askZh:translation.askZh,
  options:question.options.map(option=>({...option,zh:translation.options[option.id]})),
  explanation:{...question.explanation,zh:translation.explanationZh},
 };
});
const qltsBilingual=translatedQltsRecords.filter(question=>(!question.stem.trim()||question.stemZh?.trim())&&question.askZh?.trim()&&question.options.every(option=>option.zh?.trim())&&question.explanation.zh?.trim()).length;
assert.equal(qltsBilingual,datasets.qltsMocks.length);
for(const question of translatedQltsRecords){
 const translatedValues=[question.askZh,question.explanation.zh];
 if(question.stem.trim())translatedValues.push(question.stemZh);
 for(const value of translatedValues){
  assert.ok(value.trim(),`${question.id}: empty QLTS translation`);
  assert.match(value,/\p{Script=Han}/u,`${question.id}: missing Chinese QLTS translation`);
 }
 for(const option of question.options){
  assert.ok(option.zh.trim(),`${question.id}: empty translated option ${option.id}`);
  if(/\p{L}{3}/u.test(option.en))assert.match(option.zh,/\p{Script=Han}/u,`${question.id}: missing Chinese option ${option.id}`);
 }
 assert.ok([question.stemZh,question.askZh,...question.options.map(option=>option.zh)].every(value=>!value.includes('\n')),`${question.id}: translated question text contains a line break`);
 assert.deepEqual(Object.keys(qltsTranslations[question.id].options).sort(),question.options.map(option=>option.id).sort(),`${question.id}: translated option keys differ from source`);
}

const rawFormattingIssues=all.filter(question=>
 /\n/.test(question.stem)||/\n/.test(question.ask)||question.options.some(option=>/\n/.test(option.en))
).length;
const normalized=all.map(question=>({
 ...question,
 stem:normalizeInlineQuestionText(question.stem),
 ask:normalizeInlineQuestionText(question.ask),
 options:question.options.map(option=>({...option,en:normalizeInlineQuestionText(option.en)})),
}));
const displayedFormattingIssues=normalized.filter(question=>
 /\n/.test(question.stem)||/\n/.test(question.ask)||question.options.some(option=>/\n/.test(option.en))
).length;
assert.equal(displayedFormattingIssues,0);

const recordsByBook=new Map();
for(const question of datasets.reviseChapters){
 const bookId=question.explanation.textbookReferences?.[0]?.bookId;
 assert.ok(bookId,`${question.id}: missing Revise book reference`);
 if(!recordsByBook.has(bookId))recordsByBook.set(bookId,new Map());
 const chapterMap=recordsByBook.get(bookId);
 const key=question.sourceSet;
 if(!chapterMap.has(key))chapterMap.set(key,[]);
 chapterMap.get(key).push(question.number);
}

async function pdfQuestionCounts(book){
 const filename=book.url.split('/').at(-1);
 const bytes=new Uint8Array(fs.readFileSync(path.join(root,'public/textbooks',filename)));
 const pdf=await getDocument({data:bytes,disableFontFace:true}).promise;
 let text='';
 for(let number=1;number<=pdf.numPages;number++){
  const page=await pdf.getPage(number);
  const content=await page.getTextContent();
  text+=content.items.map(item=>'str' in item?item.str:'').join(' ')+'\n';
 }
 const counts=[];
 const marker=/SQE1-STYLE QUESTIONS/g;
 for(const match of text.matchAll(marker)){
  const section=text.slice(match.index+match[0].length);
  const end=section.indexOf('ANSWERS TO QUESTIONS');
  assert.ok(end>=0,`${book.id}: question section has no answer heading`);
  counts.push([...section.slice(0,end).matchAll(/\bQUESTION\s+([1-5])\b/g)].map(item=>Number(item[1])).length);
 }
 return counts;
}

const coverage=[];
for(const book of textbooks){
 const pdfCounts=await pdfQuestionCounts(book);
 const importedCounts=[...(recordsByBook.get(book.id)?.values()??[])].map(numbers=>numbers.length);
 assert.deepEqual(importedCounts,pdfCounts.filter(Boolean),`${book.id}: imported chapter counts differ from the PDF`);
 coverage.push({book:book.shortTitle,questions:importedCounts.reduce((sum,value)=>sum+value,0),questionSections:pdfCounts.filter(Boolean).length,emptySections:pdfCounts.filter(value=>!value).length});
}

console.log(JSON.stringify({
 totalQuestions:all.length,
 qltsQuestions:datasets.qltsMocks.length,
 qltsMocks:Object.fromEntries(qltsSource.mocks.map(mock=>[`mock${mock.mock}`,mock.importedQuestions])),
 reviseQuestions:datasets.reviseFlk1.length+datasets.reviseFlk2.length+datasets.reviseChapters.length,
 reviseAssessments:{flk1:datasets.reviseFlk1.length,flk2:datasets.reviseFlk2.length},
 reviseChapterQuestions:datasets.reviseChapters.length,
 staticBilingual,
 qltsBilingual,
 staticTranslationRecords:Object.keys(staticTranslations).length,
 qltsTranslationRecords:Object.keys(qltsTranslations).length,
 rawFormattingIssues,
 displayedFormattingIssues,
 coverage,
},null,2));
