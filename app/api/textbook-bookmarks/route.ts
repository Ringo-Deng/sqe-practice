import {getChatGPTUser} from '../../chatgpt-auth';
import {database} from '@/db/store';
import {textbookById} from '@/lib/textbooks';
import {applyBookmarkMutation,parseBookmarkMutation,TextbookBookmarkError,type BookmarkBook,type TextbookBookmark} from '@/lib/textbook-bookmarks';

export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
const columns='book_id AS bookId,page,note,created_at AS createdAt,updated_at AS updatedAt,revision';
async function payload(userId:string){
 const bookmarks=(await database().prepare(`SELECT ${columns} FROM textbook_bookmarks WHERE user_id=? ORDER BY updated_at DESC,book_id,page`).bind(userId).all<TextbookBookmark>()).results;
 return {bookmarks};
}
export async function GET(){
 const user=await getChatGPTUser();
 if(!user)return json({error:'请先登录，再读取教材书签。'},401);
 try{return json(await payload(user.userId));}
 catch(error){console.error('Textbook bookmark load failed',error);return json({error:'暂时无法读取教材书签，请重试。'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(!user)return json({error:'请先登录，再保存教材书签。'},401);
 if(request.headers.get('x-study-action')!=='1'||!request.headers.get('content-type')?.includes('application/json')||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请求无效，请刷新后重试。'},403);
 let body:Record<string,unknown>;
 try{const raw=await request.text();if(raw.length>65000)throw Error();body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}
 catch{return json({error:'书签内容格式无效或过长。'},400);}
 try{
  const mutation=parseBookmarkMutation(body),db=database();
  const builtIn=textbookById(mutation.bookId);
  const imported=builtIn?undefined:await db.prepare('SELECT id,page_count AS pageCount FROM user_textbooks WHERE id=? AND user_id=?').bind(mutation.bookId,user.userId).first<BookmarkBook>();
  const book=builtIn??imported??undefined;
  const existing=await db.prepare(`SELECT ${columns} FROM textbook_bookmarks WHERE user_id=? AND book_id=? AND page=?`).bind(user.userId,mutation.bookId,mutation.page).first<TextbookBookmark>();
  const next=applyBookmarkMutation({bookmarks:existing?[existing]:[]},body,book);
  if(mutation.action==='delete'){
   const result=await db.prepare('DELETE FROM textbook_bookmarks WHERE user_id=? AND book_id=? AND page=? AND revision=?').bind(user.userId,mutation.bookId,mutation.page,mutation.revision).run();
   if(!result.meta.changes)throw new TextbookBookmarkError('这条书签已在其他页面更新，请刷新后重试。',409);
  }else{
   const bookmark=next.bookmarks[0];
   if(mutation.revision===undefined){
    const result=await db.prepare('INSERT OR IGNORE INTO textbook_bookmarks (user_id,book_id,page,note,created_at,updated_at,revision) VALUES (?,?,?,?,?,?,?)').bind(user.userId,bookmark.bookId,bookmark.page,bookmark.note,bookmark.createdAt,bookmark.updatedAt,bookmark.revision).run();
    if(!result.meta.changes)throw new TextbookBookmarkError('这一页已有书签，请刷新后编辑现有书签。',409);
   }else{
    const result=await db.prepare('UPDATE textbook_bookmarks SET note=?,updated_at=?,revision=revision+1 WHERE user_id=? AND book_id=? AND page=? AND revision=?').bind(bookmark.note,bookmark.updatedAt,user.userId,mutation.bookId,mutation.page,mutation.revision).run();
    if(!result.meta.changes)throw new TextbookBookmarkError('这条书签已在其他页面更新，请刷新后重新编辑。',409);
   }
  }
  return json(await payload(user.userId));
 }catch(error){
  if(error instanceof TextbookBookmarkError)return json({error:error.message},error.status);
  console.error('Textbook bookmark save failed',error);
  return json({error:'这次操作未能确认保存，书签备注仍保留，请重试。'},503);
 }
}
