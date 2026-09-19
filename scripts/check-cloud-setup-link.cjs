/* eslint-disable @typescript-eslint/no-require-imports -- Isolated test loads the small production TypeScript helper. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {consumeSetupLink} = require('../cloud/setup-link.ts');
let checks=0;
function run(href,expectedToken,expectedReplacement){
  const calls=[],state={retained:true};
  const history={state,replaceState(...args){calls.push(args);}};
  assert.equal(consumeSetupLink({href},history),expectedToken);
  if(expectedReplacement===null)assert.equal(calls.length,0);
  else assert.deepEqual(calls,[[state,'',expectedReplacement]]);
  checks++;
}
run('http://localhost:8788/','',null);
run('http://localhost:8788/login#setup=synthetic-token','synthetic-token','/login');
run('http://localhost:8788/login?view=start#setup=a%2Bb%2Fc&panel=help','a+b/c','/login?view=start#panel=help');
run('http://localhost:8788/#setup=first&setup=second','first','/');
run('http://localhost:8788/?setup=query-must-not-be-used','',null);
run('http://localhost:8788/#setup=','','/');
run('http://localhost:8788/#setup='+ 'x'.repeat(513),'','/');
console.log(`${checks} setup-link checks passed: fragment consumed, history replaced, no query-based token accepted.`);
