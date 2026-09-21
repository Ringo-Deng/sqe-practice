// Synthetic copy checks; no saved answers, browser storage or textbook files are read.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {formatQuestionForCopy}=require('../lib/question-copy.ts');
const question={
 id:'revise-flk1-2025-26-s2-007',number:7,sourceId:'revise',sourceTitle:'Fixture Practice Assessment',sourceSet:'fixture-set',sourceSession:2,sourcePages:[12],subjectId:'contract',
 stem:'A client\n asks for advice.\n\nA solicitor responds.',stemZh:'QUESTION_TRANSLATION',ask:'Which option\n is correct?',askZh:'',
 options:[{id:'A',en:'The first\n option.',zh:''},{id:'B',en:'The second option.',zh:''}],
 knowledge:{points:[{term:'KNOWLEDGE_BODY',zh:'KNOWLEDGE_BODY',en:''}],warning:{zh:'KNOWLEDGE_WARNING',en:''},sources:[]},
 explanation:{
  kind:'publisher-original',answer:'B',topic:'TOPIC_SECRET',en:'PUBLISHER_REASONING',zh:'TRANSLATED_REASONING',ruleEn:'',ruleZh:'AI_RULE',warning:'EXCLUDED_WARNING',
  options:{A:{en:'',zh:'AI_OPTION_REASONING'}},source:'Publisher Fixture',sourceUrl:'https://example.com/source',originalPdfPages:[98],
  reasoningSteps:[{title:'Step',detail:'AI_STEP'}],
  publisherReference:{text:'UNNEEDED_PUBLISHER_PROSE',book:'Fixture textbook',chapters:[3]},
  textbookReferences:[{book:'Fixture textbook 2026',chapter:'Chapter 3',pages:'20–21',section:'Formation',pageNumbers:[22,23],note:'TEXTBOOK_NOTE_BODY'}],
  textbookExample:{title:'TEXTBOOK_EXAMPLE',facts:'TEXTBOOK_FACTS',lesson:'TEXTBOOK_LESSON',connection:'TEXTBOOK_CONNECTION'},
 },
};

const hidden=formatQuestionForCopy(question,{selected:'A',includeAnswer:false});
for(const text of ['PUBLISHER_REASONING','TRANSLATED_REASONING','AI_RULE','AI_OPTION_REASONING','Publisher Fixture','Fixture textbook','https://example.com/source','标准答案','原书解析 PDF'])assert.ok(!hidden.includes(text),`Unrevealed review cannot leak ${text}`);
assert.ok(hidden.includes('我的选择：A'));
assert.ok(hidden.includes('A. The first option.'));
assert.ok(hidden.includes('Session 2 · Q7'));
assert.ok(hidden.includes('系统题号：317'));
assert.ok(hidden.endsWith('我的疑问：'));
assert.doesNotThrow(()=>formatQuestionForCopy({...question,get explanation(){throw Error('The answer must not be accessed');}},{includeAnswer:false}));
assert.ok(formatQuestionForCopy({...question,explanation:undefined},{includeAnswer:true}).includes('我的选择：未作答'));

const revealed=formatQuestionForCopy(question,{selected:'A',includeAnswer:true});
for(const text of ['标准答案：B','出版方原文解析（英文）：\nPUBLISHER_REASONING','原文解析的中文译文（非出版方原文）：\nTRANSLATED_REASONING','AI 补充规则与选项分析：','AI_OPTION_REASONING','AI_STEP','原书推荐教材：Fixture textbook · Chapter 3','Fixture textbook 2026 · Chapter 3 · 页码：20–21 · Formation','https://example.com/source'])assert.ok(revealed.includes(text),`Revealed copy includes labelled ${text}`);
for(const text of ['TEXTBOOK_NOTE_BODY','TEXTBOOK_EXAMPLE','TEXTBOOK_FACTS','TEXTBOOK_LESSON','TEXTBOOK_CONNECTION','KNOWLEDGE_BODY','KNOWLEDGE_WARNING','UNNEEDED_PUBLISHER_PROSE'])assert.ok(!revealed.includes(text),`Copy omits textbook/knowledge content ${text}`);

const supplemental=formatQuestionForCopy({...question,explanation:{...question.explanation,kind:undefined,en:'AI_ENGLISH',zh:'AI_CHINESE'}},{includeAnswer:true});
assert.ok(supplemental.includes('AI 补充解析（英文）：\nAI_ENGLISH'));
assert.ok(supplemental.includes('AI 补充解析（中文）：\nAI_CHINESE'));
assert.ok(!supplemental.includes('出版方原文解析'));
assert.ok(formatQuestionForCopy({...question,explanation:{...question.explanation,answer:''}},{includeAnswer:true}).includes('标准答案：未提供'));
console.log('Question copy checks passed: unrevealed answer boundary, source labels, selected answer, missing answer and exclusion of textbook/knowledge body.');
