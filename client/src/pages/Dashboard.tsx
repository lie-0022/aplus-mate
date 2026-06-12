import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Users,
  Handshake,
  Plus,
  ArrowRight,
  GraduationCap,
  CalendarDays,
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

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.dashboard.getData.useQuery();
  const upcoming = trpc.events.upcoming.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          안녕하세요, {user?.name || "학생"}님
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          오늘도 좋은 팀원을 만나보세요
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data?.courses.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">수강 과목</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-sky-brand/10 flex items-center justify-center mx-auto mb-2">
              <Handshake className="h-5 w-5 text-sky-brand" />
            </div>
            <div className="text-2xl font-bold">{data?.pendingMatches ?? 0}</div>
            <div className="text-xs text-muted-foreground">대기 매칭</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="text-2xl font-bold">{data?.activeTeams ?? 0}</div>
            <div className="text-xs text-muted-foreground">진행 팀</div>
          </CardContent>
        </Card>
      </div>

      {/* 다가오는 일정 — 내 활성 그룹들의 미완료 일정(임박순) */}
      {upcoming.data && upcoming.data.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            다가오는 일정
          </h2>
          <div className="space-y-2">
            {upcoming.data.map((item) => {
              const d = dday(item.event.dueAt);
              return (
                <Card
                  key={item.event.id}
                  className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/teams/${item.team.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          <span className="truncate">{item.event.title}</span>
                          {item.event.assigneeId === user?.id && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 bg-primary/10 text-primary border-0 shrink-0"
                            >
                              내 담당
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.course.name} ·{" "}
                          {MATCH_TYPE_LABELS[(item.team.teamType ?? "project") as MatchType]}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          d.tone === "over"
                            ? "text-xs bg-red-100 text-red-700 shrink-0"
                            : d.tone === "soon"
                              ? "text-xs bg-amber-100 text-amber-700 shrink-0"
                              : "text-xs shrink-0"
                        }
                      >
                        {d.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* My Courses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">내 수업</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/courses")}
            className="text-primary"
          >
            전체보기 <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {data?.courses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-4">
                아직 등록한 수업이 없어요
              </p>
              <Button
                onClick={() => setLocation("/courses")}
                className="gradient-primary text-white border-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                수업 추가하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.courses.slice(0, 5).map((item) => (
              <Card
                key={item.userCourse.id}
                className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/courses/${item.course.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {item.course.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.course.professor} · {item.userCourse.semester}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.course.hasTeamProject && (
                        <Badge variant="secondary" className="text-xs">
                          팀플
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => setLocation("/matching/requests")}
        >
          <Handshake className="h-5 w-5 text-primary" />
          <span className="text-xs">매칭 요청</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => setLocation("/teams")}
        >
          <Users className="h-5 w-5 text-sky-brand" />
          <span className="text-xs">내 팀</span>
        </Button>
      </div>
    </div>
  );
}
