import { act,renderHook,waitFor } from '@testing-library/react';
import { describe,it,expect,vi } from 'vitest';
import fixture from '../../e2e/fixtures/question-statistics-v2.json';
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../contexts/AuthContext',()=>({supabase:{from:mock.from}}));
import { useQuestionStatistics } from './useQuestionStatistics';
describe('통합 통계 조회·캐시·응답 경합',()=>{
 it('두 과목/문형이 한 조회를 공유하고 늦은 다른 학년도 응답을 무시한다',async()=>{
  const selections=[] as {year:string;subject:'verbal';examType:'odd'|'even'}[];
  const queries:string[]=[];
  let release!:()=>void;
  const late=new Promise<void>(resolve=>{release=resolve;});
  mock.from.mockImplementation((table:string)=>{
   expect(table).toBe('question_statistics_snapshots_v2');
   return {select:()=>({eq:async(_column:string,year:string)=>{
    queries.push(year);if(year==='2025') await late;
    return {data:fixture.filter(r=>r.year===year),error:null};
   }})};
  });
  const {result,rerender,unmount}=renderHook(({year,examType,enabled})=>{
   const s={year,subject:'verbal' as const,examType};selections.push(s);
   return [useQuestionStatistics(s,enabled),useQuestionStatistics({...s,subject:'reasoning'},enabled)];
  },{initialProps:{year:'2026',examType:'odd' as 'odd'|'even',enabled:true}});
  await waitFor(()=>expect(result.current.every(r=>r.state.status==='ready')).toBe(true));
  expect(queries).toEqual(['2026']);
  const odd=result.current[0].state;
  rerender({year:'2026',examType:'even',enabled:true});
  await waitFor(()=>expect(result.current[0].state.status).toBe('ready'));
  expect(queries).toEqual(['2026']);
  const even=result.current[0].state;
  if(odd.status==='ready'&&even.status==='ready') {
   const a=odd.data.items[0],b=even.data.items.find(q=>q.question_id===a.question_id)!;
   expect(a.choice_counts[a.correct_answer-1]).toBe(b.choice_counts[b.correct_answer-1]);
  }
  rerender({year:'2025',examType:'odd',enabled:true});
  expect(result.current[0].state.status).toBe('loading');
  rerender({year:'2026',examType:'odd',enabled:true});
  await waitFor(()=>expect(result.current[0].state.status).toBe('ready'));
  await act(async()=>{release();await late;});
  expect(result.current[0].state.status).toBe('ready');
  if(result.current[0].state.status==='ready') expect(result.current[0].state.data.year).toBe('2026');
  rerender({year:'2010',examType:'odd',enabled:false});
  expect(queries).not.toContain('2010');
  rerender({year:'2027',examType:'odd',enabled:true});expect(result.current[0].state.status).toBe('unavailable');expect(queries).not.toContain('2027');
  unmount();expect(selections.length).toBeGreaterThan(0);
 });
 it('누락 테이블은 미가용, 실패는 재시도, 부분 과목은 오류로 구분한다',async()=>{
  let error:{code:string}|null={code:'PGRST205'};
  let rows=fixture.filter(r=>r.year==='2011');
  mock.from.mockImplementation(()=>({select:()=>({eq:async()=>({data:rows,error})})}));
  const {result,unmount}=renderHook(()=>useQuestionStatistics({year:'2011',subject:'verbal',examType:'odd'}));
  await waitFor(()=>expect(result.current.state.status).toBe('unavailable'));
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
   error={code:'503'};act(()=>result.current.retry());await waitFor(()=>expect(result.current.state.status).toBe('error'));
   error=null;rows=rows.slice(0,1);act(()=>result.current.retry());await waitFor(()=>expect(result.current.state.status).toBe('error'));
   rows=fixture.filter(r=>r.year==='2011');act(()=>result.current.retry());await waitFor(()=>expect(result.current.state.status).toBe('ready'));
  } finally {log.mockRestore();unmount();}
 });
});
