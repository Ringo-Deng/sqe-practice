import translations from './review-translations.json';

const inline:Record<string,string>=translations.inline;
const labels:Record<string,string>=translations.labels;
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const terms=new RegExp(`(?<![A-Za-z])(${Object.keys(inline).sort((a,b)=>b.length-a.length).map(escape).join('|')})(?![A-Za-z])`,'gi');

// Only Chinese review text passes through this helper. The English question is untouched.
export function explainLegalText(text:string):string{
 const seen=new Set<string>();
 return text.replace(terms,(term:string,_match:string,offset:number,whole:string)=>{
  const key=term.toLowerCase();
  if(seen.has(key))return term;
  seen.add(key);
  const before=whole.slice(0,offset).replace(/\*\*/g,'');
  const after=whole.slice(offset+term.length).replace(/^\*\*/,'');
  // Preserve an existing adjacent translation, including 中文（**English**）.
  if(/^\s*[（(][^）)\n]*[\u3400-\u9fff]/.test(after)||/[\u3400-\u9fff][^\n（）()]*[（(]\s*$/.test(before))return term;
  return `${term}（${inline[key]}）`;
 });
}

export function translateLegalLabel(text:string):string{
 const plain=text.replace(/\*\*/g,'');
 const exact=labels[plain.toLowerCase()]??inline[plain.toLowerCase()];
 if(exact)return `${plain}（${exact}）`;
 const pair=plain.match(/^([^\u3400-\u9fff]+?)\s*·\s*(.+)$/);
 if(pair&&/[\u3400-\u9fff]/.test(pair[2])){
  const translation=labels[pair[1].trim().toLowerCase()]??pair[2];
  return `${pair[1].trim()}（${translation}）`;
 }
 return explainLegalText(text);
}
