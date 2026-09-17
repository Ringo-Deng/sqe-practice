// Preserve the original eight-question demo timer for saved sessions.
export function examDurationMs(ids:string[]){return ids.length===8&&ids.every(id=>id.startsWith('demo-'))?14*60*1000:ids.length*108*1000;}
