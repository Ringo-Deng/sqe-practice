import type {GuestStudyResult} from '../lib/guest-study';

// Cloud clients never receive the browser-side question bank or grading keys.
export function applyGuestStudyAction(_state:unknown,_action:Record<string,unknown>):GuestStudyResult{
 throw new Error('请登录后继续学习。');
}
