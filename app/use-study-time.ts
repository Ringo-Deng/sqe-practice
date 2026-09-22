'use client';

import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {subjects} from '@/lib/subjects';
import {activeMilliseconds} from '@/lib/study-time';
export {formatStudyTime} from '@/lib/study-time';

const ENABLED_KEY='sqe-practice:study-time-enabled:v1';
const ENTRY_PREFIX='sqe-practice:study-time:v1:';
const SETTING_EVENT='sqe-practice:study-time-setting';
const TOTALS_EVENT='sqe-practice:study-time-totals';
const SAVE_INTERVAL_MS=30*1000;
const subjectIds=new Set(subjects.map(subject=>subject.id));
let memoryEnabled:boolean|null=null;

function subscribeSetting(notify:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===ENABLED_KEY){memoryEnabled=null;notify();}};
 window.addEventListener('storage',storage);
 window.addEventListener(SETTING_EVENT,notify);
 return()=>{window.removeEventListener('storage',storage);window.removeEventListener(SETTING_EVENT,notify);};
}
const subscribeHydration=()=>()=>{};

type Entry={version:1;milliseconds:Record<string,number>};

function readEnabled(){
 if(memoryEnabled!==null)return memoryEnabled;
 try{return window.localStorage.getItem(ENABLED_KEY)!=='false';}catch{return true;}
}

export function useStudyTimeSetting(){
 const enabled=useSyncExternalStore(subscribeSetting,readEnabled,()=>true);
 const ready=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
 const[error,setError]=useState('');
 const update=useCallback((value:boolean)=>{
  memoryEnabled=value;
  try{window.localStorage.setItem(ENABLED_KEY,String(value));setError('');}
  catch{setError('设置已在当前页面生效，但浏览器未能保存；刷新后可能恢复默认。');}
  window.dispatchEvent(new Event(SETTING_EVENT));
 },[]);
 return {enabled,ready,error,update};
}

export function readStudyTimeTotals():Record<string,number>{
 const totals:Record<string,number>={};
 try{
  for(let index=0;index<window.localStorage.length;index++){
   const key=window.localStorage.key(index);
   if(!key?.startsWith(ENTRY_PREFIX))continue;
   let entry:Partial<Entry>|null;
   try{entry=JSON.parse(window.localStorage.getItem(key)??'null') as Partial<Entry>|null;}
   catch{continue;}
   if(entry?.version!==1||!entry.milliseconds||typeof entry.milliseconds!=='object')continue;
   for(const [subjectId,value] of Object.entries(entry.milliseconds)){
    if(subjectIds.has(subjectId)&&typeof value==='number'&&Number.isFinite(value)&&value>=0)totals[subjectId]=(totals[subjectId]??0)+value;
   }
  }
 }catch{/* Reading time never blocks the study page. */}
 return totals;
}

export function useStudyTimeTotals(active:boolean){
 const[totals,setTotals]=useState<Record<string,number>>({});
 useEffect(()=>{
  if(!active)return;
  const refresh=()=>setTotals(readStudyTimeTotals());
  refresh();
  const storage=(event:StorageEvent)=>{if(event.key?.startsWith(ENTRY_PREFIX))refresh();};
  window.addEventListener('storage',storage);
  window.addEventListener(TOTALS_EVENT,refresh);
  return()=>{window.removeEventListener('storage',storage);window.removeEventListener(TOTALS_EVENT,refresh);};
 },[active]);
 return totals;
}

export function useSubjectStudyTime(subjectId:string|null,enabled:boolean,ready:boolean){
 const entryId=useRef<string|null>(null);
 const entry=useRef<Entry>({version:1,milliseconds:{}});
 const[error,setError]=useState('');
 useEffect(()=>{
  if(!ready||!enabled||!subjectId||!subjectIds.has(subjectId))return;
  if(!entryId.current)entryId.current=`${ENTRY_PREFIX}${crypto.randomUUID()}`;
  let lastAccountedAt=Date.now();
  let lastActivityAt=lastAccountedAt;
  let running=document.visibilityState==='visible'&&document.hasFocus();
  let dirty=false;
  const settle=(now:number)=>{
   if(running){
    const duration=activeMilliseconds(lastAccountedAt,lastActivityAt,now);
    if(duration){entry.current.milliseconds[subjectId]=(entry.current.milliseconds[subjectId]??0)+duration;dirty=true;}
   }
   lastAccountedAt=now;
  };
  const save=()=>{
   if(!dirty)return;
   try{window.localStorage.setItem(entryId.current!,JSON.stringify(entry.current));dirty=false;setError('');window.dispatchEvent(new Event(TOTALS_EVENT));}
   catch{setError('浏览器无法保存学习时长，请检查是否允许本站使用本机存储。');}
  };
  const activity=()=>{
   const now=Date.now();
   settle(now);
   running=document.visibilityState==='visible'&&document.hasFocus();
   lastActivityAt=now;lastAccountedAt=now;
  };
  const focus=()=>{running=document.visibilityState==='visible'&&document.hasFocus();lastAccountedAt=Date.now();lastActivityAt=lastAccountedAt;};
  const blur=()=>{settle(Date.now());running=false;save();};
  const visibility=()=>{if(document.visibilityState==='visible')focus();else blur();};
  const tick=()=>{settle(Date.now());save();};
  window.addEventListener('pointerdown',activity,{passive:true});
  window.addEventListener('keydown',activity);
  window.addEventListener('scroll',activity,{capture:true,passive:true});
  window.addEventListener('focus',focus);
  window.addEventListener('blur',blur);
  window.addEventListener('pagehide',blur);
  document.addEventListener('visibilitychange',visibility);
  const interval=window.setInterval(tick,SAVE_INTERVAL_MS);
  return()=>{
   settle(Date.now());save();window.clearInterval(interval);
   window.removeEventListener('pointerdown',activity);
   window.removeEventListener('keydown',activity);
   window.removeEventListener('scroll',activity,true);
   window.removeEventListener('focus',focus);
   window.removeEventListener('blur',blur);
   window.removeEventListener('pagehide',blur);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[subjectId,enabled,ready]);
 return error;
}
