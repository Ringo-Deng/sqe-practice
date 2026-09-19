import * as study from '../app/api/study/route';
import * as vocabulary from '../app/api/vocabulary/route';
import * as annotations from '../app/api/textbook-annotations/route';
import * as bookmarks from '../app/api/textbook-bookmarks/route';
import * as textbooks from '../app/api/textbooks/route';
import * as textbookFile from '../app/api/textbooks/file/route';
import {handleAccountRequest} from './account-api';
import {getAccountUser} from './auth';
import {handleBackupRequest} from './backup';
import {handleReadingPositionRequest} from './reading-position-api';
import {withVerifiedIdentity} from './request-context';
import {EXPECTED_ACCOUNT_HEADER,matchesExpectedAccount} from '../lib/expected-account-headers';

export interface CloudEnv{
 DB:D1Database;
 ASSETS:Fetcher;
 BUCKET?:R2Bucket;
 APP_ORIGIN:string;
 BETTER_AUTH_SECRET:string;
 BOOTSTRAP_TOKEN?:string;
 LOCAL_DEV?:string;
}

const routes:Record<string,{GET?:(request:Request)=>Promise<Response>;POST?:(request:Request)=>Promise<Response>}>= {
 '/api/study':study,
 '/api/vocabulary':vocabulary,
 '/api/textbook-annotations':annotations,
 '/api/textbook-bookmarks':bookmarks,
 '/api/textbooks':textbooks,
 '/api/textbooks/file':textbookFile,
};
function error(message:string,status:number){return Response.json({error:message},{status});}
function protect(response:Response,privateData=false){
 const result=new Response(response.body,response);
 result.headers.set('X-Content-Type-Options','nosniff');
 result.headers.set('Referrer-Policy','same-origin');
 result.headers.set('X-Frame-Options','DENY');
 result.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 result.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
 if(privateData){result.headers.set('Cache-Control','no-store');result.headers.set('Vary','Cookie');}
 return result;
}
function safeOrigin(request:Request,env:CloudEnv){
 const url=new URL(request.url);
 let expected:URL;
 try{expected=new URL(env.APP_ORIGIN);}catch{return false;}
 if(expected.origin!==url.origin)return false;
 if(!['GET','HEAD','OPTIONS'].includes(request.method)){
  if(request.headers.get('origin')!==expected.origin)return false;
  if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 }
 return expected.protocol==='https:'||(['localhost','127.0.0.1','[::1]'].includes(expected.hostname)&&expected.protocol==='http:');
}

async function fetchRequest(request:Request,env:CloudEnv):Promise<Response>{
 const url=new URL(request.url),path=url.pathname;
 if(path==='/health')return Response.json({service:'sqe-practice-cloud',status:'ok'});
 if(!safeOrigin(request,env))return error('请求来源无效，请使用本站地址重新登录。',403);
 if(path==='/api/account'||path.startsWith('/api/account/')||path.startsWith('/api/admin/')){
  if(request.headers.has(EXPECTED_ACCOUNT_HEADER)){
   const user=await getAccountUser(request,env);
   if(!user)return error('登录已失效，请重新登录。',401);
   if(!matchesExpectedAccount(request,user.id))return error('此页面的账号已切换，请刷新页面后重试。',409);
  }
  return await handleAccountRequest(request,env)??error('没有找到这个入口。',404);
 }
 if(path.startsWith('/api/')||path.startsWith('/textbooks/')){
  const user=await getAccountUser(request,env);
  if(!user)return error('登录已失效，请重新登录。',401);
  if(!matchesExpectedAccount(request,user.id))return error('此页面的账号已切换，请刷新页面后重试。',409);
  if(user.mustChangePassword)return error('请先修改初始密码，再开始学习。',403);
  if(path==='/api/backup')return handleBackupRequest(request,env.DB,user.id);
  if(path==='/api/reading-positions')return handleReadingPositionRequest(request,env.DB,user.id);
  if(path.startsWith('/textbooks/')){
   if(!['GET','HEAD'].includes(request.method))return error('请求方式无效。',405);
   return env.ASSETS.fetch(request);
  }
  const handlers=routes[path],handler=request.method==='GET'?handlers?.GET:request.method==='POST'?handlers?.POST:undefined;
  if(!handler)return error('没有找到这个入口。',handlers?405:404);
  if(path==='/api/textbooks/file'){
   const id=url.searchParams.get('id');
   if(id){const row=await env.DB.prepare('SELECT storage_key FROM user_textbooks WHERE id=? AND user_id=?').bind(id,user.id).first<{storage_key:string}>();
    if(row?.storage_key.startsWith('unrestored-backup/'))return error('这本教材的笔记已恢复，PDF 原文件尚未恢复，请重新关联原文件。',409);
   }
  }
  return withVerifiedIdentity(user,()=>handler(request));
 }
 if(!['GET','HEAD'].includes(request.method))return error('请求方式无效。',405);
 return env.ASSETS.fetch(request);
}

export default {
 async fetch(request:Request,env:CloudEnv):Promise<Response>{
  const path=new URL(request.url).pathname;
  try{return protect(await fetchRequest(request,env),path.startsWith('/api/')||path.startsWith('/textbooks/')||!path.startsWith('/assets/'));}
  catch(errorValue){
   // Never log request bodies, passwords, cookies or backup contents.
   console.error('SQE request failed',{path,error:errorValue instanceof Error?errorValue.name:'Error'});
   return protect(error('暂时无法完成操作，请稍后重试。',503),true);
  }
 },
 async scheduled(_event:ScheduledController,env:CloudEnv):Promise<void>{
  // D1 Time Travel is provided by Cloudflare. App maintenance must not represent
  // snapshots in the same database as an independent backup.
  await env.DB.prepare('DELETE FROM cloud_auth_limits WHERE window_start < ?').bind(Date.now()-86400000).run();
 },
} satisfies ExportedHandler<CloudEnv>;
