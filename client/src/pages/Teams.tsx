import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserCircle, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";

export default function Teams() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.teams.list.useQuery();
  const [tab, setTab] = useState("active");

  const activeTeams = useMemo(
    () => data?.filter((t) => t.team.status === "active") || [],
    [data]
  );
  const completedTeams = useMemo(
    () => data?.filter((t) => t.team.status === "completed") || [],
    [data]
  );

  if (isLoading) {
    return (
      <div className="space-y-4 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-8 w-32" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[18px]" />
        ))}
      </div>
    );
  }

  const renderTeamList = (teamList: typeof activeTeams) => {
    if (teamList.length === 0) {
      return (
        <div className="rounded-[18px] bg-card shadow-card p-8 text-center">
          <Users className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-foreground text-sm font-semibold mb-1">
            {tab === "active" ? "진행 중인 팀이 없어요" : "완료된 팀이 없어요"}
          </p>
          <p className="text-muted-foreground text-[13px]">
            {tab === "active"
              ? "수업 상세의 팀원 찾기에서 팀을 만들어보세요"
              : "활동이 끝난 팀이 여기 모여요"}
          </p>
        </div>
      );
    }

    return teamList.map((item) => (
      <div
        key={item.team.id}
        className="rounded-[18px] bg-card shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
        onClick={() => setLocation(`/teams/${item.team.id}`)}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="font-bold text-sm">{item.course.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.course.professor}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="badge-tag text-xs font-bold px-2.5 py-0.5 rounded-full">
              {MATCH_TYPE_LABELS[(item.team.teamType ?? "project") as MatchType]}
            </span>
            {/* 평가 상태는 팀플 전용 — 스터디·멘토멘티는 평가 단계가 없다 */}
            {item.team.teamType === "project" &&
              item.team.evaluationStatus === "in_progress" && (
                <span className="badge-notice text-xs font-bold px-2.5 py-0.5 rounded-full">
                  평가 진행 중
                </span>
              )}
            {item.team.teamType === "project" && item.team.evaluationStatus === "done" && (
              <span className="badge-pos text-xs font-bold px-2.5 py-0.5 rounded-full">평가 완료</span>
            )}
            {item.team.professorApprovedAt && (
              <span className="badge-pos text-xs font-bold px-2.5 py-0.5 rounded-full">
                교수님 승인
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.members.map((m) => (
            <div
              key={m.teamMember.id}
              className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1"
            >
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">{m.user.name}</span>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  // PC 우측 레일 — 팀 현황 + 안내 (진행·완료 탭 공통)
  const railEl = (
    <div className="hidden lg:block space-y-3">
      <div className="rounded-[18px] bg-card shadow-card p-4">
        <div className="text-xs font-bold text-muted-foreground mb-2">팀 현황</div>
        <div className="flex items-center justify-between text-sm font-semibold py-1">
          <span>진행 중</span>
          <span className="text-primary font-extrabold">{activeTeams.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-semibold py-1">
          <span>완료</span>
          <span className="text-primary font-extrabold">{completedTeams.length}</span>
        </div>
      </div>
      <div className="rounded-[18px] bg-card shadow-card p-4 text-[13px] text-muted-foreground leading-relaxed">
        팀을 누르면 멤버·오픈채팅·일정과 <span className="font-semibold text-foreground">(팀플은) 상호 평가</span>
        를 볼 수 있어요. 새 팀은 수업 상세의 팀원 찾기에서 만들어져요.
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <h1 className="text-xl font-extrabold">내 팀</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            진행 중 ({activeTeams.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            완료 ({completedTeams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-3">{renderTeamList(activeTeams)}</div>
            {railEl}
          </div>
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-3">{renderTeamList(completedTeams)}</div>
            {railEl}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
