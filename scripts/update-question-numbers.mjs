import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[
 'sra-flk1-original','sra-flk1-pretested','sra-flk2-original','sra-flk2-pretested',
 'revise-flk1-assessment-2025-26','revise-flk2-practice-assessment','revise-chapter-questions',
 'qlts-mock-exams-1-5','qlts-mock-exams-6-10','qlts-mock-exams-11-15',
 'qlts-mock-exams-16-20','qlts-mock-exams-21-30',
];
const registryPath=path.join(root,'lib/question-numbers.json');
const registry=fs.existsSync(registryPath)?JSON.parse(fs.readFileSync(registryPath,'utf8')):{};
const values=Object.values(registry);
if(values.some(number=>!Number.isSafeInteger(number)||number<1)||new Set(values).size!==values.length){
 throw new Error('Question number registry contains invalid or duplicate numbers.');
}
const questions=files.flatMap(name=>JSON.parse(fs.readFileSync(path.join(root,`lib/${name}.json`),'utf8')));
const ids=questions.map(question=>question.id);
if(ids.length!==new Set(ids).size)throw new Error('Question bank contains duplicate IDs.');
const missing=ids.filter(id=>!Object.hasOwn(registry,id));
if(process.argv.includes('--check')&&missing.length){
 throw new Error(`${missing.length} questions lack system numbers. Run pnpm number:questions.`);
}
let next=Math.max(0,...values)+1;
for(const id of missing)registry[id]=next++;
const added=missing.length;
if(added)fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
console.log(`Question numbers: ${ids.length} active, ${values.length+added} reserved, ${added} added.`);
