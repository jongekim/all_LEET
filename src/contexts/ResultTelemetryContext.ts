import { createContext } from 'react';
export type ResultSurface='new'|'history'|'example'|'past';
export type TelemetryTool='distribution'|'field'|'edit'|'note';
export const ResultTelemetryContext=createContext<{id:string;verbal:string;reasoning:string;surface:ResultSurface;enabled:boolean;entry?:string;owner:string|null}|null>(null);
