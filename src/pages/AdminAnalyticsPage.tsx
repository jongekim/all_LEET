import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { adminAnalyticsApi, createAdminAnalyticsApi } from '../utils/adminAnalyticsApi';
import { detailPeriod } from '../utils/adminAnalyticsNavigation';
import { AdminDashboard, type DashboardControls } from '../components/admin/AdminDashboard';
import { AdminMemberPicker } from '../components/admin/AdminMemberPicker';
import { AnalyticsAuthorizationScope } from '../utils/adminAnalyticsErrors';
import { parseFilters, UUID } from '../../supabase/functions/_shared/analytics-contract';
import type { AccessRow, ActivityRow, AnalyticsFilters, AnalyticsReport, MemberReference, MemberSummary, PageResult, ReportKind } from '../types/analytics';
import '../styles/admin.css';
import '../styles/admin-analytics.css';

const tabs = [['overview', '개요'], ['features', '기능'], ['grading', '채점'], ['members', '회원/재방문'], ['activity', '회원 활동'], ['pwa', 'PWA'], ['access', '관리자 조회 이력']] as const;
type Tab = typeof tabs[number][0];
const names: Record<string, string> = { navigation: '화면 탐색', grading: '채점', past_exams: '기출', history: '성적 이력', mock: '사설 모의고사', admission: '지원 분석', community: '커뮤니티', chat: '채팅', install: '설치 안내', pwa: 'PWA', browser: '브라우저', other: '기타 실행', unknown: '판별 불가', verbal: '언어이해', reasoning: '추리논증', both: '두 과목', odd: '홀수형', even: '짝수형', single: '단일 문형', success: '성공 확인', failed: '실패 확인', accepted: '수락', dismissed: '닫음' };
const eventLabels: Record<string, string> = { page_view: '화면 조회', grading_input_started: '답안 입력 시작', grading_input_resumed: '답안 입력 재개', grading_requested: '채점 요청', grading_completed: '채점 계산 완료', grading_result_viewed: '새 채점 결과 조회', past_result_viewed: '과거·예시 결과 조회', history_save_outcome: '이력 저장 응답', history_viewed: '성적 이력 조회', history_trend_viewed: '성적 추이 조회', past_exam_file_clicked: '기출 PDF 링크 클릭', reference_opened: '참고표 열기', question_distribution_opened: '문항 분포 열기', mock_saved: '사설 성적 저장 응답', admission_completed: '지원 분석 완료', admission_result_viewed: '지원 분석 결과 조회', community_post_viewed: '게시글 조회', chat_loaded: '채팅 화면 조회', install_cta_viewed: '설치 버튼 노출', install_cta_clicked: '설치 버튼 클릭', install_guide_opened: '설치 안내 열기', install_prompt_available: '설치 프롬프트 사용 가능', install_prompt_requested: '설치 프롬프트 요청', install_prompt_result: '설치 프롬프트 응답', install_event_observed: '설치 이벤트 관측', execution_channel_changed: '실행 채널 변경' };
const formatTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '—';
const count = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('ko-KR');
const rate = (n: number | null, d: number) => n == null || !d ? '—' : `${(n / d * 100).toFixed(1)}%`;
const failure = (error: unknown) => error instanceof Error ? error.message : '조회 중 오류가 발생했습니다. 다시 시도해주세요.';
const AnalyticsApiContext = createContext(adminAnalyticsApi);

