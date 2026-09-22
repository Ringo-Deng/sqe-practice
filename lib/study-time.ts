export const STUDY_TIME_IDLE_MS=2*60*1000;

export function activeMilliseconds(lastAccountedAt:number,lastActivityAt:number,now:number){
 return Math.max(0,Math.min(now,lastActivityAt+STUDY_TIME_IDLE_MS)-lastAccountedAt);
}

export function formatStudyTime(milliseconds:number){
 const minutes=Math.floor(Math.max(0,milliseconds)/60000);
 const hours=Math.floor(minutes/60);
 return hours?`${hours} 小时 ${minutes%60} 分钟`:`${minutes} 分钟`;
}
