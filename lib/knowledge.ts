import type {Bilingual,KnowledgeReview} from './study-types';
const b=(zh:string,en:string):Bilingual=>({zh,en});
const point=(term:string,zh:string,en:string)=>({term,zh,en});
const law=(act:string,section:string,label:string)=>({label,url:`https://www.legislation.gov.uk/ukpga/${act}/section/${section}`});
export const knowledgeReviews:Record<string,KnowledgeReview>={
'demo-contract-01':{
 points:[
  point('Short-term right to reject','瑕疵商品：通常30天内可直接退货、全额退款，无须先修。','Faulty goods: usually reject within 30 days for a full refund; no prior repair needed.'),
  point('Repair / replacement','超过短期拒收期：通常先要求维修或更换。','After the short-term period: normally request repair or replacement first.'),
  point('Final right to reject / price reduction','维修或更换一次后仍不合格 → 可选择最终退货退款，或减价。','Still faulty after one repair or replacement → choose final rejection or a price reduction.')
 ],
 warning:b('“先修一次”有例外：维修、更换均无法要求，或商家未在合理时间内完成／造成重大不便，可直接进入最终救济。','No completed attempt is required if neither remedy is available, or requested work is not done within a reasonable time or without significant inconvenience.'),
 sources:[law('2015/15','22','CRA ss 22–24'),law('2015/15','24','Final rejection · s 24')]
},
'demo-contract-02':{
 points:[
  point('Negligence → death / personal injury','消费者合同中，过失导致死亡或人身伤害：不得免责或限责。','A consumer term cannot exclude or restrict negligence liability for death or personal injury.'),
  point('Exclusion / limitation','完全免责、设置赔偿上限，都受禁止。','Both total exclusion and financial caps are prohibited.'),
  point('Signature ≠ enforceability','消费者签字、条款醒目、价格优惠，均不能使该免责有效。','Signature, prominent wording and a discount do not validate the exclusion.')
 ],
 warning:b('本题是法律禁止免责，不是看条款是否“合理”。','This is a statutory prohibition, not a reasonableness test.'),
 sources:[law('2015/15','65','CRA s 65')]
},
'demo-contract-03':{
 points:[
  point('Third-party rights','合同明确赋予执行权；或条款旨在使第三人受益，且合同无相反意思。','Express enforcement right, or an intended benefit without a contrary contractual intention.'),
  point('Identification','第三人须按姓名、类别或描述明确识别。','Identify the third party by name, class or description.'),
  point('No consideration / assignment needed','符合法定条件的第三人，无须自己提供对价或先取得债权让与。','A qualifying third party need not provide consideration or obtain an assignment.')
 ],
 warning:b('不要仅因“不是合同当事人”就否定第三人执行权。','Non-party status alone does not defeat statutory enforcement.'),
 sources:[law('1999/31','1','1999 Act s 1')]
},
'demo-contract-04':{
 points:[
  point('Misrepresentation · s 2(1)','合同相对方的虚假陈述诱使订约并造成损失，可能产生法定赔偿责任。','A misrepresentation by the other contracting party inducing the contract and loss may attract statutory damages.'),
  point('Reasonable grounds + actual belief','抗辩须同时证明：有合理依据相信真实，且直至订约仍实际相信。','The defence requires reasonable grounds and actual belief in the truth until contracting.'),
  point('Burden of proof','上述抗辩由作出陈述的一方举证。','The representor must prove the defence.')
 ],
 warning:b('仅“主观诚实／无欺诈故意”不够；还须有合理依据。','Honesty or absence of fraud alone is insufficient; reasonable grounds are also needed.'),
 sources:[law('1967/7','2','Misrepresentation Act s 2(1)')]
},
'demo-contract-05':{
 points:[
  point('UCTA · personal injury','在UCTA适用时，过失导致死亡或人身伤害 → 不得免责或限责。','Where UCTA applies, negligent death or personal injury → no exclusion or restriction.'),
  point('Property damage → reasonableness','过失导致财产等其他损失 → 免责条款须合理。','Negligent property damage or other loss → the exclusion must be reasonable.'),
  point('Timing + burden','以订约时情形判断；援引条款的一方证明合理。','Assess circumstances at contracting; the relying party proves reasonableness.')
 ],
 warning:b('双方都是企业、条款已签字，不代表免责自动有效。','Business status and signature do not make the exclusion automatically valid.'),
 sources:[law('1977/50','2','UCTA s 2'),law('1977/50','11','Reasonableness · s 11')]
},
'demo-contract-06':{
 points:[
  point('Unfair term','违反诚信 + 权利义务显著失衡 + 对消费者不利。','Contrary to good faith + significant imbalance + consumer detriment.'),
  point('Not binding on the consumer','不公平条款不约束消费者；消费者仍可选择援引。','An unfair term does not bind the consumer, who may still choose to rely on it.'),
  point('Severability','其余合同能继续运行 → 在可行范围内继续有效。','If the rest can operate, preserve it so far as practicable.')
 ],
 warning:b('一项条款不公平 ≠ 整份合同自动无效。','One unfair term does not automatically invalidate the whole contract.'),
 sources:[law('2015/15','62','CRA s 62'),law('2015/15','67','Severability · s 67')]
},
'demo-contract-07':{
 points:[
  point('Misrepresentation exclusion · s 3','第3条适用时，排除／限制虚假陈述责任或救济，须满足合理性。','Where section 3 applies, excluding or limiting misrepresentation liability or remedies requires reasonableness.'),
  point('Reasonableness + burden','按订约时情形判断；援引免责条款的一方举证。','Assess circumstances at contracting; the party relying on the exclusion bears the burden.'),
  point('Consumer contract → CRA','消费者合同条款转用CRA公平性规则，不适用第3条。','Consumer terms fall under CRA fairness rules rather than section 3.')
 ],
 warning:b('签字不等于有效免责；条款标题不如实际效果重要。','Signature does not establish validity; examine the clause’s effect, not just its label.'),
 sources:[law('1967/7','3','Misrepresentation Act s 3')]
},
'demo-contract-08':{
 points:[
  point('Reasonable care and skill','消费者服务须达到合理谨慎与技能标准，即使合同没写。','Consumer services require reasonable care and skill, even if the contract is silent.'),
  point('Repeat performance → price reduction','通常先要求免费重新履行；不可能、超合理时间或造成重大不便 → 可减价。','Usually seek free repeat performance; if impossible, unduly delayed or significantly inconvenient → price reduction.'),
  point('No automatic guarantee of perfection','第49条本身不保证完美结果；另有明确结果承诺须另行判断。','Section 49 itself does not guarantee perfection; assess any separate result promise.')
 ],
 warning:b('服务合同不套用商品的“30天退货”规则。','Do not apply the goods regime’s 30-day rejection rule to services.'),
 sources:[law('2015/15','49','CRA s 49'),law('2015/15','55','Repeat performance · s 55'),law('2015/15','56','Price reduction · s 56')]
}
};
