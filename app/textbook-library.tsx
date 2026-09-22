'use client';
import {useCallback,useEffect,useMemo,useState,type CSSProperties} from 'react';
import {Bookmark,BookmarkPlus,BookOpen,FileUp,Highlighter,Loader2,PanelLeft,Pencil,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {subjects,subjectById} from '@/lib/subjects';
import {questions} from '@/lib/questions';
import {useStudyTimeSetting,useSubjectStudyTime} from './use-study-time';
import {bookMatchesCategory,bookSubjectIds,type BookFilter} from '@/lib/library-books';
import {readReadingPositions,writeReadingPosition} from '@/lib/textbook-reading-position';
import {TextbookReader} from './textbook-reader';
import {TextbookBookmarkEditor} from './textbook-bookmark-editor';
import './textbook-library.css';
import type {Textbook,TextbookReaderTarget} from '@/lib/textbooks';
import type {TextbookAnnotationsController} from './use-textbook-annotations';
import type {TextbookCatalogController} from './use-textbook-catalog';
import type {TextbookBookmarksController} from './use-textbook-bookmarks';
import type {TextbookBookmarkDraft} from '@/lib/textbook-bookmarks';

type LibraryPanel='catalog'|'notes'|'bookmarks';
const bookFilters:{id:BookFilter;label:string}[]=[{id:'all',label:'全部'},{id:'FLK1',label:'FLK1'},{id:'FLK2',label:'FLK2'},{id:'maps',label:'导图'},{id:'mine',label:'我的'}];

export function TextbookLibrary({controller,catalog,bookmarks,guest=false,initial,kind='textbook',initialPanel=null}:{controller:TextbookAnnotationsController;catalog:TextbookCatalogController;bookmarks:TextbookBookmarksController;guest?:boolean;initial?:TextbookReaderTarget;kind?:'textbook'|'mindmap';initialPanel?:LibraryPanel|null}){
 const studyTimeSetting=useStudyTimeSetting();
 const isMindMap=kind==='mindmap';
 const[first]=catalog.books;
 const[selectedId,setSelectedId]=useState(first?.id??'');
 const[target,setTarget]=useState({bookId:first?.id??'',page:1});
 const[navigationRequest,setNavigationRequest]=useState(0);
 const[toolbarHeight,setToolbarHeight]=useState(56);
 const[positionReady,setPositionReady]=useState(false);
 const[positions,setPositions]=useState<Record<string,number>>({});
 const[panel,setPanel]=useState<LibraryPanel|null>(initialPanel);
 const[query,setQuery]=useState(''),[filter,setFilter]=useState<BookFilter>('all');
 const[subjectFilter,setSubjectFilter]=useState('all');
 const[noteQuery,setNoteQuery]=useState('');
 const[bookmarkQuery,setBookmarkQuery]=useState('');
 const[bookmarkDraft,setBookmarkDraft]=useState<TextbookBookmarkDraft|null>(null);
 const[editBook,setEditBook]=useState<Textbook|null>(null),[editTitle,setEditTitle]=useState(''),[editSubject,setEditSubject]=useState('my-materials');
 const[importOpen,setImportOpen]=useState(false),[importFile,setImportFile]=useState<File|null>(null),[importName,setImportName]=useState('');
 const book=catalog.books.find(item=>item.id===selectedId)??first;
 const sourceQuestionId=initial?.sourceQuestionId;
 const linkedSubjectId=useMemo(()=>sourceQuestionId?questions.find(question=>question.id===sourceQuestionId)?.subjectId:null,[sourceQuestionId]);
 const studySubjectId=linkedSubjectId??(book&&subjectById(book.subjectId)?book.subjectId:null);
 const studyTimeError=useSubjectStudyTime(positionReady?studySubjectId:null,studyTimeSetting.enabled,studyTimeSetting.ready);
 const activeMindMap=!!book?.pdfSlice;
 const bookNotes=useMemo(()=>(controller.data?.annotations??[]).filter(item=>item.bookId===book?.id).sort((a,b)=>a.page-b.page||b.updatedAt-a.updatedAt),[controller.data?.annotations,book?.id]);
 const filteredNotes=useMemo(()=>{const term=noteQuery.trim().toLocaleLowerCase();return bookNotes.filter(note=>!term||`${note.quote} ${note.note} ${note.page}`.toLocaleLowerCase().includes(term));},[bookNotes,noteQuery]);
 const bookBookmarks=useMemo(()=>(bookmarks.data?.bookmarks??[]).filter(item=>item.bookId===book?.id).sort((a,b)=>a.page-b.page),[bookmarks.data?.bookmarks,book?.id]);
 const filteredBookmarks=useMemo(()=>{const term=bookmarkQuery.trim().toLocaleLowerCase();return bookBookmarks.filter(item=>!term||`${item.note} ${item.page}`.toLocaleLowerCase().includes(term));},[bookBookmarks,bookmarkQuery]);
 const currentBookmark=bookBookmarks.find(item=>item.page===target.page);
 const filterBooks=useMemo(()=>catalog.books.filter(item=>bookMatchesCategory(item,filter)),[catalog.books,filter]);
 const subjectFilters=useMemo(()=>[
  {id:'all',label:'全部科目'},
  ...subjects.filter(subject=>{
   const hasBook=filterBooks.some(item=>bookSubjectIds(item).includes(subject.id));
   return (isMindMap||filter==='maps')?hasBook:(filter!=='FLK1'&&filter!=='FLK2')||subject.group===filter||hasBook;
  }).map(subject=>({id:subject.id,label:subject.zh})),
  ...(filter==='all'||filter==='mine'?[{id:'my-materials',label:'未分类'}]:[]),
 ],[filter,filterBooks,isMindMap]);
 const filteredBooks=useMemo(()=>{
  const term=query.trim().toLocaleLowerCase();
  return filterBooks.filter(item=>{
   const subject=subjectById(item.subjectId);
   const subjectNames=bookSubjectIds(item).map(id=>subjectById(id)).filter(Boolean).map(value=>`${value?.zh??''} ${value?.en??''}`).join(' ');
   return (subjectFilter==='all'||bookSubjectIds(item).includes(subjectFilter))&&(!term||`${item.title} ${item.shortTitle} ${subject?.zh??'未分类'} ${subject?.en??''} ${subjectNames}`.toLocaleLowerCase().includes(term));
  });
 },[filterBooks,query,subjectFilter]);
 const resetFilters=()=>{setQuery('');setFilter('all');setSubjectFilter('all');};
 useEffect(()=>{
  if(positionReady||catalog.loading)return;
  const timer=window.setTimeout(()=>{
   const saved=readReadingPositions(catalog.books),requested=catalog.books.find(item=>item.id===initial?.bookId);
   const id=requested?.id??saved.lastBookId??catalog.books[0]?.id??'';
   const page=requested&&initial?Math.max(1,Math.min(requested.pageCount,initial.page)):saved.pages[id]??1;
   setPositions(saved.pages);setSelectedId(id);setTarget({bookId:id,page});setPositionReady(true);
  },0);
  return()=>window.clearTimeout(timer);
 },[catalog.books,catalog.loading,positionReady,initial]);
 const closePanel=()=>{const previous=panel;setPanel(null);requestAnimationFrame(()=>document.getElementById(`textbook-${previous}-toggle`)?.focus());};
 const togglePanel=(next:LibraryPanel)=>{
  if(panel===next){closePanel();return;}
  setPanel(next);
  if(next==='bookmarks'&&!bookmarks.data&&!bookmarks.loading)void bookmarks.load();
  requestAnimationFrame(()=>document.getElementById(`textbook-${next}-search`)?.focus());
 };
 const selectBook=(id:string)=>{
  const next=catalog.books.find(item=>item.id===id);if(!next)return;
  setSelectedId(id);setTarget({bookId:id,page:Math.min(next.pageCount,positions[id]??1)});setNoteQuery('');setBookmarkQuery('');
  closePanel();
 };
 const handlePosition=useCallback((bookId:string,page:number)=>{
  setTarget(current=>current.bookId===bookId&&current.page===page?current:{bookId,page});
  setPositions(current=>current[bookId]===page?current:{...current,[bookId]:page});
  writeReadingPosition(bookId,page);
 },[]);
 const jumpToPage=(bookId:string,page:number)=>{setTarget({bookId,page});setNavigationRequest(current=>current+1);};
 const openEdit=(item:Textbook)=>{setEditBook(item);setEditTitle(item.shortTitle);setEditSubject(item.subjectId);};
 const submitEdit=async(event:React.FormEvent)=>{event.preventDefault();if(!editBook||!editTitle.trim())return;if(await catalog.updateBook(editBook.id,editTitle.trim(),editSubject))setEditBook(null);};
 const chooseFile=(file?:File)=>{setImportFile(file??null);if(file&&!importName.trim())setImportName(file.name.replace(/\.pdf$/i,''));};
 const submitImport=async(event:React.FormEvent)=>{event.preventDefault();if(!importFile||!importName.trim())return;if(await catalog.importPdf(importFile,importName.trim())){setImportOpen(false);setImportFile(null);setImportName('');setQuery('');setFilter('mine');setSubjectFilter('all');setPanel('catalog');}};
 const bookmarkCurrentPage=()=>{if(book&&bookmarks.data)setBookmarkDraft(currentBookmark??{bookId:book.id,page:target.page,note:''});};
 const panelControls=<div className="textbook-panel-controls" role="group" aria-label="阅读侧栏">
  <Button id="textbook-catalog-toggle" variant="ghost" size="sm" aria-label={isMindMap?'导图':'书目'} title={isMindMap?'打开或收起导图目录':'打开或收起书目'} aria-expanded={panel==='catalog'} aria-controls="textbook-catalog-panel" onClick={()=>togglePanel('catalog')}><PanelLeft size={16}/><span className="textbook-panel-button-label">{isMindMap?'导图':'书目'}</span></Button>
  <Button id="textbook-notes-toggle" variant="ghost" size="sm" aria-label="笔记" title="打开或收起笔记" aria-expanded={panel==='notes'} aria-controls="textbook-notes-panel" onClick={()=>togglePanel('notes')}><Highlighter size={16}/><span className="textbook-panel-button-label">笔记</span></Button>
  <Button id="textbook-bookmarks-toggle" variant="ghost" size="sm" aria-label="书签" title="打开或收起书签" aria-expanded={panel==='bookmarks'} aria-controls="textbook-bookmarks-panel" onClick={()=>togglePanel('bookmarks')}><Bookmark size={16}/><span className="textbook-panel-button-label">书签</span></Button>
 </div>;
 if(!positionReady)return <div className="empty"><Loader2 className="animate-spin" size={24}/><p>{initial?'正在打开对应教材页面…':'正在打开上次阅读位置…'}</p></div>;
 return <section className="textbook-library-page textbook-library-refined textbook-library-compact" onKeyDown={event=>{
  if(!event.defaultPrevented&&event.key==='Escape'&&panel&&!editBook&&!importOpen&&!bookmarkDraft&&!(event.target as HTMLElement).closest('[role="dialog"],[role="alertdialog"]')){event.preventDefault();closePanel();}
 }} onPointerDown={event=>{
  // Book selection is temporary; notes stay open while the reader is used.
  if(panel==='catalog'&&!editBook&&!importOpen&&!bookmarkDraft&&!(event.target as HTMLElement).closest('#textbook-catalog-panel,#textbook-catalog-toggle,#textbook-notes-toggle,#textbook-bookmarks-toggle,[role="dialog"],[role="alertdialog"],[data-slot="popover-content"]'))setPanel(null);
 }}>
  <h1 className="sr-only">{isMindMap?'思维导图阅读':'教材阅读'}</h1>
  {(controller.error||catalog.error)&&<div className="notice error" role="alert"><span>{controller.error||catalog.error}</span><Button variant="outline" disabled={controller.busy||controller.loading||catalog.busy||catalog.loading} onClick={()=>void Promise.all([controller.load(),catalog.load()])}>重新读取</Button></div>}
  {studyTimeError&&<div className="notice error" role="alert">{studyTimeError}</div>}
  <div className={`textbook-library-layout ${panel??'reading'}-open`} style={{'--textbook-toolbar-height':`${toolbarHeight}px`} as CSSProperties}>
   <aside id="textbook-catalog-panel" className="textbook-catalog" aria-label="教材目录" hidden={panel!=='catalog'}>
    <div className="textbook-catalog-heading"><div><h2>{isMindMap?'思维导图':'我的书目'}</h2><span>{catalog.books.length}</span></div><div className="textbook-panel-heading-actions">{!isMindMap&&<Button size="sm" variant="outline" onClick={()=>setImportOpen(true)} disabled={catalog.busy}><FileUp size={14}/>导入</Button>}<Button size="icon" variant="ghost" aria-label="收起书目" onClick={closePanel}><X size={16}/></Button></div></div>
    <div className="textbook-panel-search"><Search size={15}/><Input id="textbook-catalog-search" aria-label="搜索教材" placeholder="搜索书名或科目" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="清除教材搜索" onClick={()=>{setQuery('');document.getElementById('textbook-catalog-search')?.focus();}}><X size={14}/></button>}</div>
    <div className="textbook-catalog-filters" role="group" aria-label="教材分类">{bookFilters.filter(item=>!isMindMap||(item.id!=='mine'&&item.id!=='maps')).map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>{setFilter(item.id);setSubjectFilter('all');}}>{item.label}</button>)}</div>
    <div className="textbook-subject-filters" role="group" aria-label="按科目筛选">{subjectFilters.map(item=><button key={item.id} type="button" aria-pressed={subjectFilter===item.id} onClick={()=>setSubjectFilter(item.id)}>{item.label}</button>)}</div>
    <div className="textbook-catalog-results" aria-live="polite">{filteredBooks.length} {isMindMap?'份导图':'本教材'}</div>
    <div className="textbook-catalog-books">
     {filteredBooks.length?<section aria-label="书目列表">{filteredBooks.map(item=>{
      const isCurrent=item.id===book?.id,page=positions[item.id];
      return <div className={`textbook-catalog-row ${isCurrent?'active':''}`} key={item.id}>
       <button className="textbook-catalog-select" onClick={()=>selectBook(item.id)} aria-current={isCurrent?'page':undefined}>
        <span title={item.shortTitle}>{item.shortTitle.replace(/^Revise · |^Notes · /,'')}</span>
        <small title={page?`上次读到第 ${page} ${item.pdfSlice?'段':'页'}，共 ${item.pageCount} ${item.pdfSlice?'段':'页'}`:`共 ${item.pageCount} ${item.pdfSlice?'段':'页'}`}>{page?`${page}/${item.pageCount}`:item.pageCount} {item.pdfSlice?'段':'页'}</small>
       </button>
       {!item.pdfSlice&&<Button size="icon" variant="ghost" aria-label={`编辑 ${item.shortTitle}`} title="修改书名与科目" disabled={catalog.busy} onClick={()=>openEdit(item)}><Pencil size={14}/></Button>}
      </div>;
     })}</section>:<div className="textbook-filter-empty"><BookOpen size={24}/><p>{filter==='mine'&&!query&&subjectFilter==='all'?'还没有导入教材':'没有找到匹配的教材'}</p><small>{filter==='mine'&&!query&&subjectFilter==='all'?'通过右上角“导入”添加自己的 PDF。':'试试其他书名、科目或分类。'}</small>{(query||filter!=='all'||subjectFilter!=='all')&&<Button variant="ghost" size="sm" onClick={resetFilters}>查看全部教材</Button>}</div>}
    </div>
   </aside>
   <div className="textbook-library-reader">
    {book?<TextbookReader key={book.id} references={[]} books={[book]} initial={target} navigationRequest={navigationRequest} annotations={controller} bookmarks={bookmarks} sourceQuestionId={book.id===initial?.bookId?initial.sourceQuestionId:undefined} entryLocation={book.id===initial?.bookId?initial:undefined} standalone toolbarStart={panelControls} onToolbarHeightChange={setToolbarHeight} onPositionChange={handlePosition}/>:<div className="empty">{panelControls}<BookOpen/><p>尚无教材。</p><Button onClick={()=>setImportOpen(true)}><FileUp size={15}/>导入 PDF</Button></div>}
   </div>
   <aside id="textbook-notes-panel" className="textbook-note-index" aria-label="教材高亮笔记" hidden={panel!=='notes'}>
    <div className="textbook-note-index-heading"><div><h2><Highlighter size={17}/>高亮笔记</h2><p>{book?.shortTitle??'选择一本教材'}</p></div><Button size="icon" variant="ghost" aria-label="收起笔记" onClick={closePanel}><X size={16}/></Button></div>
    <div className="textbook-panel-search"><Search size={15}/><Input id="textbook-notes-search" aria-label="搜索当前教材笔记" placeholder="搜索高亮、笔记或页码" value={noteQuery} onChange={event=>setNoteQuery(event.target.value)}/>{noteQuery&&<button type="button" aria-label="清除笔记搜索" onClick={()=>{setNoteQuery('');document.getElementById('textbook-notes-search')?.focus();}}><X size={14}/></button>}</div>
    {controller.loading&&!controller.data?<div className="textbook-notes-loading"><Loader2 className="animate-spin" size={18}/>正在读取…</div>:!bookNotes.length?<div className="textbook-notes-empty"><div className="textbook-note-empty-icon"><Highlighter size={24}/></div><p>把重要的规则留下来</p><small>在{activeMindMap?'导图':'教材'}中选中文字，即可高亮或写笔记。<br/>保存后，在这里点击即可回到原文。</small></div>:!filteredNotes.length?<div className="textbook-filter-empty"><p>没有匹配的笔记</p><Button variant="ghost" size="sm" onClick={()=>setNoteQuery('')}>查看全部笔记</Button></div>:<div className="textbook-note-list">{filteredNotes.map(item=><button key={item.id} onClick={()=>jumpToPage(item.bookId,item.page)}><span>第 {item.page} {activeMindMap?'段':'页'}<span>回到原文 →</span></span><blockquote>{item.quote}</blockquote>{item.note&&<p>{item.note}</p>}</button>)}</div>}
   </aside>
   <aside id="textbook-bookmarks-panel" className="textbook-note-index textbook-bookmark-index" aria-label="教材书签" hidden={panel!=='bookmarks'}>
    <div className="textbook-note-index-heading"><div><h2><Bookmark size={17}/>书签</h2><p>{book?.shortTitle??'选择一本教材'}</p></div><Button size="icon" variant="ghost" aria-label="收起书签" onClick={closePanel}><X size={16}/></Button></div>
    <div className="textbook-panel-search"><Search size={15}/><Input id="textbook-bookmarks-search" aria-label="搜索当前教材书签" placeholder="搜索备注或页码" value={bookmarkQuery} onChange={event=>setBookmarkQuery(event.target.value)}/>{bookmarkQuery&&<button type="button" aria-label="清除书签搜索" onClick={()=>{setBookmarkQuery('');document.getElementById('textbook-bookmarks-search')?.focus();}}><X size={14}/></button>}</div>
    <div className="textbook-bookmark-actions"><Button variant="outline" size="sm" onClick={bookmarkCurrentPage} disabled={!book||!bookmarks.data||bookmarks.loading||bookmarks.busy}>{currentBookmark?<Pencil size={14}/>:<BookmarkPlus size={14}/>}<span>{currentBookmark?'编辑当前页书签':'收藏当前页'}</span><small>第 {target.page} {activeMindMap?'段':'页'}</small></Button></div>
    {bookmarks.error&&<div className="textbook-bookmark-error" role="alert"><p>{bookmarks.error}</p><Button variant="outline" size="sm" disabled={bookmarks.loading||bookmarks.busy} onClick={()=>void bookmarks.load()}>重新读取</Button></div>}
    {bookmarks.loading&&!bookmarks.data?<div className="textbook-notes-loading"><Loader2 className="animate-spin" size={18}/>正在读取…</div>:!bookBookmarks.length?<div className="textbook-filter-empty"><Bookmark size={24}/><p>{bookmarks.error?'暂时无法读取书签':'还没有书签'}</p></div>:!filteredBookmarks.length?<div className="textbook-filter-empty"><p>没有匹配的书签</p><Button variant="ghost" size="sm" onClick={()=>setBookmarkQuery('')}>查看全部书签</Button></div>:<div className="textbook-bookmark-list">{filteredBookmarks.map(item=><div className={`textbook-bookmark-row ${item.page===target.page?'active':''}`} key={`${item.bookId}:${item.page}`}><button type="button" className="textbook-bookmark-jump" onClick={()=>jumpToPage(item.bookId,item.page)} aria-current={item.page===target.page?'page':undefined}><span><Bookmark size={14}/>第 {item.page} {activeMindMap?'段':'页'}</span>{item.note&&<p>{item.note}</p>}</button><Button variant="ghost" size="icon" aria-label={`编辑第 ${item.page} 页书签备注`} title="编辑备注" disabled={bookmarks.busy} onClick={()=>setBookmarkDraft(item)}><Pencil size={14}/></Button></div>)}</div>}
   </aside>
  </div>
  {bookmarkDraft&&<TextbookBookmarkEditor pageUnit={activeMindMap?'段':'页'} key={`${bookmarkDraft.bookId}:${bookmarkDraft.page}:${bookmarkDraft.revision??'new'}`} draft={bookmarkDraft} bookTitle={catalog.books.find(item=>item.id===bookmarkDraft.bookId)?.shortTitle??'教材'} controller={bookmarks} onChange={setBookmarkDraft} onClose={()=>setBookmarkDraft(null)}/>}
  <Dialog open={!!editBook} onOpenChange={open=>{if(!open&&!catalog.busy)setEditBook(null);}}><DialogContent className="textbook-manage-dialog"><DialogHeader><DialogTitle>编辑教材</DialogTitle><DialogDescription>修改书名和所属科目，方便查找。</DialogDescription></DialogHeader><form onSubmit={submitEdit}><div className="textbook-manage-field"><Label htmlFor="textbook-edit-title">教材名称</Label><Input id="textbook-edit-title" autoFocus maxLength={120} disabled={catalog.busy} value={editTitle} onChange={event=>setEditTitle(event.target.value)}/></div><div className="textbook-manage-field"><Label htmlFor="textbook-edit-subject">所属科目</Label><select id="textbook-edit-subject" disabled={catalog.busy} value={editSubject} onChange={event=>setEditSubject(event.target.value)}><option value="my-materials">未分类</option>{(['FLK1','FLK2'] as const).map(group=><optgroup key={group} label={group}>{subjects.filter(subject=>subject.group===group).map(subject=><option key={subject.id} value={subject.id}>{subject.zh}</option>)}</optgroup>)}</select></div><DialogFooter><Button type="button" variant="outline" disabled={catalog.busy} onClick={()=>setEditBook(null)}>取消</Button><Button type="submit" disabled={catalog.busy||!editTitle.trim()}>{catalog.busy?<Loader2 size={15} className="animate-spin"/>:<Pencil size={15}/>}保存</Button></DialogFooter></form></DialogContent></Dialog>
  <Dialog open={importOpen} onOpenChange={open=>{if(!catalog.busy)setImportOpen(open);}}><DialogContent className="textbook-manage-dialog"><DialogHeader><DialogTitle>导入教材 PDF</DialogTitle><DialogDescription>{guest?'PDF 只保存在当前浏览器中，清除网站数据或更换设备后需要重新导入。单份不超过 80 MB。':'PDF 会保存到你的账号中，导入后可连续阅读、高亮并记录笔记。单份不超过 80 MB。'}</DialogDescription></DialogHeader><form onSubmit={submitImport}><div className="textbook-manage-field"><Label htmlFor="textbook-file">PDF 文件</Label><Input id="textbook-file" type="file" accept="application/pdf,.pdf" onChange={event=>chooseFile(event.target.files?.[0])}/></div><div className="textbook-manage-field"><Label htmlFor="textbook-import-name">教材名称</Label><Input id="textbook-import-name" maxLength={120} value={importName} onChange={event=>setImportName(event.target.value)} placeholder="例如：Business Law Notes"/></div><DialogFooter><Button type="button" variant="outline" disabled={catalog.busy} onClick={()=>setImportOpen(false)}>取消</Button><Button type="submit" disabled={catalog.busy||!importFile||!importName.trim()}>{catalog.busy?<Loader2 size={15} className="animate-spin"/>:<FileUp size={15}/>}导入教材</Button></DialogFooter></form></DialogContent></Dialog>
 </section>;
}
