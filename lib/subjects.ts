export type Subject={id:string;zh:string;en:string;group:'FLK1'|'FLK2';scope:string};
export const subjects:Subject[]=[
{id:'contract',zh:'合同法',en:'Contract Law',group:'FLK1',scope:'合同成立、条款、合同瑕疵、解除与救济'},
{id:'business',zh:'商法与实务',en:'Business Law and Practice',group:'FLK1',scope:'经营组织、公司管理、融资、破产与相关税务'},
{id:'dispute',zh:'争议解决',en:'Dispute Resolution',group:'FLK1',scope:'民事诉讼、证据、案件管理、和解与执行'},
{id:'tort',zh:'侵权法',en:'Tort',group:'FLK1',scope:'过失、责任、因果关系、抗辩与损害赔偿'},
{id:'legal-system',zh:'法律制度、公法与欧盟法',en:'Legal System',group:'FLK1',scope:'英格兰与威尔士法律制度、宪法、行政法及欧盟法'},
{id:'legal-services',zh:'法律服务与职业道德',en:'Legal Services & Ethics',group:'FLK1',scope:'法律服务按 FLK1 考纲分类；职业道德贯穿 FLK1 和 FLK2。'},
{id:'property-practice',zh:'房地产法与实务',en:'Property Law and Practice',group:'FLK2',scope:'房地产买卖、调查、交割、租赁与相关税务'},
{id:'wills',zh:'遗嘱与遗产管理',en:'Wills and the Administration of Estates',group:'FLK2',scope:'遗嘱效力、无遗嘱继承、遗产管理与相关税务'},
{id:'accounts',zh:'律师账目',en:'Solicitors Accounts',group:'FLK2',scope:'客户资金与账目；结合房地产及遗产管理情境考查'},
{id:'land',zh:'土地法',en:'Land Law',group:'FLK2',scope:'土地权利、登记、共同所有、租赁与抵押'},
{id:'trusts',zh:'信托法',en:'Trusts Law',group:'FLK2',scope:'信托设立、受托人义务、受益人权利与救济'},
{id:'criminal-liability',zh:'刑事实体法',en:'Criminal Liability',group:'FLK2',scope:'犯罪构成、主要罪名、未完成犯罪与抗辩'},
{id:'criminal-practice',zh:'刑事法与实务',en:'Criminal Law and Practice',group:'FLK2',scope:'警察调查、保释、刑事诉讼、证据、量刑与上诉'}
];
export const subjectById=(id?:string)=>subjects.find(s=>s.id===id);
export const syllabusUrl='https://sqe.sra.org.uk/assessments/sqe1-assessments/sqe1-specification';
