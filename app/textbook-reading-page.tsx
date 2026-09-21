'use client';
import {useEffect,useMemo} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {parseTextbookReaderTarget,textbookById,type TextbookReaderTarget} from '@/lib/textbooks';
import {TextbookLibrary} from './textbook-library';
import {useTextbookAnnotations} from './use-textbook-annotations';
import {useTextbookBookmarks} from './use-textbook-bookmarks';
import {useTextbookCatalog} from './use-textbook-catalog';

function ReadingWorkspace({guest,target}:{guest:boolean;target:TextbookReaderTarget}){
 const annotations=useTextbookAnnotations(guest);
 const bookmarks=useTextbookBookmarks(guest);
 const catalog=useTextbookCatalog(guest);
 useEffect(()=>{document.title=`${textbookById(target.bookId)?.shortTitle??'教材'} · SQE Practice`;},[target.bookId]);
 return <main className="workspace textbook-library-workspace">
  <TextbookLibrary controller={annotations} bookmarks={bookmarks} catalog={catalog} guest={guest} initial={target}/>
  <Toaster position="bottom-center" theme="light"/>
 </main>;
}

export function TextbookReadingPage({guest,search}:{guest:boolean;search:string}){
 const target=useMemo(()=>parseTextbookReaderTarget(search),[search]);
 if(!target)return <main className="empty" role="alert"><p>教材链接或页码无效，请回到原题重新打开。</p></main>;
 return <ReadingWorkspace guest={guest} target={target}/>;
}
