const list=document.getElementById('map-list');
const select=document.getElementById('map-select');
const cards=document.getElementById('landing-cards');
const landing=document.getElementById('landing');
const panel=document.getElementById('document-panel');
const viewer=document.getElementById('pdf-viewer');
let maps=[];

function requestedMap(){return new URLSearchParams(location.search).get('map');}

function showMap(id){
 const map=maps.find(item=>item.id===id);
 landing.hidden=!!map;
 panel.hidden=!map;
 select.value=map?.id??'';
 list.querySelectorAll('a[data-map]').forEach(link=>{
  if(link.dataset.map===map?.id)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 });
 if(!map){viewer.removeAttribute('src');document.title='思维导图 · SQE Practice';return;}
 document.getElementById('document-title').textContent=map.title;
 document.getElementById('document-en').textContent=map.en;
 document.getElementById('document-group').textContent=map.group;
 document.getElementById('pdf-link').href=`./${map.file}`;
 viewer.title=`${map.title}思维导图 PDF`;
 viewer.src=`./${map.file}#zoom=125`;
 document.title=`${map.title} · 思维导图 · SQE Practice`;
}

function navigate(id){
 const url=new URL(location.href);
 if(id)url.searchParams.set('map',id);
 else url.searchParams.delete('map');
 history.pushState(null,'',url);
 showMap(id);
}

function mapLink(map,className){
 const link=document.createElement('a');
 link.href=`?map=${encodeURIComponent(map.id)}`;
 link.className=className;
 link.dataset.map=map.id;
 const title=document.createElement('strong');title.textContent=map.title;
 const subtitle=document.createElement('small');subtitle.textContent=map.en;
 link.append(title,subtitle);
 link.addEventListener('click',event=>{event.preventDefault();navigate(map.id);});
 return link;
}

async function loadCatalog(){
 try{
  const response=await fetch('./catalog.json');
  if(!response.ok)throw new Error('Catalog unavailable');
  maps=await response.json();
  const groups=[...new Set(maps.map(map=>map.group))];
  for(const group of groups){
   const section=document.createElement('section');
   const heading=document.createElement('h2');heading.textContent=group;
   section.append(heading);
   for(const map of maps.filter(item=>item.group===group))section.append(mapLink(map,'catalog-link'));
   list.append(section);
  }
  for(const map of maps){
   const option=document.createElement('option');option.value=map.id;option.textContent=map.title;select.append(option);
   cards.append(mapLink(map,'map-card'));
  }
  showMap(requestedMap());
 }catch{document.getElementById('load-error').hidden=false;landing.hidden=true;}
}

select.addEventListener('change',()=>navigate(select.value));
addEventListener('popstate',()=>showMap(requestedMap()));
loadCatalog();
