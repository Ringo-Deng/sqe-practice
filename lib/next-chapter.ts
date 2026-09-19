import {chapters,filterQuestions,type Chapter} from './chapters';
import type {Question,Session} from './study-types';

/** The effective filters used when the practice session was started. */
export type PracticeScope={
 subjectId?:string;
 sourceId?:string;
 chapterId?:string;
 sourceSet?:string;
};

export type NextChapter={
 subjectId:string;
 sourceId:string;
 chapterId:string;
 sourceSet?:string;
 chapter:Chapter;
 questionCount:number;
};

/**
 * Find the next populated chapter in the same order as the question library.
 * An explicit scope preserves its filters; older sessions need one unambiguous
 * shared chapter. Return null when the library should let the learner choose.
 */
export function getNextChapter(session:Session|null|undefined,questions:readonly Question[],scope?:PracticeScope):NextChapter|null{
 if(!session||session.status!=='finished'||!session.questionIds.length)return null;
 const questionById=new Map(questions.map(question=>[question.id,question]));
 const currentQuestions:Question[]=[];
 for(const id of session.questionIds){
  const question=questionById.get(id);
  if(!question)return null;
  currentQuestions.push(question);
 }

 let currentChapter:Chapter|undefined;
 let sourceId:string;
 let sourceSet:string|undefined;
 if(scope){
  // A known whole-subject session is not a chapter session, even if its
  // current question bank happens to contain just one populated chapter.
  if(!scope.chapterId)return null;
  currentChapter=chapters.find(chapter=>chapter.id===scope.chapterId&&(!scope.subjectId||chapter.subjectId===scope.subjectId));
  if(!currentChapter)return null;
  sourceId=scope.sourceId||'all';
  sourceSet=scope.sourceSet;
  if(filterQuestions(currentQuestions,{...scope,subjectId:currentChapter.subjectId}).length!==currentQuestions.length)return null;
 }else{
  const subjectId=currentQuestions[0].subjectId;
  if(currentQuestions.some(question=>question.subjectId!==subjectId))return null;
  // Use the same membership rule as the library, rather than treating a
  // relatedChapterIds reference as an independently selected chapter.
  const candidates=chapters.filter(chapter=>chapter.subjectId===subjectId&&filterQuestions(currentQuestions,{subjectId,chapterId:chapter.id}).length===currentQuestions.length);
  if(candidates.length!==1)return null;
  currentChapter=candidates[0];
  sourceId=currentQuestions.every(question=>question.sourceId===currentQuestions[0].sourceId)?currentQuestions[0].sourceId:'all';
  const chapterQuestions=filterQuestions(Array.from(questions),{subjectId,sourceId,chapterId:currentChapter.id});
  const currentIds=new Set(session.questionIds);
  const isWholeChapter=chapterQuestions.length===currentIds.size&&chapterQuestions.every(question=>currentIds.has(question.id));
  const sharedSet=currentQuestions[0].sourceSet;
  // The old library started whole chapters without a sourceSet filter. Some
  // chapters happen to draw every question from one assessment (or have a
  // chapter-specific sourceSet), which must not constrain the next chapter.
  sourceSet=!isWholeChapter&&sharedSet&&currentQuestions.every(question=>question.sourceSet===sharedSet)?sharedSet:undefined;
 }

 const subjectChapters=chapters.filter(chapter=>chapter.subjectId===currentChapter.subjectId);
 const currentIndex=subjectChapters.findIndex(chapter=>chapter.id===currentChapter.id);
 const availableQuestions=Array.from(questions);
 for(const chapter of subjectChapters.slice(currentIndex+1)){
  const filter={subjectId:currentChapter.subjectId,sourceId,chapterId:chapter.id,sourceSet};
  const questionCount=filterQuestions(availableQuestions,filter).length;
  if(questionCount)return {...filter,chapter,questionCount};
 }
 return null;
}
