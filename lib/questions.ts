import officialQuestions from './sra-flk1-original.json';
import pretestedQuestions from './sra-flk1-pretested.json';
import officialFlk2Questions from './sra-flk2-original.json';
import pretestedFlk2Questions from './sra-flk2-pretested.json';
import reviseQuestions from './revise-flk1-assessment-2025-26.json';
import reviseFlk2Questions from './revise-flk2-practice-assessment.json';
import reviseChapterQuestions from './revise-chapter-questions.json';
import reviseTranslations from './revise-assessment-translations.json';
import reviseReferences from './revise-assessment-references.json';
import questionTextbookLinks from './question-textbook-links.json';
import textbookReviews from './contract-textbook-reviews.json';
import type {Question,Explanation} from './study-types';
type FullQuestion=Question&{explanation:Explanation};
type TextbookReview={chapterId:string;relatedChapterIds?:string[];topicTags:string[];explanation:Partial<Explanation>;quickPoints?:{term:string;zh:string;en:string}[]};
type QuestionTextbookLink={chapterId?:string;textbookReferences:NonNullable<Explanation['textbookReferences']>};
const textbookById=textbookReviews as Record<string,TextbookReview>;
const textbookLinksById=questionTextbookLinks as Record<string,QuestionTextbookLink>;
const reviseById=reviseReferences as Record<string,QuestionTextbookLink>;
const translationsById=reviseTranslations as Record<string,{stemZh:string;askZh:string;options:Record<string,string>;explanationZh:string}>;
const importedRevise=(reviseQuestions as FullQuestion[]).map(q=>{
 const translation=translationsById[q.id];
 return {...q,
  ...(translation?{stemZh:translation.stemZh,askZh:translation.askZh,options:q.options.map(o=>({...o,zh:translation.options[o.id]}))}:{}),
  explanation:{...q.explanation,...(translation?{zh:translation.explanationZh}:{})}};
});
export const questions:FullQuestion[]=[...(officialQuestions as FullQuestion[]),...(pretestedQuestions as FullQuestion[]),...(officialFlk2Questions as FullQuestion[]),...(pretestedFlk2Questions as FullQuestion[]),...importedRevise,...(reviseFlk2Questions as FullQuestion[]),...(reviseChapterQuestions as FullQuestion[])].map(q=>{
 const link=textbookLinksById[q.id];
 const refined=reviseById[q.id];
 const references=refined?[...refined.textbookReferences,...(link?.textbookReferences.filter(ref=>ref.bookId?.startsWith('notes-'))??[])]:link?.textbookReferences;
 const chapterId=refined?.chapterId??link?.chapterId;
 const linked=references?{...q,...(chapterId?{chapterId}:{}),explanation:{...q.explanation,textbookReferences:references}}:q;
 const review=textbookById[linked.id];
 if(!review)return linked;
 const {explanation,quickPoints,...classification}=review;
 return {...linked,...classification,explanation:{...linked.explanation,...explanation},knowledge:linked.knowledge?{...linked.knowledge,...(quickPoints?{points:quickPoints}:{}),warning:{...linked.knowledge.warning,zh:explanation.warning??linked.knowledge.warning.zh}}:undefined};
});
export function publicQuestions(){return questions.map(({explanation,knowledge,...q})=>q);}
