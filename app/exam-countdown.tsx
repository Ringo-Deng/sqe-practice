'use client';

import {useEffect,useState} from 'react';
import {CalendarDays,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {daysUntilExam,formatExamDate,validExamDate} from '@/lib/exam-countdown';

const TARGET_DATE_KEY='sqe-practice:exam-target-date:v1';

function savedTargetDate(){
 try{const value=window.localStorage.getItem(TARGET_DATE_KEY);return validExamDate(value)?value:null;}
 catch{return null;}
}

function sameLocalDay(left:Date,right:Date){
 return left.getFullYear()===right.getFullYear()&&left.getMonth()===right.getMonth()&&left.getDate()===right.getDate();
}

export function ExamCountdown(){
 const[targetDate,setTargetDate]=useState<string|null>(()=>typeof window==='undefined'?null:savedTargetDate());
 const[today,setToday]=useState(()=>new Date());
 const[error,setError]=useState('');

 useEffect(()=>{
  const refreshDay=()=>{const current=new Date();setToday(previous=>sameLocalDay(previous,current)?previous:current);};
  const storage=(event:StorageEvent)=>{if(event.key===TARGET_DATE_KEY)setTargetDate(savedTargetDate());};
  const timer=window.setInterval(refreshDay,60_000);
  window.addEventListener('focus',refreshDay);
  window.addEventListener('storage',storage);
  document.addEventListener('visibilitychange',refreshDay);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',refreshDay);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',refreshDay);};
 },[]);

 function update(value:string){
  if(value&&!validExamDate(value)){setError('请选择有效的日期。');return;}
  setTargetDate(value||null);
  try{
   if(value)window.localStorage.setItem(TARGET_DATE_KEY,value);
   else window.localStorage.removeItem(TARGET_DATE_KEY);
   setError('');
  }catch{setError('日期已在当前页面生效，但浏览器未能保存；刷新后可能恢复原值。');}
 }

 const days=targetDate?daysUntilExam(targetDate,today):null;
 const state=days===null?'empty':days>0?'future':days===0?'today':'past';
 return <section className={`exam-countdown-card ${state}`} aria-labelledby="exam-countdown-title">
  <div className="exam-countdown-main">
   <div className="exam-countdown-kicker"><CalendarDays size={16}/><span>我的考期计划</span></div>
   <h2 id="exam-countdown-title">目标日倒计时</h2>
   <p>选定计划考期，查看距离目标还有多少天。</p>
   <div className="exam-countdown-controls">
    <label htmlFor="exam-target-date">目标日期</label>
    <input id="exam-target-date" type="date" value={targetDate??''} onChange={event=>update(event.target.value)} aria-describedby={error?'exam-countdown-error':undefined}/>
    {targetDate&&<Button type="button" variant="ghost" size="sm" onClick={()=>update('')} aria-label="清除目标日期"><X size={15}/>清除</Button>}
   </div>
   {error&&<p id="exam-countdown-error" className="exam-countdown-error" role="alert">{error}</p>}
  </div>
  <div className="exam-countdown-result" role="status" aria-live="polite">
   {days===null?<><span className="exam-countdown-result-label">等待你的目标</span><strong className="exam-countdown-number">—</strong><small>设置日期后开始倒计时</small></>:<><span className="exam-countdown-result-label">{days>0?'距离目标日':days===0?'目标日已到':'目标日已过'}</span><div className="exam-countdown-number-line"><strong className="exam-countdown-number">{Math.abs(days)}</strong><span>天</span></div><small>{days===0?'今天是目标日':formatExamDate(targetDate!)}</small></>}
  </div>
 </section>;
}
