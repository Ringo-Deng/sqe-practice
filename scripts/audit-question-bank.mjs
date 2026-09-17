import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {normalizeInlineQuestionText} from '../lib/question-text.ts';

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
};
const reviseTranslations=readJson('lib/revise-assessment-translations.json');
const staticTranslations=readJson('lib/static-question-translations.json');
const textbooks=readJson('lib/textbooks.json').filter(book=>book.id.startsWith('revise-'));

assert.equal(datasets.reviseFlk1.length,180);
assert.equal(datasets.reviseFlk2.length,180);
assert.equal(datasets.reviseChapters.length,654);
for(const items of [datasets.reviseFlk1,datasets.reviseFlk2]){
 for(const session of [1,2])assert.deepEqual(items.filter(item=>item.sourceSession===session).map(item=>item.number),Array.from({length:90},(_,index)=>index+1));
}

const all=Object.values(datasets).flat();
assert.equal(all.length,1234);
assert.equal(new Set(all.map(question=>question.id)).size,all.length);
for(const question of all){
 assert.ok(question.stem.trim(),`${question.id}: missing stem`);
 assert.ok(question.ask.trim(),`${question.id}: missing ask`);
 assert.deepEqual(question.options.map(option=>option.id),['A','B','C','D','E'],`${question.id}: invalid options`);
 assert.match(question.explanation.answer,/^[A-E]$/,`${question.id}: invalid answer`);
}

const translatedRecords=all.map(question=>{
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
assert.equal(staticBilingual,all.length);
for(const question of translatedRecords){
 const translatedValues=[question.stemZh,question.askZh,...question.options.map(option=>option.zh)];
 assert.match(translatedValues.join(' '),/\p{Script=Han}/u,`${question.id}: missing Chinese translation`);
 for(const value of translatedValues){
  assert.ok(value.trim(),`${question.id}: empty translated question text`);
 }
 if(staticTranslations[question.id])assert.ok(translatedValues.every(value=>!/\n/.test(value)),`${question.id}: generated translation contains a line break`);
 if(question.explanation.en?.trim())assert.match(question.explanation.zh,/\p{Script=Han}/u,`${question.id}: missing Chinese explanation`);
}

const rawFormattingIssues=all.filter(question=>
 /\n/.test(question.stem)||/\n/.test(question.ask)||question.options.some(option=>/\n/.test(option.en))
).length;
const normalized=translatedRecords.map(question=>({
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
 reviseQuestions:datasets.reviseFlk1.length+datasets.reviseFlk2.length+datasets.reviseChapters.length,
 reviseAssessments:{flk1:datasets.reviseFlk1.length,flk2:datasets.reviseFlk2.length},
 reviseChapterQuestions:datasets.reviseChapters.length,
 staticBilingual,
 staticTranslationRecords:Object.keys(staticTranslations).length,
 rawFormattingIssues,
 displayedFormattingIssues,
 coverage,
},null,2));
