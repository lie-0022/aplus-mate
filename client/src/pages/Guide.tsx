import { useLocation } from "wouter";
import {
  BookOpen,
  Star,
  Users,
  Handshake,
  Award,
  BadgeCheck,
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Smartphone,
  Share,
  MoreVertical,
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
    icon: CalendarDays,
    title: "3. 내 시간표 채우기",
    body: "수업을 등록하면 시간표가 자동으로 그려져요. 알바·동아리 같은 개인 일정도 직접 추가해두면, 팀원을 찾을 때 '나와 공강이 겹치는 시간'이 자동으로 계산돼요.",
    action: { label: "내 시간표 보기", path: "/timetable" },
  },
  {
    icon: Users,
    title: "4. 팀원 찾기",
    body: "수업 상세의 '팀원 찾기' 탭에서 모집공고를 올리거나, 이미 올라온 공고에 지원해요. 공고에는 모집자와 나의 공통 공강이 함께 보여서 시간 맞는 팀을 고르기 쉬워요. 스터디·멘토멘티는 같은 과목이면 다른 분반의 공고에도 지원할 수 있어요.",
  },
  {
    icon: Handshake,
    title: "5. 매칭 — 커넥트",
    body: "지원하면 상대가 수락할지 정해요. 수락되기 전까지는 이름이 공개되지 않고, 수락된 뒤에만 서로의 이름과 카카오 오픈채팅 링크가 공개돼요. 안전하게 팀을 꾸릴 수 있어요.",
    action: { label: "내 매칭 보기", path: "/matching/requests" },
  },
  {
    icon: Award,
    title: "6. 팀 활동과 평가·배지",
    body: "팀이 만들어지면 팀 페이지에서 함께 진행해요. 활동이 끝나면 블라인드 동료평가를 하고, 그 결과로 신뢰 배지가 쌓여 다음 팀원 찾기에서 나를 더 믿을 수 있게 해줘요.",
    action: { label: "내 팀 보기", path: "/teams" },
  },
  {
    icon: BadgeCheck,
    title: "7. 교수님 승인 (교수 인증 수업)",
    body: "교수님이 함께 보는 수업이라면, 여기서 미리 꾸린 팀이 교수님 팀 현황에 그대로 표시되고 승인을 받을 수 있어요. 승인받은 팀에는 '교수님 승인' 표시가 붙어요.",
  },
];

export default function Guide() {
  const [, setLocation] = useLocation();
  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => (window.history.length > 1 ? window.history.back() : setLocation("/settings"))}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 뒤로
      </button>
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

      {/* 앱으로 설치 — PWA. 스토어 없이 홈 화면에 아이콘·전체화면으로. */}
      <div className="mt-6 rounded-[18px] bg-card shadow-card p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[15px]">앱으로 설치하기</div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
              홈 화면에 추가하면 앱처럼 전체화면으로 열려요. 설치는 무료예요.
            </p>
            <div className="mt-2.5 space-y-2 text-[13px]">
              <div className="rounded-xl bg-muted p-3">
                <div className="font-bold mb-0.5">아이폰 (사파리)</div>
                <p className="text-muted-foreground leading-relaxed">
                  하단 <Share className="inline h-3.5 w-3.5 align-text-bottom" /> 공유 버튼 → "홈
                  화면에 추가" → 추가
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <div className="font-bold mb-0.5">안드로이드 (크롬)</div>
                <p className="text-muted-foreground leading-relaxed">
                  우측 상단 <MoreVertical className="inline h-3.5 w-3.5 align-text-bottom" /> 메뉴 →
                  "홈 화면에 추가" 또는 "앱 설치"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 notice-soft rounded-[18px] p-4 text-[13px] leading-relaxed">
        <span className="font-bold">안전하게 이용하세요.</span> 매칭 수락 전에는 실명이
        공개되지 않아요. 외부 오픈채팅에서 금융정보·송금을 요구받으면 응하지 말고, 설정의
        문의·지원으로 알려주세요.
      </div>
    </div>
  );
}
