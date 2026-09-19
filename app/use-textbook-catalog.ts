'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {toast} from 'sonner';
import {loadPdfEngine} from '@/lib/textbook-pdf';
import {isTextbookSubjectId,mergeTextbookCatalog,readGuestTextbookMetadata,saveGuestTextbookMetadata,updateTextbookCatalog,validateTextbookMetadata,type TextbookCatalogData} from '@/lib/textbook-catalog';
import {textbookById,type Textbook} from '@/lib/textbooks';

const MAX_PDF_BYTES=80*1024*1024;
const GUEST_DB='sqe-practice-guest-v1',GUEST_STORE='textbooks';
type StoredGuestTextbook={id:string;title:string;subjectId?:string;originalName:string;pageCount:number;sizeBytes:number;createdAt:number;updatedAt:number;revision:number;blob:Blob};
function guestDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(GUEST_DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(GUEST_STORE))request.result.createObjectStore(GUEST_STORE,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function guestTextbooks(){const db=await guestDb();try{return await new Promise<StoredGuestTextbook[]>((resolve,reject)=>{const request=db.transaction(GUEST_STORE).objectStore(GUEST_STORE).getAll();request.onsuccess=()=>resolve(request.result as StoredGuestTextbook[]);request.onerror=()=>reject(request.error);});}finally{db.close();}}
async function guestTextbook(id:string){const db=await guestDb();try{return await new Promise<StoredGuestTextbook|undefined>((resolve,reject)=>{const request=db.transaction(GUEST_STORE).objectStore(GUEST_STORE).get(id);request.onsuccess=()=>resolve(request.result as StoredGuestTextbook|undefined);request.onerror=()=>reject(request.error);});}finally{db.close();}}
async function putGuestTextbook(book:StoredGuestTextbook){const db=await guestDb();try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(GUEST_STORE,'readwrite');transaction.objectStore(GUEST_STORE).put(book);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});}finally{db.close();}}
export function useTextbookCatalog(guest=false){
 const[data,setData]=useState<TextbookCatalogData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false),objectUrls=useRef<string[]>([]);
 const books=useMemo(()=>mergeTextbookCatalog(data),[data]);
 const read=useCallback(async(options?:RequestInit,url='/api/textbooks')=>{
  const response=await fetch(url,options??{cache:'no-store'});const value=await response.json().catch(()=>({error:response.status===413?'PDF 文件过大，单份教材不能超过 80 MB。':'服务器没有返回可读取的结果，请重试。'})) as TextbookCatalogData&{error?:string};
  if(!response.ok)throw new Error(value.error||'暂时无法读取教材，请重试。');return value;
 },[]);
 const load=useCallback(async()=>{setLoading(true);try{
  if(guest){
   const rows=(await guestTextbooks()).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id));
   objectUrls.current.forEach(url=>URL.revokeObjectURL(url));objectUrls.current=[];
   const imported:Textbook[]=rows.map(row=>{const url=URL.createObjectURL(row.blob);objectUrls.current.push(url);return {id:row.id,title:row.title,shortTitle:row.title,subjectId:isTextbookSubjectId(row.subjectId)?row.subjectId:'my-materials',version:'本机 PDF',pageCount:row.pageCount,url,sha256:`guest-${row.id}`,pageUrlTemplate:'',imported:true,originalName:row.originalName,sizeBytes:row.sizeBytes,createdAt:row.createdAt};});
   setData({...readGuestTextbookMetadata(localStorage),imported});
  }else setData(await read());
  setError('');
 }catch(e){setError(guest?'暂时无法读取本机教材，请检查浏览器存储权限。':(e as Error).message);}finally{setLoading(false);}},[guest,read]);
 const updateBook=useCallback(async(id:string,title:string,subjectId:string)=>{
  if(locked.current)return false;locked.current=true;setBusy(true);setError('');
  try{
   const metadata=validateTextbookMetadata(title,subjectId);
   if(guest){
    if(textbookById(id))saveGuestTextbookMetadata(localStorage,id,metadata.title,metadata.subjectId);
    else{const stored=await guestTextbook(id);if(!stored)throw new Error('没有找到这本本机教材，请刷新后重试。');await putGuestTextbook({...stored,...metadata,updatedAt:Date.now(),revision:stored.revision+1});}
    setData(current=>updateTextbookCatalog(current,id,metadata.title,metadata.subjectId));
   }else{const value=await read({method:'POST',headers:{'Content-Type':'application/json','X-Study-Action':'1'},body:JSON.stringify({action:'update',id,...metadata})});setData(value);}
   toast.success('教材信息已保存');return true;
  }
  catch(e){setError((e as Error).message);toast.error((e as Error).message);return false;}finally{locked.current=false;setBusy(false);}
 },[guest,read]);
 const rename=useCallback((id:string,title:string)=>updateBook(id,title,books.find(book=>book.id===id)?.subjectId??'my-materials'),[books,updateBook]);
 const importPdf=useCallback(async(file:File,title:string)=>{
  if(locked.current)return false;if(file.size>MAX_PDF_BYTES){toast.error('单份教材暂支持 80 MB 以内的 PDF。');return false;}
  locked.current=true;setBusy(true);setError('');
  try{
   toast.loading('正在读取 PDF 页数…',{id:'textbook-import'});
   const lib=await loadPdfEngine(),task=lib.getDocument({data:await file.arrayBuffer(),useWasm:false});
   const pdf=await task.promise,pageCount=pdf.numPages;await task.destroy();
   toast.loading(guest?'正在保存到当前浏览器…':'正在导入教材…',{id:'textbook-import'});
   if(guest){const now=Date.now();await putGuestTextbook({id:crypto.randomUUID(),title,originalName:file.name,pageCount,sizeBytes:file.size,createdAt:now,updatedAt:now,revision:0,blob:file});await load();}
   else{const params=new URLSearchParams({title,pageCount:String(pageCount),fileName:file.name,size:String(file.size)});const value=await read({method:'POST',headers:{'Content-Type':'application/pdf','X-Study-Action':'1'},body:file},`/api/textbooks?${params}`);setData(value);}
   toast.success(`教材已导入，共 ${pageCount} 页`,{id:'textbook-import'});return true;
  }catch(e){setError((e as Error).message);toast.error((e as Error).message,{id:'textbook-import'});return false;}finally{locked.current=false;setBusy(false);}
 },[guest,load,read]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>()=>{objectUrls.current.forEach(url=>URL.revokeObjectURL(url));objectUrls.current=[];},[]);
 return {books,data,loading,busy,error,load,rename,updateBook,importPdf};
}
export type TextbookCatalogController=ReturnType<typeof useTextbookCatalog>;
