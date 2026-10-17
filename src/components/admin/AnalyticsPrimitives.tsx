import { useRef, type ReactNode } from 'react';
import type { ObservationRate } from '../../../supabase/functions/_shared/analytics-insights';
import { number, percent } from '../../utils/analyticsFormat';
export function Badge({children,tone='gray'}:{children:ReactNode;tone?:string}) { return <span className={`status ${tone}`}>{children}</span>; }
export function Panel({title,description,extra,children}:{title:string;description?:string;extra?:ReactNode;children:ReactNode}) {return <section className="panel"><div className="panel-header"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{extra}</div>{children}</section>;}
export function Notice({children,warn=false}:{children:ReactNode;warn?:boolean}) {return <p className={`notice${warn?' warn':''}`}>{children}</p>;}
export function DataTable({headings,rows,label}:{headings:string[];rows:ReactNode[][];label?:string}) {return <div className="table-wrap"><table aria-label={label||headings.join(' · ')}><thead><tr>{headings.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} className={j?'num':undefined}>{cell}</td>)}</tr>):<tr><td colSpan={headings.length}>선택 조건에 맞는 관측 자료가 없습니다.</td></tr>}</tbody></table></div>;}
export function Rate({value}:{value:ObservationRate}) {if(value.status==='unsupported')return <Badge tone="amber">필터 미지원</Badge>;return <>{value.denominator?percent(value.numerator,value.denominator):<Badge tone={value.immature?'gray':'amber'}>{value.immature?'관찰 중':value.excluded?'관측 공백':'미계산'}</Badge>}<small>{number(value.numerator)} / {number(value.denominator)}명{value.excluded?` · 제외 ${number(value.excluded)}명`:''}{value.immature?` · 관찰 중 ${number(value.immature)}명`:''}</small></>;}
export function MetricDefinitions() {
  const dialog=useRef<HTMLDialogElement>(null);
  return <><button className="button secondary" type="button" onClick={()=>dialog.current?.showModal()}>지표 정의</button><dialog ref={dialog} aria-labelledby="analytics-definitions"><div className="dialog-heading"><div><p className="eyebrow">METRIC GUIDE</p><h2 id="analytics-definitions">숫자를 읽는 기준</h2></div><button className="button secondary" type="button" onClick={()=>dialog.current?.close()}>닫기</button></div><div className="definition-list">{[
    ['회원 · 세션 · 실행','회원은 기간 내 고유 계정입니다. 비회원은 세션 기준이며 회원 수와 합쳐 전체 사람 수로 표시하지 않습니다. 두 과목 동시 채점은 실행 1회, 저장 대상은 최대 2개입니다.'],
    ['카드와 그래프','카드는 기간 전체 고유 수이고 그래프는 구간 일평균입니다. 일별 회원 수를 더해 기간 회원 수로 사용하지 않습니다.'],
    ['D7과 W1','D7은 최초 핵심 이용일의 정확히 7일 뒤, W1은 D+7~D+13입니다. 관찰 기간이 완료되고 해당 구간 자료가 가용한 표본만 분모입니다.'],
    ['기능 사용률','사용 가능 상태와 실제 노출을 모두 관측한 화면 진입이 분모입니다. 노출 미관측 실행은 별도 표시합니다.'],
    ['채점 후 복습','예시 결과와 빈 이력은 제외합니다. 반복 이용은 실제 읽기·학습 완료나 성적 향상의 증거가 아닙니다.'],
    ['자료 상태와 시간','정상 0건·수집 전·관측 공백·미성숙·필터 미지원·조회 오류를 구분합니다. 대기시간은 단조 시계 기반 측정이며 서버 수신 간격이 아닙니다.'],
  ].map(([title,copy])=><article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></dialog></>;
}
