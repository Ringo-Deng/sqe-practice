import assert from 'node:assert/strict';
import {activeMilliseconds,formatStudyTime,STUDY_TIME_IDLE_MS} from '../lib/study-time.ts';

assert.equal(activeMilliseconds(0,0,30_000),30_000);
assert.equal(activeMilliseconds(0,0,STUDY_TIME_IDLE_MS+30_000),STUDY_TIME_IDLE_MS);
assert.equal(activeMilliseconds(STUDY_TIME_IDLE_MS+30_000,0,STUDY_TIME_IDLE_MS+60_000),0);
assert.equal(activeMilliseconds(150_000,150_000,180_000),30_000);
assert.equal(activeMilliseconds(180_000,180_000,170_000),0);
assert.equal(formatStudyTime(59_999),'0 分钟');
assert.equal(formatStudyTime(60_000),'1 分钟');
assert.equal(formatStudyTime(4_500_000),'1 小时 15 分钟');
console.log('Study time accounting checks passed.');
