import {AsyncLocalStorage} from 'node:async_hooks';

type VerifiedIdentity={id:string;name:string;username:string};
const context=new AsyncLocalStorage<VerifiedIdentity>();

export function withVerifiedIdentity<T>(identity:VerifiedIdentity,operation:()=>T):T{
 return context.run(identity,operation);
}

// Existing Sites API handlers consume trusted platform headers. In the standalone
// Worker they are synthesized only from a verified account session, never copied
// from inbound HTTP headers.
export async function headers():Promise<Headers>{
 const user=context.getStore();
 const result=new Headers();
 if(user){
  result.set('oai-authenticated-user-id',user.id);
  result.set('oai-authenticated-user-email',`${user.username}@accounts.invalid`);
  result.set('oai-authenticated-user-full-name',encodeURIComponent(user.name));
  result.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
 }
 return result;
}
