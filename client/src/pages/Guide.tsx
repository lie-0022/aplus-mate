import { useLocation } from "wouter";
import {
  BookOpen,
  Star,
  Users,
  Handshake,
  Award,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";

// A+ Mate 사용법 — 처음 온 학생이 "무엇을, 어떤 순서로" 하는지 한 화면에서 이해하게.
const STEPS = [
  {
    icon: BookOpen,
    title: "1. 수업에 참여하기",
    body: "교수님이 알려준 수업 코드를 입력하거나, 수업 검색에서 찾아 등록해요. 등록하면 같은 수업 학생들과 연결될 수 있어요.",
    action: { label: "수업으로 가기", path: "/courses" },
  },
  {
    icon: Star,
    title: "2. 수업 리뷰 남기고 확인하기",
    body: "이 수업에 팀플이 있었는지, 보통 몇 명이서 하는지, 어떤 유형인지, 미리 짠 팀을 교수님이 허용하는지 — 수강생들이 남긴 정보로 미리 파악하고, 나도 남겨서 다음 사람을 도와줘요.",
  },
  {
    icon: Users,
    title: "3. 팀원 찾기",
    body: "수업 상세의 '팀원 찾기' 탭에서 모집공고를 올리거나, 이미 올라온 공고에 지원해요. 카드에 '지금 N팀이 팀원 구하는 중' 신호가 뜨면 활발히 모집 중이라는 뜻이에요.",
  },
  {
    icon: Handshake,
    title: "4. 매칭 — 커넥트",
    body: "지원하면 상대가 수락할지 정해요. 수락되기 전까지는 이름이 공개되지 않고, 수락된 뒤에만 서로의 이름과 카카오 오픈채팅 링크가 공개돼요. 안전하게 팀을 꾸릴 수 있어요.",
    action: { label: "내 매칭 보기", path: "/matching/requests" },
  },
  {
    icon: Award,
    title: "5. 팀 활동과 평가·배지",
    body: "팀이 만들어지면 팀 페이지에서 함께 진행해요. 활동이 끝나면 블라인드 동료평가를 하고, 그 결과로 신뢰 배지가 쌓여 다음 팀원 찾기에서 나를 더 믿을 수 있게 해줘요.",
    action: { label: "내 팀 보기", path: "/teams" },
  },
  {
    icon: BadgeCheck,
    title: "6. 교수님 승인 (교수 인증 수업)",
    body: "교수님이 함께 보는 수업이라면, 여기서 미리 꾸린 팀이 교수님 팀 현황에 그대로 표시되고 승인을 받을 수 있어요. 승인받은 팀에는 '교수님 승인' 표시가 붙어요.",
  },
];

export default function Guide() {
  const [, setLocation] = useLocation();
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">A+ Mate 사용법</h1>
        <p className="text-muted-foreground text-sm mt-1">
          수업에서 마음 맞는 팀원을 찾고, 함께 A+ 받는 흐름을 소개해요.
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step) => (
          <div key={step.title} className="rounded-[18px] bg-card shadow-card p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[15px]">{step.title}</div>
                <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
                  {step.body}
                </p>
                {step.action && (
                  <button
                    onClick={() => setLocation(step.action!.path)}
                    className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline"
                  >
                    {step.action.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 notice-soft rounded-[18px] p-4 text-[13px] leading-relaxed">
        <span className="font-bold">안전하게 이용하세요.</span> 매칭 수락 전에는 실명이
        공개되지 않아요. 외부 오픈채팅에서 금융정보·송금을 요구받으면 응하지 말고, 설정의
        문의·지원으로 알려주세요.
      </div>
    </div>
  );
}
