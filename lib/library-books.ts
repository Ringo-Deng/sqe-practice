import {subjectById} from './subjects';
import type {Textbook} from './textbooks';

export type BookFilter='all'|'FLK1'|'FLK2'|'maps'|'mine';

export function bookSubjectIds(book:Textbook):readonly string[]{
 return book.subjectIds?.length?book.subjectIds:[book.subjectId];
}

export function bookMatchesCategory(book:Textbook,filter:BookFilter):boolean{
 if(filter==='all')return true;
 if(filter==='maps')return !!book.pdfSlice;
 if(filter==='mine')return !!book.imported;
 return (book.groups??bookSubjectIds(book).map(id=>subjectById(id)?.group)).includes(filter);
}
