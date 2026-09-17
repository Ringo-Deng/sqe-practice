import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {database} from '@/db/store';

export const dynamic='force-dynamic';
type FileRow={storageKey:string;originalName:string;sizeBytes:number};
function requestedRange(header:string|null,size:number){
 if(!header)return undefined;
 const match=/^bytes=(\d*)-(\d*)$/.exec(header.trim());if(!match)return null;
 const startText=match[1],endText=match[2];let start:number,end:number;
 if(!startText){const suffix=Number(endText);if(!Number.isInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(startText);end=endText?Number(endText):size-1;if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=size)return null;end=Math.min(end,size-1);}
 return {offset:start,length:end-start+1,end};
}
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return new Response('请先登录。',{status:401});
 const id=new URL(request.url).searchParams.get('id');if(!id)return new Response('缺少教材编号。',{status:400});
 try{
  const row=await database().prepare('SELECT storage_key AS storageKey,original_name AS originalName,size_bytes AS sizeBytes FROM user_textbooks WHERE id=? AND user_id=?').bind(id,user.userId).first<FileRow>();
  if(!row)return new Response('没有找到这本教材。',{status:404});
  if(!env.BUCKET)return new Response('教材文件存储暂不可用。',{status:503});
  const range=requestedRange(request.headers.get('range'),row.sizeBytes);
  if(range===null)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${row.sizeBytes}`}});
  const object=await env.BUCKET.get(row.storageKey,range?{range:{offset:range.offset,length:range.length}}:undefined);
  if(!object)return new Response('教材文件不存在。',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);
  headers.set('Content-Type','application/pdf');headers.set('Accept-Ranges','bytes');headers.set('Cache-Control','private, max-age=3600');headers.set('Vary','Cookie');headers.set('ETag',object.httpEtag);headers.set('X-Content-Type-Options','nosniff');headers.set('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.originalName)}`);
  if(range){headers.set('Content-Range',`bytes ${range.offset}-${range.end}/${row.sizeBytes}`);headers.set('Content-Length',String(range.length));}
  else headers.set('Content-Length',String(row.sizeBytes));
  return new Response(object.body,{status:range?206:200,headers});
 }catch(error){console.error('Textbook file read failed',error);return new Response('暂时无法打开教材，请重试。',{status:503});}
}
