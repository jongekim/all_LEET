export const number = (value:number|null|undefined) => value==null?'—':value.toLocaleString('ko-KR',{maximumFractionDigits:1});
export const percent = (n:number,d:number) => d?`${number(n/d*100)}%`:'—';
export const time = (value:string|null) => value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'—';
