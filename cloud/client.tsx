'use client';

import {useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {ArrowDownToLine, ArrowUpFromLine, ChevronRight, Loader2, LogOut, UserRound} from 'lucide-react';
import StudyApp from '@/app/study-app';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {setWorkspaceAccount} from '@/lib/study-workspace';
import {activateReadingAccount, getReadingSyncStatus, subscribeReadingSync} from '@/lib/textbook-reading-position';
import {ExpectedAccountProvider, useExpectedAccount} from '@/lib/expected-account';
import {expectedAccountHeaders} from '@/lib/expected-account-headers';
import {consumeSetupLink} from './setup-link';
import './account-ui.css';

type AccountUser = {id:string; name:string; username:string; role:'admin'|'user'; mustChangePassword:boolean};
type Account = {user:AccountUser|null; setupRequired:boolean};
type ManagedUser = {id:string; username:string; name:string; disabled:boolean; createdAt:string; mustChangePassword:boolean};
type BackupResult = {imported?:number|Record<string, number>; skipped?:number|Record<string, number>; missingFiles?:unknown[]|number; tables?:Record<string,{inserted:number;skipped:number}>; files?:{requiresUpload?:unknown[]}; migration?:{unknownQuestionIds:string[];skippedSessions:{sessionId:string;reason:string}[];skippedAnswers:{sessionId:string;questionId:string;reason:string}[]}};
const expiredEvent = 'sqe:account-expired';
// Read and remove the fragment before the first account request. The in-memory
// value survives React's development double render and is cleared at form mount.
let pendingSetupToken = typeof window === 'undefined' ? '' : consumeSetupLink(window.location, window.history);

async function request<T>(path:string, body?:unknown, expectedAccountId:string|null=null):Promise<T> {
  let response:Response;
  try {
    response = await fetch(path, {
      credentials:'same-origin', cache:'no-store',
      headers:expectedAccountHeaders(expectedAccountId, body === undefined ? undefined : {'Content-Type':'application/json'}),
      ...(body === undefined ? {} : {method:'POST', body:JSON.stringify(body)}),
    });
  } catch {
    throw new Error('暂时无法连接，请检查网络后重试。');
  }
  const value = await response.json().catch(() => null) as (T & {error?:string})|null;
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/account/login' && path !== '/api/account/setup') {
      window.dispatchEvent(new Event(expiredEvent));
    }
    throw new Error(value?.error || '操作未完成，请重试。');
  }
  if (value === null) throw new Error('服务返回了无法识别的结果，请重试。');
  return value;
}

function useAccountRequest() {
  const accountId = useExpectedAccount();
  return useCallback(<T,>(path:string, body?:unknown)=>request<T>(path, body, accountId),[accountId]);
}

function Feedback({error, message}:{error?:string; message?:string}) {
  return <>{error && <p className="cloud-feedback cloud-error" role="alert">{error}</p>}{message && <p className="cloud-feedback cloud-success" role="status">{message}</p>}</>;
}

function BusyLabel({busy, children}:{busy:boolean; children:ReactNode}) {
  return <>{busy && <Loader2 size={16} className="cloud-spinner" aria-hidden="true"/>}{children}</>;
}

function AuthFrame({title, description, children}:{title:string; description:string; children:ReactNode}) {
  return <main className="cloud-auth-page"><section className="cloud-auth-card"><div className="cloud-auth-brand"><span aria-hidden="true">S</span><strong>SQE Practice</strong></div><h1>{title}</h1><p className="cloud-description">{description}</p>{children}</section></main>;
}

