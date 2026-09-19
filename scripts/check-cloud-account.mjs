import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, writeFile, chmod} from 'node:fs/promises';
import {randomBytes, randomUUID} from 'node:crypto';

// This integration check intentionally accepts no remote endpoint or credentials.
// Run Wrangler with --local --persist-to .wrangler/cloud-integration on port 8788.
const origin = 'http://localhost:8788';
const fixturePath = new URL('../.cloud/account-check-credentials.json', import.meta.url);
const reportPath = new URL('../.cloud/local-account-check.json', import.meta.url);
const results = [];
const timings = [];
const check = (condition, label)=>{assert.ok(condition, label);results.push(label);};
const secret = ()=>randomBytes(24).toString('base64url');

await mkdir(new URL('../.cloud/', import.meta.url), {recursive:true});
let fixture;
try { fixture=JSON.parse(await readFile(fixturePath,'utf8')); }
catch(error) {
  if(error.code!=='ENOENT')throw error;
  fixture={adminUsername:`qa_admin_${randomBytes(4).toString('hex')}`,adminPassword:secret()};
  await saveFixture();
}
async function saveFixture(){await writeFile(fixturePath,JSON.stringify(fixture),{mode:0o600});await chmod(fixturePath,0o600);}
const values=Object.fromEntries((await readFile(new URL('../.dev.vars',import.meta.url),'utf8')).split('\n').filter(line=>line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)];}));
assert.ok(values.BOOTSTRAP_TOKEN,'Local .dev.vars must contain a bootstrap token.');

function actor(){return {cookies:new Map(),accountId:null};}
const anonymous=actor(),admin=actor(),student=actor();
async function api(who,path,body,{expected=200,headers={},label=path}={}){
  const started=performance.now();
  const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30000),
    method:body===undefined?'GET':'POST',headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json','X-Study-Action':'1'}),...(who.cookies.size?{Cookie:[...who.cookies].map(([key,value])=>`${key}=${value}`).join('; ')}:{}),...(who.accountId&&!['/api/account','/api/account/login','/api/account/setup'].includes(path)?{'X-Expected-Account-Id':who.accountId}:{}),...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  for(const cookie of response.headers.getSetCookie()){
    const pair=cookie.split(';')[0],at=pair.indexOf('='),key=pair.slice(0,at),value=pair.slice(at+1);
    if(!value||/max-age=0(?:;|$)/i.test(cookie))who.cookies.delete(key);else who.cookies.set(key,value);
  }
  const value=await response.json().catch(()=>null);
  assert.equal(response.status,expected,`${label}: unexpected HTTP status; ${value?.error||'no public error'}`);
  if(response.ok&&(path==='/api/account/login'||path==='/api/account'))who.accountId=value.user?.id||null;
  if(/login|setup|change-password|reset-password/.test(path))timings.push({operation:label,wallMs:Math.round(performance.now()-started)});
  return {value,response};
}

