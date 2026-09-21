import {BookOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {textbookById,textbookPdfUrl,type LinkedTextbookReference} from '@/lib/textbooks';

export function TextbookLinks({references}:{references:LinkedTextbookReference[]}){
 return <>{references.map(ref=>{
  const book=textbookById(ref.bookId);
  if(!book?.url)return null;
  return <Button key={ref.bookId} asChild variant="outline" size="sm" className="textbook-link"><a href={textbookPdfUrl(book,ref.pageNumbers[0])} target="_blank" rel="noopener noreferrer" title={`${ref.chapter} · PDF 第 ${ref.pageNumbers[0]} 页起（新标签页）`}><BookOpen size={16}/>查阅 {book.shortTitle}</a></Button>;
 })}</>;
}
