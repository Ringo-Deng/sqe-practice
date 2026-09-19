import {subjectById} from './subjects';
import {textbookById,textbooks,type Textbook} from './textbooks';

export type TextbookCatalogData={titles:Record<string,string>;subjects?:Record<string,string>;imported:Textbook[]};
type TextbookMetadata={title:string;subjectId:string};
type GuestStorage=Pick<Storage,'getItem'|'setItem'>;
export const GUEST_TEXTBOOK_TITLES_KEY='sqe-practice:guest-textbook-titles:v1';
export const GUEST_TEXTBOOK_METADATA_KEY='sqe-practice:guest-textbook-metadata:v1';

export function isTextbookSubjectId(value:unknown):value is string{return typeof value==='string'&&(value==='my-materials'||!!subjectById(value));}
export function cleanTextbookTitle(value:unknown){return typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,120):'';}
export function validateTextbookMetadata(title:unknown,subjectId:unknown):TextbookMetadata{
 const cleanedTitle=cleanTextbookTitle(title);
 if(!cleanedTitle)throw new Error('教材名称不能为空。');
 if(!isTextbookSubjectId(subjectId))throw new Error('请选择有效的科目。');
 return {title:cleanedTitle,subjectId};
}

function readGuestMap(storage:GuestStorage,key:string):Record<string,unknown>{
 const raw=storage.getItem(key);if(raw===null)return {};
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid stored textbook metadata');
 return value as Record<string,unknown>;
}
export function readGuestTextbookMetadata(storage:GuestStorage):Pick<TextbookCatalogData,'titles'|'subjects'>{
 try{
  const legacy=readGuestMap(storage,GUEST_TEXTBOOK_TITLES_KEY),metadata=readGuestMap(storage,GUEST_TEXTBOOK_METADATA_KEY);
  const titles:Record<string,string>={},subjects:Record<string,string>={};
  for(const [id,title] of Object.entries(legacy)){if(typeof title!=='string')throw new Error('Invalid stored textbook title');titles[id]=title;}
  for(const [id,value] of Object.entries(metadata)){
   if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid stored textbook metadata');
   const entry=value as Record<string,unknown>,validated=validateTextbookMetadata(entry.title,entry.subjectId);
   titles[id]=validated.title;subjects[id]=validated.subjectId;
  }
  return {titles,subjects};
 }catch{throw new Error('暂时无法读取本机教材信息，请检查浏览器存储权限。');}
}
export function saveGuestTextbookMetadata(storage:GuestStorage,id:string,title:string,subjectId:string){
 const metadata=validateTextbookMetadata(title,subjectId);
 // Read both formats first so an unavailable or malformed store cannot erase prior edits.
 readGuestTextbookMetadata(storage);
 try{
  const current=readGuestMap(storage,GUEST_TEXTBOOK_METADATA_KEY);
  storage.setItem(GUEST_TEXTBOOK_METADATA_KEY,JSON.stringify({...current,[id]:metadata}));
 }catch{throw new Error('浏览器无法保存教材信息，请检查是否允许本站使用本机存储。');}
}

export function mergeTextbookCatalog(data?:TextbookCatalogData|null){
 const renamed=textbooks.map(book=>{
  const title=data?.titles[book.id]?.trim();
  const subjectId=data?.subjects?.[book.id];
  return title||isTextbookSubjectId(subjectId)?{...book,...(title?{title,shortTitle:title}:{}),...(isTextbookSubjectId(subjectId)?{subjectId}:{})}:book;
 });
 return [...renamed,...(data?.imported??[])];
}

export function updateTextbookCatalog(data:TextbookCatalogData|null,id:string,title:string,subjectId:string):TextbookCatalogData{
 const metadata=validateTextbookMetadata(title,subjectId),current=data??{titles:{},imported:[]};
 if(textbookById(id))return {...current,titles:{...current.titles,[id]:metadata.title},subjects:{...current.subjects,[id]:metadata.subjectId}};
 if(!current.imported.some(book=>book.id===id))throw new Error('没有找到这本教材，请刷新后重试。');
 return {...current,imported:current.imported.map(book=>book.id===id?{...book,...metadata,shortTitle:metadata.title}:book)};
}
