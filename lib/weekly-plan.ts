export type PlanWeek={start:string;content:string;done:boolean};
export type WeeklyPlan={version:1;weeks:PlanWeek[];archived:PlanWeek[]};

export const weeklyPlanKey=(scope:string)=>`sqe-practice:weekly-plan:v1:${encodeURIComponent(scope)}`;
const pad=(n:number)=>String(n).padStart(2,'0');
export const localDate=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const parseDate=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12);};
export function validPlanDate(value:unknown):value is string{
 return typeof value==='string'&&/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)&&localDate(parseDate(value))===value;
}
export const validPlanMonth=(value:string)=>/^\d{4}-\d{2}$/.test(value)&&validPlanDate(`${value}-01`);
export function addPlanDays(value:string,days:number){const date=parseDate(value);date.setDate(date.getDate()+days);return localDate(date);}
export const shortPlanDate=(value:string)=>`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`;

export function buildPlanRange(plan:WeeklyPlan,startMonth:string,endMonth:string):WeeklyPlan{
 if(!validPlanMonth(startMonth)||!validPlanMonth(endMonth)||startMonth>endMonth)throw new Error('请选择有效月份，结束月份不能早于起始月份。');
 const first=`${startMonth}-01`,start=addPlanDays(first,(8-parseDate(first).getDay())%7);
 const pool=new Map([...plan.archived,...plan.weeks].map(week=>[week.start,week]));
 const weeks:PlanWeek[]=[];
 for(let date=start;date.slice(0,7)<=endMonth;date=addPlanDays(date,7)){
  weeks.push(pool.get(date)??{start:date,content:'',done:false});pool.delete(date);
 }
 return {version:1,weeks,archived:[...pool.values()].sort((a,b)=>a.start.localeCompare(b.start))};
}
export function emptyWeeklyPlan(today=new Date()):WeeklyPlan{
 const start=localDate(today).slice(0,7),end=localDate(new Date(today.getFullYear(),today.getMonth()+5,1)).slice(0,7);
 return buildPlanRange({version:1,weeks:[],archived:[]},start,end);
}
export function parseWeeklyPlan(raw:string|null):WeeklyPlan|null{
 if(raw===null)return null;
 const value=JSON.parse(raw) as Partial<WeeklyPlan>;
 if(!value||value.version!==1||!Array.isArray(value.weeks)||!value.weeks.length||!Array.isArray(value.archived??[]))throw new Error('计划文件格式无效。');
 const seen=new Set<string>();
 const parseWeek=(week:PlanWeek):PlanWeek=>{
  if(!week||!validPlanDate(week.start)||parseDate(week.start).getDay()!==1||typeof week.content!=='string'||typeof week.done!=='boolean'||seen.has(week.start))throw new Error('计划中有无效或重复的周日期。');
  seen.add(week.start);return {start:week.start,content:week.content,done:!!week.content.trim()&&week.done};
 };
 const weeks=value.weeks.map(parseWeek);
 if(weeks.some((week,i)=>i>0&&week.start!==addPlanDays(weeks[i-1].start,7)))throw new Error('计划中的周日期必须连续。');
 return {version:1,weeks,archived:(value.archived??[]).map(parseWeek)};
}
export function updatePlanWeek(plan:WeeklyPlan,start:string,change:Partial<Pick<PlanWeek,'content'|'done'>>):WeeklyPlan{
 return {...plan,weeks:plan.weeks.map(week=>{if(week.start!==start)return week;const next={...week,...change};return {...next,done:!!next.content.trim()&&next.done};})};
}
export function groupPlanWeeks(plan:WeeklyPlan){
 const groups:{month:string;weeks:PlanWeek[]}[]=[];
 for(const week of plan.weeks){const month=week.start.slice(0,7);if(groups.at(-1)?.month!==month)groups.push({month,weeks:[]});groups[groups.length-1].weeks.push(week);}
 return groups;
}
// The timestamps are filtered to submitted, non-blank answers by each data provider.
// Aggregate in the browser's timezone, not the server's timezone or session-start date.
export function dailyAnswerCounts(activity:readonly number[]):Record<string,number>{
 const result:Record<string,number>={};
 for(const timestamp of activity){if(!Number.isFinite(timestamp)||timestamp<=0)continue;const date=new Date(timestamp);if(Number.isNaN(date.getTime()))continue;const day=localDate(date);result[day]=(result[day]??0)+1;}
 return result;
}
