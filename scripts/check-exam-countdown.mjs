import assert from 'node:assert/strict';
import {daysUntilExam,formatExamDate,validExamDate} from '../lib/exam-countdown.ts';

assert.equal(validExamDate('2028-02-29'),true);
assert.equal(validExamDate('2027-02-29'),false);
assert.equal(validExamDate('2027-13-01'),false);
assert.equal(validExamDate('0000-01-01'),false);
assert.equal(daysUntilExam('2027-01-15',new Date(2027,0,14,23,59)),1);
assert.equal(daysUntilExam('2027-01-15',new Date(2027,0,15,0,1)),0);
assert.equal(daysUntilExam('2027-01-15',new Date(2027,0,17,8,0)),-2);
assert.equal(daysUntilExam('2027-01-15',new Date(2026,11,31)),15);
assert.equal(daysUntilExam('2027-02-29',new Date(2027,0,1)),null);
assert.equal(formatExamDate('2027-01-15'),'2027 年 1 月 15 日');
console.log('Exam countdown date checks passed.');
