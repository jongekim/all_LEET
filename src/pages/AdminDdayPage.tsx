import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useExamScheduleStore } from '../hooks/useExamSchedule';
import { useKstNow } from '../hooks/useKstNow';
import { useUnsavedDdayChanges } from '../hooks/useUnsavedDdayChanges';
import type { ExamSchedule, ExamScheduleForm } from '../types/examSchedule';
import { examScheduleApi, ExamScheduleError } from '../utils/examScheduleApi';
import { calculateConfiguredDday, isExamDate, normalizeScheduleForm, sameScheduleForm, scheduleFormError } from '../utils/examScheduleModel';
import { renderDdayTemplate, templateError } from '../utils/ddayTemplate';
import '../styles/admin.css';

const empty: ExamScheduleForm = { exam_date: '', display_template: '' };
const formOf = (schedule: ExamSchedule): ExamScheduleForm => ({ exam_date: schedule.exam_date, display_template: schedule.display_template });
const timestamp = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

export function AdminDdayPage() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.id;
  const store = useExamScheduleStore();
  const navigate = useNavigate();
  const now = useKstNow();
  const [baseline, setBaseline] = useState<ExamSchedule | null>(null);
  const [form, setForm] = useState<ExamScheduleForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<ExamSchedule | null>(null);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const request = useRef<AbortController | null>(null);
  const validation = scheduleFormError(form);
  const dirty = baseline !== null && !sameScheduleForm(form, formOf(baseline));
  const changed = baseline !== null && (validation !== null || !sameScheduleForm({ ...form, display_template: form.display_template.trim() }, baseline));
  const draftDay = isExamDate(form.exam_date) ? calculateConfiguredDday(form.exam_date, now) : null;
  const preview = draftDay && !templateError(form.display_template)
    ? renderDdayTemplate(form.display_template, draftDay.examDate, draftDay.ddayText) : '올바른 날짜와 문구를 입력해주세요.';
  const applied = current ?? baseline;
  const appliedDay = applied ? calculateConfiguredDday(applied.exam_date, now) : null;

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const id = ++epoch.current;
    async function load() {
      try {
        if (!ownerId) return;
        const [schedule] = await Promise.all([examScheduleApi.read(controller.signal), examScheduleApi.assertAdmin(ownerId, controller.signal)]);
        if (controller.signal.aborted || epoch.current !== id) return;
        setBaseline(schedule);
        setForm(formOf(schedule));
        setLocked(false);
        setDenied(false);
        store.publish(schedule);
      } catch (cause) {
        if (controller.signal.aborted || epoch.current !== id) return;
        console.error('관리자 디데이 설정 조회 실패', cause);
        setError(cause instanceof ExamScheduleError ? cause.message : '디데이 설정을 불러오지 못했습니다. 다시 시도해주세요.');
        setLocked(true);
        if (cause instanceof ExamScheduleError && cause.kind === 'authorization') {
          setDenied(true); setForm(empty); setBaseline(null); setCurrent(null);
        }
      } finally {
        if (!controller.signal.aborted && epoch.current === id) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); request.current?.abort(); };
  }, [ownerId, reload, store]);

  useUnsavedDdayChanges(dirty);

  const retry = () => {
    setLoading(true); setLocked(true); setError(''); setMessage(''); setCurrent(null);
    setReload(value => value + 1);
  };
  const back = () => {
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버리고 관리자 페이지로 돌아갈까요?')) return;
    navigate('/admin');
  };
  const acceptCurrent = () => {
    if (!current) return;
    setBaseline(current); setCurrent(null); setLocked(false); setError('');
    setMessage('최신 서버 설정을 확인했습니다. 유지된 입력을 확인한 뒤 저장하거나 변경 취소해주세요.');
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!baseline || !ownerId || locked || saving || validation || !changed) return;
    const submitted = normalizeScheduleForm(form);
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const id = ++epoch.current;
    const active = () => !controller.signal.aborted && epoch.current === id;
    setSaving(true); setError(''); setMessage(''); setCurrent(null);
    try {
      const saved = await examScheduleApi.save(submitted, baseline, ownerId, controller.signal);
      if (!active()) return;
      setBaseline(saved); setForm(formOf(saved)); store.publish(saved);
      setMessage('디데이 설정을 저장했습니다.');
    } catch (cause) {
      if (!active()) return;
      console.error('관리자 디데이 설정 저장 실패', cause);
      if (cause instanceof ExamScheduleError && cause.kind === 'authorization') {
        setForm(empty); setBaseline(null); setDenied(true); setLocked(true); setError(cause.message);
      } else if (cause instanceof ExamScheduleError && cause.kind === 'conflict' && cause.current) {
        setCurrent(cause.current); setLocked(true); setError(cause.message); store.publish(cause.current);
      } else if (cause instanceof ExamScheduleError && cause.kind === 'invalid') {
        setError(cause.message);
      } else {
        // Never repeat a write whose response was lost. Reconcile with a read.
        setLocked(true);
        try {
          const [server] = await Promise.all([examScheduleApi.read(controller.signal), examScheduleApi.assertAdmin(ownerId, controller.signal)]);
          if (!active()) return;
          store.publish(server);
          if (sameScheduleForm(server, submitted)) {
            setBaseline(server); setForm(formOf(server)); setLocked(false);
            setMessage('현재 서버에는 이 날짜와 문구가 적용되어 있습니다.');
          } else {
            setCurrent(server);
            setError('저장 결과를 확인하지 못했습니다. 최신 서버 설정을 확인해주세요. 입력은 유지됩니다.');
          }
        } catch (readCause) {
          if (!active()) return;
          console.error('디데이 저장 상태 확인 실패', readCause);
          if (readCause instanceof ExamScheduleError && readCause.kind === 'authorization') {
            setForm(empty); setBaseline(null); setDenied(true); setError(readCause.message);
          } else {
            setError('저장 상태를 확인하지 못했습니다. 입력은 유지됩니다. 저장 상태 확인을 눌러주세요.');
          }
        }
      }
    } finally { if (active()) setSaving(false); }
  }

  async function verify() {
    if (!ownerId || saving || loading) return;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const id = ++epoch.current;
    setLoading(true); setError('');
    try {
      const [server] = await Promise.all([examScheduleApi.read(controller.signal), examScheduleApi.assertAdmin(ownerId, controller.signal)]);
      if (controller.signal.aborted || epoch.current !== id) return;
      setCurrent(server); store.publish(server);
      setMessage('최신 서버 설정을 확인한 뒤 입력 내용을 다시 검토해주세요.');
    } catch (cause) {
      if (controller.signal.aborted || epoch.current !== id) return;
      setError('저장 상태를 확인하지 못했습니다. 입력 내용은 유지됩니다.');
      console.error('디데이 저장 상태 확인 실패', cause);
      if (cause instanceof ExamScheduleError && cause.kind === 'authorization') {
        setForm(empty); setBaseline(null); setDenied(true); setError(cause.message);
      }
    } finally { if (!controller.signal.aborted && epoch.current === id) setLoading(false); }
  }

  return <div className="min-h-screen bg-gray-50">
    <PageHeader title="디데이 관리" description="홈·로그인·회원가입에 표시할 LEET 시험일과 문구를 설정합니다." backTo="/admin" onBack={back} backDisabled={saving} />
    <main className="admin-shell"><div className="admin-container admin-dday-container">
      {loading && <p role="status">디데이 설정을 불러오는 중입니다.</p>}
      {error && <div role="alert" className="admin-notice">{error}</div>}
      {message && <p role="status" className="admin-notice">{message}</p>}
      {!baseline && !loading && !denied && <Button variant="outline" onClick={retry}>다시 불러오기</Button>}
      {baseline && !denied && <>
        <section className="admin-panel" aria-label="현재 적용 중">
          <h2>현재 적용 중</h2>
          <p>시험일 {appliedDay?.examDate} · 디데이 {appliedDay?.ddayText}</p>
          <p className="admin-dday-copy">현재 문구: {applied?.display_template}</p>
          <p className="admin-muted">마지막 수정 {timestamp(applied!.updated_at)} KST · 버전 {applied?.revision}</p>
        </section>
        {current && <section className="admin-panel" aria-label="최신 서버 설정">
          <h2>최신 서버 설정</h2><p>{current.exam_date}</p><p className="admin-dday-copy">{current.display_template}</p>
          <Button variant="outline" onClick={acceptCurrent} disabled={saving || loading}>최신 설정 확인</Button>
        </section>}
        {locked && !current && !loading && <Button variant="outline" onClick={() => void verify()}>저장 상태 확인</Button>}
        <form onSubmit={event => void save(event)} noValidate>
          <fieldset className="admin-fields admin-panel" disabled={saving || loading || denied}>
            <legend className="admin-dday-legend">시험일과 표시 문구</legend>
            <label className="admin-field"><span id="dday-date-label">LEET 시험일</span>
              <input type="date" aria-labelledby="dday-date-label" min="2000-01-01" max="2099-12-31" required value={form.exam_date} onChange={event => { setForm(previous => ({ ...previous, exam_date: event.target.value })); setMessage(''); }} />
              <span className="admin-muted">한국 시간 기준으로 계산합니다.</span>
            </label>
            <label className="admin-field"><span id="dday-template-label">표시 문구</span>
              <input type="text" aria-labelledby="dday-template-label" required value={form.display_template} onChange={event => { setForm(previous => ({ ...previous, display_template: event.target.value })); setMessage(''); }} aria-describedby="dday-template-help" />
              <span className="admin-muted" id="dday-template-help">{'{date}'}: 시험일 / {'{dday}'}: 디데이 · {Array.from(form.display_template.trim()).length} / 100자 · 세 화면에 같은 문구가 표시됩니다.</span>
            </label>
            {validation && <p role="alert">{validation}</p>}
            {draftDay && draftDay.dday < 0 && <p className="admin-muted">지난 시험일입니다. {'{dday}'}는 {draftDay.ddayText}으로 표시됩니다.</p>}
            {!templateError(form.display_template) && !form.display_template.includes('{dday}') && <p className="admin-muted">이 문구에는 자동 디데이가 표시되지 않습니다.</p>}
            <section aria-label="저장 후 표시 미리보기" className="admin-fields">
              <h2>저장 후 표시 미리보기</h2>
              {['홈', '로그인', '회원가입'].map(label => <div key={label}><h3>{label}</h3><p className="admin-preview">{preview}</p></div>)}
            </section>
            <div className="admin-actions">
              <Button type="submit" className="admin-primary" disabled={locked || !changed || !!validation}>{saving ? '저장 중…' : '저장'}</Button>
              <Button type="button" variant="outline" onClick={() => { setForm(formOf(baseline)); setMessage(''); }} disabled={!dirty || locked}>변경 취소</Button>
            </div>
            <p className="admin-muted">시험일과 문구를 함께 저장합니다. 홈·로그인·회원가입에 같은 문구가 표시되며, 열려 있는 다른 화면에는 최대 60초 후 반영됩니다.</p>
          </fieldset>
        </form>
      </>}
    </div></main>
  </div>;
}
