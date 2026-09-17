import type {Explanation} from './study-types';
const rows=(value:string):NonNullable<Explanation['concepts']>=>value.split('|').map(row=>{const i=row.indexOf('：');return{term:row.slice(0,i),detail:row.slice(i+1)};});
export const demoConcepts:Record<string,NonNullable<Explanation['concepts']>>={
'demo-contract-01':rows('Short-term right to reject · 短期拒收：商品交付时不合格，通常在法定30日内可选择拒收并获全额退款；本题第7日即可直接要求。|Repair / replacement · 维修或更换：超过短期拒收期后，通常先要求修或换；商家须在合理时间内、不给消费者造成重大不便地完成。|Final right to reject / price reduction · 最终救济：一次修理或更换后仍不合格，或修换不能要求、迟延或造成重大不便时，可进入减价或最终拒收。并非任何情况都必须实际先修一次。'),
'demo-contract-02':rows('Incorporation · 条款订入：签字或醒目提示可能使条款成为合同内容，但还必须检查法律是否允许这种免责。|Death / personal injury · 死亡或人身伤害：CRA第65条禁止以消费者条款或告示排除、限制过失造成的这类责任，签字及价格优惠也不能使之生效。|Other loss · 其他损失：财产损失等不一定受同一绝对禁止，须进一步找适用的公平性或合理性等规则，不能把一条规则用于所有损失。'),
'demo-contract-03':rows('Privity · 合同相对性：通常由合同当事人执行合同；女儿虽受益，但不是父亲与建筑商合同的当事人。|Express third-party right · 明确第三人权利：1999年法允许已被识别的第三人依合同明确赋权执行条款。女儿姓名及执行权均已写明。|Consideration / assignment · 对价与让与：第三人走这条法定路径，不需要自己向建筑商另给对价，也不需要先让父亲转让合同权利。'),
'demo-contract-04':rows('Fraudulent misrepresentation · 欺诈：明知虚假、无真实相信或鲁莽作出陈述；但本题明确不主张欺诈，不能仅以没有欺诈排除法定赔偿。|Section 2(1) · 法定责任：在符合条件的非欺诈失实陈述中，陈述方要依该条抗辩，须证明有合理理由且确实相信内容真实，直至订约。|Honesty / reasonableness · 诚实与合理：actual belief说明主观相信；reasonable grounds要求客观合理依据。两者必须同时满足。'),
'demo-contract-05':rows('Negligent personal injury · 过失人身伤害：UCTA第2(1)条禁止排除或限制过失造成的死亡或人身伤害责任，不能靠合理性证明来挽救。|Negligent property damage · 过失财产损害：本题机器受损，无人受伤。第2(2)条允许在符合reasonableness的范围内限责或免责。|Reasonableness · 合理性：重点是订约时条款是否公平合理，结合议价能力、认知等适用因素；已订入合同、双方均为企业，并不等于自动有效。'),
'demo-contract-06':rows('Unfair term · 不公平条款：违反诚信并使权利义务显著失衡、不利于消费者，可触发CRA的不公平条款控制；不要求先证明欺诈。|Not binding · 不约束消费者：效果主要落在该条款，经营者不能据此强制消费者；不是一发现不公平就把所有交易一并作废。|Severability · 可分性：剔除问题条款后合同能运作，其余部分在实际可行范围内继续。本题已明确满足这一条件。|Transparency · 透明性：清楚、醒目帮助消费者知道内容，但条款透明不代表内容公平。'),
'demo-contract-07':rows('Misrepresentation exclusion · 失实陈述免责：条款如果排除订约前失实陈述的责任或救济，须检查Misrepresentation Act第3条控制。|Reasonableness · 合理性：商业合同不因此一律免责有效，也不因此一律无效；关键是是否满足法定合理性要求。|Burden of proof · 举证责任：希望援引免责条款的一方证明其合理。本题卖方援引，所以由卖方承担，不是买方先证明卖方故意隐藏条款。'),
'demo-contract-08':rows('Statutory term · 法定合同条款：CRA第49条将reasonable care and skill纳入消费者服务合同；书面合同未写，也仍然适用。|Reasonable care and skill · 合理谨慎与技能：考察服务过程是否达到合理专业水平；草率粉刷可违反该义务，无须是故意破坏。|Guaranteed result · 结果保证：该条本身不保证每次完美结果；若另有关于具体结果的有效约定，则需结合其他条款另行判断。')
};
