export function redirect(path:string):never{
 throw new Error(`Unexpected server navigation: ${path}`);
}
