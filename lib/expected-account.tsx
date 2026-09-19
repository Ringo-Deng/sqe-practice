'use client';
import {createContext,useContext,type ReactNode} from 'react';

// Empty on the original Next/GitHub builds. Cloud renders capture their verified
// account so an older tab/callback cannot silently act with a newer login cookie.
const ExpectedAccountContext=createContext<string|null>(null);
export function ExpectedAccountProvider({accountId,children}:{accountId:string;children:ReactNode}){
 return <ExpectedAccountContext.Provider value={accountId}>{children}</ExpectedAccountContext.Provider>;
}
export function useExpectedAccount(){return useContext(ExpectedAccountContext);}