export function AdminAnalyticsPage() {
  const { currentUser, isAdmin } = useAuth();
  return currentUser && isAdmin ? <AnalyticsWorkspace key={currentUser.id} owner={currentUser.id} /> : null;
}
function AnalyticsWorkspace({ owner }: { owner: string }) {
  const scope = useMemo(() => new AnalyticsAuthorizationScope(owner), [owner]);
  const api = useMemo(() => createAdminAnalyticsApi(scope), [scope]);
  useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);
  useEffect(() => () => scope.dispose(), [scope]);
  return <AnalyticsApiContext.Provider value={api}>{scope.error ? <div className="min-h-screen bg-gray-50"><PageHeader title="이용 통계" /><main className="admin-shell"><Link to="/admin" className="admin-back">관리자 메뉴</Link><Notice error>{scope.error.message}</Notice></main></div> : <AnalyticsContent owner={owner} />}</AnalyticsApiContext.Provider>;
}
function AnalyticsContent({ owner }: { owner: string }) {
  const api = useContext(AnalyticsApiContext);
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: Tab = tabs.some(([key]) => key === rawTab) ? rawTab as Tab : 'overview';
  const filters = useMemo(() => parseFilters(params), [params]);
  const [refresh, setRefresh] = useState(0);
  const [controls, setControls] = useState<DashboardControls>({range:'7d',channel:['pwa','browser','other','unknown'].includes(params.get('channel')||'')?params.get('channel')!:'',compare:true});
  const [entryUser, setEntryUser] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const filterKey = JSON.stringify(filters);
  function chooseTab(next: Tab) { const p = new URLSearchParams(params); if (next !== 'access') p.delete('kind'); p.set('tab', next); setEntryUser('');setDetailNote('');setParams(p, { replace: true }); }
  function apply(next: AnalyticsFilters) { setDetailNote('');setParams(new URLSearchParams({ ...next, tab }), { replace: true }); }
  function openDetail(next: string, requested: {start:string;end:string;channel?:string}, userId='') {
    const result=detailPeriod({...requested,channel:requested.channel as AnalyticsFilters['channel']});
    if(!result){setDetailNote('선택 기간에는 최근 90일 상세 자료와 겹치는 날짜가 없습니다.');return;}
    setDetailNote(result.clipped?`대시보드 분석 ${requested.start} ~ ${requested.end} / 상세 조회 ${result.filters.start} ~ ${result.filters.end} · 상세 원본 최대 90일`: '');
    setEntryUser(userId);
    const p=new URLSearchParams({tab:next});
    for(const [key,value] of Object.entries(result.filters))if(typeof value==='string'&&value)p.set(key,value);
    setParams(p,{replace:true});
  }
  return <div className="min-h-screen bg-gray-50">
    <PageHeader title="이용 통계" description="누가 어떤 기능을 얼마나 이용하는지 확인합니다." />
    <main className="admin-shell analytics-shell"><div className="admin-container">
      <Link to="/admin" className="admin-back"><ArrowLeft size={16} />관리자 메뉴</Link>
      <div className="admin-heading"><div><p className="admin-eyebrow">ADMIN ANALYTICS</p><h1>서비스 이용 통계</h1><p>수신 시각 · 한국 시간(KST) · 실제 회원 ID 기준 · 관리자/테스트 계정 제외</p></div>{tab!=='overview'&&<Button variant="outline" onClick={() => setRefresh(v => v + 1)}><RefreshCw size={16} aria-hidden="true" />새로고침</Button>}</div>
      <div role="tablist" aria-label="통계 항목" className="analytics-tabs">{tabs.map(([key, label]) => <button type="button" role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls="analytics-content" key={key} onClick={() => chooseTab(key)}>{label}</button>)}</div>
      {tab!=='overview'&&<FilterForm key={`${filterKey}:${tab === 'access'}`} filters={filters} audit={tab === 'access'} onApply={apply} />}
      {detailNote&&<Notice>{detailNote}</Notice>}
      <section role="tabpanel" id="analytics-content" aria-labelledby={`tab-${tab}`}>
        {tab==='overview'?<AdminDashboard owner={owner} services={api} initialControls={controls} onControlsChange={setControls} onDetail={openDetail} onMemberSelect={(id,f)=>openDetail('activity',f,id)}/>: !filters ? <Notice error>날짜와 필터를 확인해주세요. 조회 기간은 최대 90일이며 미래 날짜는 선택할 수 없습니다.</Notice> : tab === 'activity' ? <MemberExplorer key={refresh} initialUserId={entryUser} owner={owner} filters={filters} /> : tab === 'access' ? <AccessExplorer key={`${filterKey}:${refresh}`} owner={owner} filters={filters} /> : <><ReportView key={`${tab}:${filterKey}:${refresh}`} owner={owner} filters={filters} tab={tab} />{tab==='pwa'&&<MemberShortcut owner={owner} filters={{...filters,channel:'pwa'}} onSelect={(id)=>openDetail('activity',{...filters,channel:'pwa'},id)} />}</>}
      </section>
    </div></main>
  </div>;
}
function MemberShortcut({owner,filters,onSelect}:{owner:string;filters:AnalyticsFilters;onSelect(id:string):void}) {
  const api=useContext(AnalyticsApiContext),[selected,setSelected]=useState<MemberReference|null>(null);
  return <section className="admin-panel"><h2>회원의 PWA 활동 확인</h2><p className="admin-muted">회원 선택은 개인 활동 조회에만 적용합니다. 전체 PWA 통계와 재방문 코호트는 유지합니다. 상세 기간 {filters.start} ~ {filters.end}.</p><AdminMemberPicker owner={owner} value={selected} loadOptions={api.options} onChange={m=>{setSelected(m);if(m)onSelect(m.user_id);}}/></section>;
}

