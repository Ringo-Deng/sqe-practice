// PDF coordinates are measured from the top of each supplied, single-page map.
// The publisher's diagram branches do not share the Revise textbook numbering.
// Each entry therefore points to the matching topic branch, not chapter N in the PDF.
const numberedChapters:Record<string,{mapId:string;tops:number[]}>= {
 business:{mapId:'business',tops:[1187,772,3055,4694,7514,10166,9100,8849,9249,8680]},
 contract:{mapId:'contract',tops:[1108,1408,1744,6404,3081,3900,4514,5960,7140,7964]},
 dispute:{mapId:'dispute',tops:[417,319,1693,2707,2105,5315,3822,7262,6641,10329,9334]},
 tort:{mapId:'tort',tops:[2051,1239,1837,9569,5165,4172,6208,8054]},
 'legal-system-lss':{mapId:'legal-system',tops:[9486,3720,2154,276]},
 'legal-system-cal':{mapId:'legal-system',tops:[1927,3076,2818,952,3720,5654,9148,6228,7343]},
 'criminal-liability':{mapId:'criminal-law',tops:[946,1708,1359,11633,2507,3222,4783,6133,6699]},
 'criminal-practice':{mapId:'criminal-practice',tops:[1636,3268,7009,5067,8824,13964,9253,11415,18073,12191]},
 land:{mapId:'land-property',tops:[38,2725,3463,708,8971,1867,2807,4110,415]},
 'property-practice':{mapId:'land-property',tops:[12667,12729,13521,13453,14316,8971,11218,12515,10262,18609]},
 trusts:{mapId:'trusts',tops:[817,3181,3152,220,4209,1842,9025,9050,104,6047,7948,8331]},
 wills:{mapId:'wills',tops:[129,12203,8184,7249,15047,1905,13499,13132,15149,17288,2476]},
};

const namedChapters:Record<string,{mapId:string;top:number}>={
 'legal-services-sra-regulation':{mapId:'ethics',top:1142},
 'legal-services-aml':{mapId:'ethics',top:6747},
 'legal-services-financial-services':{mapId:'ethics',top:5556},
 'legal-services-funding':{mapId:'ethics',top:11052},
 'legal-services-sra-principles':{mapId:'ethics',top:5079},
 'legal-services-code-of-conduct':{mapId:'ethics',top:5111},
};

export function mindMapChapterLocation(chapterId?:string){
 if(!chapterId)return undefined;
 const named=namedChapters[chapterId];
 if(named)return named;
 const match=/^(.*)-(\d{2})$/.exec(chapterId);
 if(!match)return undefined;
 const group=numberedChapters[match[1]];
 const top=group?.tops[Number(match[2])-1];
 return top===undefined?undefined:{mapId:group.mapId,top};
}
