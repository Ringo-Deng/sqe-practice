import type {NewglawNote} from './newglaw-note-types';

const page='https://sqe.newglaw.com/service/';
const note=(id:string,title:string,sections:NewglawNote['sections']):NewglawNote=>({id,title,url:`${page}#${id}`,sections});
const section=(heading:string,...points:string[])=>({heading,points});

export const newglawServiceNotes:Record<string,NewglawNote>={
 'legal-services':note('英格兰和威尔士的法律服务','英格兰和威尔士的法律服务',[
  section('学习顺序','来源页把法律服务、职业道德和律师账务连续编排：法律服务主要在 FLK1 考查，职业道德贯穿 FLK1 与 FLK2，律师账务主要在 FLK2。'),
  section('保留的法律活动','六类主要 reserved legal activities 是出庭权、诉讼行为、特定保留文书、遗嘱认证文书、公证及监誓。未经授权从事可能构成犯罪。','提供一般法律意见，以及起草普通合同、遗嘱或授权书本身通常不是保留活动；房地产转让、登记文书及诉讼文书等可能属于保留文书。'),
  section('法律从业人员','SRA 监管 solicitors 与律所，BSB 监管 barristers，其他监管机构分别负责特许法律执行官及知识产权专业人员。被监管身份不等于天然具有全部保留活动权限。','Solicitor 通常须获准入、列入 roll 并持 practising certificate；in-house solicitor 仅为雇主服务等情形可不持证。Higher rights of audience 的民事与刑事资格分开取得。'),
  section('法律从业机构','Recognised body 的管理人及利益持有人均须具法律资格；licensed body/ABS 只要求至少一名经理具法律资格。两类机构通常须至少投保 £3m PII，recognised sole practice 从事保留活动通常为 £2m。','保险到期后先有30日 extended policy period，再有60日 cessation period；后者只能继续现有事项，不得接受新业务。SRA 采用 risk-based regulation。')
 ]),
 'anti-money-laundering':note('律师的反洗钱义务','律师的反洗钱义务',[
  section('反洗钱立法的范围','MLRs 2017 要求律所保存书面风险评估，建立政策、控制及程序，任命 MLCO，培训员工并对客户进行 CDD。'),
  section('尽职调查','个人身份须用可靠独立资料核验；法人还要核实实益所有人、所有权与控制结构、名称、编号、办公及营业地址，非上市公司还要了解适用法律、章程和管理层。','受监管上市公司等低风险客户可能适用 SDD；高风险国家、PEP及其家属或已知密切关系人、未曾面谈等高风险情况须 EDD，并审查交易背景目的、加强持续监控。'),
  section('报告责任','怀疑客户洗钱时，律师向律所合规官报告，指定人员向 NCA 提交 SAR、停止交易且不得 tipping off。法律专业特权范围内的独立法律咨询不当然对外披露。','申请 DAML 后，NCA同意可继续；来源页指出七个工作日内不反对或不答复视为同意。其他来源页列举的抗辩或例外包括培训不足、合理律师费的 adequate consideration、非虚假诉讼所得及特定境外行为。')
 ]),
 'financial-services':note('律师与金融服务','律师与金融服务',[
  section('律师与银行服务','律所不得把客户账户当作一般银行设施；只有与法律事项相关时才能持有或转移资金，法律事务结束后不能继续替客户日常付款。'),
  section('金融服务和市场法','FSMA 2000 原则上禁止未经授权或豁免从事受监管金融服务。律师不得以业务方式代理投资、安排交易、管理或保护投资资金，或评价具体投资的优劣。','土地、National Savings 产品及红酒、邮票、艺术品、老爷车等不属于来源页列出的受监管投资范围，但仍可能涉及职业道德。'),
  section('例外','介绍给 FCA 授权人士、通过获授权第三方交易，作为 trustee/nominee/personal representative 且不另收投资报酬，作为法律服务不可或缺部分，或代理出售公司至少50%投票权，可能不违反一般禁止。'),
  section('豁免','法律服务附带的金融服务可依 FCA 与 SRA 安排获豁免，但须书面披露律所身份、地址、服务性质、未获FCA授权、SRA监管及投诉救济。','交易须迅速执行并保存记录六年；妥善保管资金，向第三人转款取得书面确认；佣金须记录、通知并归客户；execution-only 取得客户书面确认。豁免不允许 financial promotion。')
 ]),
 'fees-legal-aid':note('律师费和法律援助','律师费与民事法律援助',[
  section('信息透明','律师应以客户能理解的方式说明委托范围、人员、费用或估算、义务、投诉、时限与客户需采取的步骤。Client care letter 常用但不是来源页所述的明确强制形式。','费用信息须尽可能准确并随重大变化更新，涵盖 fees、VAT 和 disbursements。可采用 hourly rate、fixed fee、CFA、DBA，以及 BTE/ATE 保险。','CFA胜诉时成功费通常最高为常规律师费的100%，人身伤害案还受赔偿额25%限制且刑事案不能使用；DBA按赔偿比例收费，人身伤害通常25%、就业案35%。'),
  section('民事案件中的法律援助','LAA 民事法援先看事项范围，再适用 merits 与 means test。Legal help 与 help at court 属 controlled work；特定家庭暴力、照护、无家可归、歧视及移民等事项属于 licensed work。','Controlled work 主要看 sufficient benefit；licensed work 还考察成功前景、成本收益及能否从其他途径筹资。','来源页列出的经济门槛为月总收入不超过 £2,657、月可支配收入低于 £733、资本通常不超过 £8,000（移民事项 £3,000）；领取特定福利可直接满足，配偶收入原则上合并。')
 ]),
 'ethics-overview':note('职业道德概述','职业道德概述',[
  section('律师对谁忠诚','Solicitor 对客户负忠诚义务，同时对法院和 proper administration of justice 负责，必要时还对第三人承担义务；客户利益并非压倒一切。'),
  section('SRA基本原则','七项原则要求维护法治与公正司法、维护公众信任、保持独立、诚信、正直、促进平等多样与包容，并维护每位客户的最佳利益。')
 ]),
 'ethics-rule-of-law':note('维护法治和公正司法','维护法治和公正司法',[
  section('守法','刑事定罪并非违反原则1的唯一方式；漠视法律平等、涉黑、恐怖主义、反复违法或洗钱等行为即使未定罪，也可能违反。'),
  section('维护公正司法','律师只能提出 properly arguable 且有法律或事实基础的主张，不得提出明知 frivolous 的论点。','律师须向法院指出本人已知且可能实质影响结果的相关案例、法条或程序不规范，包括不利于己方的材料。'),
  section('遵守SRA的规定','律师须了解并遵守现行 SRA 要求、配合调查及保存记录。刑事指控或处分、破产、重要执业信息变化及合理认为的 serious breach 等事项须及时报告。','向 COLP/COFA 报告只有在合理相信其会继续向 SRA 报告时才足够。律所须立即纠正账务违规，并用商业资金补足被挪用的客户资金。')
 ]),
 'ethics-public-confidence':note('维护公众对律师的信心','维护公众对律师的信心',[
  section('私人行为','与执业无关的私人行为也可能因损害职业声誉而违反原则2，例如高风险欺诈投资、向对方律师发送攻击贬损邮件或发布冒犯性社交媒体内容。'),
  section('投诉处理','签约时须书面告知客户可就服务和收费投诉、内部程序及 Legal Ombudsman 渠道。内部投诉应及时、公正、免费处理。','八周内未解决时，书面告知无法解决、适当 ADR 机构及是否同意使用、以及 Ombudsman 的方式和时限；客户通常再有六个月投诉。Ombudsman 处理服务质量问题，可命令道歉、退费或最高 £50,000 赔偿。'),
  section('广告和宣传','Publicity 必须准确且不误导；不得主动接近并招揽非现有或前客户。'),
  section('监管信息','客户应知道律师不为不受 SRA 监管的第三方行为负责，并应获知赔偿基金、专业责任保险等可用监管保护。')
 ]),
 'ethics-independence':note('独立','独立',[
  section('优先的法律义务','反洗钱、不误导法院及平等多样义务可优先于客户指示；指示与更高义务冲突时须拒绝，客户不改变时通常退出代理。','不存在优先义务时，律师仍不得让自身或第三人利益影响专业判断。'),
  section('房地产合同竞赛','Property contract race 须向另一交易方披露；客户拒绝披露时，应拒绝或终止代理。'),
  section('刑事案件','客户承认犯罪却坚持无罪答辩时，律师可要求控方证明，但不得积极提出客户无辜的虚假案件；必要时退出且不得向法院泄露退出原因。','客户有可用抗辩但坚持认罪时，律师先说明抗辩及控方案件强弱；客户仍坚持后应尊重，并可继续代理量刑。')
 ]),
 'ethics-honesty':note('诚信','诚信',[
  section('诚信的定义','先确定律师主观相信的事实，再由普通合理人依这些事实客观判断行为是否诚实。'),
  section('不得误导法庭','律师不得误导法院或裁判机构。可以进行 witness familiarisation，但不得 witness coaching 或教证人具体说法；应采用开放问题并保留适当记录。'),
  section('不得误导客户','律师须对客户诚实透明；自身过失造成损失时，应尽可能补救，并及时、完整告知事实及可能影响。'),
  section('不得误导他人','不误导义务也适用于对方律师及其他当事人。')
 ]),
 'ethics-integrity':note('正直','正直',[
  section('不得滥用律师地位','Integrity 要求不仅是不说谎，还涵盖整体行为。律师不得利用相对客户或 litigant in person 的专业优势谋取不当利益。'),
  section('意外披露','明显错误披露且受 privilege 保护的材料不得利用，也不得告知客户；双方律师应积极解决，法院通常也不会允许依赖。'),
  section('信守承诺','Undertaking 是向合理依赖者作出的、某事会发生或不会发生的口头或书面承诺，不必使用 undertake 一词；个人或代表律所作出后均须履行。'),
  section('纠正法庭和检察官','法官误述事实或法律时，即使对己方有利也须纠正；刑事辩护律师还可能须纠正控方错误，即使会增加客户刑责。')
 ]),
 'ethics-edi':note('鼓励平等多样化和包容','平等、多样化与包容',[
  section('个人观点','律师不得让个人观点影响与客户的关系，也不得在服务过程中实施不公平歧视。'),
  section('受保护的群体','Equality Act 2010 保护年龄、残疾、gender reassignment、婚姻或 civil partnership、怀孕与生育、种族或国籍、宗教信仰、性别及性取向。'),
  section('直接歧视','因 protected characteristic 直接给予较差待遇，构成禁止的 direct discrimination。'),
  section('间接歧视','表面统一的 provision、criterion 或 practice 对特定群体造成不利时，除非为实现合法目标且手段相称，否则构成 indirect discrimination。'),
  section('因残疾而产生的歧视','律所须主动采取 reasonable adjustments，避免残疾人遭受 substantial disadvantage，且不能把调整费用转嫁给残疾人。'),
  section('骚扰','与受保护特征相关的行为如侵犯尊严，或制造恐吓、敌对、贬低、羞辱或冒犯环境，可能构成 harassment；也不得因拒绝骚扰而差别待遇。'),
  section('报复','因他人提起 Equality Act 诉讼、提供证据、从事相关活动或指控违法而对其不利，构成 victimisation。'),
  section('替代责任','雇主通常对员工违反 Equality Act 的行为承担 vicarious liability，除非证明已采取合理步骤预防。')
 ]),
 'ethics-best-interests':note('维护客户的最佳利益','维护客户的最佳利益',[
  section('服务与胜任','律师须胜任、控制工作量、维护保密、避免未经授权利润，并避免自身、其他客户或前客户利益影响当前客户。监督他人时仍对其工作负责。','第三人可以在客户同意时提供指示；如怀疑授权或真实意愿，须采取措施核实并排除不当影响。','遗嘱能力有疑问时遵循 golden rule：寻求医疗意见并在签署时由医疗人员确认，详细书面记录能力、证据与理由；面谈尽量排除家属的不当影响。'),
  section('推荐、执业和商业要求','收取或支付 referral fee 必须向客户披露并书面安排；刑事案件及死亡或人身伤害索赔原告事项不得支付或收取推荐费。','向非授权机构推荐、拆分业务等情形须取得客户书面同意；非授权机构不得以 solicitor 名义经营。'),
  section('利益冲突','Own-interest conflict 或其重大风险没有例外。客户之间冲突原则上也禁止，但 substantially common interest 或 competing for same objective 可在特定条件下例外。','例外还须取得 informed written consent、保护保密信息并由律师合理判断共同代理适当；刑事案件通常不能使用这些例外。','掌握前客户保密信息且新事项与其利益冲突时，只有无真实披露风险的有效措施，或受不利影响客户书面同意，才可代理。'),
  section('房地产交易','买卖双方利益相反，通常不宜共同代理；joint buyers 一般可以。标准住宅按揭中，在使用标准文件且合理、符合双方利益时，可共同代理 lender 与 buyer。','配偶以自有财产担保时，依 Etridge 指引应考虑单独代理，并以单独面谈、非技术语言说明后果、确认自由选择及书面授权向 lender 确认。'),
  section('保密义务','与委托有关的信息即使来自第三人也须保密，客户死亡后义务转移至 personal representative。法律或法院命令、客户同意属于明确例外。','防止将发生的自杀、严重自残、儿童或弱势成人伤害、犯罪时，披露可能正当；事件已经发生后通常不适用。'),
  section('披露义务','律师原则上须把重要信息告诉客户；法律禁止、客户书面知情同意、不披露是为避免严重身体或精神伤害、或信息来自错误披露的特权文件时例外。'),
  section('客户资金和资产','客户资金由律师以信托方式持有；代理产生的经济利益原则上记入客户账，另有约定或适用单独利息规则除外。COLP 负责一般合规，COFA 负责财务合规。')
 ]),
 'solicitors-accounts':note('律师账务','律师账务',[
  section('商户账户和客户账户','Business money 与 client money 必须分离：已开账单的 fees 与 VAT、律所已支付后收回的 disbursements 属商业资金；预存费用及代持款通常属客户资金。','错误挪用客户资金须立即用商业资金补足；收到客户资金应 promptly 存入客户账户，通常可在下一工作日；客户资金转为商业资金后也应及时转出。'),
  section('客户账户的类别','不持有客户资金的律所可不设客户账户；否则至少设 general client account。长期持有大额资金可设 separate designated deposit client account。','Joint account、代客户操作自有账户、以及由FCA监管第三方管理的 TPMA 均有独立规则；选择及使用方式须符合客户最佳利益。'),
  section('记账、对账和审计','每个客户及每一事项须有单独 client ledger，并维护 client cash sheet、profit costs ledger 与 transfer journal。','至少每五周取得银行账单并完成 reconciliation，由 COFA 或经理签署。持有客户资金的律所原则上须在会计期结束后六个月内取得 accountant’s report；特定低余额或仅法援资金者例外。','Qualifying report 须在同一期限提交 SRA；全部会计记录保存至少六年。'),
  section('客户资金必须随时提取','客户要求时须按指示返还；事项完成后也不能无限期留存。失联后经合理时间和查找，可申请 SRA 同意捐赠；少于 £500 时来源页指出无须事先批准。')
 ]),
 'double-entry':note('复式记账法入门','复式记账法入门',[
  section('借记和贷记','每项交易均以相等的 debit 与 credit 成对记录。Cash sheet 中借记表示现金增加、贷记表示减少；client ledger 中借记表示客户余额减少或欠律所，贷记表示客户余额增加。'),
  section('预存律师费','尚未产生的 fees 与未来 disbursements 的 on-account payment 属客户资金：客户账户现金表借记，客户 ledger 的 client-account 栏贷记。'),
  section('后付律师费','已产生的费用先发 bill：client ledger business 栏借记 fees 与 VAT，profit costs ledger 贷记费用，HMRC-VAT ledger 贷记输出税。','Fee abatement 按相反方向调整相应账簿；客户随后付款进入 business account，再以 cash sheet 与 client ledger 的对应分录结清。'),
  section('律师作为受托人','律师作为 trustee 或 personal representative 管理的资金属于 client money；收取与分配均在客户账户及相应 ledger、cash sheet 记录。'),
  section('转账','客户之间或同一客户不同事项之间可经 transfer journal 转账；现金不动，只在转出 ledger 借记、转入 ledger 贷记。非法律目的的第三方付款仍可能构成禁止的 banking facility。')
 ]),
 'interest':note('利息','客户资金利息',[
  section('利息的支付方式','只有 client account 的利息可能归客户；business account 利息归律所。律所须给予客户公平利息，或以书面安排支付 sum in lieu of interest。','书面政策可设公平的 de minimis 门槛；SDDCA 的实际利息通常直接归对应客户。'),
  section('替代利息的记账','一般客户账户利息在替代利息模式下先归律所；确定应付客户金额后，在 client ledger business 栏贷记，并在 interest payable ledger 作对应分录。','如客户继续用于法律服务，应把属于客户的钱从 business account 转入 client account。'),
  section('单开账户的利息记账','SDDCA 可在现有账簿增设 deposit 栏，或另设 deposit client ledger 与 cash sheet；转入、结息及转回均须分别成对记录。')
 ]),
 'disbursements':note('第三方费用的报销','第三方费用的报销',[
  section('免税第三方','SDLT、Land Registry fee、court fee、probate fee 等来源页列举的政府费用通常为 VAT purposes 的免税 disbursement。','客户账户有钱时可直接支付；没有时可由 business account 垫付，但绝不能动用其他客户资金。'),
  section('应税第三方 - 代理法','Invoice 直接开给客户时适用 agency method；把含 VAT 的总额作为一笔支出记录，客户账户有余额时可直接从 client account 支付，不单独在 HMRC-VAT ledger 拆分。'),
  section('应税第三方 - 无代理法','Invoice 开给律所时适用 principal method，全部通过 business account：税前费用与 VAT 分别记录，VAT进入 HMRC-VAT ledger。','客户收到律所 bill 后，如 client account 有钱可转入 business account。区分两法的核心是第三方发票抬头及资金从哪个账户支出。')
 ])
};
