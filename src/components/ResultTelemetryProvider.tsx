import { useContext,useMemo,type ReactNode } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { analyticsId } from '../utils/analyticsId';
import { ResultTelemetryContext,type ResultSurface } from '../contexts/ResultTelemetryContext';
import { AuthContext } from '../contexts/AuthContext';
export function ResultTelemetryProvider({source,enabled,children}:{source:string;enabled:boolean;children:ReactNode}) {
 const location=useContext(UNSAFE_LocationContext),auth=useContext(AuthContext),owner=auth?.currentUser?.id||null;
 const allowed=enabled&&!auth?.isAdmin&&!auth?.adminLoading&&!auth?.adminError;
 const value=useMemo(()=>({id:analyticsId(),verbal:analyticsId(),reasoning:analyticsId(),surface:(source==='past'?'past':source==='history'?'history':source==='example'?'example':'new') as ResultSurface,enabled:allowed,entry:location?.location.key,owner}),[source,allowed,location?.location.key,owner]);
 return <ResultTelemetryContext.Provider value={value}>{children}</ResultTelemetryContext.Provider>;
}
