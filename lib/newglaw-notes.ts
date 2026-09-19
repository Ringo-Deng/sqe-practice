import type {Question} from './study-types';
import type {NewglawNote} from './newglaw-note-types';
import {newglawContractNotes} from './newglaw-notes-contract';
import {newglawLegalSystemNotes} from './newglaw-notes-legal-system';
import {newglawCriminalNotes} from './newglaw-notes-criminal';
import {newglawServiceNotes} from './newglaw-notes-service';

const notes:Record<string,NewglawNote>={
 ...newglawContractNotes,
 ...newglawLegalSystemNotes,
 ...newglawCriminalNotes,
 ...newglawServiceNotes,
};

const chapterNotes:Record<string,string[]>={
 'contract-01':['contract-formation'],
 'contract-02':['contract-consideration'],
 'contract-03':['contract-intention-capacity'],
 'contract-04':['contract-privity'],
 'contract-05':['contract-terms'],
 'contract-06':['contract-unfair-terms'],
 'contract-07':['contract-misrepresentation'],
 'contract-08':['contract-vitiating-factors'],
 'contract-09':['contract-discharge'],
 'contract-10':['contract-remedies'],

 'legal-system-lss-01':['courts'],
 'legal-system-lss-02':['parliament','legislation'],
 'legal-system-lss-03':['legislation','courts'],
 'legal-system-lss-04':['courts'],
 'legal-system-cal-01':['constitution'],
 'legal-system-cal-02':['parliament'],
 'legal-system-cal-03':['government'],
 'legal-system-cal-04':['crown'],
 'legal-system-cal-05':['legislation'],
 'legal-system-cal-06':['public-order'],
 'legal-system-cal-07':['judicial-review'],
 'legal-system-cal-08':['human-rights'],

 'criminal-liability-01':['criminal-principles'],
 'criminal-liability-02':['criminal-complicity-attempt'],
 'criminal-liability-03':['criminal-principles'],
 'criminal-liability-04':['criminal-defences'],
 'criminal-liability-05':['criminal-person-offences'],
 'criminal-liability-06':['criminal-person-offences'],
 'criminal-liability-07':['criminal-property-offences'],
 'criminal-liability-08':['criminal-property-offences'],
 'criminal-liability-09':['criminal-property-offences'],
 'criminal-practice-01':['criminal-detention'],
 'criminal-practice-02':['criminal-bail'],
 'criminal-practice-03':['criminal-pretrial'],
 'criminal-practice-04':['criminal-pretrial'],
 'criminal-practice-05':['criminal-pretrial'],
 'criminal-practice-06':['criminal-trial'],
 'criminal-practice-07':['criminal-trial'],
 'criminal-practice-08':['criminal-trial','criminal-sentencing'],
 'criminal-practice-09':['criminal-appeals'],
 'criminal-practice-10':['criminal-youth'],

 'legal-services-lss-05':['legal-services'],
 'legal-services-lss-06':['anti-money-laundering','ethics-rule-of-law'],
 'legal-services-lss-07':['financial-services'],
 'legal-services-lss-08':['fees-legal-aid'],
 'legal-services-sra-regulation':['legal-services','ethics-edi'],
 'legal-services-aml':['anti-money-laundering','ethics-rule-of-law'],
 'legal-services-financial-services':['financial-services'],
 'legal-services-funding':['fees-legal-aid'],
 'legal-services-sra-principles':['ethics-overview'],
 'accounts-01':['solicitors-accounts'],
 'accounts-02':['double-entry'],
 'accounts-03':['solicitors-accounts','double-entry'],
 'accounts-04':['interest'],
 'accounts-05':['double-entry','disbursements'],
 'accounts-06':['double-entry'],
 'accounts-07':['solicitors-accounts','interest'],
 'accounts-08':['solicitors-accounts'],
};

const ethicsAll=['ethics-overview','ethics-rule-of-law','ethics-public-confidence','ethics-independence','ethics-honesty','ethics-integrity','ethics-edi','ethics-best-interests'];
chapterNotes['legal-services-code-of-conduct']=ethicsAll;
for(const prefix of ['legal-services-ethics','flk2-ethics']){
 chapterNotes[`${prefix}-01`]=['ethics-overview'];
 chapterNotes[`${prefix}-02`]=ethicsAll;
 chapterNotes[`${prefix}-03`]=['ethics-rule-of-law','ethics-independence','ethics-honesty','ethics-integrity'];
 chapterNotes[`${prefix}-04`]=['ethics-best-interests'];
 chapterNotes[`${prefix}-05`]=['ethics-rule-of-law','ethics-independence','ethics-honesty','ethics-integrity'];
 chapterNotes[`${prefix}-06`]=['ethics-best-interests'];
 chapterNotes[`${prefix}-07`]=['ethics-independence','ethics-best-interests'];
 chapterNotes[`${prefix}-08`]=['solicitors-accounts','ethics-best-interests'];
}

