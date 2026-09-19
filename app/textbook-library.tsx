'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {BookOpen,FileUp,Highlighter,Loader2,PanelLeft,Pencil,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {subjectById} from '@/lib/subjects';
import {readReadingPositions,writeReadingPosition} from '@/lib/textbook-reading-position';
import {TextbookReader} from './textbook-reader';
import './textbook-library.css';
import type {Textbook} from '@/lib/textbooks';
import type {TextbookAnnotationsController} from './use-textbook-annotations';
import type {TextbookCatalogController} from './use-textbook-catalog';

type LibraryPanel='catalog'|'notes';
type BookFilter='all'|'FLK1'|'FLK2'|'mine';
const bookFilters:{id:BookFilter;label:string}[]=[{id:'all',label:'全部'},{id:'FLK1',label:'FLK1'},{id:'FLK2',label:'FLK2'},{id:'mine',label:'我的'}];

export function TextbookLibrary({controller,catalog,guest=false}:{controller:TextbookAnnotationsController;catalog:TextbookCatalogController;guest?:boolean}){
 const[first]=catalog.books;
 const[selectedId,setSelectedId]=useState(first?.id??'');
 const[target,setTarget]=useState({bookId:first?.id??'',page:1});
 const[positionReady,setPositionReady]=useState(false);
 const[positions,setPositions]=useState<Record<string,number>>({});
 const[panel,setPanel]=useState<LibraryPanel|null>(null);
 const[query,setQuery]=useState(''),[filter,setFilter]=useState<BookFilter>('all');
 const[noteQuery,setNoteQuery]=useState('');
 const[renameBook,setRenameBook]=useState<Textbook|null>(null),[renameValue,setRenameValue]=useState('');
 const[importOpen,setImportOpen]=useState(false),[importFile,setImportFile]=useState<File|null>(null),[importName,setImportName]=useState('');
 const book=catalog.books.find(item=>item.id===selectedId)??first;
 const bookNotes=useMemo(()=>(controller.data?.annotations??[]).filter(item=>item.bookId===book?.id).sort((a,b)=>a.page-b.page||b.updatedAt-a.updatedAt),[controller.data?.annotations,book?.id]);
 const noteCounts=useMemo(()=>{const counts=new Map<string,number>();for(const note of controller.data?.annotations??[])counts.set(note.bookId,(counts.get(note.bookId)??0)+1);return counts;},[controller.data?.annotations]);
 const filteredNotes=useMemo(()=>{const term=noteQuery.trim().toLocaleLowerCase();return bookNotes.filter(note=>!term||`${note.quote} ${note.note} ${note.page}`.toLocaleLowerCase().includes(term));},[bookNotes,noteQuery]);
 const groups=useMemo(()=>{
  const term=query.trim().toLocaleLowerCase();
  const filtered=catalog.books.filter(item=>{
   const subject=subjectById(item.subjectId);
   const matchesFilter=filter==='all'||(filter==='mine'?item.imported||item.subjectId==='my-materials':subject?.group===filter);
   return matchesFilter&&(!term||`${item.title} ${item.shortTitle} ${item.version} ${subject?.zh??''} ${subject?.en??''}`.toLocaleLowerCase().includes(term));
  });
  const ids=[...new Set(filtered.map(item=>item.subjectId))];
  ids.sort((a,b)=>a==='my-materials'?-1:b==='my-materials'?1:0);
  return ids.map(id=>({id,books:filtered.filter(item=>item.subjectId===id)}));
 },[catalog.books,query,filter]);
 const resultCount=groups.reduce((total,group)=>total+group.books.length,0);
 useEffect(()=>{
  if(positionReady||catalog.loading)return;
  const timer=window.setTimeout(()=>{
   const saved=readReadingPositions(catalog.books),id=saved.lastBookId??catalog.books[0]?.id??'';
   setPositions(saved.pages);setSelectedId(id);setTarget({bookId:id,page:saved.pages[id]??1});setPositionReady(true);
  },0);
  return()=>window.clearTimeout(timer);
 },[catalog.books,catalog.loading,positionReady]);
 const closePanel=()=>{const previous=panel;setPanel(null);requestAnimationFrame(()=>document.getElementById(`textbook-${previous}-toggle`)?.focus());};
 const togglePanel=(next:LibraryPanel)=>{
  if(panel===next){closePanel();return;}
  setPanel(next);
  requestAnimationFrame(()=>document.getElementById(`textbook-${next}-search`)?.focus());
 };
 const selectBook=(id:string)=>{
  const next=catalog.books.find(item=>item.id===id);if(!next)return;
  setSelectedId(id);setTarget({bookId:id,page:Math.min(next.pageCount,positions[id]??1)});setNoteQuery('');
  closePanel();
 };
 const handlePosition=useCallback((bookId:string,page:number)=>{
  setTarget(current=>current.bookId===bookId&&current.page===page?current:{bookId,page});
  setPositions(current=>current[bookId]===page?current:{...current,[bookId]:page});
  writeReadingPosition(bookId,page);
 },[]);
 const openRename=(item:Textbook)=>{setRenameBook(item);setRenameValue(item.shortTitle);};
 const submitRename=async(event:React.FormEvent)=>{event.preventDefault();if(!renameBook||!renameValue.trim())return;if(await catalog.rename(renameBook.id,renameValue.trim()))setRenameBook(null);};
 const chooseFile=(file?:File)=>{setImportFile(file??null);if(file&&!importName.trim())setImportName(file.name.replace(/\.pdf$/i,''));};
 const submitImport=async(event:React.FormEvent)=>{event.preventDefault();if(!importFile||!importName.trim())return;if(await catalog.importPdf(importFile,importName.trim())){setImportOpen(false);setImportFile(null);setImportName('');setQuery('');setFilter('mine');setPanel('catalog');}};
 const panelControls=<div className="textbook-panel-controls" role="group" aria-label="阅读侧栏">
  <Button id="textbook-catalog-toggle" variant="ghost" size="sm" aria-label="书目" title="打开或收起书目" aria-expanded={panel==='catalog'} aria-controls="textbook-catalog-panel" onClick={()=>togglePanel('catalog')}><PanelLeft size={16}/><span className="textbook-panel-button-label">书目</span></Button>
  <Button id="textbook-notes-toggle" variant="ghost" size="sm" aria-label={`笔记，${bookNotes.length} 条`} title="打开或收起笔记" aria-expanded={panel==='notes'} aria-controls="textbook-notes-panel" onClick={()=>togglePanel('notes')}><Highlighter size={16}/><span className="textbook-panel-button-label">笔记</span><span className="textbook-count">{bookNotes.length}</span></Button>
 </div>;
 if(!positionReady)return <div className="empty"><Loader2 className="animate-spin" size={24}/><p>正在打开上次阅读位置…</p></div>;
 return <section className="textbook-library-page textbook-library-refined textbook-library-compact" onKeyDown={event=>{
  if(!event.defaultPrevented&&event.key==='Escape'&&panel&&!renameBook&&!importOpen&&!(event.target as HTMLElement).closest('[role="dialog"],[role="alertdialog"]')){event.preventDefault();closePanel();}
 }} onPointerDown={event=>{
  // Book selection is temporary; notes stay open while the reader is used.
  if(panel==='catalog'&&!renameBook&&!importOpen&&!(event.target as HTMLElement).closest('#textbook-catalog-panel,#textbook-catalog-toggle,#textbook-notes-toggle,[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]'))setPanel(null);
 }}>
  <h1 className="sr-only">教材阅读</h1>
  {(controller.error||catalog.error)&&<div className="notice error" role="alert"><span>{controller.error||catalog.error}</span><Button variant="outline" disabled={controller.busy||controller.loading||catalog.busy||catalog.loading} onClick={()=>void Promise.all([controller.load(),catalog.load()])}>重新读取</Button></div>}
  <div className={`textbook-library-layout ${panel??'reading'}-open`}>
   <aside id="textbook-catalog-panel" className="textbook-catalog" aria-label="教材目录" hidden={panel!=='catalog'}>
    <div className="textbook-catalog-heading"><div><h2>我的书目</h2><span>{catalog.books.length}</span></div><div className="textbook-panel-heading-actions"><Button size="sm" variant="outline" onClick={()=>setImportOpen(true)} disabled={catalog.busy}><FileUp size={14}/>导入</Button><Button size="icon" variant="ghost" aria-label="收起书目" onClick={closePanel}><X size={16}/></Button></div></div>
    <div className="textbook-panel-search"><Search size={15}/><Input id="textbook-catalog-search" aria-label="搜索教材" placeholder="搜索书名或科目" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="清除教材搜索" onClick={()=>{setQuery('');document.getElementById('textbook-catalog-search')?.focus();}}><X size={14}/></button>}</div>
    <div className="textbook-catalog-filters" role="group" aria-label="教材分类">{bookFilters.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}</button>)}</div>
    <div className="textbook-catalog-results" aria-live="polite">{query||filter!=='all'?`${resultCount} 本教材`:'按科目查找 · 自动记住阅读页码'}</div>
    <div className="textbook-catalog-books">
     {groups.length?groups.map(group=><section key={group.id}><h3><span>{group.id==='my-materials'?'我的教材':subjectById(group.id)?.zh??group.id}</span>{subjectById(group.id)&&<small>{subjectById(group.id)?.group}</small>}</h3>{group.books.map(item=>{
      const count=noteCounts.get(item.id)??0,isCurrent=item.id===book?.id;
      return <div className={`textbook-catalog-row ${isCurrent?'active':''}`} key={item.id}>
       <button className="textbook-catalog-select" onClick={()=>selectBook(item.id)} aria-current={isCurrent?'page':undefined}>
        <span>{item.shortTitle.replace(/^Revise · |^Notes · /,'')}</span>
        <small>{item.version} · {item.pageCount} 页</small>
        {(positions[item.id]||count>0)&&<small className="textbook-book-location">{positions[item.id]?`上次读到 ${positions[item.id]} 页`:''}{positions[item.id]&&count?' · ':''}{count?`${count} 条笔记`:''}</small>}
       </button>
       <Button size="icon" variant="ghost" aria-label={`重命名 ${item.shortTitle}`} onClick={()=>openRename(item)}><Pencil size={14}/></Button>
      </div>;
     })}</section>):<div className="textbook-filter-empty"><BookOpen size={24}/><p>{filter==='mine'&&!query?'还没有导入教材':'没有找到匹配的教材'}</p><small>{filter==='mine'&&!query?'通过右上角“导入”添加自己的 PDF。':'试试其他书名、科目或分类。'}</small>{(query||filter!=='all')&&<Button variant="ghost" size="sm" onClick={()=>{setQuery('');setFilter('all');}}>查看全部教材</Button>}</div>}
    </div>
   </aside>
   <div className="textbook-library-reader">
    {book?<TextbookReader key={book.id} references={[]} books={[book]} initial={target} annotations={controller} standalone toolbarStart={panelControls} onPositionChange={handlePosition}/>:<div className="empty">{panelControls}<BookOpen/><p>尚无教材。</p><Button onClick={()=>setImportOpen(true)}><FileUp size={15}/>导入 PDF</Button></div>}
   </div>
   <aside id="textbook-notes-panel" className="textbook-note-index" aria-label="教材高亮笔记" hidden={panel!=='notes'}>
    <div className="textbook-note-index-heading"><div><h2><Highlighter size={17}/>高亮笔记 <span className="textbook-count">{bookNotes.length}</span></h2><p>{book?.shortTitle??'选择一本教材'}</p></div><Button size="icon" variant="ghost" aria-label="收起笔记" onClick={closePanel}><X size={16}/></Button></div>
    <div className="textbook-panel-search"><Search size={15}/><Input id="textbook-notes-search" aria-label="搜索当前教材笔记" placeholder="搜索高亮、笔记或页码" value={noteQuery} onChange={event=>setNoteQuery(event.target.value)}/>{noteQuery&&<button type="button" aria-label="清除笔记搜索" onClick={()=>{setNoteQuery('');document.getElementById('textbook-notes-search')?.focus();}}><X size={14}/></button>}</div>
    {controller.loading&&!controller.data?<div className="textbook-notes-loading"><Loader2 className="animate-spin" size={18}/>正在读取…</div>:!bookNotes.length?<div className="textbook-notes-empty"><div className="textbook-note-empty-icon"><Highlighter size={24}/></div><p>把重要的规则留下来</p><small>在教材中选中文字，即可高亮或写笔记。<br/>保存后，在这里点击即可回到原文。</small></div>:!filteredNotes.length?<div className="textbook-filter-empty"><p>没有匹配的笔记</p><Button variant="ghost" size="sm" onClick={()=>setNoteQuery('')}>查看全部笔记</Button></div>:<div className="textbook-note-list">{filteredNotes.map(item=><button key={item.id} onClick={()=>{setTarget({bookId:item.bookId,page:item.page});}}><span>第 {item.page} 页<span>回到原文 →</span></span><blockquote>{item.quote}</blockquote>{item.note&&<p>{item.note}</p>}</button>)}</div>}
   </aside>
  </div>
  <Dialog open={!!renameBook} onOpenChange={open=>{if(!open&&!catalog.busy)setRenameBook(null);}}><DialogContent className="textbook-manage-dialog"><DialogHeader><DialogTitle>重命名教材</DialogTitle><DialogDescription>只改变你在刷题室看到的名称，不会修改 PDF 文件。</DialogDescription></DialogHeader><form onSubmit={submitRename}><div className="textbook-manage-field"><Label htmlFor="textbook-rename">教材名称</Label><Input id="textbook-rename" autoFocus maxLength={120} value={renameValue} onChange={event=>setRenameValue(event.target.value)}/></div><DialogFooter><Button type="button" variant="outline" disabled={catalog.busy} onClick={()=>setRenameBook(null)}>取消</Button><Button type="submit" disabled={catalog.busy||!renameValue.trim()}>{catalog.busy?<Loader2 size={15} className="animate-spin"/>:<Pencil size={15}/>}保存名称</Button></DialogFooter></form></DialogContent></Dialog>
  <Dialog open={importOpen} onOpenChange={open=>{if(!catalog.busy)setImportOpen(open);}}><DialogContent className="textbook-manage-dialog"><DialogHeader><DialogTitle>导入教材 PDF</DialogTitle><DialogDescription>{guest?'PDF 只保存在当前浏览器中，清除网站数据或更换设备后需要重新导入。单份不超过 80 MB。':'PDF 会保存到你的账号中，导入后可连续阅读、高亮并记录笔记。单份不超过 80 MB。'}</DialogDescription></DialogHeader><form onSubmit={submitImport}><div className="textbook-manage-field"><Label htmlFor="textbook-file">PDF 文件</Label><Input id="textbook-file" type="file" accept="application/pdf,.pdf" onChange={event=>chooseFile(event.target.files?.[0])}/></div><div className="textbook-manage-field"><Label htmlFor="textbook-import-name">教材名称</Label><Input id="textbook-import-name" maxLength={120} value={importName} onChange={event=>setImportName(event.target.value)} placeholder="例如：Business Law Notes"/></div><DialogFooter><Button type="button" variant="outline" disabled={catalog.busy} onClick={()=>setImportOpen(false)}>取消</Button><Button type="submit" disabled={catalog.busy||!importFile||!importName.trim()}>{catalog.busy?<Loader2 size={15} className="animate-spin"/>:<FileUp size={15}/>}导入教材</Button></DialogFooter></form></DialogContent></Dialog>
 </section>;
}
