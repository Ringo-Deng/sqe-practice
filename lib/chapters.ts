import type {Question} from './study-types';

export type Chapter={
 id:string;
 subjectId:string;
 bookId:string;
 bookZh:string;
 bookEn:string;
 number:number;
 zh:string;
 en:string;
};

type ChapterBook={
 bookId:string;
 subjectId:string;
 idPrefix:string;
 bookZh:string;
 bookEn:string;
 items:[number,string,string][];
};

const chapterBooks:ChapterBook[]=[
 {
  bookId:'revise-business-law-practice-2027',subjectId:'business',idPrefix:'business',
  bookZh:'商法与实务',bookEn:'Business Law and Practice',
  items:[
   [1,'创办新企业：企业组织形式','Starting a new business: types of business medium'],
   [2,'合伙','Partnerships'],
   [3,'有限公司（上）','Limited companies: part 1'],
   [4,'有限公司（下）','Limited companies: part 2'],
   [5,'企业融资、财务记录与会计要求','Financing a business, financial records and accounting requirements'],
   [6,'终止经营与破产','Termination and insolvency'],
   [7,'交易利润与增值税','Trading profits and VAT'],
   [8,'所得税','Income tax'],
   [9,'资本利得税与遗产税','Capital gains tax and inheritance tax'],
   [10,'公司税','Corporation tax'],
  ],
 },
 {
  bookId:'revise-dispute-resolution-2027',subjectId:'dispute',idPrefix:'dispute',
  bookZh:'争议解决',bookEn:'Dispute Resolution',
  items:[
   [1,'争议解决的不同方式','Different options for dispute resolution'],
   [2,'通过民事诉讼解决争议','Resolving a dispute through a civil claim'],
   [3,'启动诉讼程序','Commencing proceedings'],
   [4,'对诉讼请求作出回应','Responding to a claim'],
   [5,'案情陈述文件','Statements of case'],
   [6,'中间申请','Interim applications'],
   [7,'案件管理','Case management'],
   [8,'证据','Evidence'],
   [9,'披露与查阅','Disclosure and inspection'],
   [10,'诉讼费用与资助','Costs and funding'],
   [11,'审判、上诉与金钱判决执行','Trial, appeals and enforcement of money judgments'],
  ],
 },
 {
  bookId:'revise-contract-2027',subjectId:'contract',idPrefix:'contract',
  bookZh:'合同法',bookEn:'Contract Law',
  items:[
   [1,'要约与承诺','Offer and acceptance'],
   [2,'对价','Consideration'],
   [3,'法律关系意图、确定性与行为能力','The intention to create legal relations, certainty and capacity'],
   [4,'合同相对性与第三人权利','Privity of contract and rights of third parties'],
   [5,'合同内容（一）：来源与解释','Contents of a contract 1: Sources and interpretation'],
   [6,'合同内容（二）：免责条款与不公平条款','Contents of a contract 2: Exemption clauses and unfair terms'],
   [7,'虚假陈述','Misrepresentation'],
   [8,'错误、胁迫、不当影响与违法','Mistake, duress, undue influence and illegality'],
   [9,'合同义务的解除','The discharge of contracts'],
   [10,'救济','Remedies'],
  ],
 },
 {
  bookId:'revise-tort-2027',subjectId:'tort',idPrefix:'tort',
  bookZh:'侵权法',bookEn:'Tort Law',
  items:[
   [1,'过失：注意义务与违反义务','Negligence: Duty of care and breach'],
   [2,'过失：因果关系、损害遥远性与损失','Negligence: Causation, remoteness and loss'],
   [3,'过失：救济、纯经济损失与精神损害','Negligence: Remedies, economic loss and psychiatric harm'],
   [4,'抗辩','Defences'],
   [5,'替代责任与雇主责任','Vicarious liability and employers’ liability'],
   [6,'场所占有人责任','Occupiers’ liability'],
   [7,'产品责任','Product liability'],
   [8,'妨害与 Rylands v Fletcher 规则','Nuisance and Rylands v Fletcher'],
  ],
 },
 {
  bookId:'revise-legal-system-services-2027',subjectId:'legal-system',idPrefix:'legal-system-lss',
  bookZh:'英格兰与威尔士法律制度',bookEn:'The Legal System and Services of England and Wales',
  items:[
   [1,'英格兰与威尔士法院体系','The court structure of England and Wales'],
   [2,'法律渊源：主要立法','Sources of law: primary legislation'],
   [3,'法律渊源：成文法解释','Sources of law: statutory interpretation'],
   [4,'法律渊源：判例法','Sources of law: case law'],
  ],
 },
 {
  bookId:'revise-constitutional-administrative-2027',subjectId:'legal-system',idPrefix:'legal-system-cal',
  bookZh:'宪法与行政法',bookEn:'Constitutional and Administrative Law',
  items:[
   [1,'宪法与宪法惯例','The constitution and conventions'],
   [2,'议会：议会主权与议会特权','Parliament: Parliamentary sovereignty and parliamentary privilege'],
   [3,'中央政府与权力下放机构','Central government and devolved institutions'],
   [4,'王室与皇家特权','The Crown and the royal prerogative'],
   [5,'立法：主要立法与次级立法','Legislation: Primary and secondary'],
   [6,'公共秩序法','Public order law'],
   [7,'司法审查','Judicial review'],
   [8,'人权','Human rights'],
   [9,'欧盟法','European Union law'],
  ],
 },
 {
  bookId:'revise-legal-system-services-2027',subjectId:'legal-services',idPrefix:'legal-services-lss',
  bookZh:'英格兰与威尔士法律服务',bookEn:'The Legal System and Services of England and Wales',
  items:[
   [5,'法律服务监管','The regulation of legal services'],
   [6,'首要法律义务','Overriding legal obligations'],
   [7,'金融服务','Financial services'],
   [8,'法律服务的资助方式','Funding options for legal services'],
  ],
 },
 {
  bookId:'revise-ethics-2027',subjectId:'legal-services',idPrefix:'legal-services-ethics',
  bookZh:'职业道德与专业行为',bookEn:'Ethics and Professional Conduct',
  items:[
   [1,'SRA 原则','SRA Principles'],
   [2,'SRA 行为准则','SRA Code of Conduct'],
   [3,'争议解决中的职业道德与专业行为','Ethics and professional conduct in dispute resolution'],
   [4,'商法与实务中的职业道德与专业行为','Ethics and professional conduct in business law and practice'],
   [5,'刑法与实务中的职业道德与专业行为','Ethics and professional conduct in criminal law and practice'],
   [6,'遗嘱及遗产管理中的职业道德与专业行为','Ethics and professional conduct in wills and the administration of estates'],
   [7,'房地产实务中的职业道德与专业行为','Ethics and professional conduct in property practice'],
   [8,'律师账目中的职业道德与专业行为','Ethics and professional conduct in solicitors’ accounts'],
  ],
 },
 {
  bookId:'revise-trusts-2027',subjectId:'trusts',idPrefix:'trusts',
  bookZh:'信托法',bookEn:'Trusts Law',
  items:[
   [1,'三项确定性','The three certainties'],
   [2,'设立信托的形式要求','Formalities for the creation of trusts'],
   [3,'信托财产的完整转移','Constitution of trusts'],
   [4,'“衡平法不帮助无偿受让人”原则的例外','Exceptions to the maxim that equity will not assist a volunteer'],
   [5,'受益权归属','Beneficial entitlement'],
   [6,'目的信托','Purpose trusts'],
   [7,'归复信托','Resulting trusts'],
   [8,'家庭住房信托','Family home trusts'],
   [9,'第三人责任与信义关系','Liability of strangers and the fiduciary relationship'],
   [10,'受托人','Trustees'],
   [11,'受托人责任','Trustees’ liability'],
   [12,'衡平法追踪与衡平法救济','Equitable tracing and equitable remedies'],
  ],
 },
 {
  bookId:'revise-solicitors-accounts-2027',subjectId:'accounts',idPrefix:'accounts',
  bookZh:'律师账目',bookEn:'Solicitors’ Accounts',
  items:[
   [1,'律师账目的基础','Foundations of solicitors’ accounts'],
   [2,'客户资金与客户账户（上）','Client money and client accounts: part 1'],
   [3,'客户资金与客户账户（下）','Client money and client accounts: part 2'],
   [4,'利息','Interest'],
   [5,'账单','Bills'],
   [6,'增值税与转账','VAT and transfers'],
   [7,'房产交易账目及其他账目','Conveyancing accounts and other accounts'],
   [8,'记录、对账与报告','Records, reconciliation and reports'],
  ],
 },
 {
  bookId:'revise-wills-estates-2027',subjectId:'wills',idPrefix:'wills',
  bookZh:'遗嘱与遗产管理',bookEn:'Wills and the Administration of Estates',
  items:[
   [1,'有效遗嘱的基本要求','Essential requirements for a valid will'],
   [2,'遗产代理人','The personal representatives'],
   [3,'遗嘱解释、涂改与修订','Interpretation of wills, alterations and amendments'],
   [4,'遗嘱撤销','Revocation of wills'],
   [5,'无遗嘱继承规则','The intestacy rules'],
   [6,'遗产范围之外转移的财产','Property passing outside of the estate'],
   [7,'取得遗产代理授予','Getting the grant of representation'],
   [8,'遗产管理','Administration of the estate'],
   [9,'《1975年继承（家庭及受扶养人供养）法》项下的请求','Claims under the Inheritance (Provision for Family and Dependants) Act 1975'],
   [10,'遗产税','Inheritance tax'],
   [11,'遗嘱信托：受托人与受益人','Will trusts: trustees and beneficiaries'],
  ],
 },
 {
  bookId:'revise-property-practice-2027',subjectId:'property-practice',idPrefix:'property-practice',
  bookZh:'房地产实务',bookEn:'Property Practice',
  items:[
   [1,'永久产权交易的关键要素与结构概览','Key elements and structure of freehold property transactions: an overview'],
   [2,'合同前阶段（一）：产权证明与审查','Pre-contract (1): deduction and investigation of title'],
   [3,'合同前阶段（二）：查询、询问与规划事项','Pre-contract (2): searches and enquiries and planning matters'],
   [4,'合同草案与合同交换','The draft contract and exchange of contracts'],
   [5,'交割前、交割及交割后事项','Pre-completion, completion, and post-completion matters'],
   [6,'租约的结构与内容','Structure and content of a lease'],
   [7,'商业租约的授予与转让','Grant and assignment of commercial leases'],
   [8,'商业租赁救济','Commercial leasehold remedies'],
   [9,'租约终止及《1954年房东与租客法》第二部分的租赁权保障','Termination of leases and security of tenure under Part II of the Landlord and Tenant Act 1954'],
   [10,'房地产税务','Property taxation'],
  ],
 },
 {
  bookId:'revise-criminal-law-2027',subjectId:'criminal-liability',idPrefix:'criminal-liability',
  bookZh:'刑法',bookEn:'Criminal Law',
  items:[
   [1,'刑法一般原则','General principles of criminal law'],
   [2,'共同犯罪人','Parties to a crime'],
   [3,'未完成犯罪','Inchoate offences'],
   [4,'一般抗辩','General defences'],
   [5,'杀人罪','Homicide offences'],
   [6,'非致命人身犯罪','Non-fatal offences against the person'],
   [7,'盗窃类犯罪','Theft offences'],
   [8,'欺诈类犯罪','Fraud offences'],
   [9,'刑事损坏','Criminal damage'],
  ],
 },
 {
  bookId:'revise-land-law-2027',subjectId:'land',idPrefix:'land',
  bookZh:'土地法',bookEn:'Land Law',
  items:[
   [1,'土地法的性质与原则','The nature and principles of land law'],
   [2,'未登记土地','Unregistered land'],
   [3,'登记土地','Registered land'],
   [4,'永久产权地产','Freehold estates'],
   [5,'租赁地产','Leasehold estates'],
   [6,'地役权','Easements'],
   [7,'永久产权契约','Freehold covenants'],
   [8,'抵押','Mortgages'],
   [9,'共同所有','Co-ownership'],
  ],
 },
 {
  bookId:'revise-criminal-practice-2027',subjectId:'criminal-practice',idPrefix:'criminal-practice',
  bookZh:'刑事实务',bookEn:'Criminal Practice',
  items:[
   [1,'就警察局程序与流程向客户（包括弱势客户）提供建议','Advising clients, including vulnerable clients, about the procedure and processes at the police station'],
   [2,'保释申请','Bail applications'],
   [3,'治安法院首次聆讯','First hearings before the magistrates’ court'],
   [4,'审判地点答辩及治安法院与皇家法院之间的案件分配','Plea before venue and allocation of business between magistrates’ court and Crown Court'],
   [5,'案件管理与审前聆讯','Case management and pre-trial hearings'],
   [6,'采纳与排除证据的原则和程序','Principles and procedures to admit and exclude evidence'],
   [7,'治安法院与皇家法院的审判程序','Trial procedure in the magistrates’ court and Crown Court'],
   [8,'量刑','Sentencing'],
   [9,'上诉程序','Appeals procedure'],
   [10,'青少年法院程序与聆讯','Youth Court procedure and hearings'],
  ],
 },
 {
  bookId:'revise-ethics-2027',subjectId:'flk2-ethics',idPrefix:'flk2-ethics',
  bookZh:'职业道德与专业行为（FLK2）',bookEn:'Ethics and Professional Conduct (FLK2)',
  items:[
   [1,'SRA 原则','SRA Principles'],
   [2,'SRA 行为准则','SRA Code of Conduct'],
   [3,'争议解决中的职业道德与专业行为','Ethics and professional conduct in dispute resolution'],
   [4,'商法与实务中的职业道德与专业行为','Ethics and professional conduct in business law and practice'],
   [5,'刑法与实务中的职业道德与专业行为','Ethics and professional conduct in criminal law and practice'],
   [6,'遗嘱及遗产管理中的职业道德与专业行为','Ethics and professional conduct in wills and the administration of estates'],
   [7,'房地产实务中的职业道德与专业行为','Ethics and professional conduct in property practice'],
   [8,'律师账目中的职业道德与专业行为','Ethics and professional conduct in solicitors’ accounts'],
  ],
 },
];

export const chapters:Chapter[]=chapterBooks.flatMap(book=>book.items.map(([number,zh,en])=>({
 id:`${book.idPrefix}-${String(number).padStart(2,'0')}`,
 subjectId:book.subjectId,
 bookId:book.bookId,
 bookZh:book.bookZh,
 bookEn:book.bookEn,
 number,
 zh,
 en,
})));
export const chapterById=(id?:string)=>chapters.find(c=>c.id===id);
export function filterQuestions<T extends Pick<Question,'sourceId'|'subjectId'|'chapterId'|'sourceSet'>>(items:T[],filter:{sourceId?:string;subjectId?:string;chapterId?:string;sourceSet?:string}){
 return items.filter(q=>(!filter.sourceId||filter.sourceId==='all'||q.sourceId===filter.sourceId)&&(!filter.subjectId||q.subjectId===filter.subjectId)&&(!filter.chapterId||q.chapterId===filter.chapterId)&&(!filter.sourceSet||q.sourceSet===filter.sourceSet));
}
