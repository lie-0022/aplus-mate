import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

// ⚠️ 초안 — 정식 서비스 전 법률 검토/확정 필요. 운영자 정보·보유기간 등은 실제 값으로 교체.
export default function Privacy() {
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

        <h1 className="text-2xl font-bold mb-1">개인정보처리방침</h1>
        <p className="text-xs text-muted-foreground mb-6">
          버전 2026.1 · <span className="text-amber-600">초안(베타) — 정식 검토 예정</span>
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-semibold text-base mb-2">1. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>필수: 이름, 학교, 학과, 학년, 로그인 식별자(소셜·이메일)</li>
              <li>선택: 스킬 태그, 카카오 오픈채팅 URL</li>
              <li>활동 기록: 수강 등록 수업, 매칭/팀/평가 내역</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">2. 수집·이용 목적</h2>
            <p className="text-muted-foreground">
              같은 수업 팀원 매칭, 블라인드 동료 평가 및 신뢰 배지 산정, 서비스 운영·문의 대응.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">3. 제3자 제공·공개</h2>
            <p className="text-muted-foreground">
              매칭 <strong>수락 이후에만</strong> 같은 팀원에게 이름과 카카오 오픈채팅 링크가 공개됩니다.
              매칭 전 단계에서는 이름이 공개되지 않습니다. 그 외 외부 제3자에게 제공하지 않습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">4. 보유·이용 기간</h2>
            <p className="text-muted-foreground">
              회원 탈퇴 또는 동의 철회 시 지체 없이 파기합니다. 관련 법령상 보존 의무가 있는 경우 해당 기간 동안 보관합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">5. 정보주체의 권리</h2>
            <p className="text-muted-foreground">
              열람·정정·삭제·처리정지를 요청할 수 있으며, 아래 보호책임자에게 문의하면 지체 없이 처리합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">6. 개인정보 보호책임자</h2>
            <p className="text-muted-foreground">
              A+ Mate 운영자 ·{" "}
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
