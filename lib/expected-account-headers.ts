export const EXPECTED_ACCOUNT_HEADER='X-Expected-Account-Id';

export function expectedAccountHeaders(accountId:string|null,initial?:HeadersInit):Headers{
 const headers=new Headers(initial);
 if(accountId!==null)headers.set(EXPECTED_ACCOUNT_HEADER,accountId);
 return headers;
}

// This is an expectation check only. The authenticated session always owns data.
export function matchesExpectedAccount(request:Request,verifiedUserId:string):boolean{
 const expected=request.headers.get(EXPECTED_ACCOUNT_HEADER);
 return expected===null||expected===verifiedUserId;
}
