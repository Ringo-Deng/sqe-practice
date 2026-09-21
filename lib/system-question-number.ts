import registry from './question-numbers.json';

const numbers=registry as Record<string,number>;

/** Stable library-wide number; source question numbers and session positions are separate. */
export function systemQuestionNumber(id:string):number{
 const number=numbers[id];
 if(!Number.isInteger(number)||number<1)throw new Error(`Missing system question number for ${id}`);
 return number;
}
