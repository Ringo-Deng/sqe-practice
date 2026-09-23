'use client';

import {useEffect,useState} from 'react';
import {CalendarDays,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {daysUntilExam,validExamDate} from '@/lib/exam-countdown';

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
 return <section className={`exam-countdown-card is-${state}`} aria-labelledby="exam-countdown-title">
  <div className="exam-countdown-heading"><CalendarDays size={18}/><h2 id="exam-countdown-title">目标考期</h2></div>
  <div className="exam-countdown-controls">
   <label className="sr-only" htmlFor="exam-target-date">目标日期</label>
   <input id="exam-target-date" type="date" value={targetDate??''} onChange={event=>update(event.target.value)} aria-describedby={error?'exam-countdown-error':undefined}/>
   {targetDate&&<Button type="button" variant="ghost" size="icon" onClick={()=>update('')} aria-label="清除目标日期" title="清除目标日期"><X size={14}/></Button>}
  </div>
  <div className="exam-countdown-result" role="status" aria-live="polite">
   {days===null?<span className="exam-countdown-placeholder">设置日期，开始倒计时</span>:days===0?<span className="exam-countdown-today">今天是目标日</span>:<><span>{days>0?'距离目标还有':'目标日已过'}</span><strong>{Math.abs(days)}</strong><span>天</span></>}
  </div>
  {error&&<p id="exam-countdown-error" className="exam-countdown-error" role="alert">{error}</p>}
 </section>;
}