function SignIn({setup, notice, onSuccess}:{setup:boolean; notice:string; onSuccess:()=>Promise<void>}) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState(()=>setup ? pendingSetupToken : '');
  const [setupCreated, setSetupCreated] = useState(false);
  const setupActive = setup && !setupCreated;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(()=>{pendingSetupToken='';},[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (setupActive && password !== confirmPassword) { setError('两次输入的密码不一致。'); return; }
    setBusy(true);
    let initialized = false;
    try {
      if (setupActive) {
        await request('/api/account/setup', {token, username:username.trim(), name:name.trim(), password});
        initialized = true; setSetupCreated(true); setToken('');
      }
      await request('/api/account/login', {username:username.trim(), password});
      await onSuccess();
      setPassword(''); setConfirmPassword(''); setToken('');
    } catch (cause) { setError((initialized ? '账号已创建，但自动登录未完成。请再次登录。' : '')+(cause as Error).message); }
    finally { setBusy(false); }
  }
  return <AuthFrame title={setupActive ? '创建管理员账号' : '登录你的学习空间'} description={setupActive ? '设置你自己的管理员账号和密码，创建后即可开始使用。之后可以为学员开通账号。' : '使用你的账号登录，继续练习和笔记。'}>
    <form className="cloud-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {setupActive && <label>初始化口令<input type="password" value={token} onChange={e=>setToken(e.target.value)} required autoComplete="off" spellCheck={false}/><small>{token ? '已从开通链接填入或由你填写。仅用于首次创建管理员，不是登录密码。' : '打开专属开通链接可自动填入，也可粘贴部署者提供的口令。它不是登录密码。'}</small></label>}
        <label>账号<input value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false}/></label>
        {setupActive && <label>显示名称<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} autoComplete="nickname"/></label>}
        <label>{setupActive ? '设置登录密码' : '密码'}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={setupActive ? 12 : undefined} maxLength={128} autoComplete={setupActive ? 'new-password' : 'current-password'}/>{setupActive && <small>12–128 个字符，由你自己设置，之后登录使用。</small>}</label>
        {setupActive && <label>再次输入密码<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password"/></label>}
        <Feedback error={error} message={!error ? notice : ''}/>
        <button type="submit" className="cloud-primary cloud-wide"><BusyLabel busy={busy}>{busy ? '正在处理…' : setupActive ? '创建并进入学习空间' : '登录'}</BusyLabel></button>
      </fieldset>
    </form>
    {!setupActive && <p className="cloud-auth-help">还没有账号或忘记密码？请联系管理员。</p>}
  </AuthFrame>;
}

