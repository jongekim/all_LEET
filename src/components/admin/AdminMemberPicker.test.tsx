import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminMemberPicker, type MemberOptionsLoader } from './AdminMemberPicker';
import { AdminAnalyticsError } from '../../utils/adminAnalyticsErrors';
import type { MemberOptions, MemberReference } from '../../types/analytics';
afterEach(cleanup);
const member=(n:number):MemberReference=>({user_id:String(n),name:`회원 ${n}`,email:`member${n}@example.test`,created_at:'2026-01-01T00:00:00Z',account_info_status:'available'});
const result=(items:MemberReference[],next:string|null=null):MemberOptions=>({items,next_cursor:next,purpose:'member_activity',sort_version:'1',snapshot_at:'2026-10-04T00:00:00Z'});
it('빈 검색으로 탐색하되 자동 선택하지 않고 키보드로 선택, IME 중에는 조회하지 않는다',async()=>{
  const options=vi.fn<MemberOptionsLoader>().mockResolvedValue(result([member(1),member(2)])),choose=vi.fn();render(<AdminMemberPicker owner="admin" value={null} onChange={choose} loadOptions={options}/>);
  fireEvent.click(screen.getByRole('button',{name:'회원 선택 목록 열기'}));await screen.findByRole('option',{name:/회원 1/});expect(options.mock.calls[0].slice(0,4)).toEqual(['admin','member_activity','','']);expect(choose).not.toHaveBeenCalled();
  const input=screen.getByRole('combobox');fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'Enter'});expect(choose).toHaveBeenCalledWith(member(1));
  options.mockClear();fireEvent.compositionStart(input);fireEvent.change(input,{target:{value:'회'}});await act(()=>new Promise(resolve=>setTimeout(resolve,350)));expect(options).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input,{data:'회원',target:{value:'회원'}});await waitFor(()=>expect(options).toHaveBeenCalledOnce());expect(options.mock.calls[0][2]).toBe('회원');
});
it('다음 페이지 일시 실패는 기존 50명 보존, 재시도는 실패 커서, 검색은 선택 대상을 바꾸지 않는다',async()=>{
  const options=vi.fn<MemberOptionsLoader>().mockResolvedValueOnce(result([member(1)],'page2')).mockRejectedValueOnce(new AdminAnalyticsError('UNAVAILABLE',503,true,'일시 실패')).mockResolvedValueOnce(result([member(51)])),choose=vi.fn();
  render(<AdminMemberPicker owner="admin" value={member(8)} onChange={choose} loadOptions={options}/>);fireEvent.click(screen.getByRole('button',{name:'회원 선택 목록 열기'}));await screen.findByRole('option',{name:/회원 1/});
  fireEvent.click(screen.getByRole('button',{name:'다음 50명'}));await screen.findByRole('alert');expect(screen.getByRole('option',{name:/회원 1/})).toBeVisible();expect(choose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'다시 시도'}));await screen.findByRole('option',{name:/회원 51/});expect(options.mock.calls[2][3]).toBe('page2');expect(screen.getByText(/회원 8 ·/)).toBeVisible();
});
it('소유 계정 변경은 열림·검색·이전 응답을 폐기한다',async()=>{
  let finish:((d:MemberOptions)=>void)|undefined;const options=vi.fn<MemberOptionsLoader>().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const props={value:null,onChange:vi.fn(),loadOptions:options};const view=render(<AdminMemberPicker owner="old" {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'회원 선택 목록 열기'}));await waitFor(()=>expect(finish).toBeDefined());view.rerender(<AdminMemberPicker owner="new" {...props}/>);await act(async()=>{finish!(result([member(1)]));});expect(screen.queryByRole('option')).toBeNull();expect(screen.getByRole('combobox')).toHaveValue('');expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded','false');
});
