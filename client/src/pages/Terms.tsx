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
            <h2 className="font-semibold text-base mb-2">제1조 (목적)</h2>
            <p className="text-muted-foreground">
              본 약관은 A+ Mate(이하 “서비스”)가 제공하는 학내 팀플 매칭·평가 기능의 이용 조건을 정합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제2조 (이용자의 의무)</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>가입·프로필 정보를 사실대로 입력합니다(허위 학교·수강 정보 입력 금지).</li>
              <li>타인을 사칭하거나 매칭·평가 기능을 악용하지 않습니다.</li>
              <li>외부 연락(오픈채팅 등)에서 불법·기만 행위를 하지 않습니다.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제3조 (평가와 배지)</h2>
            <p className="text-muted-foreground">
              팀플 종료 후 블라인드 동료 평가가 이루어지며, 누적 평가가 신뢰 배지로 환산됩니다.
              보복성·허위 평가는 제한될 수 있으며, 부당한 평가는 운영자에게 이의제기할 수 있습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제4조 (면책)</h2>
            <p className="text-muted-foreground">
              서비스는 매칭된 팀원 간의 외부 활동·분쟁에 대해 직접 당사자가 아니며, 관련 책임을 부담하지 않습니다.
              다만 신고 접수 시 합리적 범위에서 조치합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">제5조 (문의)</h2>
            <p className="text-muted-foreground">
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
