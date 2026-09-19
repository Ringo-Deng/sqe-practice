'use client';
import {useState} from 'react';
import {Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {readLegacyStudyBackup} from '@/lib/legacy-study-backup';

export function LocalStudyBackup(){
 const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 function download(){
  setMessage('');setError('');
  try{
   const backup=readLegacyStudyBackup(window.localStorage);
   const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
   const link=document.createElement('a');
   link.href=url;link.download=`SQE本机做题备份-${new Date().toISOString().slice(0,10)}.json`;
   document.body.appendChild(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage('已生成下载，请确认文件保存成功，并另外保存在云盘或其他设备。');
  }catch(cause){setError(cause instanceof Error?cause.message:'无法读取本机记录，请稍后重试。');}
 }
 return <><button type="button" className="sidebar-login" onClick={()=>{setMessage('');setError('');setOpen(true);}}>备份本机做题记录</button>{open&&<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>备份本机做题记录</DialogTitle><DialogDescription>下载当前浏览器的练习与作答记录。以后可在账号版的“账号与备份”中导入。</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">这份备份只包含做题记录，不包含词卡、教材批注或 PDF 文件。下载不会删除或修改本机记录。</p><Button onClick={download}><Download size={16}/>下载做题备份</Button>{message&&<p className="text-sm" role="status">{message}</p>}{error&&<p className="text-sm text-destructive" role="alert">{error}</p>}</DialogContent></Dialog>}</>;
}
