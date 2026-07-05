import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

// ⚠️ 초안 — 정식 서비스 전 법률 검토/확정 필요.
export default function Terms() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> 뒤로
        </button>

        <h1 className="text-2xl font-bold mb-1">이용약관</h1>
        <p className="text-xs text-muted-foreground mb-6">
          버전 2026.1 · <span className="text-amber-600">초안(베타) — 정식 검토 예정</span>
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <p className="text-muted-foreground">
              본 약관은 정식 서비스 전 검토를 거쳐 확정될 예정인 초안이며, 법률 자문을 대체하지 않습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제1조 (목적)</h2>
            <p className="text-muted-foreground">
              본 약관은 A+ Mate(이하 “서비스”)가 제공하는 학내 팀플 매칭·팀 활동·블라인드 동료평가 기능의
              이용 조건과 서비스와 이용자 간의 권리·의무를 정하는 것을 목적으로 합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제2조 (서비스의 내용)</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>같은 수업을 듣는 이용자 간의 팀원 매칭 및 팀 구성 지원</li>
              <li>팀플 종료 후 블라인드 동료평가 및 신뢰 배지 산정</li>
              <li>매칭 수락 이후 팀원 간 연락을 위한 카카오 오픈채팅 링크 공개</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제3조 (이용자의 의무)</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>가입·프로필 정보를 사실대로 입력합니다(허위 학교·수강 정보 입력 금지).</li>
              <li>타인을 사칭하거나 매칭·평가 기능을 악용하지 않습니다.</li>
              <li>외부 연락(오픈채팅 등)에서 불법·기만·비방 행위를 하지 않습니다.</li>
              <li>본인의 로그인 계정을 타인과 공유하거나 양도하지 않습니다.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제4조 (블라인드 동료평가와 배지)</h2>
            <p className="text-muted-foreground">
              팀플 종료 후 블라인드 동료평가가 이루어지며, 평가 내용은 익명으로 처리되고 누적 평가가 신뢰
              배지로 환산됩니다. 보복성·허위 평가는 제한될 수 있으며, 부당한 평가를 받은 이용자는 운영자에게
              이의를 제기할 수 있습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제5조 (면책)</h2>
            <p className="text-muted-foreground">
              서비스는 매칭된 팀원 간의 외부 활동·연락·분쟁에 대해 직접 당사자가 아니며, 이에 대한 책임을
              부담하지 않습니다. 다만 신고가 접수되는 경우 합리적인 범위에서 필요한 조치를 취합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제6조 (문의)</h2>
            <p className="text-muted-foreground">
              약관 및 서비스 이용에 관한 문의는 아래로 연락해 주시기 바랍니다.
              <br />
              <a href="mailto:jayjun.rim@gmail.com" className="text-primary underline">
                jayjun.rim@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
