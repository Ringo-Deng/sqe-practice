import catalog from '../public/mindmaps/catalog.json';
import type {Textbook} from './textbooks';

// Segment geometry is part of saved annotation coordinates. Version document IDs before changing it.
export const MINDMAP_SLICE_HEIGHT=1200;
const subjects:Record<string,readonly string[]>={ethics:['legal-services'],business:['business'],'legal-system':['legal-system'],contract:['contract'],dispute:['dispute'],tort:['tort'],'criminal-law':['criminal-liability'],'criminal-practice':['criminal-practice'],'land-property':['land','property-practice'],trusts:['trusts'],wills:['wills'],taxation:['business','wills']};
export const mindMapBooks:Textbook[]=catalog.map(map=>({
 id:`mindmap-${map.id}`,title:`思维导图 · ${map.title}`,shortTitle:`导图 · ${map.title}`,subjectId:subjects[map.id][0],subjectIds:subjects[map.id],
 ...(map.id==='ethics'?{groups:['FLK1','FLK2'] as const}:{}),
 version:'思维导图',pageCount:Math.ceil(map.height/MINDMAP_SLICE_HEIGHT),url:`/mindmaps/${map.file}`,sha256:map.sha256,
 pdfSlice:{height:MINDMAP_SLICE_HEIGHT,width:map.width,totalHeight:map.height},
}));
