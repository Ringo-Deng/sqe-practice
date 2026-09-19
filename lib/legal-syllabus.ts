import type {Chapter} from './chapters';
import type {Question} from './study-types';

// SRA specification effective 1 September 2026. These are study topics, not
// publisher chapter numbers. Original chapter IDs and textbook links survive.
export const legalSyllabusChapters:Chapter[]=[
 {id:'legal-services-sra-regulation',number:1,zh:'SRA 监管与平等义务',en:'SRA regulation and equality obligations'},
 {id:'legal-services-aml',number:2,zh:'反洗钱',en:'Money laundering'},
 {id:'legal-services-financial-services',number:3,zh:'金融服务',en:'Financial services'},
 {id:'legal-services-funding',number:4,zh:'法律服务费用与资助',en:'Funding options for legal services'},
 {id:'legal-services-sra-principles',number:5,zh:'SRA 原则',en:'SRA Principles'},
 {id:'legal-services-code-of-conduct',number:6,zh:'SRA 行为准则与实务中的职业道德',en:'SRA Codes of Conduct and ethics in practice'},
].map(topic=>({
 ...topic,subjectId:'legal-services',kind:'syllabus' as const,
 bookId:topic.number<=4?'syllabus-legal-services':'syllabus-ethics',
 bookZh:topic.number<=4?'法律服务 · FLK1':'职业道德与专业行为 · FLK1 / FLK2',
 bookEn:topic.number<=4?'Legal Services':'Ethics and Professional Conduct',
}));

// Explicit, reviewed exceptions to the old publisher-chapter classification.
// Do not infer a question's primary topic from incidental words in its scenario.
const overrides:Record<string,{subjectId?:string;chapterId:string}>={
 'sra-flk1-original-031':{chapterId:'legal-services-sra-regulation'},
 'sra-flk1-pretested-059':{chapterId:'legal-services-sra-regulation'},
 'revise-flk1-2025-26-s1-070':{chapterId:'legal-services-sra-regulation'},
 'revise-flk1-2025-26-s2-080':{chapterId:'legal-services-sra-regulation'},
 'revise-chapter-legal-system-services-c06-q1':{chapterId:'legal-services-sra-regulation'},
 'revise-chapter-legal-system-services-c06-q2':{chapterId:'legal-services-sra-regulation'},
 'sra-flk1-pretested-053':{chapterId:'legal-services-code-of-conduct'},
 'sra-flk1-pretested-104':{chapterId:'legal-services-code-of-conduct'},
 'revise-flk1-2025-26-s1-043':{chapterId:'legal-services-code-of-conduct'},
 'revise-flk1-2025-26-s1-074':{chapterId:'legal-services-code-of-conduct'},
 'revise-flk1-2025-26-s1-077':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-01-q014':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-01-q027':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-04-q001':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-05-q074':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-05-q033':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-28-q017':{chapterId:'legal-services-sra-principles'},
 'qlts-mock-28-q019':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-28-q028':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-28-q037':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-28-q045':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-28-q058':{chapterId:'legal-services-code-of-conduct'},
 'qlts-mock-28-q060':{chapterId:'legal-services-aml'},
 'sra-flk1-original-022':{chapterId:'legal-services-funding'},
 'revise-flk1-2025-26-s2-026':{chapterId:'legal-services-aml'},
 'sra-flk2-pretested-105':{chapterId:'legal-services-sra-regulation'},
 // Criminal legal aid is in Criminal Practice under the current FLK, even
 // when the source assessment or book originally placed it in Legal Services.
 'sra-flk1-pretested-080':{subjectId:'criminal-practice',chapterId:'criminal-practice-01'},
 'revise-flk1-2025-26-s2-066':{subjectId:'criminal-practice',chapterId:'criminal-practice-03'},
 'qlts-mock-01-q090':{subjectId:'business',chapterId:'business-02'},
 'qlts-mock-05-q069':{subjectId:'business',chapterId:'business-03'},
 'revise-flk2-practice-s2-077':{subjectId:'accounts',chapterId:'accounts-02'},
 'revise-flk2-practice-s2-079':{subjectId:'accounts',chapterId:'accounts-03'},
 'revise-chapter-ethics-c08-q1':{subjectId:'accounts',chapterId:'accounts-06'},
};

const chapterTopics:Record<string,string>={
 'legal-services-lss-05':'legal-services-sra-regulation',
 'legal-services-lss-06':'legal-services-aml',
 'legal-services-lss-07':'legal-services-financial-services',
 'legal-services-lss-08':'legal-services-funding',
 'legal-services-ethics-01':'legal-services-sra-principles',
 'flk2-ethics-01':'legal-services-sra-principles',
};

export function classifyLegalQuestion<T extends Question>(question:T):T{
 if(question.subjectId!=='legal-services'&&question.subjectId!=='flk2-ethics')return question;
 const override=overrides[question.id];
 const chapterId=override?.chapterId??chapterTopics[question.chapterId??'']??'legal-services-code-of-conduct';
 return {
  ...question,
  originalSubjectId:question.subjectId,
  originalChapterId:question.chapterId,
  subjectId:override?.subjectId??'legal-services',
  chapterId,
  ...(chapterId==='legal-services-sra-principles'||chapterId==='legal-services-code-of-conduct'?{assessmentScope:'FLK1 / FLK2' as const}:{}),
 };
}
