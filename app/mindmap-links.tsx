import {Network} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {Question} from '@/lib/study-types';
import {mindMapPageUrl,mindMapsForQuestion} from '@/lib/mindmaps';

export function MindMapLinks({question}:{question:Question}){
 const maps=mindMapsForQuestion(question);
 return <>{maps.length?maps.map(map=><Button key={map.id} asChild variant="outline" size="sm" className="textbook-link mindmap-link"><a target="_blank" rel="noopener noreferrer" href={mindMapPageUrl(map.id,map.top,map.focusLabel,question.id)} title={map.top!==undefined?`定位到${map.focusLabel??map.title}对应的导图位置`:`打开${map.title}思维导图`}><Network size={16}/>思维导图 · {map.title}</a></Button>):<Button asChild variant="outline" size="sm" className="textbook-link mindmap-link"><a target="_blank" rel="noopener noreferrer" href={mindMapPageUrl()} title="浏览全部思维导图"><Network size={16}/>思维导图目录</a></Button>}</>;
}
