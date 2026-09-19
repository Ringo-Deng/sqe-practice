const MAX_REQUEST_BYTES=2048;
const RESERVED_IDS=new Set(['__proto__','constructor','prototype']);
const validBook=(value:unknown):value is string=>typeof value==='string'&&value.length<=200&&value.trim().length>0&&!RESERVED_IDS.has(value)&&!/[\u0000-\u001f\u007f]/.test(value);
const headers={'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});

/** Identity/origin checks are the caller's responsibility; user_id is never read from the payload. */
export async function handleReadingPositionRequest(request:Request,db:D1Database,userId:string):Promise<Response>{
 if(typeof userId!=='string'||!userId.trim()||userId.length>512)return json({error:'请先登录，再保存阅读位置。'},401);
 const expectedAccount=request.headers.get('X-Reading-Account');
 if(expectedAccount!==null&&expectedAccount!==userId)return json({error:'当前账号已切换，请刷新后重试。'},409);
 try{
  if(request.method==='GET'){
   const rows=(await db.prepare('SELECT book_id,page FROM reading_positions WHERE user_id=? ORDER BY updated_at DESC,book_id').bind(userId).all<{book_id:string;page:number}>()).results;
   const pages:Record<string,number>={};
   for(const row of rows)if(validBook(row.book_id)&&Number.isSafeInteger(row.page)&&row.page>=1&&row.page<=100000)pages[row.book_id]=row.page;
   return json({lastBookId:rows.find(row=>Object.prototype.hasOwnProperty.call(pages,row.book_id))?.book_id??null,pages});
  }
  if(request.method!=='POST')return Response.json({error:'此接口只支持读取和保存阅读位置。'},{status:405,headers:{...headers,Allow:'GET, POST'}});
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'请求格式无效。'},415);
  if(Number(request.headers.get('content-length'))>MAX_REQUEST_BYTES)return json({error:'请求过大。'},413);
  if(!request.body)return json({error:'请选择教材页码。'},400);
  const reader=request.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;
  try{
   while(true){
    const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
    if(size>MAX_REQUEST_BYTES){await reader.cancel();return json({error:'请求过大。'},413);}
    text+=decoder.decode(part.value,{stream:true});
   }
   text+=decoder.decode();
  }catch{return json({error:'请求格式无效。'},400);}finally{reader.releaseLock();}
  let body:unknown;try{body=JSON.parse(text);}catch{return json({error:'请求格式无效。'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'请选择有效的教材页码。'},400);
  const value=body as Record<string,unknown>;
  if(Object.keys(value).some(key=>key!=='bookId'&&key!=='page')||!validBook(value.bookId)||!Number.isSafeInteger(value.page)||Number(value.page)<1||Number(value.page)>100000)return json({error:'请选择有效的教材页码。'},400);
  // Monotonic per-account ordering also distinguishes two page turns in one millisecond.
  await db.prepare('INSERT INTO reading_positions (user_id,book_id,page,updated_at) VALUES (?,?,?,MAX(?,COALESCE((SELECT MAX(updated_at)+1 FROM reading_positions WHERE user_id=?),0))) ON CONFLICT(user_id,book_id) DO UPDATE SET page=excluded.page,updated_at=excluded.updated_at').bind(userId,value.bookId,value.page,Date.now(),userId).run();
  return json({ok:true,bookId:value.bookId,page:value.page});
 }catch{return json({error:'暂时无法同步阅读位置，请稍后重试。'},503);}
}