try{
  const first=await api(anonymous,'/api/account');
  check(first.value.user===null,'anonymous account has no user');
  for(const path of ['/api/study','/api/backup','/api/reading-positions','/api/admin/users']){
    await api(anonymous,path,undefined,{expected:401,headers:{'oai-authenticated-user-id':'forged-admin','oai-authenticated-user-email':'fake@example.invalid'}});
    check(true,`anonymous identity header cannot access ${path}`);
  }
  const file=(await readdir(new URL('../public/textbooks/',import.meta.url))).find(name=>name.endsWith('.pdf'));
  assert.ok(file,'Expected a fixture textbook filename.');
  for(const prefix of ['/textbooks/','/%74extbooks/','/textbooks%2F','//textbooks/','/%2ftextbooks%2f','/%2574extbooks/']){
    let url=origin+prefix+file, final;
    for(let redirects=0;redirects<5;redirects++){
      const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000)});
      final={status:response.status,type:response.headers.get('content-type')||''};
      await response.body?.cancel();
      const location=response.headers.get('location');
      if(!location)break;
      const next=new URL(location,url);assert.equal(next.origin,origin,'Asset redirect must remain local');url=next.href;
    }
    check(final.status===401||final.status===404||(final.status===200&&final.type.startsWith('text/html')),`anonymous encoded textbook path ${prefix} cannot return PDF`);
  }
  await api(anonymous,'/api/account/login',{username:fixture.adminUsername,password:'invalid-password'},{expected:403,headers:{Origin:'https://untrusted.example'},label:'cross-origin login'});
  check(true,'cross-origin login is rejected');
  if(first.value.setupRequired){
    await api(anonymous,'/api/account/setup',{token:values.BOOTSTRAP_TOKEN,username:fixture.adminUsername,name:'本机测试管理员',password:fixture.adminPassword},{expected:201,label:'bootstrap admin'});
    check(true,'one-time admin setup succeeds in workerd');
  }
  const login=await api(admin,'/api/account/login',{username:fixture.adminUsername,password:fixture.adminPassword},{label:'admin login'});
  check(login.value.user?.role==='admin','admin login returns verified administrator');
  check(login.response.headers.getSetCookie().some(cookie=>/httponly/i.test(cookie)&&/samesite=lax/i.test(cookie)),'login cookie is HttpOnly and SameSite=Lax');
  if(first.value.setupRequired)check(login.value.user.mustChangePassword===false,'self-created administrator password needs no forced replacement');
  if(login.value.user.mustChangePassword){
    await api(admin,'/api/study',undefined,{expected:403});check(true,'initial admin password cannot access study data');
    const password=secret();
    await api(admin,'/api/account/change-password',{currentPassword:fixture.adminPassword,newPassword:password},{label:'admin initial password change'});
    fixture.adminPassword=password;await saveFixture();
  }
  const adminAccount=(await api(admin,'/api/account')).value.user;
  check(adminAccount.mustChangePassword===false,'password change clears forced-change gate');
  await api(anonymous,'/api/account/setup',{token:values.BOOTSTRAP_TOKEN,username:`qa_extra_${randomBytes(3).toString('hex')}`,name:'不会创建',password:secret()},{expected:409,label:'setup replay'});
  check(true,'completed setup cannot be replayed');
  const credentials={username:`qa_user_${randomBytes(4).toString('hex')}`,password:secret()};
  const created=await api(admin,'/api/admin/users',{...credentials,name:'本机测试学员'},{expected:201});
  const studentId=created.value.user.id;
  check(created.value.user.mustChangePassword===true,'admin-created user requires password change');
  await api(student,'/api/account/login',credentials,{label:'student login'});
  await api(student,'/api/study',undefined,{expected:403});check(true,'student must change temporary password before study');
  const personalPassword=secret();
  await api(student,'/api/account/change-password',{currentPassword:credentials.password,newPassword:personalPassword},{label:'student initial password change'});
  credentials.password=personalPassword;
  await api(student,'/api/admin/users',undefined,{expected:403});check(true,'student cannot list or manage accounts');
  const before=(await api(admin,'/api/study')).value;
  const sessionId=randomUUID();
  const started=(await api(admin,'/api/study',{action:'start',id:sessionId,mode:'practice',sourceId:'sra'},{headers:{'X-Study-Compact':'1'}})).value;
  check(started.compact===true&&started.questions.length===0,'session start omits the unchanged question catalogue');
  const question=before.questions.find(item=>item.id===started.session.questionIds[0]);
  const answered=(await api(admin,'/api/study',{action:'answer',sessionId,questionId:question.id,selected:question.options[0].id},{headers:{'X-Study-Compact':'1'}})).value;
  check(answered.compact===true&&answered.questions.length===0&&answered.revealedQuestions[0]?.id===question.id&&answered.revealedQuestions[0]?.explanation,'answer returns only the newly revealed question');
  const fullResponseBytes=Buffer.byteLength(JSON.stringify(before));
  const compactResponseBytes=Buffer.byteLength(JSON.stringify(answered));
  check(compactResponseBytes<100000&&compactResponseBytes*20<fullResponseBytes,'answer response is more than 20 times smaller than a full load');
  check(answered.stats.answered===before.stats.answered+1,'answer persists through actual Worker and D1');
  const after=(await api(admin,'/api/study')).value;
  check(after.stats.answered===answered.stats.answered,'saved answer survives a fresh API load');
  const isolated=(await api(student,'/api/study?session='+sessionId)).value;
  check(isolated.stats.answered===0&&isolated.sessions.length===0&&isolated.session===null,'second account cannot read first account sessions');
  const staleHeaders={'X-Expected-Account-Id':adminAccount.id};
  await api(student,'/api/backup',undefined,{expected:409,headers:staleHeaders});
  check(true,'stale browser tab cannot download a different account backup');
  await api(student,'/api/study',{action:'start',id:randomUUID(),mode:'practice',sourceId:'sra'},{expected:409,headers:staleHeaders});
  check((await api(student,'/api/study')).value.sessions.length===0,'stale browser tab cannot create a session in a newly logged-in account');
  await api(student,'/api/account/change-password',{currentPassword:credentials.password,newPassword:secret()},{expected:409,headers:staleHeaders,label:'stale tab password change rejection'});
  check(true,'stale browser tab cannot change another active account password');
  await api(student,'/api/account/logout',{}, {expected:409,headers:staleHeaders});
  check((await api(student,'/api/account')).value.user?.id===studentId,'stale browser tab cannot log out a newly logged-in account');
  await api(student,'/api/study',{action:'answer',sessionId,questionId:question.id,selected:question.options[1].id},{expected:404});
  check(true,'second account cannot write another account session');
  await api(admin,'/api/reading-positions',{bookId:'qa-local-reading',page:17},{headers:{'X-Reading-Account':adminAccount.id}});
  check(Object.keys((await api(student,'/api/reading-positions')).value.pages).length===0,'reading positions are separated by account');
  await api(student,'/api/reading-positions',{bookId:'qa-local-reading',page:99},{expected:409,headers:{'X-Reading-Account':adminAccount.id}});
  check(true,'stale reading account header cannot cross account boundary');
  const backup=(await api(admin,'/api/backup')).value;
  check(backup.schemaVersion===2&&backup.data.reading_positions.some(item=>item.book_id==='qa-local-reading'&&item.page===17),'cloud backup includes synchronized reading positions');
  check(backup.files.included===false&&!JSON.stringify(backup).includes(fixture.adminPassword),'backup excludes PDF bytes and authentication credentials');
  const conflict=(await api(student,'/api/backup',backup)).value;
  check(conflict.tables.sessions.inserted===0&&conflict.tables.responses.inserted===0,'restore never adopts session IDs already owned by another account');
  // Simulate an archive whose records are absent from this database. Existing
  // foreign account IDs are deliberately skipped by the production restore.
  const importable=structuredClone(backup), ids=new Map();
  for(const session of importable.data.sessions){const next=randomUUID();ids.set(session.id,next);session.id=next;}
  for(const response of importable.data.responses)response.session_id=ids.get(response.session_id);
  const restore=(await api(student,'/api/backup',importable)).value;
  check(restore.mode==='merge-preserve-existing'&&restore.tables.sessions.inserted>0,'backup restores by merging into the current account');
  const restored=(await api(student,'/api/study')).value;
  check(restored.stats.answered===after.stats.answered,'restored study statistics match exported account');
  const replay=(await api(student,'/api/backup',importable)).value;
  check(Object.values(replay.tables).every(table=>table.inserted===0),'repeated restore does not duplicate records');
  check((await api(admin,'/api/study')).value.stats.answered===after.stats.answered,'backup restore leaves source account unchanged');
  await api(admin,`/api/admin/users/${studentId}/disable`,{});
  await api(student,'/api/study',undefined,{expected:401});check(true,'disabling an account revokes existing access');
  await api(admin,`/api/admin/users/${studentId}/enable`,{});
  await api(student,'/api/account/login',credentials,{label:'student login after enable'});
  check((await api(student,'/api/study')).value.stats.answered===restored.stats.answered,'re-enabling retains learning progress');
  const replacement=secret();
  await api(admin,`/api/admin/users/${studentId}/reset-password`,{password:replacement},{label:'administrator resets password'});
  await api(student,'/api/study',undefined,{expected:401});check(true,'password reset revokes old sessions');
  await api(student,'/api/account/login',credentials,{expected:401,label:'old student password rejection'});
  const resetLogin=await api(student,'/api/account/login',{username:credentials.username,password:replacement},{label:'student temporary reset login'});
  check(resetLogin.value.user.mustChangePassword===true,'reset password requires another personal password change');
  await api(student,'/api/account/logout',{});
  check((await api(student,'/api/account')).value.user===null,'logout clears the account session');
  await api(admin,`/api/admin/users/${studentId}/disable`,{});
  await api(admin,'/api/account/logout',{});
  const report={passed:results.length,checks:results,responseBytes:{full:fullResponseBytes,answer:compactResponseBytes},timings,limitations:'Local wall-clock measurements only; not production CPU usage or browser interaction verification.'};
  await writeFile(reportPath,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}catch(error){
  console.error(JSON.stringify({passedBeforeFailure:results.length,error:error.message,timings},null,2));
  process.exitCode=1;
}
