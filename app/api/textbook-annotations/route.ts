import {getChatGPTUser} from '../../chatgpt-auth';
import {database} from '@/db/store';
import {questions} from '@/lib/questions';
import {textbookById} from '@/lib/textbooks';
import {validAnnotationRects,type TextbookAnnotation} from '@/lib/textbook-annotations';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
type Row=Omit<TextbookAnnotation,'rects'|'color'>&{rects:string;color:string};
const columns='id,book_id AS bookId,page,quote,note,color,rects,source_question_id AS sourceQuestionId,created_at AS createdAt,updated_at AS updatedAt,revision';
function annotation(row:Row):TextbookAnnotation|null{
 try{const rects=JSON.parse(row.rects);return row.color==='yellow'&&validAnnotationRects(rects)?{...row,color:'yellow',rects}:null;}catch{return null;}
}
async function payload(userId:string){
 const rows=(await database().prepare(`SELECT ${columns} FROM textbook_annotations WHERE user_id=? ORDER BY updated_at DESC,id`).bind(userId).all<Row>()).results;
 return {annotations:rows.map(annotation).filter((item):item is TextbookAnnotation=>!!item)};
}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再读取教材笔记。'},401);
 try{return json(await payload(user.userId));}catch(e){console.error('Textbook annotation load failed',e);return json({error:'暂时无法读取教材笔记，请重试。'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再保存教材笔记。'},401);
 if(request.headers.get('x-study-action')!=='1'||!request.headers.get('content-type')?.includes('application/json')||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请求无效，请刷新后重试。'},403);
 let body:Record<string,unknown>;
 try{const text=await request.text();if(text.length>30000)throw Error();body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json({error:'高亮或笔记内容格式无效或过长。'},400);}
 if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return json({error:'教材笔记编号无效。'},400);
 const now=Date.now();
 try{
  const db=database();
  const existing=await db.prepare(`SELECT ${columns} FROM textbook_annotations WHERE id=? AND user_id=?`).bind(body.id,user.userId).first<Row>();
  if(body.action==='add'||body.action==='edit'){
   const builtIn=typeof body.bookId==='string'?textbookById(body.bookId):undefined;
   const imported=!builtIn&&typeof body.bookId==='string'?await db.prepare('SELECT id,page_count AS pageCount FROM user_textbooks WHERE id=? AND user_id=?').bind(body.bookId,user.userId).first<{id:string;pageCount:number}>():undefined;
   const book=builtIn??imported;
   if(!book||!Number.isInteger(body.page)||(body.page as number)<1||(body.page as number)>book.pageCount)return json({error:'请选择有效的教材与页码。'},400);
   if(typeof body.quote!=='string'||!body.quote.trim()||body.quote.length>8000||typeof body.note!=='string'||body.note.length>10000||body.color!=='yellow'||!validAnnotationRects(body.rects))return json({error:'请选择教材文字；高亮原文最多8,000字，笔记最多10,000字。'},400);
   const sourceQuestionId=body.sourceQuestionId==null?null:typeof body.sourceQuestionId==='string'&&questions.some(q=>q.id===body.sourceQuestionId)?body.sourceQuestionId:null;
   if(body.sourceQuestionId!=null&&!sourceQuestionId)return json({error:'来源题目无效。'},400);
   const quote=body.quote.trim().replace(/\s+/g,' '),note=body.note.trim(),rects=JSON.stringify(body.rects);
   if(body.action==='edit'){
    if(!existing)return json({error:'这条教材笔记已被删除，请刷新后重试。'},404);
    if(!Number.isInteger(body.revision)||body.revision!==existing.revision)return json({error:'这条教材笔记已在其他页面更新，请刷新后重新编辑。'},409);
    const result=await db.prepare('UPDATE textbook_annotations SET book_id=?,page=?,quote=?,note=?,color=?,rects=?,source_question_id=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=? AND revision=?').bind(book.id,body.page,quote,note,'yellow',rects,sourceQuestionId,now,body.id,user.userId,body.revision).run();
    if(!result.meta.changes)return json({error:'这条教材笔记已更新，请刷新后重试。'},409);
   }else{
    if(existing)return json(await payload(user.userId));
    await db.prepare('INSERT OR IGNORE INTO textbook_annotations (id,user_id,book_id,page,quote,note,color,rects,source_question_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(body.id,user.userId,book.id,body.page,quote,note,'yellow',rects,sourceQuestionId,now,now).run();
   }
  }else if(body.action==='delete'){
   if(!existing)return json(await payload(user.userId));
   if(!Number.isInteger(body.revision)||body.revision!==existing.revision)return json({error:'这条教材笔记已更新，请刷新后重试。'},409);
   const result=await db.prepare('DELETE FROM textbook_annotations WHERE id=? AND user_id=? AND revision=?').bind(body.id,user.userId,body.revision).run();
   if(!result.meta.changes)return json({error:'这条教材笔记已更新，请刷新后重试。'},409);
  }else return json({error:'未知操作。'},400);
  return json(await payload(user.userId));
 }catch(e){console.error('Textbook annotation save failed',e);return json({error:'这次操作未能确认保存，所选文字仍保留，请重试。'},503);}
}
