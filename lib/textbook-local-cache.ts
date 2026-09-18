import {textbookPageSource,type Textbook} from './textbooks';

const CACHE_NAME='sqe-practice-textbooks-v1';

export function canSaveTextbookLocally(book:Textbook){
 return !book.imported&&!book.pageUrlTemplate&&!!book.url;
}

function cacheAvailable(){return typeof window!=='undefined'&&'caches' in window;}
function sourceUrl(book:Textbook){return textbookPageSource(book,1).url;}

export async function isTextbookSavedLocally(book:Textbook){
 if(!canSaveTextbookLocally(book)||!cacheAvailable())return false;
 try{return !!(await caches.open(CACHE_NAME)).match(sourceUrl(book));}catch{return false;}
}

export async function saveTextbookLocally(book:Textbook){
 if(!canSaveTextbookLocally(book))throw new Error('这本教材已经保存在本机，或暂不支持离线保存。');
 if(!cacheAvailable())throw new Error('当前浏览器不支持保存教材，请使用最新版 Chrome、Edge 或 Safari。');
 const url=sourceUrl(book),response=await fetch(url,{credentials:'same-origin'});
 if(!response.ok)throw new Error(`教材下载失败（${response.status}），请检查网络后重试。`);
 try{await (await caches.open(CACHE_NAME)).put(url,response);}catch{throw new Error('浏览器无法保存这本教材，请检查可用空间或网站存储权限。');}
 try{await navigator.storage?.persist?.();}catch{/* Browser persistence is best-effort. */}
}

export async function readSavedTextbook(url:string){
 if(!cacheAvailable()||!/^https?:/i.test(url))return undefined;
 try{
  const response=await (await caches.open(CACHE_NAME)).match(url);
  return response?new Uint8Array(await response.arrayBuffer()):undefined;
 }catch{return undefined;}
}