function FilterForm({ filters, audit, onApply }: { filters: AnalyticsFilters | null; audit: boolean; onApply: (filters: AnalyticsFilters) => void }) {
  const initial = filters || parseFilters(new URLSearchParams())!;
  const [draft, setDraft] = useState<AnalyticsFilters>(initial);
  const [error, setError] = useState('');
  function set(key: keyof AnalyticsFilters, value: string) { setDraft(old => ({ ...old, [key]: value || undefined })); }
  function submit(e: React.FormEvent) {
    e.preventDefault(); const p = new URLSearchParams();
    for (const [key, value] of Object.entries(draft)) if (value && (!audit || key === 'start' || key === 'end' || key === 'kind')) p.set(key, value);
    const parsed = parseFilters(p);
    if (!parsed) { setError('유효한 날짜와 최대 90일의 기간을 선택해주세요.'); return; }
    setError(''); onApply(parsed);
  }
  const select = (key: keyof AnalyticsFilters, label: string, options: [string, string][]) => <label className="admin-field" key={key}>{label}<select value={draft[key] || ''} onChange={e => set(key, e.target.value)}><option value="">전체</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  return <form className="admin-panel analytics-filter" onSubmit={submit} aria-label="통계 필터">
    <label className="admin-field">시작일<input type="date" value={draft.start} onChange={e => set('start', e.target.value)} required /></label>
    <label className="admin-field">종료일<input type="date" value={draft.end} onChange={e => set('end', e.target.value)} required /></label>
    {audit && select('kind', '조회 종류', [['member_directory', '회원 검색'], ['member_activity', '회원 활동'], ['admin_access_history', '관리자 조회 이력'], ['member_options','회원 선택 목록'], ['activity_feed','최근 회원 활동']])}
    {!audit && <>{select('feature', '기능', ['navigation', 'grading', 'past_exams', 'history', 'mock', 'admission', 'community', 'chat', 'install'].map(v => [v, names[v]]))}{select('outcome', '처리 결과', [['success', '성공 확인'], ['failed', '실패 확인'], ['unknown', '응답 미확인']])}{select('channel', '실행 채널', ['pwa', 'browser', 'other', 'unknown'].map(v => [v, names[v]]))}{select('os', '운영체제', [['ios', 'iOS/iPadOS'], ['android', 'Android'], ['windows', 'Windows'], ['macos', 'macOS'], ['linux', 'Linux'], ['other', '기타'], ['unknown', '판별 불가']])}{select('device', '기기', [['mobile', '휴대폰'], ['tablet', '태블릿'], ['desktop', '데스크톱'], ['unknown', '판별 불가']])}{select('login', '로그인 상태', [['member', '회원'], ['anonymous', '비로그인']])}{select('year', '학년도', ['09예비', ...Array.from({ length: 18 }, (_, i) => String(2010 + i))].map(v => [v, v]))}{select('subjects', '과목', ['verbal', 'reasoning', 'both'].map(v => [v, names[v]]))}{select('exam_type', '문형', ['odd', 'even', 'single'].map(v => [v, names[v]]))}</>}
    <Button type="submit" className="admin-primary">필터 적용</Button><p className="admin-muted analytics-filter-help">선택 날짜 포함 · 기본값은 최근 완료된 7일 · 행동 원본 조회 최대 90일</p>
    {error && <Notice error>{error}</Notice>}
  </form>;
}
function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <p className="analytics-notice" role={error ? 'alert' : 'status'} data-error={error}>{children}</p>; }
function CoverageNote({ coverage }: { coverage?: PageResult<unknown>['coverage'] }) {
  return coverage ? <Notice>관측 범위: {formatTime(coverage.available_from)} ~ {formatTime(coverage.available_through)} · {coverage.coverage_status === 'complete' ? '선택 기간 전체' : coverage.coverage_status === 'partial' ? '선택 기간의 일부만 관측됨' : '조회 가능한 관측 자료 없음'}</Notice> : null;
}
function Table({ headings, children }: { headings: string[]; children: React.ReactNode }) { return <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function EmptyRow({ columns, text = '선택한 조건의 관측 기록이 없습니다.' }: { columns: number; text?: string }) { return <tr><td colSpan={columns}>{text}</td></tr>; }
function ReportView({ owner, filters, tab }: { owner: string; filters: AnalyticsFilters; tab: ReportKind }) {
  const adminAnalyticsApi = useContext(AnalyticsApiContext);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    adminAnalyticsApi.report(filters, owner, tab, controller.signal).then(value => { if (!controller.signal.aborted) setReport(value); }).catch(e => { if (!controller.signal.aborted) setError(failure(e)); });
    return () => controller.abort();
  }, [owner, filters, tab, adminAnalyticsApi]);
  if (error) return <Notice error>{error} 상단 새로고침으로 다시 시도할 수 있습니다.</Notice>;
  if (!report) return <Notice>통계를 불러오고 있습니다.</Notice>;
  const conversion = report.conversion;
  return <div className="analytics-stack">
    <CoverageNote coverage={report.coverage} />
    <p className="admin-muted">자료 기준 {formatTime(report.data_through)} · 자체 수집 v{report.metric_version} · {report.status === 'unavailable' ? '수집 시작 또는 서버 활성화 후 자료가 제공됩니다.' : '클라이언트에서 관측된 이용이며 전체 방문을 보장하지 않습니다.'}</p>
    <div className="analytics-metrics">{report.metrics.map(m => {
      const prior = report.comparison?.metrics?.find(p => p.key === m.key)?.value;
      return <article className="admin-panel analytics-metric" key={m.key}><p>{tab === 'pwa' ? `PWA ${m.label}` : m.label}</p><strong>{count(m.value)}<small>{m.unit}</small></strong><span className="admin-muted">{report.comparison?.status !== 'complete' || prior == null || m.value == null ? '이전 기간 비교 불가' : prior === 0 ? m.value === 0 ? '이전 기간과 동일' : '이전 기간 0건 · 증감률 계산 불가' : `이전 기간 대비 ${((m.value - prior) / prior * 100).toFixed(1)}%`}</span></article>;
    })}</div>
    {report.status !== 'unavailable' && <>
      {(tab === 'overview' || tab === 'pwa') && <section className="admin-panel"><h2>{tab === 'pwa' ? 'PWA 일별 이용' : '일별 이용'}</h2><p className="admin-muted">기간 회원·세션은 DISTINCT로 집계하므로 일별 값을 더한 값과 다를 수 있습니다.</p><DailyChart rows={report.daily} /><Table headings={['날짜', '활성 회원', '이용 세션', '채점 완료']}>{report.daily.length ? report.daily.map(r => <tr key={r.date}><td>{r.date}</td><td>{count(r.members)}</td><td>{count(r.sessions)}</td><td>{count(r.grading)}</td></tr>) : <EmptyRow columns={4} />}</Table></section>}
      {(tab === 'features' || tab === 'overview' || tab === 'pwa') && <section className="admin-panel"><h2>기능별 이용</h2><p className="admin-muted">회원·세션에는 해당 기능 화면 조회도 포함하고 행동 수에는 화면 조회를 제외합니다. PDF는 링크 클릭 기준입니다.</p><Table headings={['기능', '회원', '세션', '행동']}>{report.features.length ? report.features.map(r => <tr key={r.feature}><td>{names[r.feature] || r.feature}</td><td>{count(r.members)}</td><td>{count(r.sessions)}</td><td>{count(r.actions)}</td></tr>) : <EmptyRow columns={4} />}</Table></section>}
      {tab === 'grading' && <>{conversion.status === 'filters_unavailable' ? <Notice>입력 시작 시 과목 조합을 확정할 수 없어 과목·처리 결과 필터에서는 입력→결과 전환을 제공하지 않습니다. 과목을 전체로 바꿔 확인해주세요.</Notice> : <section className="admin-panel"><h2>입력 → 새 채점 결과 조회</h2><p className="admin-muted">최초 입력이 선택 기간에 속한 세션 중 마지막 유효 활동 수신 후 45분이 지난 세션이 분모입니다. 결과는 같은 입력 흐름·실행에 연결합니다.</p><div className="analytics-stat-line"><p>관찰 종료 <strong>{count(conversion.closed)}</strong></p><p>결과 조회 <strong>{count(conversion.converted)}</strong></p><p>전환율 <strong>{rate(conversion.converted, conversion.closed)}</strong></p></div><div className="analytics-stat-line"><p>진행 중 {count(conversion.open)}</p><p>유예 중 {count(conversion.grace)}</p><p>미확정 {count(conversion.uncertain)}</p><p>입력 재개 {count(conversion.resumed)}</p></div></section>}<EventBreakdown report={report} /></>}
      {tab === 'pwa' && <><section className="admin-panel"><h2>PWA와 브라우저를 이용한 회원</h2><p className="admin-muted">PWA {count(report.pwa.pwa_only + report.pwa.both)}명 · 브라우저 {count(report.pwa.browser_only + report.pwa.both)}명 · 두 채널 모두 {count(report.pwa.both)}명. 채널별 회원 수는 중복될 수 있습니다.</p><Table headings={['채널 조합', '회원']}><tr><td>PWA만</td><td>{count(report.pwa.pwa_only)}</td></tr><tr><td>브라우저만</td><td>{count(report.pwa.browser_only)}</td></tr><tr><td>둘 다</td><td>{count(report.pwa.both)}</td></tr><tr><td>기타/판별 불가만</td><td>{count(report.pwa.other_only)}</td></tr></Table></section><section className="admin-panel"><h2>설치 신호</h2><p className="admin-muted">설치 버튼·프롬프트·appinstalled는 관측 건수입니다. 실제 설치 보유자 수나 iOS 설치 완료 수로 해석하지 않습니다.</p><SignalCounts report={report} /></section></>}
      {(tab === 'members' || tab === 'pwa') && <section className="admin-panel"><h2>{tab === 'pwa' ? '최초 PWA 핵심 이용 기준 재방문' : '최초 핵심 이용 기준 재방문'}</h2><p className="admin-muted">D+1·D+7·D+30의 해당 KST 날짜에 핵심 기능을 이용했는지 집계합니다. 10명 미만은 표본이 적어 해석에 주의가 필요합니다. 관찰 기간이 끝나지 않은 값은 —로 표시합니다.</p>{report.cohort_status !== 'available' ? <Notice>{report.cohort_status === 'filters_unavailable' ? '최초 이용 코호트에는 기간만 적용할 수 있습니다. 나머지 필터를 전체로 바꿔 조회해주세요.' : '수집 전이거나 선택 기간의 일부를 관측하지 못해 확정 코호트를 제공하지 않습니다.'}</Notice> : <Table headings={['최초 이용일', '회원', 'D1', 'D7', 'D30']}>{report.cohorts.length ? report.cohorts.map(c => <tr key={c.date}><td>{c.date}</td><td>{count(c.members)}{c.members < 10 && <small>표본 적음</small>}</td><td>{rate(c.d1, c.members)} ({count(c.d1)})</td><td>{rate(c.d7, c.members)} ({count(c.d7)})</td><td>{rate(c.d30, c.members)} ({count(c.d30)})</td></tr>) : <EmptyRow columns={5} />}</Table>}</section>}
    </>}
    {tab === 'members' && <Membership report={report} />}
    {(tab === 'overview' || tab === 'members') && <Inventory report={report} />}
    {tab === 'overview' && <section className="admin-panel"><h2>수집 품질</h2><p className="admin-muted">선택 기간에 서버가 받은 전체 기능 이벤트입니다. 채널·시험 필터는 이 표에 적용하지 않습니다. 서버에 도달하지 않은 누락률은 측정할 수 없습니다.</p><div className="analytics-stat-line">{[['submitted', '제출'], ['accepted', '수락'], ['duplicate', '중복'], ['rejected', '유효성 거절'], ['processing_failed', '처리 실패'], ['unknown_first_usage', '최초 여부 불명 회원']].map(([key, label]) => <p key={key}>{label} <strong>{count(report.quality[key])}</strong></p>)}</div><p className="admin-muted">Vercel Web Analytics는 연결된 조회 API가 없어 이 화면에 제공하지 않습니다.</p></section>}
  </div>;
}
function DailyChart({ rows }: { rows: AnalyticsReport['daily'] }) {
  const max = Math.max(1, ...rows.map(r => r.sessions));
  return <figure className="analytics-chart" aria-label="일별 이용 세션 막대 그래프"><div>{rows.map(r => <span key={r.date} style={{ height: `${Math.max(2, r.sessions / max * 100)}%` }} title={`${r.date}: ${r.sessions}세션`} />)}</div><figcaption>일별 이용 세션 · 정확한 값은 아래 표에서 확인할 수 있습니다.</figcaption></figure>;
}
function EventBreakdown({ report }: { report: AnalyticsReport }) { return <section className="admin-panel"><h2>채점·저장 관측</h2><Table headings={['행동', '횟수']}>{Object.entries(report.grading || {}).map(([key, value]) => <tr key={key}><td>{eventLabels[key] || ({ save_success: '과목별 저장 성공 확인', save_failed: '과목별 저장 실패 확인', save_unknown: '과목별 저장 결과 미확인', verbal_completed: '언어이해 계산 완료', reasoning_completed: '추리논증 계산 완료' }[key as string] || key)}</td><td>{count(value)}</td></tr>)}</Table><p className="admin-muted">계산 완료와 로그인 회원의 저장 응답은 별도 집계입니다. 저장 미확인은 확정 실패가 아닙니다.</p></section>; }
function SignalCounts({ report }: { report: AnalyticsReport }) { return <Table headings={['관측 신호', '횟수']}>{Object.entries(report.installation || {}).length ? Object.entries(report.installation || {}).map(([key, value]) => <tr key={key}><td>{eventLabels[key] || key}</td><td>{count(value)}</td></tr>) : <EmptyRow columns={2} />}</Table>; }
function Membership({ report }: { report: AnalyticsReport }) { const m = report.membership; return m ? <section className="admin-panel"><h2>가입·확인과 첫 채점</h2><p className="admin-muted">가입·확인은 Auth 시각 기준입니다. 확인 후 7×24시간이 지나고 해당 구간을 관측할 수 있는 회원만 첫 채점 분모에 포함합니다.</p>{m.status === 'available' ? <div className="analytics-stat-line"><p>기간 내 가입 {count(m.signups)}명</p><p>기간 내 확인 {count(m.confirmations)}명</p><p>관찰 완료 회원 {count(m.mature_confirmations - m.first_usage_unknown)}명</p><p>7일 내 첫 채점 {count(m.first_grading_in_7d)}명 · {rate(m.first_grading_in_7d, m.mature_confirmations - m.first_usage_unknown)}</p><p>최초 여부 불명 {count(m.first_usage_unknown)}명</p></div> : <Notice>{m.status === 'filters_unavailable' ? '가입·확인 전환에는 기간만 적용할 수 있습니다. 다른 필터를 전체로 바꿔 확인해주세요.' : '수집 개시 이후의 관측 자료가 필요합니다.'}</Notice>}</section> : null; }
function Inventory({ report }: { report: AnalyticsReport }) { const s = report.inventory; return s ? <section className="admin-panel"><h2>현재 보관 현황</h2><p className="admin-muted">조회 시점의 Auth·KV 현황 · 기간/이용 필터 미적용 · 보관된 성적은 누적 채점량과 다릅니다.</p><div className="analytics-stat-line"><p>회원 {count(s.accounts)}명</p><p>확인 완료 {count(s.confirmed)}명</p><p>공식 과목 기록 {count(s.official_records)}건</p><p>공식 시각 그룹 {count(s.official_groups)}개</p><p>사설 기록 {count(s.mock_records)}건</p><p>무효 항목 {count(s.invalid_records)}건</p></div></section> : null; }

