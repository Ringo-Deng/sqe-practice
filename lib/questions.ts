import officialQuestions from './sra-flk1-original.json';
import pretestedQuestions from './sra-flk1-pretested.json';
import officialFlk2Questions from './sra-flk2-original.json';
import pretestedFlk2Questions from './sra-flk2-pretested.json';
import reviseQuestions from './revise-flk1-assessment-2025-26.json';
import reviseFlk2Questions from './revise-flk2-practice-assessment.json';
import reviseChapterQuestions from './revise-chapter-questions.json';
import qltsMockQuestions1To5 from './qlts-mock-exams-1-5.json';
import qltsMockQuestions6To10 from './qlts-mock-exams-6-10.json';
import qltsMockQuestions11To15 from './qlts-mock-exams-11-15.json';
import qltsMockQuestions16To20 from './qlts-mock-exams-16-20.json';
import qltsMockQuestions21To30 from './qlts-mock-exams-21-30.json';
import qltsTranslations1To5 from './qlts-mock-exams-1-5-translations.json';
import qltsTranslations6To10 from './qlts-mock-exams-6-10-translations.json';
import qltsTranslations11To15 from './qlts-mock-exams-11-15-translations.json';
import qltsTranslations16To20 from './qlts-mock-exams-16-20-translations.json';
import qltsTranslations21To30 from './qlts-mock-exams-21-30-translations.json';
import qltsChapterMatchData from './qlts-chapter-matches.json';
import reviseTranslations from './revise-assessment-translations.json';
import staticTranslations from './static-question-translations.json';
import reviseReferences from './revise-assessment-references.json';
import questionTextbookLinks from './question-textbook-links.json';
import textbookReviews from './contract-textbook-reviews.json';
import type {Question,Explanation} from './study-types';
import {classifyLegalQuestion} from './legal-syllabus';
type FullQuestion=Question&{explanation:Explanation};
type TextbookReview={chapterId:string;relatedChapterIds?:string[];topicTags:string[];explanation:Partial<Explanation>;quickPoints?:{term:string;zh:string;en:string}[]};
type QuestionTextbookLink={chapterId?:string;textbookReferences:NonNullable<Explanation['textbookReferences']>};
const textbookById=textbookReviews as Record<string,TextbookReview>;
const textbookLinksById=questionTextbookLinks as Record<string,QuestionTextbookLink>;
const reviseById=reviseReferences as Record<string,QuestionTextbookLink>;
const translationsById=reviseTranslations as Record<string,{stemZh:string;askZh:string;options:Record<string,string>;explanationZh:string}>;
const staticTranslationsById=staticTranslations as Record<string,{stemZh:string;askZh:string;options:Record<string,string>;explanationZh?:string}>;
const qltsTranslationsById={...qltsTranslations1To5,...qltsTranslations6To10,...qltsTranslations11To15,...qltsTranslations16To20,...qltsTranslations21To30} as Record<string,{stemZh:string;askZh:string;options:Record<string,string>;explanationZh:string}>;
const qltsChapterMatches=qltsChapterMatchData.matches as Record<string,{subjectId:string;chapterId:string}>;
const qltsMockQuestions=([...qltsMockQuestions1To5,...qltsMockQuestions6To10,...qltsMockQuestions11To15,...qltsMockQuestions16To20,...qltsMockQuestions21To30] as FullQuestion[]).map(question=>{
 const match=qltsChapterMatches[question.id];
 return match?{...question,subjectId:match.subjectId,chapterId:match.chapterId}:question;
});
const importedRevise=(reviseQuestions as FullQuestion[]).map(q=>{
 const translation=translationsById[q.id];
 return {...q,
  ...(translation?{stemZh:translation.stemZh,askZh:translation.askZh,options:q.options.map(o=>({...o,zh:translation.options[o.id]}))}:{}),
  explanation:{...q.explanation,...(translation?{zh:translation.explanationZh}:{})}};
});
export const assembledQuestions:FullQuestion[]=[...(officialQuestions as FullQuestion[]),...(pretestedQuestions as FullQuestion[]),...(officialFlk2Questions as FullQuestion[]),...(pretestedFlk2Questions as FullQuestion[]),...importedRevise,...(reviseFlk2Questions as FullQuestion[]),...(reviseChapterQuestions as FullQuestion[]),...qltsMockQuestions].map(q=>{
 const translation=staticTranslationsById[q.id]??qltsTranslationsById[q.id];
 const bilingual=translation?{...q,
  stemZh:q.stemZh||translation.stemZh,
  askZh:q.askZh||translation.askZh,
  options:q.options.map(option=>({...option,zh:option.zh||translation.options[option.id]||''})),
  explanation:{...q.explanation,zh:q.explanation.zh||translation.explanationZh||''},
 }:q;
 const link=textbookLinksById[q.id];
 const refined=reviseById[q.id];
 const references=refined?[...refined.textbookReferences,...(link?.textbookReferences.filter(ref=>ref.bookId?.startsWith('notes-'))??[])]:link?.textbookReferences;
 const chapterId=refined?.chapterId??link?.chapterId;
 const linked=references?{...bilingual,...(chapterId?{chapterId}:{}),explanation:{...bilingual.explanation,textbookReferences:references}}:bilingual;
 const review=textbookById[linked.id];
 if(!review)return linked;
 const {explanation,quickPoints,...classification}=review;
 return {...linked,...classification,explanation:{...linked.explanation,...explanation},knowledge:linked.knowledge?{...linked.knowledge,...(quickPoints?{points:quickPoints}:{}),warning:{...linked.knowledge.warning,zh:explanation.warning??linked.knowledge.warning.zh}}:undefined};
});
export const questions:FullQuestion[]=assembledQuestions.map(classifyLegalQuestion);
export function publicQuestions(){return questions.map(({explanation,knowledge,...q})=>q);}
