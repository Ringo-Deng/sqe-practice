'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {toast} from 'sonner';
import {loadPdfEngine} from '@/lib/textbook-pdf';
import {mergeTextbookCatalog,type TextbookCatalogData} from '@/lib/textbook-catalog';

const MAX_PDF_BYTES=80*1024*1024;
export function useTextbookCatalog(){
 const[data,setData]=useState<TextbookCatalogData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false);
 const books=useMemo(()=>mergeTextbookCatalog(data),[data]);
 const read=useCallback(async(options?:RequestInit,url='/api/textbooks')=>{
  const response=await fetch(url,options??{cache:'no-store'});const value=await response.json().catch(()=>({error:response.status===413?'PDF 文件过大，单份教材不能超过 80 MB。':'服务器没有返回可读取的结果，请重试。'})) as TextbookCatalogData&{error?:string};
  if(!response.ok)throw new Error(value.error||'暂时无法读取教材，请重试。');return value;
 },[]);
 const load=useCallback(async()=>{setLoading(true);try{setData(await read());setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[read]);
 const rename=useCallback(async(id:string,title:string)=>{
  if(locked.current)return false;locked.current=true;setBusy(true);setError('');
  try{const value=await read({method:'POST',headers:{'Content-Type':'application/json','X-Study-Action':'1'},body:JSON.stringify({action:'rename',id,title})});setData(value);toast.success('教材名称已保存');return true;}
  catch(e){setError((e as Error).message);toast.error((e as Error).message);return false;}finally{locked.current=false;setBusy(false);}
 },[read]);
 const importPdf=useCallback(async(file:File,title:string)=>{
  if(locked.current)return false;if(file.size>MAX_PDF_BYTES){toast.error('单份教材暂支持 80 MB 以内的 PDF。');return false;}
  locked.current=true;setBusy(true);setError('');
  try{
   toast.loading('正在读取 PDF 页数…',{id:'textbook-import'});
   const lib=await loadPdfEngine(),task=lib.getDocument({data:await file.arrayBuffer(),useWasm:false});
   const pdf=await task.promise,pageCount=pdf.numPages;await task.destroy();
   toast.loading('正在导入教材…',{id:'textbook-import'});
   const params=new URLSearchParams({title,pageCount:String(pageCount),fileName:file.name,size:String(file.size)});
   const value=await read({method:'POST',headers:{'Content-Type':'application/pdf','X-Study-Action':'1'},body:file},`/api/textbooks?${params}`);setData(value);toast.success(`教材已导入，共 ${pageCount} 页`,{id:'textbook-import'});return true;
  }catch(e){setError((e as Error).message);toast.error((e as Error).message,{id:'textbook-import'});return false;}finally{locked.current=false;setBusy(false);}
 },[read]);
 useEffect(()=>{void load();},[load]);
 return {books,data,loading,busy,error,load,rename,importPdf};
}
export type TextbookCatalogController=ReturnType<typeof useTextbookCatalog>;