function MemberExplorer({ owner, filters, initialUserId='' }: { owner: string; filters: AnalyticsFilters; initialUserId?:string }) {
  const api=useContext(AnalyticsApiContext);
  const [draft, setDraft] = useState(''), [query, setQuery] = useState(''), [selected, setSelected] = useState<MemberReference | null>(null);
  const [entryTarget,setEntryTarget]=useState(initialUserId);
  const [identityError,setIdentityError]=useState('');
  const [sessionDraft, setSessionDraft] = useState(''), [session, setSession] = useState(''), [error, setError] = useState('');
  useEffect(()=>{
    if(!entryTarget)return;const c=new AbortController();
    api.options(owner,'member_activity',entryTarget,'',c.signal).then(r=>{if(!c.signal.aborted)setSelected(r.items.find(m=>m.user_id===entryTarget)||null);}).catch(e=>{if(!c.signal.aborted)setIdentityError(failure(e));});
    return ()=>c.abort();
  },[owner,api,entryTarget]);
  function select(m:MemberReference|null){setEntryTarget('');setIdentityError('');setSelected(m);setSession('');}
  const userId=selected?.user_id||entryTarget;
  return <div className="analytics-stack"><section className="admin-panel"><h2>회원 검색</h2><p className="admin-muted">실제 계정의 이름·이메일·UUID로 검색합니다. 개인정보 검색어는 URL이나 조회 이력에 저장하지 않습니다.</p>
    <AdminMemberPicker owner={owner} value={selected} onChange={select} loadOptions={api.options}/>{identityError&&<Notice error>{identityError}</Notice>}
    <form className="analytics-inline-form" onSubmit={e => { e.preventDefault(); setQuery(draft.trim()); }}><label className="admin-field">회원 검색어<input value={draft} maxLength={120} onChange={e => setDraft(e.target.value)} placeholder="이름 / 이메일 / UUID" /></label><Button type="submit">검색</Button></form><MemberList key={`${query}:${JSON.stringify(filters)}`} owner={owner} filters={filters} query={query} onSelect={m => select({user_id:m.user_id,name:m.name,email:m.email,created_at:m.created_at,account_info_status:'available'})} /></section>
    <section className="admin-panel"><h2>비로그인 세션 조회</h2><p className="admin-muted">비로그인 이용은 세션 단위로만 조회합니다. 회원에게 소급 연결하지 않습니다.</p><form className="analytics-inline-form" onSubmit={e => { e.preventDefault(); if (!UUID.test(sessionDraft.trim())) { setError('유효한 세션 UUID를 입력해주세요.'); return; } setError('');setEntryTarget('');setIdentityError(''); setSession(sessionDraft.trim()); setSelected(null); }}><label className="admin-field">세션 UUID<input value={sessionDraft} onChange={e => setSessionDraft(e.target.value)} maxLength={36} /></label><Button type="submit">세션 조회</Button></form>{error && <Notice error>{error}</Notice>}</section>
    {(userId || session) && <section className="admin-panel"><h2>{userId ? `${selected?.name || '회원'}의 활동` : '비로그인 세션 활동'}</h2>{userId && <p className="analytics-identity">{selected?.email || '현재 이메일 정보 없음'} · {userId}</p>}{userId&&!selected&&<Button variant="outline" onClick={()=>select(null)}>회원 선택 해제</Button>}<ActivityList key={`${userId||session}:${JSON.stringify(filters)}`} owner={owner} filters={filters} target={userId ? { user_id:userId } : { session_id:session }} /></section>}
  </div>;
}

