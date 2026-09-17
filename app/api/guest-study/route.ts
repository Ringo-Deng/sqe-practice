import {applyGuestStudyAction} from '@/lib/guest-study';

export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json')||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请求无效，请刷新后重试。'},403);
 try{
  const text=await request.text();
  if(text.length>2_000_000)return json({error:'本机学习记录过大，请清理部分历史记录后重试。'},413);
  const body=JSON.parse(text) as Record<string,unknown>;
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error();
  return json(applyGuestStudyAction(body.state,body));
 }catch(error){
  const status=typeof (error as {status?:unknown})?.status==='number'?(error as {status:number}).status:400;
  const message=error instanceof Error&&error.message?error.message:'本机学习记录格式无效。';
  return json({error:message},status);
 }
}