const matches=(text:string,pattern:RegExp)=>pattern.test(text);
function fallbackIds(q:Question,text:string):string[]{
 if(q.subjectId==='contract'){
  if(matches(text,/misrepresentation|虚假陈述/))return ['contract-misrepresentation'];
  if(matches(text,/duress|undue influence|mistake|illegality|胁迫|不当影响|错误|违法/))return ['contract-vitiating-factors'];
  if(matches(text,/remed|damage|specific performance|injunction|损害赔偿|救济|强制履行/))return ['contract-remedies'];
  if(matches(text,/discharge|termination|frustration|breach|解除|受挫|违约/))return ['contract-discharge'];
  if(matches(text,/unfair|exclusion|limitation clause|免责|不公平条款/))return ['contract-unfair-terms'];
  if(matches(text,/term|condition|warranty|条款|条件/))return ['contract-terms'];
  if(matches(text,/privity|third part|相对性|第三人/))return ['contract-privity'];
  if(matches(text,/intention|capacity|certainty|行为能力|法律关系意图|确定性/))return ['contract-intention-capacity'];
  if(matches(text,/consideration|对价/))return ['contract-consideration'];
  return ['contract-formation'];
 }
 if(q.subjectId==='criminal-liability'){
  if(matches(text,/self.?defen|intox|duress|necessity|consent|自卫|醉酒|胁迫|紧急避险|同意/))return ['criminal-defences'];
  if(matches(text,/attempt|accessor|secondary|complic|encourag|未遂|从犯|共同犯罪|协助|鼓励/))return ['criminal-complicity-attempt'];
  if(matches(text,/murder|manslaughter|assault|battery|abh|gbh|wound|杀人|袭击|殴打|人身伤害/))return ['criminal-person-offences'];
  if(matches(text,/theft|robbery|burglary|fraud|criminal damage|arson|盗窃|抢劫|入室|欺诈|刑事损坏|纵火/))return ['criminal-property-offences'];
  return ['criminal-principles'];
 }
 if(q.subjectId==='criminal-practice'){
  if(matches(text,/youth|young offender|juvenile|青少年|未成年人/))return ['criminal-youth'];
  if(matches(text,/appeal|上诉/))return ['criminal-appeals'];
  if(matches(text,/sentenc|custodial|community order|fine|量刑|监禁|社区令|罚金/))return ['criminal-sentencing'];
  if(matches(text,/bail|保释/))return ['criminal-bail'];
  if(matches(text,/police station|detention|interview|caution|identification|appropriate adult|羁押|讯问|警告|辨认|适当成年人/))return ['criminal-detention'];
  if(matches(text,/trial|jury|hearsay|confession|bad character|witness|evidence|no case|审判|陪审团|传闻|供述|不良品格|证人|证据/))return ['criminal-trial'];
  return ['criminal-pretrial'];
 }
 if(q.subjectId==='accounts'){
  if(matches(text,/interest|利息/))return ['interest'];
  if(matches(text,/disbursement|counsel|barrister|invoice|land registry|court fee|代垫|律师费|发票|土地注册|法院费/))return ['disbursements'];
  if(matches(text,/bill|vat|ledger|debit|credit|transfer|on account|账单|增值税|分类账|借方|贷方|转账|预付款/))return ['double-entry'];
  return ['solicitors-accounts'];
 }
 if(q.subjectId==='legal-services'||q.subjectId==='flk2-ethics'){
  if(matches(text,/money laundering|aml|洗钱/))return ['anti-money-laundering'];
  if(matches(text,/financial service|investment|insurance|金融服务|投资|保险/))return ['financial-services'];
  if(matches(text,/legal aid|funding|fee|cost agreement|法律援助|收费|费用协议/))return ['fees-legal-aid'];
  if(matches(text,/discriminat|diversity|inclusion|平等|歧视|多样性|包容/))return ['ethics-edi'];
  if(matches(text,/complaint|publicity|public confidence|投诉|公众信心/))return ['ethics-public-confidence'];
  if(matches(text,/undertaking|inadvertent|integrity|承诺|误发|正直/))return ['ethics-integrity'];
  if(matches(text,/court|witness|mislead|prosecutor|法庭|证人|误导|检察/))return ['ethics-rule-of-law','ethics-honesty'];
  if(matches(text,/conflict|confidential|disclos|best interest|referral|client money|mortgage|buyer|seller|lender|利益冲突|保密|披露|最佳利益|转介|客户资金|抵押|买方|卖方|贷款人/))return ['ethics-best-interests'];
  return ['ethics-overview','ethics-independence'];
 }
 return [];
}

export function newglawNotesForQuestion(q:Question):NewglawNote[]{
 const text=[q.stem,q.stemZh,q.ask,q.askZh,q.explanation?.topic,...(q.topicTags??[])].filter(Boolean).join(' ').toLowerCase();
 // Preserve the more specific practice-context notes when old ethics chapters
 // are combined, while all other remapped questions use their reviewed topic.
 const ethicsChapter=q.chapterId==='legal-services-code-of-conduct'&&q.originalChapterId&&/^(legal-services-ethics|flk2-ethics)-0[2-8]$/.test(q.originalChapterId)?q.originalChapterId:undefined;
 const chapterId=ethicsChapter??q.chapterId;
 const ids=chapterId&&chapterNotes[chapterId]?chapterNotes[chapterId]:fallbackIds(q,text);
 return [...new Set(ids)].map(id=>notes[id]).filter((item):item is NewglawNote=>!!item);
}