function MemberList({ owner, filters, query, onSelect }: { owner: string; filters: AnalyticsFilters; query: string; onSelect: (member: MemberSummary) => void }) {
  const adminAnalyticsApi = useContext(AnalyticsApiContext);
  const [data, setData] = useState<PageResult<MemberSummary> | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(); adminAnalyticsApi.members(filters, owner, query, '', c.signal).then(r => { if (!c.signal.aborted) setData(r); }).catch(e => { if (!c.signal.aborted) setError(failure(e)); }); return () => c.abort(); }, [owner, filters, query, adminAnalyticsApi]);
  async function next() { if (!data?.next_cursor) return; setBusy(true); setError(''); try { setData(await adminAnalyticsApi.members(filters, owner, query, data.next_cursor)); } catch (e) { setError(failure(e)); } finally { setBusy(false); } }
  return <>{error && <Notice error>{error}</Notice>}{!data ? !error && <Notice>회원을 불러오고 있습니다.</Notice> : <><CoverageNote coverage={data.coverage} /><Table headings={['회원 / 실제 ID', '가입 / 확인', '기간 내 마지막 이용', '세션 / 채점 / 기출 / 이력', '채널', '활동']}>{data.items.length ? data.items.map(m => <tr key={m.user_id}><td><strong>{m.name || '이름 없음'}</strong><br />{m.email || '이메일 없음'}<small className="analytics-identity">{m.user_id}</small></td><td>{formatTime(m.created_at)}<br />{formatTime(m.confirmed_at)}</td><td>{formatTime(m.last_seen)}</td><td>{count(m.sessions)} / {count(m.grading)} / {count(m.past_exams)} / {count(m.history_views)}</td><td>{m.channels.map(c => names[c] || c).join(', ') || '—'}</td><td><Button variant="outline" onClick={() => onSelect(m)}>활동 보기</Button></td></tr>) : <EmptyRow columns={6} text="검색 조건에 맞는 회원이 없습니다." />}</Table>{data.next_cursor && <Button variant="outline" disabled={busy} onClick={next}>{busy ? '조회 중' : '다음 회원'}</Button>}</>}</>;
}
function ActivityList({ owner, filters, target }: { owner: string; filters: AnalyticsFilters; target: { user_id?: string; session_id?: string } }) {
  const adminAnalyticsApi = useContext(AnalyticsApiContext);
  const [data, setData] = useState<PageResult<ActivityRow> | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const { user_id, session_id } = target;
  useEffect(() => { const c = new AbortController(); adminAnalyticsApi.activity(filters, owner, { user_id, session_id }, '', c.signal).then(r => { if (!c.signal.aborted) setData(r); }).catch(e => { if (!c.signal.aborted) setError(failure(e)); }); return () => c.abort(); }, [owner, filters, user_id, session_id, adminAnalyticsApi]);
  async function next() { if (!data?.next_cursor) return; setBusy(true); try { const r = await adminAnalyticsApi.activity(filters, owner, target, data.next_cursor); setData({ ...r, items: [...data.items, ...r.items] }); } catch (e) { setError(failure(e)); } finally { setBusy(false); } }
  return <>{error && <Notice error>{error}</Notice>}{!data ? !error && <Notice>활동을 불러오고 있습니다.</Notice> : <><CoverageNote coverage={data.coverage} /><p className="admin-muted">클라이언트 활동 시각은 기기 시계에 영향을 받습니다. 기간 조회와 정렬은 서버 수신 시각 기준입니다.</p><Table headings={['수신 / 활동 시각', '행동', '대상 / 결과', '환경', '연결 ID']}>{data.items.length ? data.items.map(e => <tr key={e.event_id}><td>{formatTime(e.received_at)}<br />{formatTime(e.occurred_at)}<small>{e.clock_status === 'reported' ? '클라이언트 보고' : e.clock_status === 'delayed' ? '지연 수신' : '시계 오차 가능'}</small></td><td>{eventLabels[e.event_name] || e.event_name}<small>{e.source === 'client' ? '클라이언트 관측' : '서버 확인'} · {e.route}</small></td><td>{[e.attributes.year, e.attributes.subjects && names[String(e.attributes.subjects)], e.attributes.exam_type && names[String(e.attributes.exam_type)], e.attributes.target_id, e.attributes.reference_kind, e.attributes.question_no && `${e.attributes.question_no}번`, e.attributes.entry_source].filter(Boolean).join(' · ') || '—'}<small>{e.attributes.outcome ? names[String(e.attributes.outcome)] || '결과 미확인' : ''}</small></td><td>{names[e.execution_channel]}<small>{e.os_family} · {e.device_class}<br />{e.display_mode} · {e.detection_method}</small></td><td className="analytics-identity">세션 {e.session_id}<br />입력 {e.attributes.input_flow_id || '—'}<br />실행 {e.attributes.grading_run_id || '—'}<br />문서 {e.page_instance_id} · #{e.event_sequence}</td></tr>) : <EmptyRow columns={5} />}</Table>{data.next_cursor && <Button variant="outline" onClick={next} disabled={busy}>{busy ? '조회 중' : '이전 활동 더 보기'}</Button>}</>}</>;
}
function AccessExplorer({ owner, filters }: { owner: string; filters: AnalyticsFilters }) {
  const api=useContext(AnalyticsApiContext);
  const [admin, setAdmin] = useState(''), [member, setMember] = useState(''), [target, setTarget] = useState<{ admin_user_id?: string; target_user_id?: string }>({}), [error, setError] = useState('');
  const [adminOption,setAdminOption]=useState<MemberReference|null>(null),[memberOption,setMemberOption]=useState<MemberReference|null>(null);
  return <section className="admin-panel"><h2>관리자 조회 이력</h2><p className="admin-muted">회원 검색·선택 목록·활동 조회·이력 조회의 요청자, 대상, 기간, 반환 건수를 기록합니다. 이 이력 조회도 기록됩니다.</p>
    <AdminMemberPicker owner={owner} purpose="audit_target" label="조회 대상 회원" value={memberOption} loadOptions={api.options} onChange={m=>{setMemberOption(m);setMember(m?.user_id||'');}}/>
    <AdminMemberPicker owner={owner} purpose="audit_actor" label="조회 관리자" value={adminOption} loadOptions={api.options} onChange={m=>{setAdminOption(m);setAdmin(m?.user_id||'');}}/>
    <form className="analytics-inline-form" onSubmit={e => { e.preventDefault(); if ((admin && !UUID.test(admin)) || (member && !UUID.test(member))) { setError('관리자와 대상 회원은 UUID로 입력해주세요.'); return; } setError(''); setTarget({ ...(admin ? { admin_user_id: admin } : {}), ...(member ? { target_user_id: member } : {}) }); }}><label className="admin-field">관리자 UUID<input value={admin} onChange={e => {setAdmin(e.target.value.trim());setAdminOption(null);}} maxLength={36} /></label><label className="admin-field">대상 회원 UUID<input value={member} onChange={e => {setMember(e.target.value.trim());setMemberOption(null);}} maxLength={36} /></label><Button type="submit">조회</Button></form>{error && <Notice error>{error}</Notice>}<AccessList key={JSON.stringify(target)} owner={owner} filters={{ start: filters.start, end: filters.end, ...(filters.kind ? { kind: filters.kind } : {}) }} target={target} /></section>;
}

function AccessList({ owner, filters, target }: { owner: string; filters: AnalyticsFilters; target: { admin_user_id?: string; target_user_id?: string } }) {
  const adminAnalyticsApi = useContext(AnalyticsApiContext);
  const [data, setData] = useState<PageResult<AccessRow> | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const { start, end, kind } = filters; const { admin_user_id, target_user_id } = target;
  useEffect(() => { const c = new AbortController(); adminAnalyticsApi.access({ start, end, ...(kind ? { kind } : {}) }, owner, { admin_user_id, target_user_id }, '', c.signal).then(r => { if (!c.signal.aborted) setData(r); }).catch(e => { if (!c.signal.aborted) setError(failure(e)); }); return () => c.abort(); }, [owner, start, end, kind, admin_user_id, target_user_id, adminAnalyticsApi]);
  async function next() { if (!data?.next_cursor) return; setBusy(true); try { const r = await adminAnalyticsApi.access(filters, owner, target, data.next_cursor); setData({ ...r, items: [...data.items, ...r.items] }); } catch (e) { setError(failure(e)); } finally { setBusy(false); } }
  return <>{error && <Notice error>{error}</Notice>}{!data ? !error && <Notice>조회 이력을 불러오고 있습니다.</Notice> : <Table headings={['수신 시각', '관리자', '조회 종류', '대상', '필터 / 반환']}>{data.items.length ? data.items.map(r => <tr key={r.id}><td>{formatTime(r.received_at)}</td><td className="analytics-identity">{r.admin_user_id}</td><td>{({ member_directory: '회원 검색', member_activity: '활동 조회', admin_access_history: '관리자 이력 조회',member_options:'회원 선택 목록',activity_feed:'최근 회원 활동' }[r.kind] || r.kind)}</td><td className="analytics-identity">{r.target_user_id || r.target_session_id || r.filters.target_user_ids?.join(', ') || '—'}</td><td>{r.filters.start?`${r.filters.start} ~ ${r.filters.end}`:r.filters.purpose?({member_activity:'회원 활동 선택',audit_target:'감사 대상 선택',audit_actor:'조회 관리자 선택'}[r.filters.purpose]||'회원 선택'):'—'}<small>{count(r.returned_count)}건 · {r.status === 'provided' ? '응답 제공' : r.status}</small></td></tr>) : <EmptyRow columns={5} text="선택 기간의 관리자 조회 이력이 없습니다." />}</Table>}{data?.next_cursor && <Button variant="outline" onClick={next} disabled={busy}>{busy ? '조회 중' : '이전 이력 더 보기'}</Button>}</>;
}
