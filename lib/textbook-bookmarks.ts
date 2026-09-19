export type TextbookBookmark={bookId:string;page:number;note:string;createdAt:number;updatedAt:number;revision:number};
export type TextbookBookmarkDraft={bookId:string;page:number;note:string;revision?:number};
export type TextbookBookmarkData={bookmarks:TextbookBookmark[]};
export type TextbookBookmarkMutation=({action:'save'}&TextbookBookmarkDraft)|{action:'delete';bookId:string;page:number;revision:number};
export type BookmarkBook={id:string;pageCount:number};
export const GUEST_TEXTBOOK_BOOKMARKS_KEY='sqe-practice:guest-textbook-bookmarks:v1';
export const BOOKMARK_NOTE_LIMIT=10000;

export class TextbookBookmarkError extends Error{
 constructor(message:string,public status=400){super(message);this.name='TextbookBookmarkError';}
}

const validRevision=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
const validBookId=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=200;
const validPage=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=1;
const sorted=(bookmarks:TextbookBookmark[])=>[...bookmarks].sort((a,b)=>b.updatedAt-a.updatedAt||a.bookId.localeCompare(b.bookId)||a.page-b.page);

export function parseBookmarkMutation(body:Record<string,unknown>):TextbookBookmarkMutation{
 if(body.action!=='save'&&body.action!=='delete')throw new TextbookBookmarkError('未知的书签操作。');
 if(!validBookId(body.bookId)||!validPage(body.page))throw new TextbookBookmarkError('请选择有效的教材与页码。');
 if(body.action==='delete'){
  if(!validRevision(body.revision))throw new TextbookBookmarkError('书签版本无效，请刷新后重试。');
  return {action:'delete',bookId:body.bookId,page:body.page,revision:body.revision};
 }
 if(typeof body.note!=='string'||body.note.length>BOOKMARK_NOTE_LIMIT)throw new TextbookBookmarkError('书签备注最多 10,000 字。');
 if(body.revision!==undefined&&!validRevision(body.revision))throw new TextbookBookmarkError('书签版本无效，请刷新后重试。');
 return {action:'save',bookId:body.bookId,page:body.page,note:body.note.trim(),...(body.revision!==undefined?{revision:body.revision}:{})};
}

export function applyBookmarkMutation(data:TextbookBookmarkData,body:Record<string,unknown>,book:BookmarkBook|undefined,now=Date.now()):TextbookBookmarkData{
 const mutation=parseBookmarkMutation(body);
 if(!book||book.id!==mutation.bookId||!Number.isSafeInteger(book.pageCount)||mutation.page>book.pageCount)throw new TextbookBookmarkError('请选择有效的教材与页码。');
 const existing=data.bookmarks.find(item=>item.bookId===mutation.bookId&&item.page===mutation.page);
 if(mutation.action==='delete'||mutation.revision!==undefined){
  if(!existing)throw new TextbookBookmarkError('这条书签已被删除，请刷新后重试。',404);
  if(mutation.revision!==existing.revision)throw new TextbookBookmarkError('这条书签已在其他页面更新，请刷新后重新编辑。',409);
 }else if(existing)throw new TextbookBookmarkError('这一页已有书签，请刷新后编辑现有书签。',409);
 const bookmarks=data.bookmarks.filter(item=>item!==existing);
 if(mutation.action==='save'){
  const timestamp=Math.max(now,existing?.updatedAt??0);
  bookmarks.push({bookId:mutation.bookId,page:mutation.page,note:mutation.note,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,revision:existing?existing.revision+1:0});
 }
 return {bookmarks:sorted(bookmarks)};
}

export function readGuestTextbookBookmarks(storage:Pick<Storage,'getItem'>):TextbookBookmarkData{
 let raw:string|null;
 try{raw=storage.getItem(GUEST_TEXTBOOK_BOOKMARKS_KEY);}catch{throw new TextbookBookmarkError('暂时无法读取本机书签，原有内容未更改，请重试。',503);}
 if(raw===null)return {bookmarks:[]};
 try{
  const bookmarks:unknown=JSON.parse(raw);
  if(!Array.isArray(bookmarks))throw Error();
  const keys=new Set<string>();
  for(const item of bookmarks){
   if(!item||typeof item!=='object'||!validBookId(item.bookId)||!validPage(item.page)||typeof item.note!=='string'||item.note.length>BOOKMARK_NOTE_LIMIT||!validRevision(item.revision)||!validRevision(item.createdAt)||!validRevision(item.updatedAt)||item.updatedAt<item.createdAt)throw Error();
   const key=JSON.stringify([item.bookId,item.page]);
   if(keys.has(key))throw Error();
   keys.add(key);
  }
  return {bookmarks:sorted(bookmarks)};
 }catch{throw new TextbookBookmarkError('本机书签数据格式无效，原有内容未更改。',503);}
}

export function mutateGuestTextbookBookmarks(storage:Pick<Storage,'getItem'|'setItem'>,body:Record<string,unknown>,book:BookmarkBook|undefined,now=Date.now()):TextbookBookmarkData{
 const previous=readGuestTextbookBookmarks(storage);
 const next=applyBookmarkMutation(previous,body,book,now);
 try{storage.setItem(GUEST_TEXTBOOK_BOOKMARKS_KEY,JSON.stringify(next.bookmarks));}
 catch{throw new TextbookBookmarkError('浏览器无法保存书签，原有内容已保留，请重试。',503);}
 return next;
}
