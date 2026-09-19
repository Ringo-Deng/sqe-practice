const POSITION_KEY='sqe-practice:textbook-position:v2';
const LEGACY_POSITION_KEY='sqe-practice:textbook-position:v1';
const RESERVED_IDS=new Set(['__proto__','constructor','prototype']);

type ReadStorage=Pick<Storage,'getItem'>;
type WriteStorage=Pick<Storage,'getItem'|'setItem'>;
type ReadingPositions={lastBookId:string|null;pages:Record<string,number>};

function browserStorage():Storage|undefined{
 try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}
}
function isRecord(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value);
}
function safeId(value:unknown):value is string{
 return typeof value==='string'&&value.trim().length>0&&!RESERVED_IDS.has(value);
}
function validPage(value:unknown):value is number{
 return typeof value==='number'&&Number.isSafeInteger(value);
}
function readJson(storage:ReadStorage|undefined,key:string):unknown{
 try{return JSON.parse(storage?.getItem(key)??'null');}catch{return null;}
}
function readStoredPositions(storage:ReadStorage|undefined){
 const current=readJson(storage,POSITION_KEY),legacy=readJson(storage,LEGACY_POSITION_KEY);
 const pages:Record<string,number>={};
 const legacyBookId=isRecord(legacy)&&safeId(legacy.bookId)?legacy.bookId:null;
 // The first v2 write also preserves a reading position left by the old reader.
 if(legacyBookId&&isRecord(legacy))pages[legacyBookId]=validPage(legacy.page)?Math.max(1,legacy.page):1;
 if(isRecord(current)&&isRecord(current.pages)){
  for(const [id,page] of Object.entries(current.pages)){
   if(safeId(id)&&validPage(page))pages[id]=Math.max(1,page);
  }
 }
 const lastBookId=isRecord(current)&&safeId(current.lastBookId)?current.lastBookId:legacyBookId;
 return {lastBookId,legacyBookId,pages};
}

export function readReadingPositions(books:readonly {id:string;pageCount:number}[],storage?:ReadStorage):ReadingPositions{
 const stored=readStoredPositions(storage??browserStorage());
 const catalog=new Map(books.filter(book=>safeId(book.id)&&validPage(book.pageCount)&&book.pageCount>0).map(book=>[book.id,book.pageCount]));
 const pages:Record<string,number>={};
 for(const [id,page] of Object.entries(stored.pages)){
  const pageCount=catalog.get(id);
  if(pageCount!==undefined)pages[id]=Math.min(pageCount,page);
 }
 const lastBookId=stored.lastBookId&&catalog.has(stored.lastBookId)?stored.lastBookId:stored.legacyBookId&&catalog.has(stored.legacyBookId)?stored.legacyBookId:null;
 return {lastBookId,pages};
}

export function writeReadingPosition(bookId:string,page:number,storage?:WriteStorage):void{
 if(!safeId(bookId)||!validPage(page))return;
 const target=storage??browserStorage();
 if(!target)return;
 const {pages}=readStoredPositions(target);
 const position=Math.max(1,page);
 pages[bookId]=position;
 try{target.setItem(POSITION_KEY,JSON.stringify({lastBookId:bookId,pages}));}catch{/* Reading remains available when browser storage is full or denied. */}
 // Keep the previous reader usable if the application is rolled back.
 try{target.setItem(LEGACY_POSITION_KEY,JSON.stringify({bookId,page:position}));}catch{/* The v2 save may still have succeeded. */}
}
