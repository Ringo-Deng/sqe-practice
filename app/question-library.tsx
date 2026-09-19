'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,Check,ChevronRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {subjects,subjectById} from '@/lib/subjects';
import {questionSources,sourceById} from '@/lib/question-sources';
import {chapters,filterQuestions} from '@/lib/chapters';
import {defaultLibrarySelection,readLibrarySelection,writeLibrarySelection,type LibrarySelection} from '@/lib/library-selection';
import type {StudyData,Session} from '@/lib/study-types';

export function QuestionLibrary({data,busy,onStart,onResume}:{data:StudyData;busy:boolean;onStart:(subjectId?:string,sourceId?:string,chapterId?:string,sourceSet?:string)=>void;onResume:(session:Session)=>void}){
 const[{source,chosen},setSelection]=useState(defaultLibrarySelection);
 useEffect(()=>{
  // Restore after hydration so the server and initial browser markup match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setSelection(readLibrarySelection());
 },[]);
 const choose=(selection:LibrarySelection)=>{setSelection(selection);writeLibrarySelection(selection);};
 const sourceQs=data.questions.filter(q=>source==='all'||q.sourceId===source);
 const subject=subjectById(chosen??undefined);
 const qs=sourceQs.filter(q=>q.subjectId===chosen);
 const sourceName=sourceById(source)?.name??'全部来源';
 const practiced=new Set(data.sessions.filter(s=>s.mode!=='exam'||s.status==='finished').flatMap(s=>Object.entries(s.answers).filter(([,a])=>a.selected).map(([id])=>id)));
 const exactSession=(items:typeof sourceQs)=>data.sessions.find(s=>s.status==='active'&&s.mode==='practice'&&s.questionIds.length===items.length&&s.questionIds.every(id=>items.some(q=>q.id===id)));
 const resume=exactSession(qs);
 const count=(id:string)=>sourceQs.filter(q=>q.subjectId===id).length;
 const sourceArg=source;
 const subjectChapters=chapters.filter(c=>c.subjectId===subject?.id);
 const chapterGroups=subjectChapters.reduce<{bookId:string;bookZh:string;bookEn:string;items:typeof subjectChapters}[]>((groups,chapter)=>{
  const existing=groups.find(group=>group.bookId===chapter.bookId);
  if(existing)existing.items.push(chapter);
  else groups.push({bookId:chapter.bookId,bookZh:chapter.bookZh,bookEn:chapter.bookEn,items:[chapter]});
  return groups;
 },[]);
 return <div className="library-page">
  <h1 className="sr-only">题库分类</h1>
  <section className="source-section" aria-label="题目来源">
   <h2>题目来源</h2>
   <div className="source-grid">{[{id:'all',name:'全部来源',description:'跨来源练习'},...questionSources.filter(item=>item.id!=='oup')].map(s=>{const total=data.questions.filter(q=>s.id==='all'||q.sourceId===s.id).length;return <button key={s.id} type="button" aria-pressed={source===s.id} className={`source-card ${source===s.id?'active':''}`} onClick={()=>choose({source:s.id,chosen:null})}><span>{s.name}{source===s.id&&<Check size={16}/>}</span><small>{total?`${total} 题`:'待导入'}</small></button>;})}</div>
   {!sourceQs.length&&<p className="source-empty">上传这套题库后，题目会按来源和科目归入这里。</p>}
  </section>
  <div className="library-toolbar"><h2>FLK1</h2></div>
  <div className="subject-grid">{subjects.filter(s=>s.group==='FLK1').map(s=><button type="button" key={s.id} className={`subject-card ${s.id===chosen?'active':''}`} aria-pressed={s.id===chosen} onClick={()=>{choose({source,chosen:s.id});requestAnimationFrame(()=>document.getElementById('subject-detail')?.scrollIntoView({block:'start'}));}}><div className="subject-top"><h3>{s.zh}</h3>{count(s.id)>0?<span className="subject-available">{count(s.id)} 题可练</span>:<span className="subject-empty">待导入</span>}</div><p className="subject-en" lang="en">{s.en}</p><div className="subject-bottom"><span>{count(s.id)>0?`${sourceQs.filter(q=>q.subjectId===s.id&&practiced.has(q.id)).length} / ${count(s.id)} 题已练`:'0 题'}</span>{s.id===chosen?<Check size={16}/>:<ChevronRight size={16}/>}</div></button>)}</div>
  <div className="library-toolbar library-group-second"><h2>FLK2</h2></div>
  <div className="subject-grid">{subjects.filter(s=>s.group==='FLK2').map(s=><button type="button" key={s.id} className={`subject-card ${s.id===chosen?'active':''}`} aria-pressed={s.id===chosen} onClick={()=>{choose({source,chosen:s.id});requestAnimationFrame(()=>document.getElementById('subject-detail')?.scrollIntoView({block:'start'}));}}><div className="subject-top"><h3>{s.zh}</h3>{count(s.id)>0?<span className="subject-available">{count(s.id)} 题可练</span>:<span className="subject-empty">待导入</span>}</div><p className="subject-en" lang="en">{s.en}</p><div className="subject-bottom"><span>{count(s.id)>0?`${sourceQs.filter(q=>q.subjectId===s.id&&practiced.has(q.id)).length} / ${count(s.id)} 题已练`:'0 题'}</span>{s.id===chosen?<Check size={16}/>:<ChevronRight size={16}/>}</div></button>)}</div>
  {subject&&<section id="subject-detail" className="subject-detail" aria-live="polite"><div className="subject-detail-heading"><div><div className="eyebrow">{subject.id==='legal-services'?'FLK1 / 跨科职业道德':subject.group} / {sourceName}</div><h2>{subject.zh}<span>{qs.length} 题</span></h2></div>{qs.length>0&&<div className="subject-actions">{resume&&<Button disabled={busy} variant="outline" onClick={()=>onResume(resume)}>继续上次练习</Button>}<Button disabled={busy} onClick={()=>onStart(subject.id,sourceArg)}>开始本科练习<ArrowRight size={16}/></Button></div>}</div>
   {(subject.id==='legal-services'||subject.id==='accounts')&&<p className="subject-scope">{subject.scope}</p>}
   {qs.some(q=>q.chapterId)&&!!chapterGroups.length&&<div className="chapter-section compact-chapter-section">{chapterGroups.map(group=><section className="chapter-book" key={group.bookId} aria-label={group.bookZh}>{chapterGroups.length>1&&<div className="chapter-book-heading"><h4>{group.bookZh}</h4></div>}<div className="chapter-grid">{group.items.map(c=>{const items=filterQuestions(qs,{chapterId:c.id});const previous=exactSession(items);return <div className={`chapter-card ${items.length?'':'chapter-empty'}`} key={c.id}><div className="chapter-info"><span className="chapter-number">{String(c.number).padStart(2,'0')}</span><div className="chapter-copy"><h4>{c.zh}</h4><p lang="en">{c.en}</p></div></div><div className="chapter-actions"><div className="chapter-action-buttons">{previous&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>onResume(previous)}>继续</Button>}<Button size="sm" variant="outline" disabled={busy||!items.length} onClick={()=>onStart(subject.id,sourceArg,c.id)} aria-label={`练习${group.bookZh}${c.kind==='syllabus'?'专题':`第${c.number}章`}${c.zh}`}>{items.length?`练习 ${items.length} 题`:'待导入'}</Button></div><small className="chapter-progress">{items.length?`${items.filter(q=>practiced.has(q.id)).length} / ${items.length} 题已练`:'暂无题目'}</small></div></div>;})}</div></section>)}</div>}
  </section>}
 </div>;
}
