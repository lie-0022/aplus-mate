import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Users,
  Handshake,
  Plus,
  ArrowRight,
  GraduationCap,
  CalendarDays,
  Check,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { useLocation } from "wouter";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";

// D-day 계산 — TeamDetail과 동일 규칙(날짜 기준).
function dday(due: Date | string): { label: string; tone: "over" | "soon" | "normal" } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `D+${-diff}`, tone: "over" };
  if (diff <= 3) return { label: diff === 0 ? "D-DAY" : `D-${diff}`, tone: "soon" };
  return { label: `D-${diff}`, tone: "normal" };
}

// 온보딩 체크리스트의 한 단계 — 미완료면 클릭해 해당 화면으로 이동.
function OnboardStep({
  done,
  label,
  hint,
  onClick,
}: {
  done: boolean;
  label: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={!done ? onClick : undefined}
      disabled={done || !onClick}
      className="w-full flex items-center gap-2.5 text-left"
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"
        }`}
      >
        {done && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${done ? "text-muted-foreground line-through" : ""}`}>
          {label}
        </span>
        {!done && hint && <span className="block text-[13px] text-muted-foreground">{hint}</span>}
      </span>
      {!done && onClick && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </button>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.getData.useQuery();
  const upcoming = trpc.events.upcoming.useQuery();
  const sent = trpc.matching.sent.useQuery();
  const rec = trpc.dashboard.recommendedPeers.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-5 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-44 rounded-[20px]" />
        <Skeleton className="h-40 rounded-[18px]" />
      </div>
    );
  }

  const hasCourse = (data?.courses.length ?? 0) > 0;
  const hasConnected = (sent.data?.length ?? 0) > 0 || (data?.activeTeams ?? 0) > 0;
  const onboardingDone = hasCourse && hasConnected;
  const upcomingCount = upcoming.data?.length ?? 0;
  const peer = rec.data?.sample;

  const stats = [
    { key: "a", icon: BookOpen, label: "수강 과목", value: data?.courses.length ?? 0 },
    { key: "b", icon: Handshake, label: "대기 매칭", value: data?.pendingMatches ?? 0 },
    { key: "c", icon: Users, label: "진행 팀", value: data?.activeTeams ?? 0 },
  ] as const;

  return (
    <div className="space-y-5 mx-auto w-full max-w-[980px]">
      {/* Hero — 플래너 헤더 + 지표 3종 (전체 폭) */}
      <div className="rounded-[20px] bg-card shadow-card p-5">
        <p className="text-[13px] font-bold text-muted-foreground">
          {new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(
            new Date(),
          )}
        </p>
        <h1 className="text-2xl font-extrabold mt-1">반가워요, {user?.name || "학생"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {upcomingCount > 0
            ? `오늘 챙길 마감이 ${upcomingCount}개 있어요`
            : "오늘도 좋은 팀원을 만나보세요"}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {stats.map((s) => (
            <div key={s.key} className={`stat-${s.key} rounded-2xl p-3.5 text-center`}>
              <div className="stat-n text-2xl font-extrabold leading-none">{s.value}</div>
              <div className="stat-l text-xs font-bold mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 온보딩 체크리스트 — 완료 시 자동 숨김 (전체 폭) */}
      {!onboardingDone && (
        <div className="rounded-[18px] bg-secondary p-4 space-y-2.5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm text-foreground">시작하기</span>
          </div>
          <OnboardStep done label="프로필 완성" />
          <OnboardStep
            done={hasCourse}
            label="수업 등록하기"
            hint="같은 수업 학생과 매칭돼요"
            onClick={() => setLocation("/courses")}
          />
          <OnboardStep
            done={hasConnected}
            label="첫 커넥트 보내기"
            hint={hasCourse ? "수업에서 팀원을 찾아 커넥트하세요" : "먼저 수업에 참여하세요"}
            onClick={() =>
              setLocation(
                hasCourse && data?.courses[0]
                  ? `/courses/${data.courses[0].course.id}`
                  : "/courses",
              )
            }
          />
        </div>
      )}

      {/* 본문 — 모바일 단일 컬럼 / PC 2컬럼 */}
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr] lg:gap-6 lg:items-start">
        {/* LEFT: 다가오는 일정 + 내 수업 */}
        <div className="space-y-5">
          {upcoming.data && upcoming.data.length > 0 && (
            <div>
              <h2 className="font-extrabold text-[17px] mb-3 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                다가오는 일정
              </h2>
              <div className="space-y-2">
                {upcoming.data.map((item) => {
                  const d = dday(item.event.dueAt);
                  return (
                    <div
                      key={item.event.id}
                      className="rounded-[18px] bg-card shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
                      onClick={() => setLocation(`/teams/${item.team.id}`)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[15px] font-bold truncate flex items-center gap-1.5">
                            <span className="truncate">{item.event.title}</span>
                            {item.event.assigneeId === user?.id && (
                              <span className="badge-mine text-xs font-extrabold py-0.5 px-2 rounded-full shrink-0">
                                내 담당
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] text-muted-foreground mt-1">
                            {item.course.name} ·{" "}
                            {MATCH_TYPE_LABELS[(item.team.teamType ?? "project") as MatchType]}
                          </div>
                        </div>
                        <span
                          className={`text-sm font-extrabold px-3 py-1 rounded-full shrink-0 ${
                            d.tone === "normal" ? "badge-dday-soft" : "badge-dday"
                          }`}
                        >
                          {d.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-extrabold text-[17px]">내 수업</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/courses")}
                className="text-primary font-bold"
              >
                전체보기 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            {data?.courses.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border p-8 text-center">
                <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-4">아직 등록한 수업이 없어요</p>
                <Button onClick={() => setLocation("/courses")}>
                  <Plus className="mr-2 h-4 w-4" />
                  수업 추가하기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.courses.slice(0, 5).map((item) => (
                  <div
                    key={item.userCourse.id}
                    className="rounded-[18px] bg-card shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
                    onClick={() => setLocation(`/courses/${item.course.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-bold text-[15px] truncate">{item.course.name}</div>
                        <div className="text-[13px] text-muted-foreground mt-0.5">
                          {item.course.professor} · {item.userCourse.semester}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.course.hasTeamProject && (
                          <span className="badge-tag text-xs font-bold px-2.5 py-1 rounded-full">
                            팀플
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: 빠른 실행 + 추천 */}
        <div className="space-y-4">
          <h2 className="font-extrabold text-[17px] hidden lg:block">빠른 실행</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Button
              className="h-auto py-4 flex flex-col gap-2 lg:flex-row lg:justify-start lg:px-4"
              onClick={() => setLocation("/matching/requests")}
            >
              <Handshake className="h-5 w-5" />
              <span className="text-sm">매칭 요청</span>
            </Button>
            <Button
              variant="secondary"
              className="h-auto py-4 flex flex-col gap-2 lg:flex-row lg:justify-start lg:px-4"
              onClick={() => setLocation("/teams")}
            >
              <Users className="h-5 w-5" />
              <span className="text-sm">내 팀</span>
            </Button>
          </div>

          {/* 이런 팀원 어때요? — 같은 수업 · 관심분야 겹치는 학생 추천 */}
          {rec.data && rec.data.count > 0 && peer && (
            <button
              onClick={() => setLocation(`/courses/${peer.courseId}`)}
              className="w-full text-left rounded-[18px] bg-secondary p-4"
            >
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Lightbulb className="h-4 w-4" />
                이런 팀원 어때요?
              </div>
              <div className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">
                <span className="font-semibold text-foreground">{peer.courseName}</span>에서{" "}
                {peer.sharedSkills > 0 ? "나와 관심 분야가 겹치는 " : ""}
                학생 {rec.data.count}명이 팀원을 찾고 있어요
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
