'use client';
import {useState} from 'react';
import {Bookmark,Loader2,Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import type {TextbookBookmarkDraft} from '@/lib/textbook-bookmarks';
import type {TextbookBookmarksController} from './use-textbook-bookmarks';

export function TextbookBookmarkEditor({draft,bookTitle,controller,onChange,onClose}:{
 draft:TextbookBookmarkDraft|null;
 bookTitle:string;
 controller:TextbookBookmarksController;
 onChange:(draft:TextbookBookmarkDraft)=>void;
 onClose:()=>void;
}){
 const[confirmDelete,setConfirmDelete]=useState(false);
 if(!draft)return null;
 const saved=draft.revision!==undefined;
 const save=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(await controller.mutate({...draft,action:'save'})){
   toast.success(saved?'书签备注已更新':'书签已添加');
   onClose();
  }
 };
 const remove=async()=>{
  if(!saved)return;
  if(await controller.mutate({action:'delete',bookId:draft.bookId,page:draft.page,revision:draft.revision})){
   toast.success('书签已删除');
   setConfirmDelete(false);
   onClose();
  }
 };
 return <>
  <Dialog open onOpenChange={open=>{if(!open&&!controller.busy)onClose();}}>
   <DialogContent className="textbook-note-editor" showCloseButton={!controller.busy}>
    <DialogHeader><DialogTitle>{saved?'编辑书签':'添加书签'}</DialogTitle><DialogDescription>{bookTitle} · 第 {draft.page} 页</DialogDescription></DialogHeader>
    <form onSubmit={save}>
     <div className="textbook-note-field"><Label htmlFor="textbook-bookmark-note">备注 <span>选填</span></Label><Textarea id="textbook-bookmark-note" autoFocus rows={5} maxLength={10000} disabled={controller.busy} value={draft.note} onChange={event=>onChange({...draft,note:event.target.value})} placeholder="记下这页的重点或稍后要复习的内容"/></div>
     {controller.error&&<p className="vocab-error" role="alert">{controller.error}</p>}
     <DialogFooter className="textbook-note-actions">
      {saved&&<Button type="button" variant="ghost" className="text-[#aa4d5c] mr-auto" disabled={controller.busy} onClick={()=>setConfirmDelete(true)}><Trash2 size={15}/>删除书签</Button>}
      <Button type="button" variant="outline" disabled={controller.busy} onClick={onClose}>取消</Button>
      <Button type="submit" disabled={controller.busy}>{controller.busy?<Loader2 size={15} className="animate-spin"/>:<Bookmark size={15}/>} {saved?'保存备注':'保存书签'}</Button>
     </DialogFooter>
    </form>
   </DialogContent>
  </Dialog>
  <AlertDialog open={confirmDelete} onOpenChange={open=>{if(!controller.busy)setConfirmDelete(open);}}>
   <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这个书签？</AlertDialogTitle><AlertDialogDescription>第 {draft.page} 页的书签和备注将一起删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={controller.busy}>取消</AlertDialogCancel><Button variant="destructive" disabled={controller.busy} onClick={()=>void remove()}>{controller.busy?'正在删除…':'删除书签'}</Button></AlertDialogFooter>{controller.error&&<p className="vocab-error" role="alert">{controller.error}</p>}</AlertDialogContent>
  </AlertDialog>
 </>;
}
