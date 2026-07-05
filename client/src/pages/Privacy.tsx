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
            <p className="text-muted-foreground">
              A+ Mate(이하 “서비스”)는 「개인정보 보호법」 등 관련 법령을 준수하며, 아래와 같이 개인정보를
              수집·이용·보관합니다. 본 방침은 정식 서비스 전 검토를 거쳐 확정될 예정인 초안입니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">1. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                필수: 이름, 학교, 학과, 학년, 구글 계정 이메일 및 계정 식별자(로그인·본인 식별용)
              </li>
              <li>선택: 카카오 오픈채팅 URL, 스킬 태그</li>
              <li>활동 기록: 수강 등록 수업, 매칭·팀·블라인드 동료평가 내역</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              선택 항목은 입력하지 않아도 서비스의 기본 이용에 제한이 없습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">2. 수집·이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>같은 수업을 듣는 팀원 매칭 및 팀 활동 지원</li>
              <li>블라인드 동료평가 및 이를 바탕으로 한 신뢰 배지 산정</li>
              <li>서비스 운영, 문의 대응, 부정 이용 방지</li>
            </ul>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">3. 제3자 제공 및 공개</h2>
            <p className="text-muted-foreground">
              서비스는 이용자의 개인정보를 외부 제3자에게 제공하지 않습니다. 다만 서비스 이용 특성상,
              매칭을 <strong>수락한 이후에만</strong> 같은 팀원에게 이름과 카카오 오픈채팅 링크가 서비스 내에서
              공개됩니다. 매칭 수락 전 단계에서는 이름이 공개되지 않습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">4. 운영자 및 담당 교수의 데이터 접근</h2>
            <p className="text-muted-foreground">
              서비스 운영자와 수업 담당 교수는 서비스 운영·수업 관리 목적의 범위 내에서 이용자의 실명 및
              수강생 명단을 열람할 수 있습니다. 해당 목적을 벗어난 열람·이용은 하지 않습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">5. 보유 및 이용 기간</h2>
            <p className="text-muted-foreground">
              수집한 개인정보는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령상 보존 의무가 있는 경우에는
              해당 법령에서 정한 기간 동안 보관한 뒤 파기합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">6. 정보주체의 권리와 행사 방법</h2>
            <p className="text-muted-foreground">
              이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다. 개인정보
              처리에 대한 동의 철회는 회원 탈퇴 또는 아래 보호책임자에게 문의하여 하실 수 있으며, 요청 시
              지체 없이 처리합니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">7. 개인정보 보호책임자</h2>
            <p className="text-muted-foreground">
              A+ Mate 운영자 ·{" "}
              <a href="mailto:jayjun.rim@gmail.com" className="text-primary underline">
                jayjun.rim@gmail.com
              </a>
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-base mb-2">8. 처리방침의 개정</h2>
            <p className="text-muted-foreground">
              본 개인정보처리방침이 변경되는 경우, 변경 사항과 시행일을 서비스 내 공지 등을 통해 사전에
              안내합니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
