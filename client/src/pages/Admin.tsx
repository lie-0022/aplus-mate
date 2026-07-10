import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";
import {
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Inbox,
  Users,
  Flag,
  Sparkles,
  Trash2,
  Boxes,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CalendarDays,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  // 전체 팀 현황 — 펼친 팀 / "정체 팀만" 필터
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [onlyStuck, setOnlyStuck] = useState(false);
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
  const [seedSemester, setSeedSemester] = useState("2026-1");
  const seedTimetable = trpc.admin.seedTimetable.useMutation({
    onSuccess: (r) =>
      toast.success(`${r.semester} 적재 완료 — 수업 ${r.courses}개 · 시간표 ${r.schedules}개`),
    onError: (err) => toast.error(err.message),
  });
  const wipeTest = trpc.admin.wipeTestData.useMutation({
    onSuccess: (res) => {
      toast.success(
        `테스트 데이터를 정리했어요. 수업 ${res?.keptCourses ?? 0}개는 그대로 남아 있어요.`
      );
      // 데이터가 전부 바뀌므로 화면을 새로 불러온다.
      setTimeout(() => window.location.reload(), 800);
    },
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
            <Badge variant="default" className="border-0">
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
        <Card className="border-0 shadow-card">
          <CardContent className="p-10 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">대기 중인 매칭이 없어요</p>
          </CardContent>
        </Card>
      ) : (
        pending.data?.map((item) => (
          <Card key={`match-${item.match.id}`} className="rounded-2xl border-0 shadow-card">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {item.course?.name ?? "알 수 없는 수업"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                </Badge>
                {item.match.matchType === "mentoring" && (
                  <Badge variant="secondary" className="text-xs badge-sky border-0">
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* 전체 팀 현황 — 운영자가 구성된 팀·진행 상황을 한눈에, 카드 탭하면 상세 */}
      {(() => {
        const teamList = allTeams.data ?? [];
        const isStuck = (t: (typeof teamList)[number]) =>
          t.status === "active" && t.eventsDone === 0;
        const stuckCount = teamList.filter(isStuck).length;
        const shown = onlyStuck ? teamList.filter(isStuck) : teamList;
        return (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Boxes className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">전체 팀 현황 ({teamList.length})</h2>
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
            {stuckCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // 필터를 토글하면 펼침 상태도 초기화(필터로 사라진 팀이 stale하게 되살아나는 것 방지)
                  setOnlyStuck((v) => !v);
                  setExpandedTeam(null);
                }}
                className={
                  onlyStuck ? "w-fit" : "w-fit"
                }
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {onlyStuck ? "전체 보기" : `정체 팀만 (${stuckCount})`}
              </Button>
            )}
            {teamList.length === 0 && (
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 text-center text-sm text-muted-foreground">
                  아직 구성된 팀이 없어요.
                </CardContent>
              </Card>
            )}
            {shown.map((t) => {
              const pct = t.eventsTotal > 0 ? Math.round((t.eventsDone / t.eventsTotal) * 100) : 0;
              const stuck = isStuck(t);
              const open = expandedTeam === t.id;
              return (
                <Card key={`team-${t.id}`} className="rounded-2xl border-0 shadow-card">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    className="w-full text-left cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setExpandedTeam(open ? null : t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedTeam(open ? null : t.id);
                      }
                    }}
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
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
                              ? "text-xs badge-pos border-0"
                              : "text-xs"
                          }
                        >
                          {TEAM_STATUS_KO[t.status] ?? t.status}
                        </Badge>
                        {stuck && (
                          <Badge
                            variant="secondary"
                            className="text-xs badge-notice border-0"
                          >
                            정체
                          </Badge>
                        )}
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
                            <div
                              className="h-full gradient-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">등록된 일정 없음</p>
                      )}
                    </CardContent>
                  </div>
                  {open && <AdminTeamDetail teamId={t.id} />}
                </Card>
              );
            })}
          </>
        );
      })()}

      {/* 신고 큐 */}
      <div className="flex items-center gap-2 pt-2">
        <Flag className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">신고 ({reports.data?.length ?? 0})</h2>
      </div>
      {reports.data && reports.data.length === 0 && (
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            처리할 신고가 없어요.
          </CardContent>
        </Card>
      )}
      {reports.data?.map((r) => (
        <Card key={`report-${r.id}`} className="rounded-2xl border-0 shadow-card">
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
        <Card key={`user-${u.id}`} className="rounded-2xl border-0 shadow-card">
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm flex items-center gap-1.5">
                {u.name ?? "(이름 없음)"}
                <Badge
                  variant="secondary"
                  className={
                    u.role === "admin"
                      ? "text-[10px] badge-danger border-0"
                      : u.role === "professor"
                        ? "text-[10px] badge-sky border-0"
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

      {/* 수강편람 시간표 적재 — 학기가 바뀌면 여기서 다시 돌린다 */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">시간표 적재</h2>
      </div>
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            <code>server/data/timetable_&#123;학기&#125;.json</code>을 읽어 수업·시간표를 적재합니다.
            과목코드 기준으로 <b>덮어쓰기(멱등)</b>라 여러 번 눌러도 안전하고, 학생들이 남긴
            후기는 과목 단위로 유지됩니다. 다음 학기 파일을 커밋한 뒤 학기만 바꿔 실행하세요.
          </p>
          <div className="flex gap-2">
            <Input
              value={seedSemester}
              onChange={(e) => setSeedSemester(e.target.value)}
              placeholder="2026-1"
              className="max-w-[140px]"
            />
            <Button
              onClick={() => seedTimetable.mutate({ semester: seedSemester.trim() })}
              disabled={seedTimetable.isPending || !seedSemester.trim()}
              variant="secondary"
            >
              {seedTimetable.isPending ? "적재 중..." : "시간표 적재 / 갱신"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 데모 데이터 (교수 시연용) */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">데모 데이터 (시연용)</h2>
      </div>
      <Card className="rounded-2xl border-0 shadow-card">
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
              className=""
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

      {/* 파일럿 리셋 — 실제 학생 받기 직전, 운영자만 남기고 전부 초기화 */}
      <div className="flex items-center gap-2 pt-4 border-t">
        <Trash2 className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-bold">테스트 데이터 전체 초기화</h2>
      </div>
      <Card className="rounded-2xl border border-destructive/40 shadow-none">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            운영자(나) 계정만 남기고 <b>수강·리뷰·개인 일정·팀·매칭·설문·게시글과 다른 계정</b>을
            영구 삭제합니다. 실제 학생을 받기 직전, 테스트 데이터를 깨끗이 비울 때만 사용하세요.{" "}
            <b>되돌릴 수 없습니다.</b>
            <br />
            <b>수강편람 수업(3,368개)과 시간표는 그대로 남습니다</b> — 재적재할 필요 없어요. 앱에서
            직접 만든 수업(데모·테스트)만 함께 지워집니다.
          </p>
          <Button
            onClick={() => {
              if (
                !window.confirm(
                  "운영자(나) 계정만 남기고 수강·리뷰·개인 일정·팀·매칭·설문·게시글·다른 계정을 영구 삭제합니다. (수강편람 수업과 시간표는 남습니다.) 되돌릴 수 없어요. 계속할까요?"
                )
              )
                return;
              if (!window.confirm("정말 전부 삭제할까요? 실제 학생을 받기 직전에만 실행하세요.")) return;
              wipeTest.mutate();
            }}
            disabled={wipeTest.isPending}
            variant="destructive"
          >
            {wipeTest.isPending ? "정리 중..." : "테스트 데이터 전체 초기화"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// 운영자가 팀 카드를 펼치면 보이는 상세 — 멤버 연락처·일정·메모·산출물.
function AdminTeamDetail({ teamId }: { teamId: number }) {
  const detail = trpc.admin.teamDetail.useQuery({ teamId }, { retry: false });
  if (detail.isLoading) {
    return (
      <div className="px-4 pb-4">
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }
  const d = detail.data;
  if (!d) return null;
  return (
    <div className="px-4 pb-4 pt-1 border-t mt-1 space-y-3 text-sm">
      {/* 멤버 연락처 */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">멤버 연락처</div>
        <div className="space-y-1">
          {d.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="font-medium">{m.name ?? "?"}</span>
              <span className="text-xs text-muted-foreground">
                {m.department}
                {m.year ? ` · ${m.year}학년` : ""}
                {m.role === "mentor" ? " · 멘토" : m.role === "mentee" ? " · 멘티" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* 일정 */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">
          일정 ({d.events.length})
        </div>
        {d.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">등록된 일정 없음</p>
        ) : (
          <div className="space-y-1">
            {d.events.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                {e.isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <CircleDashed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={e.isDone ? "line-through text-muted-foreground" : ""}>
                  {e.title}
                </span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {e.assigneeName ? `${e.assigneeName} · ` : ""}
                  {new Date(e.dueAt).toLocaleDateString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 팀 메모 */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">
          팀 메모 ({d.notes.length})
        </div>
        {d.notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">메모 없음</p>
        ) : (
          <div className="space-y-1">
            {d.notes.map((n) => (
              <div key={n.id} className="p-2 rounded-lg bg-muted/50">
                <p className="whitespace-pre-wrap">{n.content}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {n.authorName} · {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 산출물 제출 */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">
          산출물 제출 ({d.submissions.length})
        </div>
        {d.submissions.length === 0 ? (
          <p className="text-xs text-muted-foreground">제출물 없음</p>
        ) : (
          <div className="space-y-1">
            {d.submissions.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {s.milestoneTitle}
                </Badge>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline truncate inline-flex items-center gap-0.5"
                >
                  제출물 <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                  {s.submitterName}
                  {s.reviewedAt ? " · 확인됨" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
