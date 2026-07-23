import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  ArrowRight,
  GraduationCap,
  CalendarDays,
  Check,
  Lightbulb,
  Star,
  PenLine,
} from "lucide-react";
import { useLocation } from "wouter";
import { RecruitingBadge } from "@/components/RecruitingBadge";
import { CURRENT_SEMESTER, MATCH_TYPE_LABELS, type MatchType } from "@shared/const";
import TimetableGrid from "@/components/TimetableGrid";
import { buildTimetableBlocks } from "@/lib/timetable-blocks";
import { useMemo } from "react";

// ─── 홈 = 학생의 오늘 ─────────────────────────────────────
// 설계 의도(에타 피드백 반영):
// 1) 시간표가 히어로 — 대학생 앱의 심장. 매일 열 이유를 만든다.
// 2) "지금 학교에선" 피드 — 0짜리 지표 카드 대신 살아있는 서비스 신호.
// 3) 시즌 CTA 하나 — 지금은 후기 수집. 개강하면 팀원 찾기로 바뀐다.

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

// "방금 · n분 전 · n시간 전 · n일 전" — 피드용 상대 시각.
function timeAgo(at: Date | string): string {
  const ms = Date.now() - new Date(at).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(
    new Date(at),
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.getData.useQuery();
  const activity = trpc.dashboard.activity.useQuery();
  const tt = trpc.timetable.my.useQuery({ semester: CURRENT_SEMESTER });
  const upcoming = trpc.events.upcoming.useQuery();
  const rec = trpc.dashboard.recommendedPeers.useQuery();

  // 홈 미니 격자 — 읽기 전용(메뉴 없음), 카드 전체가 /timetable로 가는 문.
  const ttBlocks = useMemo(
    () => buildTimetableBlocks(tt.data?.courses ?? [], tt.data?.events ?? []),
    [tt.data],
  );
  const ttEmpty = ttBlocks.length === 0;

  if (isLoading) {
    return (
      <div className="space-y-5 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-56 rounded-[14px]" />
        <Skeleton className="h-40 rounded-[14px]" />
      </div>
    );
  }

  const hasReview = (data?.myReviewCount ?? 0) > 0;
  const upcomingCount = upcoming.data?.length ?? 0;
  const peer = rec.data?.sample;

  // ── 조각들 (모바일 순서와 PC 2컬럼 배치가 달라 조각으로 만든다) ──

  const greetingEl = (
    <div>
      <p className="text-[13px] font-semibold text-muted-foreground">
        {new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(
          new Date(),
        )}
      </p>
      <h1 className="text-[22px] font-extrabold mt-0.5">반가워요, {user?.name || "학생"}</h1>
      {upcomingCount > 0 && (
        <p className="text-sm text-muted-foreground mt-0.5">오늘 챙길 마감이 {upcomingCount}개 있어요</p>
      )}
    </div>
  );

  const timetableEl = (
    <div className="rounded-[14px] bg-card border border-border shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="text-[15px] font-bold flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" /> 내 시간표
          {(tt.data?.courses.length ?? 0) > 0 && (
            <span className="text-[12px] font-semibold text-muted-foreground ml-0.5">
              {tt.data!.courses.length}과목
            </span>
          )}
        </div>
        <button
          className="text-[13px] font-bold text-primary flex items-center gap-0.5"
          onClick={() => setLocation(ttEmpty ? "/planner" : "/timetable")}
        >
          {ttEmpty ? "시간표 짜보기" : "전체보기"} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {ttEmpty ? (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-dashed border-border p-5 text-center">
            <p className="text-sm font-semibold mb-1">아직 시간표가 비어 있어요</p>
            <p className="text-[13px] text-muted-foreground mb-3">
              수업을 등록하면 여기에 내 한 주가 그려져요
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={() => setLocation("/courses")}>
                수업 찾기
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setLocation("/planner")}>
                플래너로 짜보기
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="block w-full text-left px-3 pb-3"
          onClick={() => setLocation("/timetable")}
          aria-label="내 시간표 전체보기"
        >
          {/* 히어로답게 /timetable과 같은 밀도로 — 압축하면 한 주가 눈에 안 들어온다 */}
          <TimetableGrid blocks={ttBlocks} minPeriods={7} maxPeriods={10} rowHeight={48} />
        </button>
      )}
    </div>
  );

  const feedEl = (
    <div className="rounded-[14px] bg-card border border-border shadow-card overflow-hidden">
      <div className="px-4 pt-3.5 pb-1 text-[15px] font-bold">지금 학교에선</div>
      {activity.isLoading ? (
        <div className="px-4 pb-4 pt-2 space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (activity.data?.length ?? 0) === 0 ? (
        <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground">
          아직 조용해요. 첫 후기를 남기면 여기에 제일 먼저 올라와요.
        </p>
      ) : (
        <div>
          {activity.data!.map((a, i) => (
            <button
              key={`${a.kind}-${i}`}
              onClick={() => setLocation(`/courses/${a.courseId}`)}
              className="w-full text-left px-4 py-2.5 border-t border-border/60 flex gap-2.5 items-start"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${
                  a.kind === "review" ? "bg-[#2E7D51]" : "bg-primary"
                }`}
              />
              <span className="min-w-0 flex-1">
                {a.kind === "review" ? (
                  <>
                    <span className="block text-[13px] font-semibold truncate">
                      {a.courseName}에 새 후기{" "}
                      <span className="text-primary">
                        <Star className="inline h-3 w-3 fill-current -mt-0.5" /> {a.rating}
                      </span>
                    </span>
                    {a.snippet && (
                      <span className="block text-[12px] text-muted-foreground truncate">
                        “{a.snippet}”
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="block text-[13px] font-semibold truncate">
                      {a.courseName} · 팀원 모집 중
                    </span>
                    <span className="block text-[12px] text-muted-foreground">
                      {MATCH_TYPE_LABELS[a.matchType as MatchType]} · {a.neededCount}명 모집
                    </span>
                  </>
                )}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                {timeAgo(a.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const reviewCtaEl = (
    <button
      onClick={() => setLocation("/courses")}
      className="w-full text-left rounded-[14px] bg-card border border-border shadow-card p-4 flex items-center justify-between gap-3"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-bold flex items-center gap-1.5">
          <PenLine className="h-4 w-4 text-primary" />
          {hasReview ? "다른 수업 후기도 남겨볼까요?" : "들었던 수업, 후기 하나 남길까요?"}
        </span>
        <span className="block text-[13px] text-muted-foreground mt-0.5">
          별점 + 팀플 정보만 · 30초 · 익명
        </span>
      </span>
      <span className="shrink-0 rounded-[10px] bg-primary text-primary-foreground text-[13px] font-bold px-3.5 py-2">
        쓰러 가기
      </span>
    </button>
  );

  const upcomingEl =
    upcoming.data && upcoming.data.length > 0 ? (
      <div>
        <h2 className="font-extrabold text-[16px] mb-2.5">다가오는 일정</h2>
        <div className="space-y-2">
          {upcoming.data.map((item) => {
            const d = dday(item.event.dueAt);
            return (
              <div
                key={item.event.id}
                className="rounded-[14px] bg-card border border-border shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
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
    ) : null;

  const myCoursesEl = (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-extrabold text-[16px]">내 수업</h2>
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
        <div className="rounded-[14px] bg-card border border-border shadow-card p-7 text-center">
          <GraduationCap className="h-9 w-9 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-4">
            아직 등록한 수업이 없어요. 등록하면 시간표가 채워지고 팀원을 찾을 수 있어요.
          </p>
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
              className="rounded-[14px] bg-card border border-border shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
              onClick={() => setLocation(`/courses/${item.course.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-[15px] truncate">{item.course.name}</div>
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    {item.course.professor} · {item.userCourse.semester}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    {item.hasMyReview ? (
                      <span className="badge-pos inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" /> 후기 완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        <Star className="h-3 w-3" /> 후기 쓰기
                      </span>
                    )}
                    {item.openRecruitCount > 0 && <RecruitingBadge count={item.openRecruitCount} />}
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
  );

  const peerEl =
    rec.data && rec.data.count > 0 && peer ? (
      <button
        onClick={() => setLocation(`/courses/${peer.courseId}`)}
        className="w-full text-left rounded-[14px] bg-secondary p-4"
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
    ) : null;

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      {greetingEl}
      {/* 시간표는 히어로 — PC에서도 2컬럼 위에서 전체 폭을 쓴다. */}
      {timetableEl}
      {/* 아래부터 2컬럼. 모바일은 피드 → 후기 CTA → 일정 → 내 수업 순서. */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:gap-6 lg:items-start">
        <div className="space-y-4 min-w-0">
          <div className="lg:hidden space-y-4">
            {feedEl}
            {reviewCtaEl}
          </div>
          {upcomingEl}
          {myCoursesEl}
          <div className="lg:hidden">{peerEl}</div>
        </div>
        <div className="hidden lg:block space-y-4">
          {feedEl}
          {reviewCtaEl}
          {peerEl}
        </div>
      </div>
    </div>
  );
}
