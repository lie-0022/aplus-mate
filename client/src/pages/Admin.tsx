import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";
import { ShieldCheck, RefreshCw, ExternalLink, Inbox, Users, Flag, Sparkles, Boxes } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ROLE_KO: Record<string, string> = { user: "학생", professor: "교수", admin: "운영자" };
const REASON_KO: Record<string, string> = {
  abuse: "욕설·비방",
  spam: "스팸·광고",
  privacy: "개인정보 노출",
  etc: "기타",
};
const TARGET_KO: Record<string, string> = { post: "게시글", comment: "댓글", user: "사용자" };
const TEAM_STATUS_KO: Record<string, string> = {
  active: "진행 중",
  completed: "완료",
  disbanded: "해체",
};
const MEMBER_ROLE_SUFFIX: Record<string, string> = { mentor: " (멘토)", mentee: " (멘티)" };

// 운영자 전용 — pending 매칭 현황. 서버는 adminProcedure(role=admin)로 이중 가드.
// 운영자에게는 수동 운영(연락·푸시)을 위해 실명·오픈채팅이 보인다.
export default function Admin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const pending = trpc.admin.pendingMatches.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const usersList = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast.success("역할을 변경했어요.");
    },
    onError: (err) => toast.error(err.message),
  });
  const allTeams = trpc.admin.allTeams.useQuery(undefined, { enabled: isAdmin, retry: false });
  const reports = trpc.admin.reports.useQuery(undefined, { enabled: isAdmin, retry: false });
  const resolveReport = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      utils.admin.reports.invalidate();
      toast.success("신고를 처리했어요.");
    },
    onError: (err) => toast.error(err.message),
  });
  const seedDemo = trpc.admin.seedDemo.useMutation({
    onSuccess: (r) => {
      toast.success(r.skipped ? (r.reason ?? "이미 데모가 있어요") : "데모 데이터 생성 완료!");
    },
    onError: (err) => toast.error(err.message),
  });
  const clearDemo = trpc.admin.clearDemo.useMutation({
    onSuccess: () => toast.success("데모 데이터를 정리했어요."),
    onError: (err) => toast.error(err.message),
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">운영자 전용 페이지예요</h2>
        <p className="text-sm text-muted-foreground">접근 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">운영자 — 대기 매칭</h1>
          {pending.data && pending.data.length > 0 && (
            <Badge variant="default" className="gradient-primary text-white border-0">
              {pending.data.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pending.refetch()}
          disabled={pending.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${pending.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {pending.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : pending.data?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">대기 중인 매칭이 없어요</p>
          </CardContent>
        </Card>
      ) : (
        pending.data?.map((item) => (
          <Card key={`match-${item.match.id}`} className="border shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {item.course?.name ?? "알 수 없는 수업"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                </Badge>
                {item.match.matchType === "mentoring" && (
                  <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700">
                    요청자가 {item.match.requesterRole === "mentor" ? "멘토" : "멘티"}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(item.match.createdAt).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "요청자", u: item.requester },
                  { label: "수신자", u: item.receiver },
                ].map(({ label, u }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-muted/50">
                    <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
                    <div className="font-medium text-sm">{u?.name ?? "?"}</div>
                    <div className="text-xs text-muted-foreground">
                      {u?.department} · {u?.year}학년
                    </div>
                    {u?.kakaoOpenChatUrl && (
                      <a
                        href={u.kakaoOpenChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 mt-1"
                      >
                        오픈채팅 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* 전체 팀 현황 — 운영자가 구성된 팀과 진행 상황을 한눈에 */}
      <div className="flex items-center gap-2 pt-2">
        <Boxes className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">전체 팀 현황 ({allTeams.data?.length ?? 0})</h2>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => allTeams.refetch()}
          disabled={allTeams.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${allTeams.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {allTeams.data && allTeams.data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            아직 구성된 팀이 없어요.
          </CardContent>
        </Card>
      )}
      {allTeams.data?.map((t) => {
        const pct = t.eventsTotal > 0 ? Math.round((t.eventsDone / t.eventsTotal) * 100) : 0;
        return (
          <Card key={`team-${t.id}`} className="border shadow-sm">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {t.courseName}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {MATCH_TYPE_LABELS[(t.teamType ?? "project") as MatchType]}
                </Badge>
                <Badge
                  variant="secondary"
                  className={
                    t.status === "active"
                      ? "text-xs bg-emerald-100 text-emerald-700"
                      : "text-xs"
                  }
                >
                  {TEAM_STATUS_KO[t.status] ?? t.status}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {t.members.length}명
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.members.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-normal">
                    {m.name ?? "?"}
                    {MEMBER_ROLE_SUFFIX[m.role ?? ""] ?? ""}
                  </Badge>
                ))}
              </div>
              {t.eventsTotal > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>일정 진척</span>
                    <span>
                      {t.eventsDone}/{t.eventsTotal} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">등록된 일정 없음</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* 신고 큐 */}
      <div className="flex items-center gap-2 pt-2">
        <Flag className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">신고 ({reports.data?.length ?? 0})</h2>
      </div>
      {reports.data && reports.data.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            처리할 신고가 없어요.
          </CardContent>
        </Card>
      )}
      {reports.data?.map((r) => (
        <Card key={`report-${r.id}`} className="border shadow-sm">
          <CardContent className="p-3 flex items-start justify-between gap-2">
            <div className="text-sm min-w-0">
              <div className="font-medium">
                {TARGET_KO[r.targetType]} #{r.targetId} · {REASON_KO[r.reason]}
              </div>
              {r.detail && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.detail}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(r.createdAt).toLocaleString("ko-KR")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => resolveReport.mutate({ reportId: r.id })}
              disabled={resolveReport.isPending}
            >
              처리
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* 유저 역할 관리 — 교수 지정은 운영자가 직접(사칭 방지) */}
      <div className="flex items-center gap-2 pt-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">유저 역할 관리</h2>
      </div>
      {usersList.data?.map((u) => (
        <Card key={`user-${u.id}`} className="border shadow-sm">
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm flex items-center gap-1.5">
                {u.name ?? "(이름 없음)"}
                <Badge
                  variant="secondary"
                  className={
                    u.role === "admin"
                      ? "text-[10px] bg-red-100 text-red-700"
                      : u.role === "professor"
                        ? "text-[10px] bg-sky-100 text-sky-700"
                        : "text-[10px]"
                  }
                >
                  {ROLE_KO[u.role]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {u.email} {u.department && `· ${u.department}`}
              </div>
            </div>
            {u.id === user?.id ? (
              <Badge variant="outline" className="text-xs shrink-0">
                나
              </Badge>
            ) : (
              <Select
                value={u.role}
                onValueChange={(v) =>
                  setRole.mutate({ userId: u.id, role: v as "user" | "professor" | "admin" })
                }
              >
                <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">학생</SelectItem>
                  <SelectItem value="professor">교수</SelectItem>
                  <SelectItem value="admin">운영자</SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      ))}

      {/* 데모 데이터 (교수 시연용) */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">데모 데이터 (시연용)</h2>
      </div>
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            교수님 시연용 예시 데이터를 한 번에 만듭니다 — '소프트웨어 캡스톤 디자인' 수업,
            데모 학생 6명, 매칭·3인 팀(일정·메모·산출물), 설문(응답 4명), 공지, 게시글. 내가 담당
            교수로 설정됩니다.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => seedDemo.mutate()}
              disabled={seedDemo.isPending}
              className="gradient-primary text-white border-0"
            >
              {seedDemo.isPending ? "생성 중..." : "데모 데이터 생성"}
            </Button>
            <Button
              onClick={() => clearDemo.mutate()}
              disabled={clearDemo.isPending}
              variant="outline"
            >
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
