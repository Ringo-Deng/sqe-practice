import catalog from './textbooks.json';
import {mindMapBooks} from './mindmap-documents';
import type {TextbookReference} from './study-types';

export type Textbook={id:string;title:string;shortTitle:string;subjectId:string;subjectIds?:readonly string[];groups?:readonly ('FLK1'|'FLK2')[];version:string;pageCount:number;url?:string;sha256:string;pageUrlTemplate?:string;imported?:boolean;originalName?:string;sizeBytes?:number;createdAt?:number;pdfSlice?:{height:number;width:number;totalHeight:number}};
export type LinkedTextbookReference=TextbookReference&{bookId:string;pageNumbers:number[]};
export const textbooks:Textbook[]=catalog;
export const textbookById=(id?:string)=>textbooks.find(book=>book.id===id)??mindMapBooks.find(book=>book.id===id);
function browserAssetUrl(url:string){
 if(typeof document==='undefined'||!url.startsWith('/'))return url;
 return new URL(url.slice(1),document.baseURI).toString();
}
export type TextbookReaderTarget={bookId:string;page:number;sourceQuestionId?:string;offset?:number;focusLabel?:string};
export function textbookReaderUrl(book:Textbook,page:number,sourceQuestionId?:string){
 if(!Number.isInteger(page)||page<1||page>book.pageCount)throw Error('无效的教材页码');
 const params=new URLSearchParams({reader:'textbook',book:book.id,page:String(page)});
 if(sourceQuestionId)params.set('question',sourceQuestionId);
 return `?${params}`;
}
export function parseTextbookReaderTarget(search:string):TextbookReaderTarget|null{
 const params=new URLSearchParams(search);
 if(params.get('reader')==='mindmap'){
  const book=textbookById(`mindmap-${params.get('map')??''}`);if(!book?.pdfSlice)return null;
  const top=Number(params.get('top'));const y=Number.isFinite(top)?Math.min(book.pdfSlice.totalHeight-1,Math.max(0,top-90)):0;
  const page=Math.floor(y/book.pdfSlice.height)+1;
  const offset=(y-(page-1)*book.pdfSlice.height)/Math.min(book.pdfSlice.height,book.pdfSlice.totalHeight-(page-1)*book.pdfSlice.height);
  return {bookId:book.id,page,offset,focusLabel:params.get('focus')||undefined,sourceQuestionId:params.get('question')||undefined};
 }
 if(params.get('reader')!=='textbook')return null;
 const book=textbookById(params.get('book')??'');
 const page=Number(params.get('page'));
 if(!book||!Number.isInteger(page)||page<1||page>book.pageCount)return null;
 const sourceQuestionId=params.get('question')||undefined;
 return {bookId:book.id,page,sourceQuestionId};
}
export function textbookPageSource(book:Textbook,page:number){
 if(!Number.isInteger(page)||page<1||page>book.pageCount)throw Error('无效的教材页码');
 const pageUrl=book.pageUrlTemplate?.replace('{page}',String(page))??book.url;
 if(!pageUrl)throw Error('教材页面文件不存在');
 return {url:browserAssetUrl(pageUrl),pageNumber:book.pageUrlTemplate||book.pdfSlice?1:page,documentPages:book.pageUrlTemplate||book.pdfSlice?1:book.pageCount};
}
export function linkedTextbooks(refs:TextbookReference[]=[]):LinkedTextbookReference[]{
 return refs.filter((ref):ref is LinkedTextbookReference=>{
  const book=textbookById(ref.bookId);
  return !!book&&!!ref.pageNumbers?.length&&ref.pageNumbers.every(n=>Number.isInteger(n)&&n>=1&&n<=book.pageCount);
 });
}
