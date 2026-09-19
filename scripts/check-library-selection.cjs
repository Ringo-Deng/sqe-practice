// Isolated navigation-state checks; no browser or study records are accessed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const nativeLoad=Module._load;
Module._load=function(request,parent,isMain){
 if(request.startsWith('@/'))request=path.join(root,request.slice(2));
 return nativeLoad.call(this,request,parent,isMain);
};
const {readLibrarySelection,writeLibrarySelection,librarySelectionKey,defaultLibrarySelection}=require('../lib/library-selection.ts');
const {subjects}=require('../lib/subjects.ts');
const values=new Map();
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
const chosen=subjects[0].id;

assert.deepEqual(readLibrarySelection(),defaultLibrarySelection,'Server rendering has safe defaults without window');
assert.deepEqual(readLibrarySelection(storage),defaultLibrarySelection,'A new tab starts with the existing selection');
for(const source of ['sra','revise','qlts','all']){
 const selection={source,chosen};
 writeLibrarySelection(selection,storage);
 assert.deepEqual(readLibrarySelection(storage),selection,`${source}: source and subject survive a fresh read`);
}
writeLibrarySelection({source:'revise',chosen:null},storage);
assert.deepEqual(readLibrarySelection(storage),{source:'revise',chosen:null},'Changing source persists the cleared subject');
for(const source of ['oup','removed-source',null,{},42]){
 storage.setItem(librarySelectionKey,JSON.stringify({source,chosen}));
 assert.deepEqual(readLibrarySelection(storage),defaultLibrarySelection,'Unavailable sources fall back safely');
}
storage.setItem(librarySelectionKey,JSON.stringify({source:'revise',chosen:'removed-subject'}));
assert.deepEqual(readLibrarySelection(storage),{source:'revise',chosen:null},'An unavailable subject is cleared while retaining the valid source');
for(const raw of ['{','null','42','[]','{}']){
 storage.setItem(librarySelectionKey,raw);
 assert.deepEqual(readLibrarySelection(storage),defaultLibrarySelection,'Malformed state falls back safely');
}
const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
assert.deepEqual(readLibrarySelection(denied),defaultLibrarySelection,'Read failures do not block navigation');
assert.doesNotThrow(()=>writeLibrarySelection({source:'revise',chosen},denied),'Write failures do not block navigation');
global.window=Object.defineProperty({},'sessionStorage',{get(){throw new Error('blocked');}});
assert.deepEqual(readLibrarySelection(),defaultLibrarySelection,'Access to sessionStorage may itself be blocked');
assert.doesNotThrow(()=>writeLibrarySelection({source:'revise',chosen}));
delete global.window;

const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {QuestionLibrary}=require('../app/question-library.tsx');
const markup=renderToStaticMarkup(React.createElement(QuestionLibrary,{data:{questions:[],sessions:[]},busy:false,onStart(){},onResume(){}}));
assert.ok(markup.includes('题库分类'),'The existing component props still support server rendering');
assert.ok(markup.includes('source-card active'),'The server retains the default selected source');
assert.equal(values.size,1,'Only the navigation selection key is written');
console.log('Library selection checks passed: refresh/remount state, invalid values, blocked storage and SSR compatibility.');
