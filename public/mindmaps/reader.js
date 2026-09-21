// Keep saved links to the previous viewer working, including chapter targets.
const destination=new URL('../',location.href);
const previous=new URLSearchParams(location.search);
destination.searchParams.set('reader','mindmap');
for(const key of ['map','top','focus','question']){
 const value=previous.get(key);
 if(value!==null)destination.searchParams.set(key,value);
}
location.replace(destination.href);
