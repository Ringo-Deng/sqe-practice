import catalog from './textbooks.json';
import type {TextbookReference} from './study-types';

export type Textbook={id:string;title:string;shortTitle:string;subjectId:string;version:string;pageCount:number;url?:string;sha256:string;pageUrlTemplate?:string;imported?:boolean;originalName?:string;sizeBytes?:number;createdAt?:number};
export type LinkedTextbookReference=TextbookReference&{bookId:string;pageNumbers:number[]};
export const textbooks:Textbook[]=catalog;
export const textbookById=(id?:string)=>textbooks.find(book=>book.id===id);
function browserAssetUrl(url:string){
 if(typeof document==='undefined'||!url.startsWith('/'))return url;
 return new URL(url.slice(1),document.baseURI).toString();
}
export type TextbookReaderTarget={bookId:string;page:number;sourceQuestionId?:string};
export function textbookReaderUrl(book:Textbook,page:number,sourceQuestionId?:string){
 if(!Number.isInteger(page)||page<1||page>book.pageCount)throw Error('无效的教材页码');
 const params=new URLSearchParams({reader:'textbook',book:book.id,page:String(page)});
 if(sourceQuestionId)params.set('question',sourceQuestionId);
 return `?${params}`;
}
export function parseTextbookReaderTarget(search:string):TextbookReaderTarget|null{
 const params=new URLSearchParams(search);
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
 return {url:browserAssetUrl(pageUrl),pageNumber:book.pageUrlTemplate?1:page,documentPages:book.pageUrlTemplate?1:book.pageCount};
}
export function linkedTextbooks(refs:TextbookReference[]=[]):LinkedTextbookReference[]{
 return refs.filter((ref):ref is LinkedTextbookReference=>{
  const book=textbookById(ref.bookId);
  return !!book&&!!ref.pageNumbers?.length&&ref.pageNumbers.every(n=>Number.isInteger(n)&&n>=1&&n<=book.pageCount);
 });
}