function PasswordForm({required, onChanged}:{required?:boolean; onChanged:()=>Promise<void>}) {
  const accountRequest = useAccountRequest();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (newPassword !== confirmation) { setError('两次输入的新密码不一致。'); return; }
    if (newPassword === currentPassword) { setError('请设置一个与当前密码不同的新密码。'); return; }
    setBusy(true);
    try {
      await accountRequest('/api/account/change-password', {currentPassword, newPassword});
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      await onChanged();
      setMessage('密码已修改。');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="cloud-form" onSubmit={submit}><fieldset disabled={busy}>
    <label>{required ? '临时密码' : '当前密码'}<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" required maxLength={128}/></label>
    <label>新密码<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/><small>12–128 个字符。</small></label>
    <label>再次输入新密码<input type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/></label>
    <Feedback error={error} message={message}/>
    <button type="submit" className="cloud-primary"><BusyLabel busy={busy}>{busy ? '保存中…' : required ? '修改密码并开始学习' : '保存新密码'}</BusyLabel></button>
  </fieldset></form>;
}

function counts(value:number|Record<string, number>|undefined) {
  return typeof value === 'number' ? value : Object.values(value || {}).reduce((sum, count)=>sum + (typeof count === 'number' ? count : 0), 0);
}

function ReadingSyncNotice() {
  const [status, setStatus] = useState(getReadingSyncStatus);
  useEffect(()=>subscribeReadingSync(setStatus),[]);
  if (status.state !== 'error' && status.state !== 'pending') return null;
  return <p className="cloud-note cloud-sync-note" role="status">{status.message || (status.state === 'error' ? '阅读位置暂未同步，请检查网络后重试。' : `有 ${status.pendingCount} 处阅读位置等待同步。`)}{status.pendingCount > 0 && ' 下载的备份只包含已同步的阅读位置。'}</p>;
}

function BackupPanel({onImported, onAccountRefresh}:{onImported:()=>Promise<void>; onAccountRefresh:()=>Promise<void>}) {
  const accountRequest = useAccountRequest();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{name:string; data:unknown}|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function download() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await accountRequest<unknown>('/api/backup');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `SQE学习备份-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url), 1000);
      setMessage('已生成备份下载，请确认文件已保存。备份不包含 PDF 教材原文件。');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function choose(file:File|undefined) {
    setSelected(null); setError(''); setMessage('');
    if (!file) return;
    try {
      const data:unknown = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
      setSelected({name:file.name, data});
    } catch { setError('无法读取该文件，请选择完整的 SQE 学习备份 JSON 文件。'); }
  }
  async function restore() {
    if (!selected || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await accountRequest<BackupResult>('/api/backup', selected.data);
      const missing = result.files?.requiresUpload?.length ?? (Array.isArray(result.missingFiles) ? result.missingFiles.length : result.missingFiles || 0);
      const imported = result.tables ? Object.values(result.tables).reduce((total, table)=>total+table.inserted,0) : counts(result.imported);
      const skipped = result.tables ? Object.values(result.tables).reduce((total, table)=>total+table.skipped,0) : counts(result.skipped);
      setSelected(null);
      if (fileInput.current) fileInput.current.value = '';
      await onImported();
      await onAccountRefresh();
      const migration = result.migration ? `旧版本机备份：有 ${result.migration.unknownQuestionIds.length} 道题当前无法识别，跳过 ${result.migration.skippedAnswers.length} 条作答、${result.migration.skippedSessions.length} 次练习。请保留原备份文件，未迁移项仍在其中。` : '';
      setMessage(`恢复完成：导入 ${imported} 条，跳过 ${skipped} 条。${missing ? `有 ${missing} 份教材需要重新提供原 PDF 文件。` : 'PDF 教材原文件请另行保管。'}${migration}`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="cloud-section" aria-labelledby="cloud-backup-title"><h2 id="cloud-backup-title">学习数据备份</h2><p className="cloud-description">学习记录保存在账号中。你也可以下载一份备份，保存在自己的电脑或云盘。</p><p className="cloud-note">备份包含学习记录、笔记和已同步的教材阅读位置，<strong>不包含 PDF 教材原文件</strong>。请另外保存教材。</p>
    <p className="cloud-note">也接受旧版“本机做题备份”；这类文件仅迁移做题记录，不包含词卡、教材批注或 PDF。</p>
    <ReadingSyncNotice/>
    <div className="cloud-actions"><button type="button" className="cloud-secondary" onClick={()=>void download()} disabled={busy}><ArrowDownToLine size={16}/>下载备份</button><button type="button" className="cloud-secondary" onClick={()=>fileInput.current?.click()} disabled={busy}><ArrowUpFromLine size={16}/>选择备份恢复</button><input ref={fileInput} type="file" accept=".json,application/json" className="cloud-file-input" aria-label="选择学习备份文件" onChange={e=>void choose(e.target.files?.[0])} disabled={busy}/></div>
    {selected && <div className="cloud-import-preview"><strong>{selected.name}</strong><p>将备份记录合并到当前账号。建议先下载一份当前数据备份，再确认恢复。</p><div className="cloud-actions"><button type="button" className="cloud-primary" disabled={busy} onClick={()=>void restore()}><BusyLabel busy={busy}>{busy ? '恢复中…' : '确认恢复到此账号'}</BusyLabel></button><button type="button" className="cloud-text-button" disabled={busy} onClick={()=>{setSelected(null); if(fileInput.current)fileInput.current.value='';}}>取消</button></div></div>}
    <Feedback error={error} message={message}/>
  </section>;
}

function UserManagement({currentUser, onAccountRefresh}:{currentUser:AccountUser; onAccountRefresh:()=>Promise<void>}) {
  const accountRequest = useAccountRequest();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [resetUser, setResetUser] = useState<ManagedUser|null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const resetPasswordInput = useRef<HTMLInputElement>(null);
  useEffect(()=>{resetPasswordInput.current?.focus();},[resetUser?.id]);
  const load = useCallback(async()=>{
    const result = await accountRequest<{users:ManagedUser[]}>('/api/admin/users');
    setUsers(result.users);
  },[accountRequest]);
  useEffect(()=>{
    let active = true;
    void accountRequest<{users:ManagedUser[]}>('/api/admin/users').then(result=>{if(active)setUsers(result.users);}).catch(cause=>{if(active)setError((cause as Error).message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[accountRequest]);
  async function change(action:()=>Promise<unknown>, success:string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await action();
      await load();
      await onAccountRefresh();
      setMessage(success);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change(async()=>{
      await accountRequest('/api/admin/users', {username:username.trim(), name:name.trim(), password});
      setUsername(''); setName(''); setPassword('');
    }, '账号已开通。请将账号和临时密码交给该用户，首次登录时须修改密码。');
  }
  function reset(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetUser || busy) return;
    if (resetPassword !== resetConfirmation) { setError('两次输入的临时密码不一致。'); return; }
    void change(async()=>{
      await accountRequest(`/api/admin/users/${encodeURIComponent(resetUser.id)}/reset-password`, {password:resetPassword});
      setResetUser(null); setResetPassword(''); setResetConfirmation('');
    }, '临时密码已更新。请通知该用户使用新密码登录，并在登录后修改密码。');
  }
  return <section className="cloud-section" aria-labelledby="cloud-users-title"><h2 id="cloud-users-title">用户管理</h2><details className="cloud-details"><summary>开通新账号</summary><form className="cloud-form" onSubmit={create}><fieldset disabled={busy}>
    <div className="cloud-form-row"><label>账号<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required/></label><label>显示名称<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="off" required/></label></div>
    <label>临时密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password"/><small>12–128 个字符。用户首次登录后须自行改密。</small></label>
    <button type="submit" className="cloud-primary"><BusyLabel busy={busy}>开通账号</BusyLabel></button>
  </fieldset></form></details>
    {loading ? <p className="cloud-muted" role="status">正在读取用户列表…</p> : <ul className="cloud-user-list">{users.map(item=><li key={item.id}><div className="cloud-user-info"><strong>{item.name || item.username}</strong><small>{item.username}{item.id===currentUser.id ? ' · 当前账号' : ''}</small><span className={`cloud-user-state ${item.disabled ? 'cloud-user-disabled' : ''}`}>{item.disabled ? '已停用' : item.mustChangePassword ? '待修改初始密码' : '使用中'}</span></div>{item.id!==currentUser.id && <div className="cloud-user-actions"><button type="button" className="cloud-text-button" disabled={busy} onClick={()=>{setResetUser(item);setResetPassword('');setResetConfirmation('');setError('');setMessage('');}}>重设密码</button><button type="button" className={`cloud-text-button ${item.disabled ? '' : 'cloud-danger-text'}`} disabled={busy} onClick={()=>void change(()=>accountRequest(`/api/admin/users/${encodeURIComponent(item.id)}/${item.disabled ? 'enable' : 'disable'}`, {}), item.disabled ? '账号已启用。' : '账号已停用，学习数据保留。')}>{item.disabled ? '启用' : '停用'}</button></div>}</li>)}</ul>}
    {resetUser && <form className="cloud-form cloud-reset-form" onSubmit={reset}><h3>为 {resetUser.name || resetUser.username} 设置临时密码</h3><fieldset disabled={busy}><label>新临时密码<input ref={resetPasswordInput} type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/></label><label>再次输入临时密码<input type="password" value={resetConfirmation} onChange={e=>setResetConfirmation(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/></label><small className="cloud-muted">该用户下次登录后须自行修改密码。</small><div className="cloud-actions"><button type="submit" className="cloud-primary"><BusyLabel busy={busy}>保存临时密码</BusyLabel></button><button type="button" className="cloud-text-button" onClick={()=>{setResetUser(null);setResetPassword('');setResetConfirmation('');}}>取消</button></div></fieldset></form>}
    <Feedback error={error} message={message}/>
    {!loading && error && <button type="button" className="cloud-text-button" disabled={busy} onClick={()=>void change(load, '用户列表已刷新。')}>刷新用户列表</button>}
  </section>;
}

function AccountDialog({user, open, onOpenChange, onAccountRefresh, onImported, onLogout}:{user:AccountUser; open:boolean; onOpenChange:(open:boolean)=>void; onAccountRefresh:()=>Promise<void>; onImported:()=>Promise<void>; onLogout:(expectedAccountId:string)=>Promise<void>}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try { await onLogout(user.id); } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="cloud-account-dialog"><DialogHeader><DialogTitle>账号与备份</DialogTitle><DialogDescription>{user.name || user.username} · {user.username}{user.role==='admin' ? ' · 管理员' : ''}</DialogDescription></DialogHeader><BackupPanel onImported={onImported} onAccountRefresh={onAccountRefresh}/><section className="cloud-section"><details className="cloud-details"><summary>修改密码</summary><PasswordForm onChanged={onAccountRefresh}/></details></section>{user.role==='admin' && <UserManagement currentUser={user} onAccountRefresh={onAccountRefresh}/>}<footer className="cloud-account-footer"><Feedback error={error}/><button type="button" className="cloud-secondary" onClick={()=>void logout()} disabled={busy}><LogOut size={16}/><BusyLabel busy={busy}>{busy ? '正在退出…' : '退出登录'}</BusyLabel></button></footer></DialogContent></Dialog>;
}

export default function CloudApp() {
  const [account, setAccount] = useState<Account|null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const userId = useRef<string|null|undefined>(undefined);
  const readingAccountId = useRef<string|null|undefined>(undefined);
  const readingActivation = useRef<Promise<void>>(Promise.resolve());
  const accountGeneration = useRef(0);
  const invalidateAccountRequests = useCallback(()=>{accountGeneration.current++;},[]);
  const adoptAccount = useCallback(async(next:Account, generation:number)=>{
    if (generation !== accountGeneration.current) return;
    const nextId = next.user?.id || null;
    if (userId.current !== nextId) {
      setAccount(null); setAccountOpen(false);
      userId.current = nextId;
      setWorkspaceAccount(nextId);
    }
    const nextReadingId = next.user && !next.user.mustChangePassword ? next.user.id : null;
    if (readingAccountId.current !== nextReadingId) {
      readingAccountId.current = nextReadingId;
      readingActivation.current = activateReadingAccount(nextReadingId);
    }
    await readingActivation.current;
    if (generation !== accountGeneration.current) return;
    setAccount(next); setLoadError('');
    if (!next.user) setAccountOpen(false);
  },[]);
  const refresh = useCallback(async()=>{
    const generation = ++accountGeneration.current;
    await adoptAccount(await request<Account>('/api/account'),generation);
  },[adoptAccount]);
  useEffect(()=>{
    const generation = ++accountGeneration.current;
    void request<Account>('/api/account').then(next=>adoptAccount(next,generation)).catch(cause=>{if(generation===accountGeneration.current)setLoadError((cause as Error).message);});
    const onFocus = ()=>{ if (document.visibilityState==='visible') void refresh().catch(()=>{}); };
    const onExpired = ()=>{accountGeneration.current++;setWorkspaceAccount(null);readingAccountId.current=null;readingActivation.current=activateReadingAccount(null);userId.current=null;setAccount({user:null,setupRequired:false});setAccountOpen(false);setNotice('登录已失效，请重新登录。');};
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onFocus);
    window.addEventListener(expiredEvent,onExpired);
    return ()=>{invalidateAccountRequests();window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);window.removeEventListener(expiredEvent,onExpired);};
  },[refresh,adoptAccount,invalidateAccountRequests]);
  async function logout(expectedAccountId:string) {
    await request('/api/account/logout', {}, expectedAccountId);
    accountGeneration.current++;
    setWorkspaceAccount(null); readingAccountId.current=null; readingActivation.current=activateReadingAccount(null); await readingActivation.current;
    userId.current=null; setAccountOpen(false); setNotice('');
    setAccount({user:null,setupRequired:false});
    await refresh();
  }
  if (!account) return <AuthFrame title="你的学习空间" description="账号登录后，即可读取学习记录。">{loadError ? <><Feedback error={loadError}/><button type="button" className="cloud-primary" onClick={()=>{setLoadError('');void refresh().catch(cause=>setLoadError((cause as Error).message));}}>重试连接</button></> : <p className="cloud-loading" role="status"><Loader2 className="cloud-spinner" size={20}/>正在连接…</p>}</AuthFrame>;
  if (!account.user) return <SignIn key={account.setupRequired ? 'setup' : 'login'} setup={account.setupRequired} notice={notice} onSuccess={async()=>{await refresh();setNotice('');}}/>;
  const user = account.user;
  if (user.mustChangePassword) return <ExpectedAccountProvider accountId={user.id}><AuthFrame title="设置你的专属密码" description="你正在使用临时密码。请先修改密码，再进入学习空间。"><PasswordForm required onChanged={refresh}/><Feedback error={loadError}/><button type="button" className="cloud-text-button cloud-gate-logout" disabled={loggingOut} onClick={()=>{setLoggingOut(true);void logout(user.id).catch(cause=>setLoadError((cause as Error).message)).finally(()=>setLoggingOut(false));}}>{loggingOut ? '正在退出…' : '退出登录'}</button></AuthFrame></ExpectedAccountProvider>;
  return <ExpectedAccountProvider accountId={user.id}><StudyApp key={`${user.id}:${revision}`} authenticated standalone={false} loginHref="/login" accountControl={<button type="button" className="cloud-account-button" onClick={()=>setAccountOpen(true)} aria-label="打开账号与备份"><span className="cloud-account-avatar"><UserRound size={19}/></span><span className="cloud-account-button-copy"><strong>{user.name || user.username}</strong><small>账号与备份</small></span><ChevronRight size={15}/></button>}/>{accountOpen && <AccountDialog user={user} open={accountOpen} onOpenChange={setAccountOpen} onAccountRefresh={refresh} onImported={async()=>{readingActivation.current=activateReadingAccount(user.id);await readingActivation.current;setRevision(value=>value+1);}} onLogout={logout}/>}</ExpectedAccountProvider>;
}
