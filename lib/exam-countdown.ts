const DAY_MS=24*60*60*1000;

export function validExamDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 if(Number(value.slice(0,4))<100)return false;
 const date=new Date(`${value}T00:00:00Z`);
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export function daysUntilExam(targetDate:string,today:Date):number|null{
 if(!validExamDate(targetDate))return null;
 const localToday=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
 const [year,month,day]=targetDate.split('-').map(Number);
 return Math.round((Date.UTC(year,month-1,day)-localToday)/DAY_MS);
}

export function formatExamDate(targetDate:string){
 const [year,month,day]=targetDate.split('-').map(Number);
 return `${year} 年 ${month} 月 ${day} 日`;
}
