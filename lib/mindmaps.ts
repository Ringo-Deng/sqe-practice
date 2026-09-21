import catalog from '../public/mindmaps/catalog.json';
import type {Question} from './study-types';

export type MindMap=(typeof catalog)[number];

const primaryMapBySubject:Record<string,string>={
 business:'business',
 'legal-system':'legal-system',
 contract:'contract',
 dispute:'dispute',
 tort:'tort',
 'legal-services':'ethics',
 'criminal-liability':'criminal-law',
 'criminal-practice':'criminal-practice',
 land:'land-property',
 'property-practice':'land-property',
 trusts:'trusts',
 wills:'wills',
};

const taxChapters=new Set(['business-08','business-09','wills-10']);

export function mindMapsForQuestion(question:Pick<Question,'subjectId'|'chapterId'>):MindMap[]{
 const ids=[primaryMapBySubject[question.subjectId]];
 if(question.chapterId&&taxChapters.has(question.chapterId))ids.push('taxation');
 return ids.flatMap(id=>catalog.filter(map=>map.id===id));
}

export function mindMapPageUrl(id?:string){
 return `mindmaps/index.html${id?`?map=${encodeURIComponent(id)}`:''}`;
}
