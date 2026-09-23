'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,MoreHorizontal,Undo2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {addPlanDays,buildPlanRange,dailyAnswerCounts,emptyWeeklyPlan,groupPlanWeeks,parseWeeklyPlan,shortPlanDate,updatePlanWeek,weeklyPlanKey,type PlanWeek,type WeeklyPlan} from '@/lib/weekly-plan';
import './weekly-planner.css';

function loadPlan(key:string){
 try{const raw=window.localStorage.getItem(key);return {plan:parseWeeklyPlan(raw)??emptyWeeklyPlan(),raw,error:''};}
 catch{return {plan:emptyWeeklyPlan(),raw:null,error:'暂时无法读取本机计划。原存储不会自动覆盖；请检查浏览器存储，或导出本页内容作为备份。'};}
}
function WeekInput({week,onChange,onStart,onEnd}:{week:PlanWeek;onChange:(content:string)=>void;onStart:()=>void;onEnd:()=>void}){
 const ref=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{const resize=()=>{const node=ref.current;if(node){node.style.height='auto';node.style.height=`${Math.max(32,node.scrollHeight)}px`;}};resize();window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[week.content]);
 return <textarea ref={ref} className="wp-input" rows={1} value={week.content} placeholder="填写本周安排…" aria-label={`${week.start} 至 ${addPlanDays(week.start,6)} 的学习内容`} onFocus={onStart} onBlur={onEnd} onChange={event=>onChange(event.target.value)}/>;
}

