import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MemberOptions, MemberPurpose, MemberReference } from '../../types/analytics';
import { canKeepPreviousAnalytics } from '../../utils/adminAnalyticsErrors';
import '../../styles/admin-dashboard.css';

export type MemberOptionsLoader = (owner: string, purpose: MemberPurpose, query?: string, cursor?: string, signal?: AbortSignal) => Promise<MemberOptions>;
interface Props { owner: string; purpose?: MemberPurpose; label?: string; value: MemberReference | null; onChange(value: MemberReference | null): void; loadOptions: MemberOptionsLoader }
export function AdminMemberPicker(props: Props) { return <MemberPicker key={`${props.owner}:${props.purpose||'member_activity'}`} {...props} />; }
function MemberPicker({ owner, purpose='member_activity', label='회원 선택', value, onChange, loadOptions }: Props) {
  const id=useId(), root=useRef<HTMLDivElement>(null), input=useRef<HTMLInputElement>(null), request=useRef<AbortController|null>(null);
  const retry=useRef<{cursor:string;history:string[]}>({cursor:'',history:[]});
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
  const [data,setData]=useState<MemberOptions|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[active,setActive]=useState(-1),[history,setHistory]=useState<string[]>([]);
  const loadPage=useCallback(async (cursor:string,previous:string[])=> {
    retry.current={cursor,history:previous};
    request.current?.abort();const c=new AbortController();request.current=c;setBusy(true);setError('');setActive(-1);
    try {const result=await loadOptions(owner,purpose,query.trim(),cursor,c.signal);if(!c.signal.aborted){setData(result);setHistory(previous);}}
    catch(e){if(!c.signal.aborted){setError(e instanceof Error?e.message:'목록을 불러오지 못했습니다.');if(!canKeepPreviousAnalytics(e))setData(null);}}
    finally {if(!c.signal.aborted)setBusy(false);}
  },[loadOptions,owner,purpose,query]);
  useEffect(()=> {
    if(!open||composing)return;
    const timer=setTimeout(()=>void loadPage('',[]),query?300:0);
    return ()=>{clearTimeout(timer);request.current?.abort();};
  },[open,composing,loadPage,query]);
  useEffect(()=> {
    const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('mousedown',close);return ()=>{document.removeEventListener('mousedown',close);request.current?.abort();};
  },[]);
  function choose(member:MemberReference){onChange(member);setOpen(false);input.current?.focus();}
  function search(text:string){request.current?.abort();setData(null);setHistory([]);setActive(-1);setError('');setQuery(text);setOpen(true);}
  function toggle(){setData(null);setHistory([]);setError('');setActive(-1);setOpen(v=>!v);input.current?.focus();}
  return <div className="admin-picker" ref={root}>
    <label htmlFor={`${id}-input`}>{label}</label>
    <div className="admin-picker-input"><input id={`${id}-input`} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined} value={query} maxLength={120} placeholder="목록에서 선택하거나 이름·이메일 검색" onChange={e=>search(e.target.value)} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);search(e.currentTarget.value);}} onKeyDown={e=> {
      if(e.nativeEvent.isComposing)return;
      if(e.key==='Escape'){setOpen(false);return;}
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){setOpen(true);return;}const count=data?.items.length||0;if(count)setActive(a=>e.key==='ArrowDown'?Math.min(a+1,count-1):Math.max(a-1,0));}
      if(e.key==='Enter'&&open){e.preventDefault();if(active>=0&&data?.items[active])choose(data.items[active]);}
    }}/><button type="button" aria-label={`${label} 목록 ${open?'닫기':'열기'}`} aria-expanded={open} onClick={toggle}>▾</button></div>
    {value&&<div className="admin-picker-selected"><span>{value.name||'이름 없음'} · {value.email||'이메일 없음'}<small>{value.user_id}</small></span><button type="button" onClick={()=>{onChange(null);setOpen(false);setQuery('');}}>선택 해제</button></div>}
    {open&&<div className="admin-picker-popup">
      <p className="admin-muted">{purpose==='member_activity'?'일반 회원 전체 · 가입 최신순':'감사 기록 필터 대상 · UUID 순'}</p>
      {busy&&<p role="status">목록을 불러오고 있습니다.</p>}
      {error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>void loadPage(retry.current.cursor,retry.current.history)}>다시 시도</button></p>}
      <div role="listbox" id={`${id}-list`} aria-label={`${label} 목록`} aria-busy={busy} className="admin-picker-list">
        {data?.items.map((m,i)=><button type="button" role="option" tabIndex={-1} id={`${id}-option-${i}`} aria-selected={value?.user_id===m.user_id} data-active={i===active} key={m.user_id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(m)}><strong>{m.name||'이름 없음'}</strong><span>{m.email||'이메일 없음'}</span><small>{m.account_info_status==='missing'?'계정 정보 없음':`가입 ${m.created_at?new Date(m.created_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—'}`}{purpose==='audit_actor'?` · ${m.is_current_admin?'현재 관리자':'현재 관리자 역할 없음'}`:''}</small><small className="admin-picker-uuid">{m.user_id}</small></button>)}
      </div>
      {!busy&&!error&&data&&!data.items.length&&<p role="status">{query?'검색 조건에 맞는 회원이 없습니다.':'선택할 회원이 없습니다.'}</p>}
      {data&&<div className="admin-picker-pages"><span>{data.items.length?`${history.length*50+1}~${history.length*50+data.items.length}번째`:'0명'}</span><button type="button" disabled={busy||history.length===0} onClick={()=>{const h=history.slice(0,-1);void loadPage(h[h.length-1]||'',h);}}>이전</button><button type="button" disabled={busy||!data.next_cursor} onClick={()=>void loadPage(data.next_cursor!,[...history,data.next_cursor!])}>다음 50명</button></div>}
    </div>}
  </div>;
}
