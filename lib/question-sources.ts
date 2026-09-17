export type QuestionSource={id:string;name:string;description:string};
export const questionSources:QuestionSource[]=[
 {id:'sra',name:'SRA 官方',description:'官方公开样题'},
 {id:'revise',name:'Revise SQE',description:'Revise 教材与练习题'},
 {id:'qlts',name:'QLTS',description:'QLTS 模拟题'},
 {id:'oup',name:'OUP',description:'Oxford University Press 题库'}
];
export const sourceById=(id?:string)=>questionSources.find(s=>s.id===id);
export const questionNumberLabel=(q:{number:number;sourceSession?:number})=>q.sourceSession?`Session ${q.sourceSession} · Q${q.number}`:`原题 ${q.number}`;
export const reviseAssessmentSessions=[
 ...[1,2].map(session=>({id:`revise-flk1-2025-26-session-${session}`,session,name:`FLK1 · Session ${session}`,edition:'FLK1 Practice Assessment · 2025–26',details:'原题 Q1–90 · 原书解析 · 中文译文'})),
 ...[1,2].map(session=>({id:`revise-flk2-practice-session-${session}`,session,name:`FLK2 · Session ${session}`,edition:'FLK2 Practice Assessment',details:'原题 Q1–90 · 原书英文解析 · Revise 章节定位'})),
];
export const officialSamplesUrl='https://sqe.sra.org.uk/assessments/sqe1-assessments/sqe1-sample-questions';
// Source collections; imported counts are calculated from actual question records.
export const officialSampleFiles=[
 {id:'sra-flk1-original',group:'FLK1',name:'原始样题',range:'Q1–45',count:45,url:'https://sqe.sra.org.uk/docs/default-source/pdfs/sqe1-flk1-original-sample-qs-updated-2-april-26.pdf?sfvrsn=87c505c7_2'},
 {id:'sra-flk1-pretested',group:'FLK1',name:'Pre-tested 样题',range:'Q46–110',count:65,url:'https://sqe.sra.org.uk/docs/default-source/pdfs/sqe1-flk1-sample-set-qs-updated-2-april-26.pdf?sfvrsn=7c7fa98e_2'},
 {id:'sra-flk2-original',group:'FLK2',name:'原始样题',range:'Q1–45',count:45,url:'https://sqe.sra.org.uk/docs/default-source/pdfs/sqe1-flk2-original-sample-qs-updated-2-april-26.pdf?sfvrsn=2d2c2f49_2'},
 {id:'sra-flk2-pretested',group:'FLK2',name:'Pre-tested 样题',range:'Q46–110',count:65,url:'https://sqe.sra.org.uk/docs/default-source/pdfs/sqe1-flk2-sample-set-qs-updated-2-april-26.pdf?sfvrsn=7aba6eb3_2'}
];
