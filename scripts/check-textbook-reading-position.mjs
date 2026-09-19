// Run with: node --experimental-strip-types scripts/check-textbook-reading-position.mjs
import assert from 'node:assert/strict';
import {readReadingPositions,writeReadingPosition} from '../lib/textbook-reading-position.ts';

const V1='sqe-practice:textbook-position:v1',V2='sqe-practice:textbook-position:v2';
const books=[{id:'contract',pageCount:120},{id:'tort',pageCount:80}];
const storage=(initial={})=>{
 const values=new Map(Object.entries(initial));
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
};

const migrated=storage({[V1]:JSON.stringify({bookId:'contract',page:42})});
assert.deepEqual(readReadingPositions(books,migrated),{lastBookId:'contract',pages:{contract:42}},'The old reading position is available before the first write');
writeReadingPosition('tort',17,migrated);
assert.deepEqual(readReadingPositions(books,migrated),{lastBookId:'tort',pages:{contract:42,tort:17}},'Switching books preserves the migrated position');
assert.deepEqual(JSON.parse(migrated.getItem(V2)),{lastBookId:'tort',pages:{contract:42,tort:17}},'The first write migrates the old book into v2');
assert.deepEqual(JSON.parse(migrated.getItem(V1)),{bookId:'tort',page:17},'The old application can still read the latest position');
writeReadingPosition('contract',63,migrated);
assert.deepEqual(readReadingPositions(books,migrated),{lastBookId:'contract',pages:{contract:63,tort:17}},'Each book independently remembers its latest page');

const clamped=storage({[V2]:JSON.stringify({lastBookId:'contract',pages:{contract:999,tort:-2,removed:20}})});
assert.deepEqual(readReadingPositions(books,clamped),{lastBookId:'contract',pages:{contract:120,tort:1}},'Pages are bounded by the current catalogue and removed books are ignored');
assert.deepEqual(readReadingPositions(books,storage({[V2]:JSON.stringify({lastBookId:'removed',pages:{removed:2,contract:1.5,tort:'7'}})})),{lastBookId:null,pages:{}},'Unknown book IDs and non-integer pages are ignored');
assert.deepEqual(readReadingPositions(books,storage({[V2]:'{broken',[V1]:JSON.stringify({bookId:'tort',page:5})})),{lastBookId:'tort',pages:{tort:5}},'A damaged new record can recover the legacy position');
assert.deepEqual(readReadingPositions(books,storage({[V2]:JSON.stringify({lastBookId:'removed',pages:{contract:30}}),[V1]:JSON.stringify({bookId:'tort',page:5})})),{lastBookId:'tort',pages:{tort:5,contract:30}},'An unavailable last book falls back to the legacy book without dropping valid pages');
assert.deepEqual(readReadingPositions(books,storage({[V1]:JSON.stringify({bookId:'contract',page:'bad'})})),{lastBookId:'contract',pages:{contract:1}},'A legacy record with an invalid page safely reopens at page one');
for(const invalid of ['null','[]','true','4','"bad"','{broken']){
 assert.deepEqual(readReadingPositions(books,storage({[V2]:invalid,[V1]:invalid})),{lastBookId:null,pages:{}},`Invalid stored content is safe: ${invalid}`);
}

const polluted=storage({[V2]:'{"lastBookId":"__proto__","pages":{"__proto__":9,"constructor":10,"prototype":11,"contract":12}}'});
const protectedBooks=[...books,{id:'__proto__',pageCount:20},{id:'constructor',pageCount:20},{id:'prototype',pageCount:20}];
assert.deepEqual(readReadingPositions(protectedBooks,polluted),{lastBookId:null,pages:{contract:12}},'Reserved object keys are rejected even if supplied by the catalogue');
for(const id of ['__proto__','constructor','prototype','', ' '])writeReadingPosition(id,10,polluted);
for(const page of [NaN,Infinity,1.2,'4',Number.MAX_SAFE_INTEGER+1])writeReadingPosition('tort',page,polluted);
assert.equal(polluted.getItem(V1),null,'Invalid writes leave storage untouched');
assert.equal(Object.prototype.polluted,undefined,'Reading positions do not pollute object prototypes');

const denied={getItem(){throw Error('Read access denied');},setItem(){throw Error('Write access denied');}};
assert.doesNotThrow(()=>writeReadingPosition('contract',9,denied));
assert.deepEqual(readReadingPositions(books,denied),{lastBookId:null,pages:{}},'Denied storage does not block the reader');
const partial=storage();
const v2Denied={getItem:partial.getItem,setItem(key,value){if(key===V2)throw Error('Storage full');partial.setItem(key,value);}};
writeReadingPosition('contract',9,v2Denied);
assert.deepEqual(readReadingPositions(books,partial),{lastBookId:'contract',pages:{contract:9}},'The legacy fallback is still written when the v2 write is refused');

const localDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
try{
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Browser storage blocked');}});
 assert.deepEqual(readReadingPositions(books),{lastBookId:null,pages:{}},'A blocked localStorage getter is handled');
 assert.doesNotThrow(()=>writeReadingPosition('contract',3));
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:undefined});
 assert.deepEqual(readReadingPositions(books),{lastBookId:null,pages:{}},'Server-side reading works without localStorage');
 assert.doesNotThrow(()=>writeReadingPosition('contract',3));
}finally{
 if(localDescriptor)Object.defineProperty(globalThis,'localStorage',localDescriptor);else delete globalThis.localStorage;
}

console.log('Passed: v1 migration, independent book positions, rollback compatibility, catalogue bounds, damaged content recovery, prototype protection, unavailable browser storage.');
