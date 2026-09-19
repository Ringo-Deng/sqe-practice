'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {textbookById} from '@/lib/textbooks';
import {GUEST_TEXTBOOK_BOOKMARKS_KEY,mutateGuestTextbookBookmarks,parseBookmarkMutation,readGuestTextbookBookmarks,type BookmarkBook,type TextbookBookmarkData} from '@/lib/textbook-bookmarks';

const GUEST_TEXTBOOK_DB='sqe-practice-guest-v1';
let guestMutationQueue:Promise<unknown>=Promise.resolve();
function withGuestBookmarkLock<T>(task:()=>Promise<T>):Promise<T>{
 const run=async():Promise<T>=>navigator.locks?.request?await navigator.locks.request(GUEST_TEXTBOOK_BOOKMARKS_KEY,task):await task();
 const pending=guestMutationQueue.then(run,run);
 guestMutationQueue=pending.catch(()=>{});
 return pending;
}
async function guestBook(bookId:string):Promise<BookmarkBook|undefined>{
 const builtIn=textbookById(bookId);
 if(builtIn)return builtIn;
 return new Promise((resolve,reject)=>{
  let absent=false;
  const request=indexedDB.open(GUEST_TEXTBOOK_DB,1);
  // Do not create or change the imported textbook store just to validate a bookmark.
  request.onupgradeneeded=()=>{absent=true;request.transaction?.abort();};
  request.onerror=()=>absent?resolve(undefined):reject(new Error('暂时无法读取这本本机教材，请重试。'));
  request.onblocked=()=>reject(new Error('本机教材正在其他页面更新，请稍后重试。'));
  request.onsuccess=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('textbooks')){db.close();resolve(undefined);return;}
   try{
    const lookup=db.transaction('textbooks','readonly').objectStore('textbooks').get(bookId);
    lookup.onsuccess=()=>{const row=lookup.result;db.close();resolve(row&&row.id===bookId&&Number.isSafeInteger(row.pageCount)?{id:row.id,pageCount:row.pageCount}:undefined);};
    lookup.onerror=()=>{db.close();reject(new Error('暂时无法读取这本本机教材，请重试。'));};
   }catch(error){db.close();reject(error);}
  };
 });
}

export function useTextbookBookmarks(guest=false){
 const[data,setData]=useState<TextbookBookmarkData|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false),generation=useRef(0),active=useRef(true),refreshPending=useRef(false);
 const refreshRef=useRef<()=>Promise<void>>(async()=>{});
 const request=useCallback(async(body?:Record<string,unknown>):Promise<TextbookBookmarkData>=>{
  if(guest){
   if(!body)return readGuestTextbookBookmarks(localStorage);
   return withGuestBookmarkLock(async()=>{
    const mutation=parseBookmarkMutation(body);
    const book=await guestBook(mutation.bookId);
    return mutateGuestTextbookBookmarks(localStorage,body,book);
   });
  }
  const response=await fetch('/api/textbook-bookmarks',body?{method:'POST',headers:{'Content-Type':'application/json','X-Study-Action':'1'},body:JSON.stringify(body)}:{cache:'no-store'});
  const value=await response.json().catch(()=>{throw new Error('服务器没有返回可读取的书签，请重试。');}) as TextbookBookmarkData&{error?:string};
  if(!response.ok)throw new Error(value.error||'暂时无法读取教材书签，请重试。');
  if(!Array.isArray(value.bookmarks))throw new Error('服务器没有返回可读取的书签，请重试。');
  return value;
 },[guest]);
 const load=useCallback(async()=>{
  if(locked.current){refreshPending.current=true;return;}
  const run=++generation.current;setLoading(true);
  try{const value=await request();if(active.current&&run===generation.current){setData(value);setError('');}}
  catch(caught){if(active.current&&run===generation.current)setError((caught as Error).message);}
  finally{if(active.current&&run===generation.current)setLoading(false);}
 },[request]);
 const mutate=useCallback(async(body:Record<string,unknown>)=>{
  if(locked.current)return undefined;
  locked.current=true;refreshPending.current=false;
  const run=++generation.current;setLoading(false);setBusy(true);setError('');
  try{
   const value=await request(body);
   if(!active.current||run!==generation.current)return undefined;
   setData(value);return value;
  }catch(caught){
   if(active.current&&run===generation.current){const message=(caught as Error).message;setError(message);toast.error(message);}
   return undefined;
  }finally{
   locked.current=false;
   if(active.current){setBusy(false);if(refreshPending.current){refreshPending.current=false;void refreshRef.current();}}
  }
 },[request]);
 useEffect(()=>{
  active.current=true;++generation.current;refreshRef.current=load;
  const initialLoad=window.setTimeout(()=>void load(),0);
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  const storage=(event:StorageEvent)=>{if(guest&&(event.key===GUEST_TEXTBOOK_BOOKMARKS_KEY||event.key===null))void load();};
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('storage',storage);
  return()=>{active.current=false;window.clearTimeout(initialLoad);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('storage',storage);};
 },[guest,load]);
 return {data,loading,busy,error,load,mutate};
}
export type TextbookBookmarksController=ReturnType<typeof useTextbookBookmarks>;
