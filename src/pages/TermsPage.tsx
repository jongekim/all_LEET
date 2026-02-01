import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">뒤로</span>
          </button>
          <div className="flex items-center gap-2 ml-auto text-gray-900">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">이용약관</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">이용약관</h1>
            <p className="text-sm text-gray-600">시행일: 2026.02.01.</p>
          </div>

          <article className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">제1장 총칙</h2>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제1조(목적)</h3>
              <p>
                이 약관은 all LEET(이하 “회사”)가 제공하는 LEET 채점, 성적 기록 관리, 지원 가능성 분석,
                사설 모의고사 기록 및 관련 온라인 서비스(이하 “서비스”)의 이용 조건과 회사 및 이용자의 권리·의무
                및 책임 사항 등을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제2조(정의)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>“서비스”란 회사가 제공하는 LEET 채점, 성적 기록 관리, 지원 가능성 분석, 사설 모의고사 기록 및 이에 부수하는 온라인 서비스를 말합니다.</li>
                <li>“이용자”란 서비스에 접속하여 이 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
                <li>“회원”이란 회사와 이용계약을 체결하고 계정을 부여받은 이용자를 말합니다.</li>
                <li>“비회원”이란 회원이 아닌 이용자를 말합니다.</li>
                <li>“계정”이란 회원을 식별하기 위한 이메일/아이디 및 비밀번호 등의 조합을 말합니다.</li>
                <li>“콘텐츠”란 서비스에서 제공되는 정보, 결과 화면, 분석 자료 등 일체를 말합니다.</li>
                <li>“입력 데이터”란 이용자가 서비스에 입력·저장하는 답안, 점수, 시험일 등의 정보를 말합니다.</li>
                <li>“유료서비스”란 유료 결제가 필요한 기능 또는 서비스를 말합니다.</li>
                <li>“광고”란 서비스 화면, 푸시·이메일·문자 등으로 노출되는 영리 목적의 광고성 정보 또는 홍보 메시지를 말합니다.</li>
                <li>“맞춤형 광고”란 이용자의 이용 이력, 쿠키, 광고 식별자 등 정보를 활용하여 개인에게 최적화된 광고를 제공하는 것을 말합니다.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제3조(약관의 변경)</h3>
              <p>회사는 관련 법령을 위반하지 않는 범위에서 이 약관을 변경할 수 있습니다.</p>
              <p>변경 시 시행일, 변경사유를 명시하여 서비스 내 공지 및 회원 전자우편 등으로 고지합니다.</p>
              <p>회원에게 불리한 변경은 시행일 30일 전, 그 밖의 변경은 7일 전부터 공지합니다.</p>
              <p>공지 기간 내 거절 의사 표시가 없으면 동의한 것으로 봅니다.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">제2장 서비스 이용계약 및 개인정보보호</h2>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제4조(이용계약의 성립)</h3>
              <p>이용자가 회원가입 절차를 완료하고 회사가 승낙한 시점에 이용계약이 성립합니다.</p>
              <p>허위 정보 제공, 타인 정보 도용 등 부정한 가입 요청은 승낙하지 않거나 유보할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제5조(미성년자 이용 제한)</h3>
              <p>만 14세 미만은 회원가입 및 서비스 이용이 제한됩니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제6조(계정 및 비밀번호 관리)</h3>
              <p>회원은 계정과 비밀번호를 선량한 관리자의 주의로 관리하며 제3자에게 이용을 허락할 수 없습니다.</p>
              <p>도용 또는 부정 사용을 인지한 경우 즉시 회사에 통지하고 회사의 안내에 따라야 합니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제7조(회원에 대한 통지)</h3>
              <p>회사는 회원이 지정한 전자우편 주소로 통지합니다.</p>
              <p>전체 공지는 서비스 내 게시 또는 공지사항으로 갈음할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제8조(서비스 이용시간 및 중단)</h3>
              <p>회사는 원칙적으로 연중무휴 24시간 서비스를 제공합니다.</p>
              <p>시스템 점검, 장애, 운영상 필요가 있는 경우 서비스 이용을 일시 중단할 수 있습니다.</p>
              <p>중단 시 사전 공지를 원칙으로 하되 긴급 사유가 있으면 사후 공지할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제9조(서비스의 변경)</h3>
              <p>회사는 운영상·기술상 필요에 따라 서비스의 일부 또는 전부를 변경할 수 있으며, 변경 내용은 사전 고지합니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제10조(회원탈퇴 및 이용 제한)</h3>
              <p>회원은 언제든지 탈퇴를 요청할 수 있고 회사는 지체 없이 처리합니다.</p>
              <p>약관 위반, 부정 이용, 법령 위반 등의 경우 회사는 이용 제한 또는 계약 해지를 할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제11조(개인정보보호)</h3>
              <p>개인정보의 수집·이용·보관·파기에 관한 사항은 개인정보처리방침에 따릅니다.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">제3장 서비스 제공 및 유료서비스</h2>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제12조(서비스 제공)</h3>
              <p>회사는 이용자가 입력한 정보를 기반으로 채점·분석·기록·조회 등 서비스를 제공합니다.</p>
              <p>이용자는 입력 데이터의 정확성을 보장하며, 잘못된 입력으로 인한 결과는 이용자 책임입니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제13조(유료서비스)</h3>
              <p>회사는 현재 유료서비스를 제공하지 않습니다.</p>
              <p>향후 유료서비스 도입 시 가격, 결제, 환불, 이용기간 등을 사전 고지하고 이용자의 동의를 받습니다.</p>
              <p>유료서비스 관련 환불 및 청약철회는 관련 법령 및 별도 정책에 따릅니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제14조(광고 정보의 제공)</h3>
              <p>회사는 서비스 운영 및 수익화를 위해 서비스 화면 내에 광고를 게재할 수 있습니다.</p>
              <p>회사는 법령에 따라 사전 동의를 받은 이용자에게 전자우편·문자 등의 방법으로 광고성 정보를 전송할 수 있습니다.</p>
              <p>맞춤형 광고 제공을 위해 쿠키, 광고식별자 등을 사용할 수 있으며, 이용자는 개인정보처리방침에 따라 거부할 수 있습니다.</p>
              <p>이용자가 광고 수신 또는 맞춤형 광고를 거부하더라도 서비스의 기본 기능 이용에는 제한이 없습니다. 다만, 일부 개인화 기능에 제한이 있을 수 있으며, 이 경우 사전에 고지합니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제15조(광고의 게재 및 책임)</h3>
              <p>서비스에 게재되는 광고의 내용과 거래는 광고주와 이용자 간의 책임입니다.</p>
              <p>회사는 광고의 적법성에 대한 합리적 검토를 하되, 회사의 고의 또는 중대한 과실이 없는 한 광고로 인한 손해에 책임을 지지 않습니다.</p>
              <p>회사는 불법·부정 광고에 대해 사전 통지 없이 삭제 또는 노출 제한할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">제4장 권리·의무 및 책임</h2>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제16조(저작권 및 입력 데이터)</h3>
              <p>서비스 및 콘텐츠에 대한 저작권 등 지식재산권은 회사에 귀속됩니다.</p>
              <p>이용자는 회사의 사전 승낙 없이 콘텐츠를 복제·전송·배포할 수 없습니다(법령상 허용 제외).</p>
              <p>이용자는 입력 데이터의 권리를 보유하며, 회사는 서비스 제공·운영·품질 개선·통계 분석을 위해 비독점적 이용권을 가집니다.</p>
              <p>회사는 입력 데이터를 개인정보처리방침에 따라 처리합니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제17조(금지행위)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>타인의 정보 도용 및 부정 이용</li>
                <li>서비스 운영을 방해하는 행위</li>
                <li>법령 또는 공서양속에 반하는 행위</li>
                <li>불법 정보의 게시 및 유포</li>
                <li>기타 회사가 부적절하다고 판단하는 행위</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제18조(서비스 결과의 성격)</h3>
              <p>채점·분석·지원 가능성 결과는 참고용이며, 회사는 결과의 정확성 또는 적합성을 보증하지 않습니다.</p>
              <p>이용자는 본인의 판단과 책임 하에 서비스를 활용합니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제19조(책임의 제한)</h3>
              <p>회사는 천재지변, 통신 장애, 제3자의 불법행위 등 합리적 통제 범위를 벗어난 사유로 인한 손해에 책임을 지지 않습니다.</p>
              <p>무료 서비스 제공과 관련하여 법령이 허용하는 범위에서 책임을 제한할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">제5장 분쟁해결 및 관할</h2>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제20조(분쟁해결)</h3>
              <p>회사와 이용자 간 분쟁이 발생한 경우 상호 협의하여 해결합니다.</p>
              <p>협의가 되지 않는 경우 관련 법령에 따른 분쟁조정기관의 조정을 신청할 수 있습니다.</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">제21조(재판관할)</h3>
              <p>서비스 이용과 관련하여 발생한 분쟁에 대한 소는 민사소송법상 관할 법원에 제기합니다.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900">부칙</h2>
              <p>제1조 본 약관은 2026.02.01.부터 시행됩니다.</p>
            </section>
          </article>

          <div className="pt-2">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
