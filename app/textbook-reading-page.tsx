'use client';
import {useEffect,useMemo} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {parseTextbookReaderTarget,textbookById,type TextbookReaderTarget} from '@/lib/textbooks';
import {mindMapBooks} from '@/lib/mindmap-documents';
import {TextbookLibrary} from './textbook-library';
import {useTextbookAnnotations} from './use-textbook-annotations';
import {useTextbookBookmarks} from './use-textbook-bookmarks';
import {useTextbookCatalog} from './use-textbook-catalog';

function ReadingWorkspace({guest,target,directory=false}:{guest:boolean;target:TextbookReaderTarget;directory?:boolean}){
 const annotations=useTextbookAnnotations(guest);
 const bookmarks=useTextbookBookmarks(guest);
 const catalog=useTextbookCatalog(guest);
 const isMindMap=target.bookId.startsWith('mindmap-');
 const readerCatalog={...catalog,books:isMindMap?mindMapBooks:[...catalog.books,...mindMapBooks]};
 useEffect(()=>{document.title=`${textbookById(target.bookId)?.shortTitle??'教材'} · SQE Practice`;},[target.bookId]);
 return <main className="workspace textbook-library-workspace">
  <TextbookLibrary controller={annotations} bookmarks={bookmarks} catalog={readerCatalog} guest={guest} initial={target} kind={isMindMap?'mindmap':'textbook'} initialPanel={directory?'catalog':null}/>
  <Toaster position="bottom-center" theme="light"/>
 </main>;
}

export function TextbookReadingPage({guest,search}:{guest:boolean;search:string}){
 const directory=new URLSearchParams(search).get('reader')==='mindmap'&&!new URLSearchParams(search).has('map');
 const target=useMemo(()=>parseTextbookReaderTarget(directory?`${search}&map=ethics`:search),[search,directory]);
 if(!target)return <main className="empty" role="alert"><p>教材链接或页码无效，请回到原题重新打开。</p></main>;
 return <ReadingWorkspace guest={guest} target={target} directory={directory}/>;
}
