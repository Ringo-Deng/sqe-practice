import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'cloud/migrations');
await mkdir(directory,{recursive:true});
const existing=(await readdir(path.join(root,'drizzle'))).filter(name=>/^\d+.*\.sql$/.test(name)).sort();
const study=(await Promise.all(existing.map(name=>readFile(path.join(root,'drizzle',name),'utf8')))).join('\n').replaceAll('--> statement-breakpoint','');
const migrations=[['0001_study.sql',study],['0002_accounts.sql',await readFile(path.join(root,'cloud/auth-migration.sql'),'utf8')],['0003_reading_positions.sql',await readFile(path.join(root,'cloud/reading-position-migration.sql'),'utf8')]];
for(const [name,source] of migrations){
 const target=path.join(directory,name);
 let current;
 try{current=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(current!==undefined&&current!==source)throw new Error(`${name} already exists with different contents. Add a new migration instead of rewriting it.`);
 if(current===undefined)await writeFile(target,source);
}
console.log(`Prepared ${migrations.length} migrations for a fresh standalone database.`);
