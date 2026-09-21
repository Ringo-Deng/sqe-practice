import reviews from './sra-flk2-supplementary-reviews.json';
import type {Explanation,Question} from './study-types';

type Review={officialAnswer:string;zh:string;ruleZh:string;warning:string;optionZh:Record<string,string>;supplementaryReview:NonNullable<Explanation['supplementaryReview']>};
const byId:Record<string,Review>=reviews;

export function applySraFlk2SupplementaryReview<T extends Question&{explanation:Explanation}>(question:T):T{
 const review=byId[question.id];
 if(!review)return question;
 // A content review must never change the source answer or silently drift from it.
 if(review.officialAnswer!==question.explanation.answer)throw new Error(`Supplementary review answer mismatch: ${question.id}`);
 const options={...question.explanation.options};
 for(const option of question.options){
  const zh=review.optionZh[option.id];
  if(!zh?.trim())throw new Error(`Missing supplementary option: ${question.id}/${option.id}`);
  options[option.id]={...options[option.id],zh};
 }
 return {...question,explanation:{...question.explanation,zh:review.zh,ruleZh:review.ruleZh,warning:review.warning,options,supplementaryReview:review.supplementaryReview}};
}
