// Run with: node --experimental-strip-types scripts/check-textbook-cache.mjs
import assert from 'node:assert/strict';
import {createPdfPageCache} from '../lib/pdf-page-cache.ts';

const calls=[],destroyed=[],pending=new Map();
const cache=createPdfPageCache(source=>{
 calls.push(source.url);
 const promise=new Promise((resolve,reject)=>pending.set(source.url,{resolve,reject}));
 return {promise,destroy:async()=>{destroyed.push(source.url);}};
},2);
const source=url=>({url,documentPages:1});
const resolve=url=>pending.get(url).resolve({numPages:1});

const first=cache.acquire(source('page-1'));
const concurrent=cache.acquire(source('page-1'));
assert.deepEqual(calls,['page-1'],'Concurrent readers share one request');
resolve('page-1');await first.promise;
first.release();concurrent.release();
const reopened=cache.acquire(source('page-1'));await reopened.promise;
assert.deepEqual(calls,['page-1'],'Closing and reopening reuses the decoded PDF');

const second=cache.acquire(source('page-2'));resolve('page-2');await second.promise;second.release();
const third=cache.acquire(source('page-3'));resolve('page-3');await third.promise;third.release();
assert.deepEqual(destroyed,['page-2'],'An active page survives eviction of idle pages');
reopened.release();reopened.release();
const refreshedVersion=cache.acquire(source('page-1-new-version'));resolve('page-1-new-version');await refreshedVersion.promise;refreshedVersion.release();
assert.ok(calls.includes('page-1-new-version'),'A changed asset URL loads the new version');

const failed=cache.acquire(source('retry'));
pending.get('retry').reject(Error('Network unavailable'));
await assert.rejects(failed.promise,/Network unavailable/);failed.release();
const retried=cache.acquire(source('retry'));resolve('retry');await retried.promise;retried.release();
assert.equal(calls.filter(url=>url==='retry').length,2,'Failed requests can be retried');

const invalid=cache.acquire(source('invalid'));
pending.get('invalid').resolve({numPages:2});
await assert.rejects(invalid.promise,/版本/);invalid.release();
assert.ok(destroyed.includes('invalid'),'A mismatched page asset is rejected and released');
console.log('Passed: request deduplication, reopening, active-page protection, version changes, retry, page-count validation.');
