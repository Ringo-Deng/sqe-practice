import {BookOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {textbookById,textbookReaderUrl,type LinkedTextbookReference} from '@/lib/textbooks';

export function TextbookLinks({references,sourceQuestionId}:{references:LinkedTextbookReference[];sourceQuestionId?:string}){
 return <>{references.map(ref=>{
  const book=textbookById(ref.bookId);
  if(!book?.url)return null;
  return <Button key={ref.bookId} asChild variant="outline" size="sm" className="textbook-link"><a href={textbookReaderUrl(book,ref.pageNumbers[0],sourceQuestionId)} target="_blank" rel="noopener noreferrer" title={`${ref.chapter} · PDF 第 ${ref.pageNumbers[0]} 页起（新标签页）`}><BookOpen size={16}/>查阅 {book.shortTitle}</a></Button>;
 })}</>;
}
