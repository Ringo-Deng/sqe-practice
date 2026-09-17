'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import type {TextbookAnnotationData} from '@/lib/textbook-annotations';

export function useTextbookAnnotations(){
 const[data,setData]=useState<TextbookAnnotationData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false),generation=useRef(0);
 const request=useCallback(async(body?:Record<string,unknown>)=>{
  const response=await fetch('/api/textbook-annotations',body?{method:'POST',headers:{'Content-Type':'application/json','X-Study-Action':'1'},body:JSON.stringify(body)}:{cache:'no-store'});
  const value=await response.json() as TextbookAnnotationData&{error?:string};
  if(!response.ok)throw new Error(value.error||'暂时无法读取教材笔记，请重试。');
  return value;
 },[]);
 const load=useCallback(async()=>{
  if(locked.current)return;const run=++generation.current;setLoading(true);
  try{const value=await request();if(run===generation.current){setData(value);setError('');}}
  catch(e){if(run===generation.current)setError((e as Error).message);}
  finally{if(run===generation.current)setLoading(false);}
 },[request]);
 const mutate=useCallback(async(body:Record<string,unknown>)=>{
  if(locked.current)return;locked.current=true;++generation.current;setLoading(false);setBusy(true);setError('');
  try{const value=await request(body);setData(value);return value;}
  catch(e){setError((e as Error).message);toast.error((e as Error).message);return undefined;}
  finally{locked.current=false;setBusy(false);}
 },[request]);
 useEffect(()=>{void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[load]);
 return {data,loading,busy,error,load,mutate};
}
export type TextbookAnnotationsController=ReturnType<typeof useTextbookAnnotations>;
