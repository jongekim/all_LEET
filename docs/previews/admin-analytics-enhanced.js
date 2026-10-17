'use strict';
// Standalone review prototype. All fixtures are invented; no API, SDK or storage.
(() => {
  const $ = id => document.getElementById(id);
  const DAY = 86400000;
  const end = '2026-10-15';
  const state = {tab:'overview', range:'7d', channel:'all', compare:true, scenario:'ready', metric:'grading', funnel:'flow', subjects:'all', surface:'new', feature:'distribution', member:null, query:'', revision:0};
  const tabNames = {overview:'개요',features:'기능',grading:'채점',members:'회원/재방문',activity:'회원 활동',pwa:'PWA',access:'관리자 조회 이력'};
  const rangeInfo = {'7d':{days:7,scale:1},'30d':{days:30,scale:4.2},'6m':{days:183,scale:26},'1y':{days:365,scale:52}};
  const captions = {ready:'축적된 가상 자료로 개선 후 화면을 살펴봅니다.',early:'2026.10.04 수집 시작을 가정합니다. 이전 기간·장기 발행은 미가용입니다.',gap:'10.12 수집 공백을 가정합니다. 해당 날짜의 재방문은 0%로 확정하지 않습니다.',zero:'관측은 정상이고 이용은 0건인 상태입니다. 비율은 분모가 없어 미계산입니다.',error:'조회 실패 상태입니다. 실패를 0건으로 표시하지 않습니다.',denied:'권한을 상실한 상태입니다. 개인 자료와 이전 조회 결과를 모두 숨깁니다.'};
  const day = (date,offset) => new Date(Date.parse(date+'T00:00:00Z')+offset*DAY).toISOString().slice(0,10);
  const dateLabel = date => date.replaceAll('-','.');
  const fmt = n => n == null ? '—' : new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(n);
  const pct = (n,d) => !d || n == null ? '—' : (n/d*100).toFixed(1)+'%';
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge = (text,tone='gray') => `<span class="status ${tone}">${text}</span>`;
  const proposal = text => badge(text || '추가 수집 제안','purple');
  const button = (text,target) => `<button type="button" class="link-button" data-tab-target="${target}">${text} <span aria-hidden="true">→</span></button>`;
  const note = (text,tone='') => `<div class="notice ${tone}">${text}</div>`;
  function panel(title,subtitle,body,extra='') { return `<section class="panel"><div class="panel-header"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${extra}</div>${body}</section>`; }
  function table(headers,rows,label) {return `<div class="table-wrap"><table aria-label="${label || headers.join(' · ')}"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>`<td${i>0?' class="num"':''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
  function context() {
    const r=rangeInfo[state.range], start=day(end,1-r.days), long=r.days>90;
    const complete=state.scenario!=='gap' && !(state.scenario==='early' && r.days>7);
    const priorComplete=complete && state.scenario!=='early';
    const fraction=state.scenario==='early'?Math.min(1,11/r.days):state.scenario==='gap'?Math.max(.1,(r.days-1)/r.days):1;
    const channelFactor={all:1,browser:23/26,pwa:4/13}[state.channel];
    const scale=(state.tab==='overview'?r.scale:Math.min(r.scale,12.7))*fraction*channelFactor;
    const n=x=>state.scenario==='zero'?0:Math.round(x*scale);
    return {start,end,days:r.days,long,complete,priorComplete,n,actualStart:long?day(end,-89):start};
  }
  function data(c) {
    const n=c.n, memberRuns=n(400), memberGraders=n(160), priorMemberRuns=n(500), priorGraders=n(200);
    return {members:n(260),sessions:n(620),grading:memberRuns+n(80),results:n(410),pwa:state.channel==='pwa'?n(260):state.channel==='browser'?n(50/(23/26)):n(80),confirmations:state.channel==='all'?n(22):null,previous:{members:n(300),sessions:n(730),grading:priorMemberRuns+n(100),results:n(500),pwa:state.channel==='pwa'?n(300):state.channel==='browser'?n(60/(23/26)):n(100),confirmations:state.channel==='all'?n(28):null},memberRuns,memberGraders,priorMemberRuns,priorGraders,inputs:n(400),closed:n(320),converted:n(256),open:n(40),grace:n(20),uncertain:n(20)};
  }
  function spark(index=0) { const values=[18,15,17,10,14,7,11,6,9,3].map((y,i)=>`${i*8},${state.scenario==='zero'?22:Math.max(2,y+(index%3)*2)}`).join(' ');return `<svg class="spark" viewBox="0 0 75 24" aria-hidden="true"><polyline points="${values}" fill="none" stroke="#7397dc" stroke-width="1.7"/></svg>`; }
  function delta(value,prior,c) { if(!state.compare)return '<span class="muted">비교 안 함</span>'; if(!c.priorComplete)return '<span class="muted">이전 기간 비교 불가</span>'; if(prior==null)return '<span class="muted">채널 필터 미지원</span>'; if(!prior)return `<span class="muted">${value?'이전 0건 · 증감률 미계산':'이전과 동일 · 0건'}</span>`;const difference=(value-prior)/prior*100;return `<span class="delta ${difference>=0?'up':'down'}">${difference>=0?'+':''}${difference.toFixed(1)}% <span class="muted">직전 대비</span></span>`; }
  function coverage(c) {
    const healthy=c.complete, early=state.scenario==='early';
    return `<div class="coverage ${healthy?'':'warn'}">${badge(healthy?'선택 기간 관측 가능':'선택 기간 일부 관측',healthy?'':'amber')}<div class="coverage-meta"><span>수집 시작 ${early?'2026.10.04':'2024.10.01'} <small>가상</small></span><span>마지막 수락 10.16 00:00</span><span>장기 발행 ${early?'0일 · 발행 필요':'전일까지 완료'}</span></div><button class="link-button" type="button" data-quality-open>수집 품질 확인 ↓</button></div>`;
  }
  function detailBoundary(c) {return c.long?note(`분석 기간 ${dateLabel(c.start)} ~ ${dateLabel(end)} 중 상세 원본은 <b>${dateLabel(c.actualStart)} ~ ${dateLabel(end)}</b>만 보여줍니다. 최근 90일과의 교집합입니다.`,'warn'):'';}
  function quality(c,open=false) {
    const zero=state.scenario==='zero';const q=x=>zero?'0':fmt(x);
    return `<details class="quality-toggle" id="quality-details"${open?' open':''}><summary>수집 품질 · 관측 범위 <span class="muted">${state.scenario==='gap'?' / 10.12 공백 확인':state.scenario==='early'?' / 장기 발행 준비 필요':' / 집계 상태 확인'}</span></summary><div class="quality-body"><p class="label-note">선택 기간 전체 수집 · 채널·기능·시험 필터 미적용 · 서버에 도달한 전송 시도 기준</p><div class="quality-grid">${[['제출',12500],['수락',12340],['중복',130],['유효성 거절',18],['처리 실패',12]].map(([l,v])=>`<div><p>${l}</p><strong>${q(v)}</strong></div>`).join('')}</div><div class="quality-meta"><div><p>조회 생성 시각 / 마지막 이벤트 수락</p><b>10.16 00:00:30 / ${zero?'최근 수락 없음':'10.16 00:00:00'}</b></div><div><p>자료 기준 / 계산 정의</p><b>10.16 00:00 KST / 관측 지표 v2 제안</b></div><div><p>장기 자료 발행</p><b>${state.scenario==='early'?'발행 0일 · 완료 날짜 발행 필요':'2026.10.15까지 · 예시 세대 12'}</b></div><div><p>최초 여부 불명</p><b>${zero?'0명':'8명'} · 확정 최초 이용 코호트에서 제외</b></div></div><div class="coverage-calendar" aria-label="10월 5일부터 15일의 관측 상태">${Array.from({length:11},(_,i)=>{const d=i+5,gap=state.scenario==='gap'&&d===12;return `<span class="coverage-day${gap?' gap':''}" aria-label="10월 ${d}일 ${gap?'수집 공백':'관측 가능'}">${d}</span>`;}).join('')}</div><p class="label-note">${state.scenario==='gap'?'10.12 공백 · 해당 날짜의 D7 및 공백을 포함한 W1은 확정하지 않습니다.':'완료 0건과 발행 없음은 구분합니다. 오늘 자료는 별도 잠정치입니다.'}<br>서버 미도달 이벤트의 전체 누락률은 알 수 없습니다. 재시도·중복을 최종 누락으로 해석하지 않습니다.</p></div></details>`;
  }
  function kpis(c,d) {
    const items=[['members','활성 회원','명'],['sessions','이용 세션','개'],['grading','채점 완료','회'],['results','결과 조회 세션','개'],['pwa','PWA 활성 회원','명'],['confirmations','신규 확인 회원','명']];
    return `<div class="kpi-grid">${items.map(([key,label,unit],i)=>{const unsupported=d[key]==null;return `<button class="kpi${state.metric===key?' selected':''}" data-metric="${key}" type="button" aria-pressed="${state.metric===key}"><span class="kpi-top">${label}${unsupported?badge('필터 미지원'):!c.complete?badge('부분','amber'):''}</span><span class="kpi-value">${unsupported||!c.complete?'—':fmt(d[key])}<small>${unit}</small></span><span class="kpi-foot"><span>${unsupported?'<small class="muted">기간만 적용</small>':!c.complete?`<small class="muted">관측분 ${fmt(d[key])}${unit} · 전체값 미확정</small>`:delta(d[key],d.previous[key],c)}</span>${spark(i)}</span></button>`;}).join('')}</div>`;
  }
  function insights(c,d) {
    if(!c.complete||!c.priorComplete||!state.compare)return panel('확인할 변화','관측 가능한 동일 기간만 비교합니다.',`<p class="label-note">${!state.compare?'직전 기간 비교를 켜면 주요 변화를 확인할 수 있습니다.':'자료가 부족한 기간에는 증감 순위를 만들지 않습니다. 관측 범위와 수집 품질부터 확인해주세요.'}</p>${button('관측 범위 확인','members')}`,badge('판단 보류','amber'));
    if(!d.grading)return panel('확인할 변화','선택 기간은 정상 관측된 0건입니다.',`<p class="label-note">이전 기간도 0건입니다. 전환율과 기능 사용률은 분모가 없어 미계산입니다.</p>`,badge('변화 없음'));
    return panel('확인할 변화','변화 · 근거 · 다음 분석을 함께 확인합니다.',[
      ['채점 완료 감소 · 이용 회원 수부터 확인',`회원 채점 ${fmt(d.memberRuns)}회, 직전 ${fmt(d.priorMemberRuns)}회. 회원당 횟수는 약 2.5회로 비슷합니다.`,'가용 자료','채점 변화 보기','grading'],
      ['입력 이후 결과 관측률 감소',`관찰 종료 ${fmt(d.closed)}세션 중 ${fmt(d.converted)}세션에서 결과 관측. 저장 대기와 미관측 응답을 함께 점검합니다.`,'분모 50 이상','단계별로 보기','grading'],
      ['복습 이용은 채점 횟수와 따로 확인',`기록이 있는 이력과 과거 결과의 재조회도 확인합니다. 채점 횟수만으로 반복 이용을 대표하지 않습니다.`,'정의 구분','재이용 보기','members']
    ].map(([title,copy,label,action,target],i)=>`<article class="insight"><span class="insight-index">0${i+1}</span><div class="insight-body"><h3>${title}</h3><p>${copy}</p><div class="insight-end">${badge(label,i===1?'amber':'gray')}${button(action,target)}</div></div></article>`).join(''));
  }
  function chartPanel(c) {return panel('이용 추이','카드는 기간 고유 수 · 그래프는 구간 일평균입니다.',`<div class="chart-header"><label class="compact-field">표시 지표<select id="chart-metric">${[['grading','채점 완료'],['members','활성 회원'],['sessions','이용 세션'],['results','결과 조회 세션'],['pwa','PWA 활성 회원'],['confirmations','신규 확인 회원']].map(([k,l])=>`<option value="${k}"${k===state.metric?' selected':''}>${l}</option>`).join('')}</select></label><div class="legend"><span><i></i>현재</span>${state.compare?'<span><i class="dashed"></i>직전 대응 구간</span>':''}</div></div><svg id="trend-chart" class="chart-svg" role="img" aria-label="선택 지표의 구간 일평균 추이. 공백 구간은 연결하지 않습니다."></svg><div class="chart-inspect"><span id="chart-value">구간을 선택하면 정확한 값을 확인할 수 있습니다.</span><label>구간 선택 <input id="chart-point" aria-label="추이 구간 선택" type="range" min="0" max="6" value="3"></label></div><details><summary>구간별 정확한 값</summary><div id="chart-table"></div></details>`,badge(c.days<=30?'일 단위':c.days<365?'7일 구간':'월 구간','blue'));}
  function decomposition(c,d) {
    const per=d.memberGraders?d.memberRuns/d.memberGraders:null;
    return panel('채점 감소, 어디에서 달라졌을까?','로그인 회원의 완료 실행만 분해 · 비회원 실행은 별도',`<div class="equation"><div><span>채점한 회원</span><strong>${fmt(d.memberGraders)}<small>명</small></strong><small>직전 ${c.priorComplete?fmt(d.priorGraders):'—'}명</small></div><span class="symbol">×</span><div><span>회원당 채점</span><strong>${fmt(per)}<small>회</small></strong><small>직전 ${c.priorComplete&&d.priorGraders?fmt(d.priorMemberRuns/d.priorGraders):'—'}회</small></div><span class="symbol">=</span><div><span>회원 채점</span><strong>${fmt(d.memberRuns)}<small>회</small></strong><small>비회원 ${fmt(d.grading-d.memberRuns)}회 별도</small></div></div>${note(!d.memberRuns?'분모가 없어 회원당 횟수를 계산하지 않습니다.':!c.priorComplete?'직전 기간이 완전히 관측되지 않아 감소 원인을 비교하지 않습니다.':'예시에서는 회원당 횟수보다 채점한 회원 수의 변화가 큽니다. 원인을 확정하지 않고 진입·재이용을 추가 확인합니다.')}${button('채점 단계와 저장 응답 확인','grading')}`);
  }
  function recent(c) { const rows=state.scenario==='zero'?'선택 기간의 회원 활동이 없습니다.':[ ['01','새 채점 결과 조회','브라우저','2분 전'],['02','성적 이력 조회','PWA','8분 전'],['03','문항 분포 열기','브라우저','12분 전']].map(([id,e,ch,time])=>`<div class="mini-activity"><span class="member-icon">${id}</span><div><p>예시회원 ${id} · ${e}</p><small>${ch} / ${time}</small></div><button type="button" class="link-button" data-member-key="${Number(id)-1}">활동 보기 →</button></div>`).join('');return panel('최근 회원 활동','회원 선택은 개인 상세에만 적용됩니다.',`<div class="label-note">최근 원본 가용 범위 내 가상 활동</div>${rows}`,button('회원 선택','activity')); }
  function overview(c,d) {
    return coverage(c)+kpis(c,d)+`<div class="two-col">${chartPanel(c)}${insights(c,d)}</div><div class="two-col equal">${decomposition(c,d)}${panel('채점 입력 → 결과 관측','관찰 종료된 입력 세션이 분모입니다.',`<div class="mini-stat"><p>새 결과 관측률</p><strong>${c.complete?pct(d.converted,d.closed):'—'} <small>${fmt(d.converted)} / ${fmt(d.closed)}세션${!c.complete?' · 관측분':''}</small></strong></div><div class="state-counts"><span>진행 <b>${fmt(d.open)}</b></span><span>유예 <b>${fmt(d.grace)}</b></span><span>미확정 <b>${fmt(d.uncertain)}</b></span></div>${button('입력 흐름 · 실행 · 저장 진단','grading')}`,badge('실제 이탈과 구분','amber'))}</div>`+quality(c)+`<div class="two-col equal">${panel('복습과 재이용','주 2일 채점은 보조 지표 · 실제 재이용 간격을 함께 확인',`<div class="stat-strip"><div class="strip-item"><p>기록 복습 관측 회원</p><strong>${fmt(c.n(112))}</strong><small>명</small></div><div class="strip-item"><p>복습 관측 반복 회원</p><strong>${fmt(c.n(68))}</strong><small>명</small></div><div class="strip-item"><p>반복 회원의 중앙 간격</p><strong>${d.members?'4.2':'—'}</strong><small>일</small></div><div class="strip-item"><p>1회만 관측된 회원</p><strong>${fmt(c.n(44))}</strong><small>명</small></div></div>${button('코호트와 재이용 분포 확인','members')}`)}${panel('오늘 잠정 현황','10.16 00:00:30 기준 · 전체 채널 · 선택 기간 비교에서 제외',`<div class="stat-strip"><div class="strip-item"><p>이용 세션</p><strong>${state.scenario==='zero'?'0':'3'}</strong><small>개</small></div><div class="strip-item"><p>채점 완료</p><strong>${state.scenario==='zero'?'0':'1'}</strong><small>회</small></div></div><p class="label-note">조회 생성 00:00:30 · 마지막 수락 ${state.scenario==='zero'?'없음':'00:00:00'}<br>최근 수락이 없다는 이유만으로 수집 장애를 확정하지 않습니다.</p>`,badge('잠정','amber'))}</div><div class="two-col equal">${recent(c)}${releasePanel(c)}</div>`;
  }
  function releasePanel(c) {return panel('운영 변경과 버전 비교','배포일과 실제 실행 앱 버전을 구분합니다.',`<div class="release-line"><time>10.14</time><p>v1.12.3 예시 배포<small>변화 시점 참고 · 배포 효과로 단정하지 않음</small></p>${proposal('버전 계측 필요')}</div><div class="release-line"><time>10.12</time><p>${state.scenario==='gap'?'수집 공백 관측':'통계 발행 갱신 예시'}<small>${state.scenario==='gap'?'재방문 관찰 창에서 제외':'현재 발행 예시 세대 12'}</small></p>${badge(state.scenario==='gap'?'부분 관측':'운영 주석',state.scenario==='gap'?'amber':'gray')}</div><details><summary>버전별 비교 예시</summary>${table(['실행 앱 버전','결과 도달','저장 대기 p95'],[['v1.12.3 · 가상','92 / 100','4.8초'],['v1.12.2 · 가상','88 / 100','5.1초'],['미확인 · 가상','19 / 24','—']])}<p class="label-note">앱 버전·대기시간의 추가 수집이 필요합니다. 이용자 구성 차이가 있어 버전의 인과 효과를 뜻하지 않습니다.</p></details>`);}
  // Remaining tab views and interaction wiring are defined below.
  window.__analyticsPreviewReady = false;

  function features(c) {
    const surfaceFactor={new:1,history:.55,example:.24,past:.7}[state.surface];
    const n=x=>Math.round(c.n(x)*surfaceFactor);
    const fixtures=[['distribution','문항 분포',480,300,96,92],['field','분야별 분석',480,360,180,175],['edit','답안 수정',320,180,40,34],['note','오답 메모',260,140,24,22]];
    const selected=fixtures.find(r=>r[0]===state.feature);
    const [key,label,...counts]=selected;
    const numbers=counts.map(n), [eligible,exposed,used,completed]=numbers;
    const stageLabels=['사용 가능','화면 노출','실행','결과 확인'];
    const available=id=>state.surface==='past'?id==='distribution':state.surface==='example'?!['edit','note'].includes(id):true;
    const rows=fixtures.map(([id,name,a,b,u,r])=>available(id)?[`<button type="button" class="link-button" data-feature="${id}" aria-pressed="${state.feature===id}">${name}${state.feature===id?' · 선택됨':''}</button>`,fmt(n(a)),fmt(n(b)),fmt(n(u)),pct(n(u),n(b)),fmt(n(r))]:[`${name}<small>이 화면에서는 미제공</small>`,'—','—','—','—','—']);
    return detailBoundary(c)+panel('기능을 볼 수 있었고, 실제 사용했을까?','전체 방문자 대신 사용 기회와 실제 노출을 기준으로 봅니다.',`<div class="sub-filter"><label>이용 화면 <select id="surface"><option value="new"${state.surface==='new'?' selected':''}>새 채점 결과</option><option value="history"${state.surface==='history'?' selected':''}>과거 성적 결과</option><option value="example"${state.surface==='example'?' selected':''}>예시 결과</option><option value="past"${state.surface==='past'?' selected':''}>기출 정답표</option></select></label><span>집계 단위: 화면 진입 · 기능별 노출 중복 제거</span></div>${table(['기능','사용 가능','노출','실행','노출 대비 사용률','결과 확인'],rows,'기능 사용 기회 대비 사용률')}${note('기능 노출·결과 문맥은 추가 계측이 필요한 제안입니다. 예시·과거 결과·기출에서의 이용을 새 채점 결과와 섞지 않습니다.')}`,proposal())+`<div class="two-col equal">${panel(`${label} · 사용 기회부터 결과까지`,'클릭이 적은 이유를 한 단계씩 확인합니다.',`<div class="funnel">${numbers.map((v,i)=>`<div class="funnel-step"><div class="funnel-shape" style="height:${55+((eligible?v/eligible:0)*45)}px">${fmt(v)}</div><p>${stageLabels[i]}</p><small>${i===0?'분석 대상 진입':pct(v,numbers[i-1])+' · 직전 단계 대비'}</small></div>`).join('')}</div><div class="state-counts"><span>노출되지 않음 <b>${fmt(eligible-exposed)}</b></span><span>노출 미관측 실행 <b>${fmt(n(3))}</b></span></div>${note(`${label}의 노출 대비 사용률은 ${fmt(used)} / ${fmt(exposed)} = <b>${pct(used,exposed)}</b>입니다. 노출 미관측 실행 ${fmt(n(3))}건은 이 비율에서 제외합니다.`)}`)}${panel('함께 이용한 기능','동일 기간의 회원 교집합 · 순서나 인과를 뜻하지 않음',table(['회원 기준','채점','이력 복습','기출'],[['채점',badge('자기 집합'),fmt(c.n(112)),fmt(c.n(64))],['이력 복습',fmt(c.n(112)),badge('자기 집합'),fmt(c.n(42))],['기출',fmt(c.n(64)),fmt(c.n(42)),badge('자기 집합')]],'기능 교차 이용 회원')+'<p class="label-note">같은 회원이 여러 칸에 포함될 수 있습니다. 셀을 합쳐 전체 회원 수로 계산하지 않습니다.</p>')}</div>`+panel('처음 관측된 화면별 도달','진입 목적에 맞는 결과를 구분합니다.',table(['첫 관측 화면','세션','목표 행동','도달 세션','도달률'],[['홈',fmt(c.n(400)),'새 채점 결과',fmt(c.n(300)),pct(c.n(300),c.n(400))],['기출문제',fmt(c.n(140)),'PDF 링크 클릭 / 참고표',fmt(c.n(98)),pct(c.n(98),c.n(140))],['성적 이력',fmt(c.n(80)),'기록 있는 이력 조회',fmt(c.n(64)),pct(c.n(64),c.n(80))]],'진입 목적별 첫 관측 도달')+note('세션에서 처음 수집된 라우트 기준입니다. 실제 최초 방문·검색 유입을 뜻하지 않으며, PDF 링크 클릭은 다운로드 완료가 아닙니다. 로그인 전후 기록은 소급 연결하지 않습니다.'));
  }
  function grading(c,d) {
    const factor={all:1,verbal:.25,reasoning:.17,both:.58}[state.subjects], n=x=>Math.round(c.n(x)*factor);
    const flow=state.funnel==='flow',unsupported=flow&&state.subjects!=='all';
    const values=(flow?[350,320,315,300]:[500,480,460]).map(n), labels=flow?['입력 시작·재개','채점 요청 도달','계산 완료 도달','새 결과 조회']:['채점 요청','계산 완료','새 결과 조회'];
    const target=n(680),success=n(630),failed=n(12),unknown=n(18),missing=Math.max(0,target-success-failed-unknown);
    const steps=unsupported?note('입력 시점에는 최종 과목 조합이 확정되지 않습니다. 입력 흐름 퍼널은 과목 전체에서 확인하거나, 실행 기준으로 전환해주세요.','warn')+`<button type="button" class="button secondary" data-reset-subject>과목 전체로 보기</button>`:`<div class="funnel" style="grid-template-columns:repeat(${values.length},minmax(0,1fr))">${values.map((v,i)=>`<div class="funnel-step"><div class="funnel-shape" style="height:${60+(values[0]?v/values[0]*40:0)}px">${fmt(v)}</div><p>${labels[i]}</p><small>${i===0?(flow?'관찰 종료 흐름':'관찰 종료 실행'):pct(v,values[i-1])+' · 직전 대비'}</small></div>`).join('')}</div><div class="state-counts"><span>진행 <b>${fmt(n(40))}</b></span><span>유예 <b>${fmt(n(20))}</b></span><span>미확정 <b>${fmt(n(20))}</b></span><span>연결 불완전 <b>${fmt(n(6))}</b></span></div><p class="label-note" style="margin-top:10px">위 퍼널은 관찰 종료 표본입니다. 진행·유예·미확정·연결 불완전은 확정 전환에서 제외합니다. 다음 단계 미관측을 사용자 이탈로 확정하지 않습니다.</p>`;
    return detailBoundary(c)+panel('채점, 어느 단계에서 멈췄을까?','입력 흐름 · 실행 · 과목 저장의 분모를 구분합니다.',`<div class="sub-filter"><div class="segmented" role="group" aria-label="퍼널 집계 단위"><button type="button" data-funnel="flow" aria-pressed="${flow}">입력 흐름</button><button type="button" data-funnel="run" aria-pressed="${!flow}">채점 실행</button></div><label>과목 조합 <select id="subjects"><option value="all"${state.subjects==='all'?' selected':''}>과목 전체</option><option value="verbal"${state.subjects==='verbal'?' selected':''}>언어이해</option><option value="reasoning"${state.subjects==='reasoning'?' selected':''}>추리논증</option><option value="both"${state.subjects==='both'?' selected':''}>두 과목</option></select></label></div>${steps}`,badge(flow?'입력 흐름 ID 기준':'채점 실행 ID 기준','blue'))+`<div class="two-col equal">${panel('로그인 회원의 과목별 저장 응답','계산 완료된 실행의 저장 대상 과목 · 비회원 제외',table(['응답 상태','과목 건수','대상 대비'],[['성공 확인',fmt(success),pct(success,target)],['실패 확인',fmt(failed),pct(failed,target)],['응답 미확인',fmt(unknown),pct(unknown,target)],['응답 이벤트 미관측',fmt(missing),pct(missing,target)],['전체 저장 대상',`<b>${fmt(target)}</b>`,'—']],'과목별 저장 응답')+note('두 과목 채점은 실행 1회, 저장 대상은 최대 2개입니다. 한 과목만 성공한 실행을 전체 성공으로 표시하지 않습니다. 클라이언트 성공 응답과 서버 저장 확정은 별도 지표입니다.'))}${panel('계산 완료 뒤의 대기시간','현재 처리 순서: 계산 → 과목별 저장 대기 → 결과 화면',`<div class="timing">${[['로컬 계산','0.03','0.08'],['과목 저장 대기','0.9','4.8'],['저장 종료 → 표시','0.12','0.35']].map(([label,p50,p95])=>`<div><p>${label}</p><strong>${d.grading?p50:'—'}<small>초</small></strong><small>p50 / p95 ${d.grading?p95:'—'}초</small></div>`).join('')}</div><div class="state-counts"><span>시간 측정 완료 <b>${fmt(n(380))}실행</b></span><span>미측정 <b>${pct(n(20),n(400))}</b></span><span>미완료 <b>${fmt(n(20))}실행</b></span></div>${note('가상 측정 예시입니다. 동일 문서의 단조 시계로 구간을 측정하며, 서버 수신 시각 차이를 대기시간으로 사용하지 않습니다. 구간별 p95를 더해 전체 p95로 해석하지 않습니다.')}`,proposal('대기시간 계측'))}</div>`+panel('결과 관측률을 나눠 보기','집단별 분모와 구성 비중을 함께 확인합니다.',table(['기기 집단','관찰 종료 세션','결과 관측','관측률','직전 관측률'],[['휴대폰',fmt(c.n(240)),fmt(c.n(180)),pct(c.n(180),c.n(240)),c.priorComplete&&state.compare?'84.0%':'—'],['태블릿·PC',fmt(c.n(80)),fmt(c.n(76)),pct(c.n(76),c.n(80)),c.priorComplete&&state.compare?'96.0%':'—'],['전체',fmt(d.closed),fmt(d.converted),pct(d.converted,d.closed),c.priorComplete&&state.compare&&d.closed?'87.0%':'—']],'기기별 결과 관측')+note('구성 비중 변화와 집단 내부의 관측률 변화를 구분합니다. 표본이 적은 교차 집단을 자동으로 장애 순위화하지 않습니다.'));
  }
  function cohortRows(c) {
    const first=state.scenario==='early'&&c.actualStart<'2026-10-05'?'2026-10-05':c.actualStart;
    const span=Math.round((Date.parse(end)-Date.parse(first))/DAY);
    const step=Math.max(1,Math.ceil(span/5));let anchors=[];
    for(let i=0;i<=span;i+=step)anchors.push(day(first,i));
    if(state.scenario==='gap'&&first<='2026-10-05')anchors.push('2026-10-05');
    anchors.push(end);anchors=[...new Set(anchors)].sort();
    const cell=(anchor,offset,window,index,total)=>{
      const target=day(anchor,offset),until=day(anchor,window?13:offset);
      if(until>end)return `${badge('관찰 중','gray')}<small>성숙 전 · 분모 제외</small>`;
      const gap=state.scenario==='gap'&&((window&&target<='2026-10-12'&&until>='2026-10-12')||(!window&&target==='2026-10-12')||anchor==='2026-10-12');
      if(gap)return `${badge('관측 공백','amber')}<small>0%로 확정하지 않음</small>`;
      const success=Math.round(total*(window?.46:offset===1?.42:offset===7?.31:.21));
      return `${pct(success,total)}<small>${fmt(success)} / ${fmt(total)}명</small>`;
    };
    return anchors.map((anchor,index)=>{const total=c.n(12+index*3);return [dateLabel(anchor).slice(5),fmt(total),cell(anchor,1,false,index,total),cell(anchor,7,false,index,total),cell(anchor,7,true,index,total),cell(anchor,30,false,index,total)];});
  }
  function members(c,d) {
    const days=state.range==='7d'?7:28, mature=c.days>7&&state.scenario!=='zero'&&state.channel==='all', eligible=mature?c.n(108):0,returns=mature?c.n(54):0;
    return detailBoundary(c)+panel('돌아오는 회원, 관찰을 마쳤을까?','최초 핵심 이용일 기준 · D7과 W1을 구분합니다.',(state.channel==='all'?table(['최초 이용일','대상 회원','D1','D7','W1 · 7~13일','D30'],cohortRows(c),'재방문 코호트'):note('최초 핵심 이용 코호트에는 기간만 적용합니다. 채널을 전체로 바꾸거나 PWA 탭의 전용 코호트를 확인해주세요.','warn'))+note(state.scenario==='gap'?'공백이 재방문 관찰 날짜에 겹치면 분모에서 제외합니다. 10.05 코호트의 D7은 10.12 공백 때문에 확정할 수 없습니다.':'성숙 전과 관측 불가를 0%로 표시하지 않습니다. 최근 7일 코호트의 D7/D30은 아직 관찰 중일 수 있습니다.','warn')+(c.days===7?`<button type="button" class="link-button" data-range-target="30d">30일 범위에서 성숙한 코호트 보기 →</button>`:''),badge('가용한 관찰 창만 집계','blue'))+`<div class="two-col equal">${panel('채점한 뒤, 기록을 다시 보는가?','과거 결과·기록 있는 이력 조회만 복습 관측에 포함',`<div class="mini-stat"><p>첫 채점 후 7일 내 복습 관측률</p><strong>${pct(returns,eligible)}<small>${fmt(returns)} / ${fmt(eligible)}명</small></strong></div>${mature?`<p class="label-note">관찰 완료 ${fmt(c.n(120))}명 중 최초 불명 ${fmt(c.n(8))}명·관측 불가 ${fmt(c.n(4))}명을 제외한 ${fmt(eligible)}명이 분모입니다.</p>`:note('선택 기간의 첫 채점 회원은 후속 7×24시간 관찰을 아직 완료하지 않았거나 대상이 없습니다. 분모 0은 미계산입니다.','warn')}<details><summary>복습 관측의 정의</summary><p class="label-note">예시 결과와 빈 이력은 제외합니다. 최초 채점 여부가 불명인 회원은 별도 코호트로 다룹니다. 실제 읽기·학습 완료나 성적 향상을 의미하지 않습니다.</p></details>`)}${panel('얼마나 자주 다시 이용하는가?','채점과 복습은 별도 관측 · 주 2일 채점은 보조 지표',`<div class="stat-strip"><div class="strip-item"><p>복습 반복 관측</p><strong>${fmt(c.n(68))}</strong><small>명</small></div><div class="strip-item"><p>회원별 중앙 간격 요약</p><strong>${d.members?'4.2':'—'}</strong><small>일</small></div><div class="strip-item"><p>복습 1회만 관측</p><strong>${fmt(c.n(44))}</strong><small>명</small></div><div class="strip-item"><p>주 2일 이상 채점</p><strong>${fmt(c.n(56))}</strong><small>명 · 보조</small></div></div><p class="label-note">간격은 반복이 관측된 회원만의 요약입니다. 1회만 관측된 회원을 포함한 전체의 평균 재방문 시간으로 해석하지 않습니다.</p>`)} </div>`+`<div class="two-col equal">${panel(`${days}일 내 실제 이용일 분포`,'서로 다른 KST 이용일 · 채점 또는 기록 복습 관측',`<div class="bar-list">${[['1일',156],['2일',56],['3일',26],[days===7?'4~7일':'4~28일',22]].map(([l,v])=>`<div class="bar-row"><span>${l}</span><div class="bar-track"><div class="bar-fill" style="width:${c.n(v)?v/156*100:0}%"></div></div><span class="num">${fmt(c.n(v))}명</span></div>`).join('')}</div><p class="label-note" style="margin-top:16px">현재 수집 초기 상태에서 28일 전체가 가용하지 않으면 관측분으로만 표시합니다.</p>`)}${panel('가입·현재 보관 현황','조회 시점 스냅샷 · 기간·채널 필터 미적용',table(['현재 보관','가상 예시'],[['전체 회원','1,240명'],['확인 완료 회원','1,180명'],['공식 과목 기록','5,860건'],['사설 기록','420건']])+note('보관된 성적 건수는 누적 채점 횟수가 아닙니다. 현재 계정 수와 선택 기간의 활성 회원 수를 구분합니다.'))}</div>`;
  }
  const demoMembers=Array.from({length:12},(_,i)=>({id:i,name:`예시회원 ${String(i+1).padStart(2,'0')}`,email:`member${String(i+1).padStart(2,'0')}@example.test`,uuid:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,channel:i%3===1?'PWA':'브라우저'}));
  function activity(c) {
    const member=state.member==null?null:demoMembers[state.member];
    const selected=member&&state.scenario!=='zero'?`<h3>${member.name}</h3><div class="identity">${member.email}<br>${member.uuid}<br>분석 대상: ${dateLabel(c.actualStart)} ~ ${dateLabel(end)} · ${state.channel==='all'?'전체 채널':state.channel==='pwa'?'PWA':'브라우저'}</div><div class="timeline">${[['21:24','성적 이력 조회','기록 있음 · 공식 이력'],['21:20','문항 분포 열기','2026 · 추리논증 · 과거 결과'],['21:18','과거 성적 결과 조회','이력에서 진입 · 예시 결과 제외'],['21:15','새 채점 결과 조회','2026 · 두 과목 · 클라이언트 관측']].map(([time,title,copy])=>`<article class="timeline-item"><time>${time}</time><div><h3>${title}</h3><p>${copy} · ${member.channel}</p></div></article>`).join('')}</div><button type="button" class="button secondary" data-member-clear>선택 해제</button>`:`<div class="empty-state" style="border:0;padding:50px 15px"><div class="empty-symbol">↗</div><h2>회원의 이용 흐름을 확인하세요</h2><p>왼쪽에서 가상 회원을 선택하면 활동을 표시합니다.<br>개인 선택은 전체 통계의 모수를 바꾸지 않습니다.</p></div>`;
    return detailBoundary(c)+note('모든 회원은 예시 계정입니다. 검색·선택은 이 미리보기의 메모리에서만 동작합니다. 이름·이메일·대상 ID를 URL이나 저장소에 남기지 않습니다.')+`<div class="activity-grid">${panel('회원 찾기','이름 · 이메일로 가상 회원 검색',`<label class="sr-only" for="member-query">회원 검색</label><input id="member-query" class="member-search" type="search" autocomplete="off" placeholder="예시회원 또는 이메일 검색" value="${escape(state.query)}"><p id="member-count" class="member-panel-count"></p><div id="member-list"></div>`)}${panel('선택 회원의 활동','개인 상세 · 서버 수신 시각 역순 · 모든 활동은 가상',selected)}</div>`;
  }
  function updateMemberList() {
    if(!$('member-list'))return; const query=state.query.trim().toLowerCase();
    const rows=state.scenario==='zero'?[]:demoMembers.filter(m=>(m.name+' '+m.email).toLowerCase().includes(query)&&(state.channel==='all'||m.channel===(state.channel==='pwa'?'PWA':'브라우저')));
    $('member-count').textContent=`검색 결과 ${rows.length}명 · 전체 집계와 독립`;
    $('member-list').innerHTML=rows.length?rows.map(m=>`<button type="button" class="member-row" data-member-select="${m.id}" aria-pressed="${state.member===m.id}"><span class="member-icon">${String(m.id+1).padStart(2,'0')}</span><span><p>${m.name}</p><small>${m.email}</small></span>${badge(m.channel,m.channel==='PWA'?'blue':'gray')}</button>`).join(''):'<p class="label-note" style="padding:20px 0">검색 조건에 맞는 가상 회원이 없습니다.</p>';
  }
  function pwa(c,d) {
    if(state.channel==='browser')return detailBoundary(c)+panel('PWA 실행 분석','선택한 채널: 브라우저',note('PWA 실행 분석에는 브라우저 채널 조건을 적용할 수 없습니다. 전체 채널 또는 PWA로 바꿔 확인해주세요.','warn')+'<button type="button" class="button secondary" data-reset-channel>전체 채널로 보기</button>',badge('필터 미지원','amber'));
    const n=c.n,unfiltered=state.channel==='all',pwaOnly=n(30),browserOnly=n(180),both=n(50),all=pwaOnly+browserOnly+both;
    return detailBoundary(c)+panel('PWA로 실행한 이용을 확인합니다','설치 신호·실행 세션·기기 구독은 서로 다른 지표입니다.',`<div class="stat-strip"><div class="strip-item"><p>PWA 활성 회원</p><strong>${fmt(state.channel==='pwa'?d.members:n(80))}</strong><small>명</small></div><div class="strip-item"><p>PWA 이용 세션</p><strong>${fmt(state.channel==='pwa'?d.sessions:n(180))}</strong><small>개</small></div><div class="strip-item"><p>관측된 설치 이벤트</p><strong>${fmt(n(14))}</strong><small>건 · 신호</small></div><div class="strip-item"><p>PWA 결과 관측률</p><strong>${pct(n(78),n(90))}</strong><small>${fmt(n(78))}/${fmt(n(90))}</small></div></div>${note('이 패널은 PWA 실행만 집계합니다. 브라우저 채널을 선택한 경우 PWA 지표와의 교집합은 미지원입니다. 설치 이벤트는 설치 보유 인원이나 iOS 설치 완료 수가 아닙니다.')}`,badge('PWA 실행 기준','blue'))+`<div class="two-col equal">${panel('회원의 채널 교집합','회원 중복을 제거한 상호 배타적 집단',unfiltered?`<div class="channel-bar" aria-label="PWA만, 브라우저만, 둘 다 이용한 회원"><span style="flex:${pwaOnly||1}"></span><span style="flex:${browserOnly||1}"></span><span style="flex:${both||1}"></span></div>${table(['실행 조합','회원'],[['PWA만',`${fmt(pwaOnly)}명`],['브라우저만',`${fmt(browserOnly)}명`],['둘 다',`${fmt(both)}명`],['기타·미확인만','0명'],['전체 고유 회원',`<b>${fmt(all)}명</b>`]])}<p class="label-note">PWA ${fmt(pwaOnly+both)}명 + 브라우저 ${fmt(browserOnly+both)}명에는 '둘 다' ${fmt(both)}명이 겹칩니다.</p>`:note('채널별 교집합은 전체 채널에서만 제공합니다. 전체 채널로 바꿔 확인해주세요.','warn'))}${panel('설치 신호','브라우저가 제공한 관측 신호 건수',table(['관측 신호','건수'],[['설치 버튼 클릭',fmt(n(48))],['설치 안내 열기',fmt(n(35))],['프롬프트 수락',fmt(n(18))],['설치 이벤트 관측',fmt(n(14))]])+note('OS와 브라우저별 지원 범위가 다릅니다. 이를 하나의 전체 설치 전환율로 연결하지 않습니다.'))}</div>`+panel('PWA 최초 핵심 이용 기준 재방문','최초 PWA 핵심 이용일 기준 · 설치일 기준이 아님',table(['최초 PWA 이용일','대상 회원','D1','D7','W1','D30'],cohortRows({...c,n:x=>Math.round(c.n(x)*(state.channel==='pwa'?1:.32))}),'PWA 재방문 코호트')+note('최초 PWA 핵심 이용이 알려져 있고 후속 관찰 날짜가 가용한 표본만 포함합니다. 일반 회원 코호트와 최초 기준이 다릅니다.'))+panel('푸시 구독 현황과 재이용','구독 스냅샷과 PWA 사용자를 자동으로 동일시하지 않습니다.',`<div class="stat-strip"><div class="strip-item"><p>구독 회원 · 가상</p><strong>68</strong><small>명</small></div><div class="strip-item"><p>활성 구독 · 가상</p><strong>92</strong><small>개</small></div><div class="strip-item"><p>회원 연결 구독</p><strong>78</strong><small>개</small></div><div class="strip-item"><p>비회원 구독</p><strong>14</strong><small>개</small></div></div><p class="label-note">현재 시점 스냅샷 · 기간·채널 필터 미적용. 물리 기기 수나 실제 알림 수신을 보장하지 않습니다. 푸시 후 재이용 성과는 연결 범위와 대조 기준을 정한 뒤 후속 분석합니다.</p>`,proposal('별도 통계 연결'));
  }
  function access(c) {
    return detailBoundary(c)+panel('관리자 조회 이력','이름·이메일 검색어를 이력에 복제하지 않습니다.',`<div class="sub-filter"><label>조회 종류 <select id="audit-kind"><option value="all">전체 종류</option><option value="activity">회원 활동</option><option value="directory">회원 목록</option><option value="audit">관리자 조회 이력</option></select></label><span>관리자·대상·기간·반환 수를 확인합니다.</span></div><div id="audit-table"></div>${note('아래는 가상 감사 이력입니다. 이 화면 조회로 실제 감사 로그를 만들지 않습니다. 실제 구현에서는 개인 조회 응답과 감사 기록을 같은 트랜잭션으로 처리합니다.')}`);
  }
  function updateAudit(kind='all') {
    if(!$('audit-table'))return;const fixture=[['10.15 21:30','예시관리자 A','activity','회원 활동','예시회원 01','12건'],['10.15 21:28','예시관리자 A','directory','회원 목록','검색 대상 목록','12건'],['10.15 20:10','예시관리자 B','activity','회원 활동','예시회원 03','8건'],['10.15 19:40','예시관리자 A','audit','관리자 조회 이력','관리자 이력','4건']];
    const rows=state.scenario==='zero'?[]:fixture.filter(r=>kind==='all'||r[2]===kind).map(([time,actor,key,name,target,count])=>[time,actor,name,target,count]);
    $('audit-table').innerHTML=rows.length?table(['조회 시각','관리자','종류','대상','반환'],rows,'가상 관리자 조회 이력'):'<p class="label-note">조건에 맞는 가상 이력이 없습니다.</p>';
  }

  let chartObserver=null;
  function chartRows(c,d) {
    const boundaries=[c.start], endExclusive=day(end,1);
    if(c.days===365){const origin=new Date(c.start+'T00:00:00Z');for(let i=1;i<12;i++){const date=new Date(origin);date.setUTCMonth(origin.getUTCMonth()+i);boundaries.push(date.toISOString().slice(0,10));}}
    else {const step=c.days>30?7:1;for(let i=step;i<c.days;i+=step)boundaries.push(day(c.start,i));}
    boundaries.push(endExclusive);
    const source=d[state.metric], prior=d.previous[state.metric];
    const weights=boundaries.slice(0,-1).map((start,i)=>({wave:1+Math.sin(i*1.8)*.17+Math.cos(i*.7)*.09,days:Math.round((Date.parse(boundaries[i+1])-Date.parse(start))/DAY)}));
    const countDivisor=weights.reduce((sum,row)=>sum+row.wave*row.days,0);
    const base=source==null?null:source/(state.metric==='members'||state.metric==='pwa'?Math.max(3,c.days/10):countDivisor);
    return boundaries.slice(0,-1).map((start,i)=>{
      const finish=day(boundaries[i+1],-1),days=Math.round((Date.parse(boundaries[i+1])-Date.parse(start))/DAY);
      const unavailable=state.scenario==='early'&&finish<'2026-10-05';
      const partial=(state.scenario==='gap'&&start<='2026-10-12'&&finish>='2026-10-12')||(state.scenario==='early'&&start<'2026-10-05'&&finish>='2026-10-05');
      const wave=1+Math.sin(i*1.8)*.17+Math.cos(i*.7)*.09;
      const raw=base==null?null:Math.max(0,base*wave);
      return {start,end:finish,days,value:unavailable||partial?null:raw,prior:c.priorComplete&&state.compare&&raw!=null?(source?raw*prior/source:0):null,status:source==null?'필터 미지원':unavailable?'미가용':partial?'부분 관측':'관측 가능'};
    });
  }
  function drawChart(c,d) {
    const svg=$('trend-chart');if(!svg)return;
    const rows=chartRows(c,d),metricLabels={members:'활성 회원 · 명/일',sessions:'이용 세션 · 개/일',grading:'채점 완료 · 회/일',results:'결과 조회 세션 · 개/일',pwa:'PWA 회원 · 명/일',confirmations:'신규 확인 · 명/일'};
    const range=$('chart-point');range.max=String(rows.length-1);range.value=String(Math.floor(rows.length/2));
    $('chart-table').innerHTML=table(['구간 · KST','일수','현재 일평균','직전 일평균','관측 상태'],rows.map(r=>[`${dateLabel(r.start).slice(5)} ~ ${dateLabel(r.end).slice(5)}`,r.days,fmt(r.value),fmt(r.prior),badge(r.status,r.status==='관측 가능'?'gray':'amber')]),'추이 구간별 정확한 값');
    const draw=()=>{
      const width=Math.max(220,svg.getBoundingClientRect().width),height=225,left=48,right=12,top=28,bottom=38,plotW=width-left-right,plotH=height-top-bottom;
      const all=rows.flatMap(r=>[r.value,r.prior]).filter(v=>v!=null);const maximum=Math.max(1,...all)*1.2;
      const x=i=>left+plotW*(rows.length===1?.5:i/(rows.length-1));const y=v=>top+plotH*(1-v/maximum);
      const makePath=key=>{let p='',connected=false;rows.forEach((r,i)=>{if(r[key]==null){connected=false;return;}p+=`${connected?'L':'M'}${x(i).toFixed(2)},${y(r[key]).toFixed(2)} `;connected=true;});return p;};
      let markup=`<title>${metricLabels[state.metric]}의 현재·직전 구간 추이</title><text x="${left}" y="13">${metricLabels[state.metric]}</text>`;
      for(let i=0;i<4;i++){const v=maximum*i/3,yy=y(v);markup+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#e9eef5"/><text x="${left-8}" y="${yy+4}" text-anchor="end">${fmt(v)}</text>`;}
      const ticks=[...new Set([0,Math.round((rows.length-1)/3),Math.round((rows.length-1)*2/3),rows.length-1])];
      for(const i of ticks)markup+=`<text x="${x(i)}" y="${height-18}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${rows[i].start.slice(5).replace('-','.')}</text>`;
      markup+=`<text x="${width-right}" y="${height-2}" text-anchor="end">구간 · KST</text><path d="${makePath('prior')}" fill="none" stroke="#a7b6cc" stroke-width="1.7" stroke-dasharray="5 5"/><path d="${makePath('value')}" fill="none" stroke="#2458bd" stroke-width="2.3"/>`;
      rows.forEach((r,i)=>{if(r.value!=null)markup+=`<circle cx="${x(i)}" cy="${y(r.value)}" r="2.5" fill="#2458bd"/>`;else markup+=`<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${top+plotH}" stroke="#d7ad68" stroke-dasharray="3 5" opacity=".65"/>`;});
      markup+=`<line id="chart-guide" x1="0" x2="0" y1="${top}" y2="${top+plotH}" stroke="#8ba8dd" visibility="hidden"/><rect id="chart-hover" x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="transparent"/>`;
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.innerHTML=markup;
      const inspect=i=>{const r=rows[i];range.value=String(i);$('chart-value').textContent=`${r.start.slice(5).replace('-','.')} ~ ${r.end.slice(5).replace('-','.')} · 현재 ${fmt(r.value)}${state.compare?' / 직전 '+fmt(r.prior):''} · ${r.status}`;const guide=$('chart-guide');guide.setAttribute('x1',String(x(i)));guide.setAttribute('x2',String(x(i)));guide.setAttribute('visibility','visible');};
      $('chart-hover').addEventListener('pointermove',event=>{const rect=svg.getBoundingClientRect();const xx=(event.clientX-rect.left)/rect.width*width;inspect(Math.max(0,Math.min(rows.length-1,Math.round((xx-left)/plotW*(rows.length-1)))));});
      $('chart-hover').addEventListener('pointerdown',event=>{const rect=svg.getBoundingClientRect();const xx=(event.clientX-rect.left)/rect.width*width;inspect(Math.max(0,Math.min(rows.length-1,Math.round((xx-left)/plotW*(rows.length-1)))));});
      range.oninput=()=>inspect(Number(range.value));inspect(Number(range.value));
    };
    chartObserver=new ResizeObserver(draw);chartObserver.observe(svg);draw();
  }
  function navigate(tab) {
    if(!Object.hasOwn(tabNames,tab))return;state.tab=tab;render();
  }
  function render(message='') {
    if(chartObserver){chartObserver.disconnect();chartObserver=null;}
    const c=context(),d=data(c);
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-selected',String(el.dataset.tab===state.tab));el.tabIndex=el.dataset.tab===state.tab?0:-1;});
    document.querySelectorAll('[data-range]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.range===state.range)));
    $('scenario').value=state.scenario;$('scenario-caption').textContent=captions[state.scenario];$('channel').value=state.channel;$('compare').checked=state.compare;
    $('period-label').textContent=`${dateLabel(c.start)} — ${dateLabel(c.end)} · 완료된 ${c.days}일`;
    $('period-note').textContent=state.compare?`비교 ${dateLabel(day(c.start,-c.days))} — ${dateLabel(day(c.start,-1))}`:'직전 기간 비교 안 함';
    $('panel').setAttribute('aria-labelledby','tab-'+state.tab);
    const blocked=['error','denied'].includes(state.scenario);
    if(blocked){state.member=null;state.query='';$('panel').innerHTML=`<section class="empty-state" role="${state.scenario==='error'?'alert':'status'}"><div class="empty-symbol">${state.scenario==='error'?'!':'○'}</div><h2>${state.scenario==='error'?'통계를 불러오지 못했습니다':'관리자 권한을 다시 확인해주세요'}</h2><p>${state.scenario==='error'?'조회 오류로 현재 값을 확인할 수 없습니다. 이전 수치를 현재 값이나 0건으로 대신 표시하지 않습니다.':'권한 만료로 통계·회원 정보·선택 상태를 제거했습니다. 관리자 인가 전까지 자료를 제공하지 않습니다.'}</p><button class="button" type="button" data-retry>${state.scenario==='error'?'예시 재시도':'정상 권한 예시로 돌아가기'}</button></section>`;}
    else {$('panel').innerHTML=({overview,features,grading,members,activity,pwa,access}[state.tab])(c,d);drawChart(c,d);updateMemberList();updateAudit();}
    $('live-status').textContent=message||`${tabNames[state.tab]} · ${c.days}일 · ${captions[state.scenario]}`;
    window.__analyticsPreviewReady=true;
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('button');if(!el)return;
    if(el.hasAttribute('data-tab'))return navigate(el.dataset.tab);
    if(el.hasAttribute('data-tab-target')){navigate(el.dataset.tabTarget);$('panel').scrollIntoView({block:'start'});return;}
    if(el.hasAttribute('data-range')){state.range=el.dataset.range;render();return;}
    if(el.hasAttribute('data-range-target')){state.range=el.dataset.rangeTarget;render();return;}
    if(el.hasAttribute('data-metric')){state.metric=el.dataset.metric;render();return;}
    if(el.hasAttribute('data-feature')){state.feature=el.dataset.feature;render();return;}
    if(el.hasAttribute('data-funnel')){state.funnel=el.dataset.funnel;render();return;}
    if(el.hasAttribute('data-reset-subject')){state.subjects='all';render();return;}
    if(el.hasAttribute('data-reset-channel')){state.channel='all';render();return;}
    if(el.hasAttribute('data-quality-open')){const details=$('quality-details');if(details){details.open=true;details.scrollIntoView({block:'center'});}return;}
    if(el.hasAttribute('data-member-key')){state.member=Number(el.dataset.memberKey);state.query='';navigate('activity');$('panel').scrollIntoView({block:'start'});return;}
    if(el.hasAttribute('data-member-select')){state.member=Number(el.dataset.memberSelect);const top=window.scrollY;render();window.scrollTo(0,top);return;}
    if(el.hasAttribute('data-member-clear')){state.member=null;render();return;}
    if(el.hasAttribute('data-retry')){state.scenario='ready';render('가상 재시도 완료 · 정상 예시를 표시합니다.');return;}
  });
  document.addEventListener('change',event=>{
    switch(event.target.id){
      case 'scenario':state.scenario=event.target.value;state.member=null;state.query='';break;
      case 'channel':state.channel=event.target.value;state.member=null;break;
      case 'compare':state.compare=event.target.checked;break;
      case 'chart-metric':state.metric=event.target.value;break;
      case 'surface':state.surface=event.target.value;if(state.surface==='past'||(state.surface==='example'&&['edit','note'].includes(state.feature)))state.feature='distribution';break;
      case 'subjects':state.subjects=event.target.value;break;
      case 'audit-kind':updateAudit(event.target.value);return;
      default:return;
    }render();
  });
  document.addEventListener('input',event=>{if(event.target.id==='member-query'){state.query=event.target.value;updateMemberList();}});
  document.querySelector('.tabs').addEventListener('keydown',event=>{
    const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(event.target);if(index<0)return;
    let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
    event.preventDefault();navigate(tabs[next].dataset.tab);tabs[next].focus();
  });
  $('definitions-button').addEventListener('click',()=>$('definitions-dialog').showModal());
  $('close-definitions').addEventListener('click',()=>$('definitions-dialog').close());
  $('definitions-dialog').addEventListener('click',event=>{if(event.target===$('definitions-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
  $('reset-button').addEventListener('click',()=>{state.range='7d';state.channel='all';state.compare=true;state.subjects='all';render('조회 조건을 초기화했습니다.');});
  $('refresh-button').addEventListener('click',()=>{state.revision++;render(`가상 자료 새로고침 ${state.revision}회 · 운영 서버 요청은 없습니다.`);});
  render();
})();
