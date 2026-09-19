import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {database} from '@/db/store';
import {textbookById} from '@/lib/textbooks';
import {cleanTextbookTitle,isTextbookSubjectId,type TextbookCatalogData} from '@/lib/textbook-catalog';
import type {Textbook} from '@/lib/textbooks';

export const dynamic='force-dynamic';
const MAX_PDF_BYTES=80*1024*1024;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
type TitleRow={bookId:string;title:string;subjectId:string|null};
type ImportedRow={id:string;title:string;subjectId:string;originalName:string;pageCount:number;sizeBytes:number;createdAt:number;revision:number};

function cleanFileName(value:unknown){return typeof value==='string'?value.trim().replace(/[\u0000-\u001f]/g,'').slice(0,240):'';}
async function payload(userId:string):Promise<TextbookCatalogData>{
 const db=database();
 const [titleResult,importedResult]=await Promise.all([
  db.prepare('SELECT book_id AS bookId,title,subject_id AS subjectId FROM textbook_titles WHERE user_id=? ORDER BY updated_at DESC').bind(userId).all<TitleRow>(),
  db.prepare('SELECT id,title,subject_id AS subjectId,original_name AS originalName,page_count AS pageCount,size_bytes AS sizeBytes,created_at AS createdAt,revision FROM user_textbooks WHERE user_id=? ORDER BY created_at DESC,id').bind(userId).all<ImportedRow>()
 ]);
 const titles=Object.fromEntries(titleResult.results.filter(row=>!!textbookById(row.bookId)).map(row=>[row.bookId,row.title]));
 const subjects=Object.fromEntries(titleResult.results.filter(row=>!!textbookById(row.bookId)&&isTextbookSubjectId(row.subjectId)).map(row=>[row.bookId,row.subjectId as string]));
 const imported:Textbook[]=importedResult.results.map(row=>({id:row.id,title:row.title,shortTitle:row.title,subjectId:isTextbookSubjectId(row.subjectId)?row.subjectId:'my-materials',version:'导入 PDF',pageCount:row.pageCount,url:`/api/textbooks/file?id=${encodeURIComponent(row.id)}`,sha256:`user-${row.id}`,pageUrlTemplate:'',imported:true,originalName:row.originalName,sizeBytes:row.sizeBytes,createdAt:row.createdAt}));
 return {titles,subjects,imported};
}

export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再读取教材。'},401);
 try{return json(await payload(user.userId));}catch(error){console.error('Textbook catalog load failed',error);return json({error:'暂时无法读取教材，请重试。'},503);}
}

export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录，再管理教材。'},401);
 if(request.headers.get('x-study-action')!=='1'||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请求无效，请刷新后重试。'},403);
 const contentType=request.headers.get('content-type')??'';
 if(contentType.startsWith('application/pdf')){
  const url=new URL(request.url),title=cleanTextbookTitle(url.searchParams.get('title')),pageCount=Number(url.searchParams.get('pageCount')),fileName=cleanFileName(url.searchParams.get('fileName')),declaredSize=Number(url.searchParams.get('size'));
  if(!request.body||!Number.isInteger(declaredSize)||declaredSize<1)return json({error:'请选择需要导入的 PDF 文件。'},400);
  if(declaredSize>MAX_PDF_BYTES)return json({error:'单份教材暂支持 80 MB 以内的 PDF。'},413);
  if(!Number.isInteger(pageCount)||pageCount<1||pageCount>3000)return json({error:'无法确认 PDF 页数，请重新选择文件。'},400);
  if(!title)return json({error:'请填写教材名称。'},400);
  if(!env.BUCKET)return json({error:'教材文件存储暂不可用，请稍后重试。'},503);
  const id=crypto.randomUUID(),storageKey=`textbooks/${id}.pdf`,now=Date.now();
  try{
   const [probe,upload]=request.body.tee(),reader=probe.getReader();let signature='';
   while(signature.length<5){const part=await reader.read();if(part.done)break;signature+=new TextDecoder().decode(part.value.slice(0,5-signature.length));}await reader.cancel();
   if(signature!=='%PDF-'){await upload.cancel();return json({error:'这不是有效的 PDF 文件。'},400);}
   const stored=await env.BUCKET.put(storageKey,upload,{httpMetadata:{contentType:'application/pdf'}});
   if(stored.size>MAX_PDF_BYTES){await env.BUCKET.delete(storageKey);return json({error:'单份教材暂支持 80 MB 以内的 PDF。'},413);}
   try{
    await database().prepare('INSERT INTO user_textbooks (id,user_id,title,original_name,page_count,storage_key,size_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user.userId,title,fileName||`${title}.pdf`,pageCount,storageKey,stored.size,now,now).run();
   }catch(error){await env.BUCKET.delete(storageKey).catch(()=>{});throw error;}
   return json(await payload(user.userId),201);
  }catch(error){console.error('Textbook import failed',error);return json({error:'教材未能导入，请保留文件后重试。'},503);}
 }
 if(!contentType.includes('application/json'))return json({error:'请求格式无效。'},400);
 let body:Record<string,unknown>;
 try{const text=await request.text();if(text.length>2000)throw Error();body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json({error:'教材信息格式无效。'},400);}
 if((body.action!=='rename'&&body.action!=='update')||typeof body.id!=='string')return json({error:'未知操作。'},400);
 const title=cleanTextbookTitle(body.title);if(!title)return json({error:'教材名称不能为空。'},400);
 const updateSubject=body.action==='update';
 if(updateSubject&&!isTextbookSubjectId(body.subjectId))return json({error:'请选择有效的科目。'},400);
 try{
  const db=database(),now=Date.now(),builtIn=textbookById(body.id);
  if(builtIn){
   if(updateSubject)await db.prepare('INSERT INTO textbook_titles (user_id,book_id,title,subject_id,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET title=excluded.title,subject_id=excluded.subject_id,updated_at=excluded.updated_at,revision=textbook_titles.revision+1').bind(user.userId,builtIn.id,title,body.subjectId,now).run();
   else await db.prepare('INSERT INTO textbook_titles (user_id,book_id,title,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at,revision=textbook_titles.revision+1').bind(user.userId,builtIn.id,title,now).run();
  }else{
   const result=updateSubject
    ?await db.prepare('UPDATE user_textbooks SET title=?,subject_id=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=?').bind(title,body.subjectId,now,body.id,user.userId).run()
    :await db.prepare('UPDATE user_textbooks SET title=?,updated_at=?,revision=revision+1 WHERE id=? AND user_id=?').bind(title,now,body.id,user.userId).run();
   if(!result.meta.changes)return json({error:'没有找到这本教材，请刷新后重试。'},404);
  }
  return json(await payload(user.userId));
 }catch(error){console.error('Textbook metadata update failed',error);return json({error:'教材信息未能保存，请重试。'},503);}
}
