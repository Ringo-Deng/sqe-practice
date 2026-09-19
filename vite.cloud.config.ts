import {fileURLToPath,URL} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const projectRoot=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
 root:fileURLToPath(new URL('./cloud',import.meta.url)),
 base:'/',
 publicDir:fileURLToPath(new URL('./public',import.meta.url)),
 resolve:{alias:[
  {find:'@/lib/guest-study',replacement:fileURLToPath(new URL('./cloud/guest-disabled.ts',import.meta.url))},
  {find:'@',replacement:projectRoot},
 ]},
 plugins:[react()],
 css:{postcss:projectRoot},
 build:{outDir:fileURLToPath(new URL('./dist-cloud',import.meta.url)),emptyOutDir:true},
});
