import catalog from '../public/mindmaps/catalog.json';
import type {Question} from './study-types';
import {chapterById} from './chapters';
import {mindMapChapterLocation} from './mindmap-chapter-locations';
import questionChapterOverrides from './mindmap-question-chapters.json';

export type MindMap=(typeof catalog)[number];
export type MindMapTarget=MindMap&{top?:number;focusLabel?:string};

const primaryMapBySubject:Record<string,string>={
 business:'business',
 'legal-system':'legal-system',
 contract:'contract',
 dispute:'dispute',
 tort:'tort',
 'legal-services':'ethics',
 'criminal-liability':'criminal-law',
 'criminal-practice':'criminal-practice',
 'flk2-ethics':'ethics',
 land:'land-property',
 'property-practice':'land-property',
 trusts:'trusts',
 wills:'wills',
};

const taxChapterPositions:Record<string,number>={
 'business-07':2060,
 'business-08':529,
 'business-09':1484,
 'accounts-06':2060,
};
const taxQuestionPositions:Record<string,number>={
 'sra-flk2-original-025':1484,
 'sra-flk2-pretested-100':1484,
};
const questionPositions:Record<string,{mapId:string;top:number;label:string}>={
 'sra-flk2-original-029':{mapId:'trusts',top:9050,label:'信托终止与受益人同意'},
};

export function mindMapsForQuestion(question:Pick<Question,'id'|'subjectId'|'chapterId'>):MindMapTarget[]{
 const chapterId=question.chapterId??(questionChapterOverrides as Record<string,string>)[question.id];
 const chapter=mindMapChapterLocation(chapterId);
 const focusLabel=chapterById(chapterId)?.zh;
 const primaryId=primaryMapBySubject[question.subjectId];
 const ids=[primaryId];
 if((chapterId&&chapterId in taxChapterPositions)||question.id in taxQuestionPositions)ids.push('taxation');
 return ids.flatMap(id=>catalog.filter(map=>map.id===id).map(map=>{
  const specific=questionPositions[question.id];
  const top=map.id==='taxation'?taxQuestionPositions[question.id]??taxChapterPositions[chapterId??'']:specific?.mapId===map.id?specific.top:chapter?.mapId===map.id?chapter.top:undefined;
  const label=map.id==='taxation'&&question.id in taxQuestionPositions?'资本利得税':specific?.mapId===map.id?specific.label:focusLabel;
  return {...map,...(top!==undefined?{top,focusLabel:label}: {})};
 }));
}

export function mindMapPageUrl(id?:string,top?:number,focusLabel?:string){
 if(!id)return 'mindmaps/index.html';
 const params=new URLSearchParams({map:id});
 if(top!==undefined){params.set('top',String(top));if(focusLabel)params.set('focus',focusLabel);}
 return `mindmaps/index.html?${params}`;
}