export function WeeklyPlanner({scope,answerActivity}:{scope:string;answerActivity?:number[]}){
 const key=weeklyPlanKey(scope);
 const[loaded]=useState(()=>loadPlan(key));
 const[plan,setPlan]=useState(loaded.plan),[error,setError]=useState(loaded.error),[status,setStatus]=useState('计划仅保存在当前浏览器');
 const current=useRef(plan),raw=useRef<string|null>(loaded.raw),history=useRef<WeeklyPlan[]>([]),editing=useRef<{start:string;before:WeeklyPlan;changed:boolean}|null>(null),unsaved=useRef(false);
 const[undoCount,setUndoCount]=useState(0),[menu,setMenu]=useState(false);
 const[rangeOpen,setRangeOpen]=useState(false),[rangeStart,setRangeStart]=useState(''),[rangeEnd,setRangeEnd]=useState('');
 const[recordWeek,setRecordWeek]=useState<string|null>(null),[clearOpen,setClearOpen]=useState(false),[imported,setImported]=useState<WeeklyPlan|null>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 const counts=useMemo(()=>dailyAnswerCounts(answerActivity??[]),[answerActivity]);
 const groups=useMemo(()=>groupPlanWeeks(plan),[plan]);
 const range=useMemo(()=>{try{return rangeStart&&rangeEnd?{plan:buildPlanRange(plan,rangeStart,rangeEnd),error:''}:{plan:null,error:'请选择起始和结束月份。'};}catch(e){return {plan:null,error:(e as Error).message};}},[plan,rangeStart,rangeEnd]);

 function remember(previous=current.current){history.current=[...history.current.slice(-19),previous];setUndoCount(history.current.length);}
 function commit(next:WeeklyPlan,force=false){
  current.current=next;setPlan(next);
  try{
   if(!force&&window.localStorage.getItem(key)!==raw.current)throw new Error('其他页面修改了计划，当前编辑尚未保存。请先导出当前内容，再刷新核对，避免覆盖其他修改。');
   const value=JSON.stringify(next);window.localStorage.setItem(key,value);raw.current=value;unsaved.current=false;setError('');setStatus('已自动保存到本机');
  }catch(e){unsaved.current=true;setError((e as Error).message.startsWith('其他页面')?(e as Error).message:'浏览器未能保存计划。内容仍保留在本页，请导出备份，勿直接关闭页面。');}
 }
 useEffect(()=>{
  const receive=(event:StorageEvent)=>{
   if((event.key!==key&&event.key!==null)||event.storageArea!==window.localStorage)return;
   if(unsaved.current||editing.current?.changed){setError('其他页面修改了计划。继续编辑前请导出当前内容，再刷新核对。');return;}
   try{const value=window.localStorage.getItem(key),next=parseWeeklyPlan(value)??emptyWeeklyPlan();current.current=next;raw.current=value;setPlan(next);history.current=[];setUndoCount(0);setError('');setStatus('已载入其他页面的更新');}catch{setError('其他页面的计划无法读取，当前内容已保留。');}
  };
  window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
 },[key]);
 function editWeek(start:string,content:string){
  if(!editing.current||editing.current.start!==start)editing.current={start,before:current.current,changed:false};
  if(!editing.current.changed){remember(editing.current.before);editing.current.changed=true;}
  commit(updatePlanWeek(current.current,start,{content}));
 }
 function exportPlan(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(current.current,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download=`sqe-weekly-plan-${current.current.weeks[0].start}.json`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setMenu(false);
 }
 async function readImport(file?:File){
  if(!file)return;
  try{if(file.size>10_000_000)throw new Error('计划文件过大，请选择 10 MB 以内的 JSON 文件。');const next=parseWeeklyPlan(await file.text());if(!next)throw new Error('文件中没有计划内容。');setImported(next);}catch(e){setError((e as Error).message);}
  if(fileInput.current)fileInput.current.value='';
 }
 const first=plan.weeks[0].start.slice(0,7),last=plan.weeks[plan.weeks.length-1].start.slice(0,7);
 const recordDays=recordWeek?Array.from({length:7},(_,i)=>addPlanDays(recordWeek,i)):[];

 return <section className="weekly-planner" aria-label="自定义每周学习计划">
  <div className="wp-card">
   <div className="wp-toolbar">
    <button type="button" className="wp-range" aria-label="设置计划起始和结束月份" onClick={()=>{setRangeStart(first);setRangeEnd(last);setRangeOpen(true);}}>{first.replace('-','.')} — {last.replace('-','.')}<ChevronDown size={13}/></button>
    <div className="wp-actions">{undoCount>0&&<button type="button" className="wp-undo" onClick={()=>{const previous=history.current.pop();if(previous){editing.current=null;commit(previous);setUndoCount(history.current.length);}}}><Undo2 size={13}/>撤销</button>}
     <Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><button type="button" className="wp-more" aria-label="计划选项"><MoreHorizontal size={20}/></button></PopoverTrigger><PopoverContent className="wp-menu" align="end"><button type="button" onClick={exportPlan}>导出计划</button><button type="button" onClick={()=>{setMenu(false);fileInput.current?.click();}}>导入计划</button><button type="button" onClick={()=>{setMenu(false);setClearOpen(true);}}>清空当前月份内容</button></PopoverContent></Popover>
     <input type="file" accept=".json,application/json" ref={fileInput} hidden aria-label="导入学习计划文件" onChange={event=>void readImport(event.target.files?.[0])}/>
    </div>
   </div>
   {error&&<p className="wp-error" role="alert">{error}</p>}
   <div className="wp-table-wrap"><table className="wp-table" aria-label="按月份和日期排列的每周内容"><colgroup><col className="wp-month-col"/><col className="wp-date-col"/><col/></colgroup><thead><tr><th scope="col">月份</th><th scope="col">日期</th><th scope="col">每周内容<span className="wp-hint">直接输入，自动保存</span></th></tr></thead>
    {groups.map(group=><tbody key={group.month}>{group.weeks.map((week,index)=><tr key={week.start} className={index===0?'wp-month-start':undefined}>
     {index===0&&<th className="wp-month" scope="rowgroup" rowSpan={group.weeks.length}><span>{Number(group.month.slice(5))} 月</span><small>{group.month.slice(0,4)}</small></th>}
     <td className="wp-date"><button type="button" onClick={()=>setRecordWeek(week.start)} title="查看每日答题记录" aria-label={`查看 ${week.start} 至 ${addPlanDays(week.start,6)} 的答题记录`}>{shortPlanDate(week.start)} – {shortPlanDate(addPlanDays(week.start,6))}</button></td>
     <td className="wp-content"><div className={`wp-entry${week.done?' done':''}`}><label className="wp-check"><input type="checkbox" checked={week.done} disabled={!week.content.trim()} aria-label={`完成 ${week.start} 开始的本周安排`} onChange={event=>{editing.current=null;remember();commit(updatePlanWeek(current.current,week.start,{done:event.target.checked}));}}/></label><WeekInput week={week} onStart={()=>{editing.current={start:week.start,before:current.current,changed:false};}} onEnd={()=>{editing.current=null;}} onChange={content=>editWeek(week.start,content)}/></div></td>
    </tr>)}</tbody>)}
   </table></div>
  </div>
  <div className="wp-footer"><span>点击日期查看实际答题记录</span><span role="status">{error?'当前更改可能尚未保存':status}</span></div>

  <Dialog open={rangeOpen} onOpenChange={setRangeOpen}><DialogContent className="wp-dialog"><DialogHeader><DialogTitle>设置计划月份</DialogTitle><DialogDescription>选择起始与结束月份，每周内容由你自由填写。</DialogDescription></DialogHeader><form onSubmit={event=>{event.preventDefault();if(!range.plan)return;remember();commit(range.plan);setRangeOpen(false);}}><div className="wp-range-fields"><label>起始月份<input type="month" required min="2000-01" max="2100-12" value={rangeStart} onChange={event=>setRangeStart(event.target.value)}/></label><label>结束月份<input type="month" required min="2000-01" max="2100-12" value={rangeEnd} onChange={event=>setRangeEnd(event.target.value)}/></label></div><p className={range.error?'wp-error':'wp-preview'} aria-live="polite">{range.error||`共 ${range.plan?.weeks.length} 周；新增周为空白，已有内容按原日期保留。`}</p><p className="wp-help">从起始月第一个周一开始，跨月周归周一所在月份。缩小范围不会删除内容，选回原月份即可恢复。</p><DialogFooter><Button type="button" variant="outline" onClick={()=>setRangeOpen(false)}>取消</Button><Button type="submit" disabled={!range.plan}>应用</Button></DialogFooter></form></DialogContent></Dialog>
  <Dialog open={recordWeek!==null} onOpenChange={open=>{if(!open)setRecordWeek(null);}}><DialogContent className="wp-dialog"><DialogHeader><DialogTitle>本周答题记录</DialogTitle><DialogDescription>{recordWeek} 至 {recordWeek?addPlanDays(recordWeek,6):''}{answerActivity?` · 共 ${recordDays.reduce((n,day)=>n+(counts[day]??0),0)} 次`:''}</DialogDescription></DialogHeader>{answerActivity?<div className="wp-records">{recordDays.map((day,i)=><div key={day}><span>{shortPlanDate(day)}<small>周{'一二三四五六日'[i]}</small></span><strong>{counts[day]??0} 次</strong></div>)}</div>:<p className="wp-help">当前数据暂未提供每日答题时间，无法显示统计。</p>}<p className="wp-help">按本地日期统计已提交的有效作答，包含重做；不计空白答案、未交卷的历史模拟，以及缺少答题时间的旧记录。</p></DialogContent></Dialog>
  <Dialog open={clearOpen} onOpenChange={setClearOpen}><DialogContent className="wp-dialog"><DialogHeader><DialogTitle>清空当前月份内容？</DialogTitle><DialogDescription>将清空当前显示范围内的每周文字及完成勾选，日期和范围外的内容保留。操作后可撤销。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setClearOpen(false)}>取消</Button><Button onClick={()=>{remember();commit({...current.current,weeks:current.current.weeks.map(week=>({...week,content:'',done:false}))});setClearOpen(false);}}>清空内容</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={imported!==null} onOpenChange={open=>{if(!open)setImported(null);}}><DialogContent className="wp-dialog"><DialogHeader><DialogTitle>导入学习计划？</DialogTitle><DialogDescription>将用文件中的计划替换本机当前计划及范围外内容。建议先导出当前计划；导入后也可撤销。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setImported(null)}>取消</Button><Button onClick={()=>{if(imported){remember();commit(imported,true);setImported(null);}}}>确认导入</Button></DialogFooter></DialogContent></Dialog>
 </section>;
}
