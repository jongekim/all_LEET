import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DdayText } from '../components/DdayText';
import { ExamScheduleContext } from '../contexts/examScheduleContextValue';
import { ExamScheduleStore } from '../utils/examScheduleStore';
import { normalizeScheduleForm, scheduleFormError } from '../utils/examScheduleModel';
import type { ExamSchedule } from '../types/examSchedule';

const sample:ExamSchedule={key:'leet',exam_date:'2026-07-19',display_template:'{date} 시험일 {dday}',revision:1,updated_at:'2026-10-04T00:00:00Z'};
const store=new ExamScheduleStore(async()=>sample,'all-leet:dday-isolated-preview');
store.publish(sample);

export function Preview() {
  const [form,setForm]=useState({exam_date:sample.exam_date,display_template:sample.display_template});
  const error=scheduleFormError(form);
  function apply() { if(!error)store.publish({...sample,...normalizeScheduleForm(form),revision:(store.getSnapshot().schedule?.revision??0)+1}); }
  return <ExamScheduleContext.Provider value={store}>
    <main>
      <p className="notice">일반 화면 변경 제안 · 기존 앱과 분리된 예시 · 운영 서버 요청 없음</p>
      <h1>디데이 표시 미리보기</h1>
      <section className="settings">
        <label>시험일<input type="date" min="2000-01-01" max="2099-12-31" value={form.exam_date} onChange={event=>setForm({...form,exam_date:event.target.value})}/></label>
        <label>공통 문구<input type="text" value={form.display_template} onChange={event=>setForm({...form,display_template:event.target.value})}/></label>
        {error&&<p role="alert">{error}</p>}
        <button type="button" disabled={!!error} onClick={apply}>미리보기에 적용</button>
        <p>실제 구현의 계산·템플릿·표시 컴포넌트를 사용합니다. 화면 틀은 위치를 설명하는 예시입니다.</p>
      </section>
      <div className="examples">{['홈','로그인','회원가입'].map((label,i)=><section key={label} className="card">
        <h2>{label}</h2>
        <div className={i?'center':''}><h3>{i===2?'간편가입':'리트 채점은 all LEET'}</h3><p className="dday">📅 <DdayText/></p></div>
        <p className="caption">이 영역에 관리자가 설정한 동일한 문구가 표시됩니다.</p>
      </section>)}</div>
      <p>첫 조회 중에는 ‘불러오는 중…’, 캐시 없는 조회 실패에는 ‘디데이 설정을 불러오지 못했습니다.’를 같은 영역에 표시합니다. 긴 문구는 영역 안에서 줄바꿈합니다.</p>
    </main>
  </ExamScheduleContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
