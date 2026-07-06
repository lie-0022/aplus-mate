import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MATCH_TYPE_LABELS, ROLE_LABELS, type MatchType, type MentoringRole } from "@shared/const";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MessageCircle,
  CheckCircle2,
  Star,
  ExternalLink,
  Sparkles,
  Copy,
  CalendarDays,
  Circle,
  Trash2,
  Plus,
  LogOut,
  FolderOpen,
  CalendarClock,
  StickyNote,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

// D-day 계산 — 날짜 기준(시각 무시).
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

export default function TeamDetail() {
  const params = useParams<{ id: string }>();
  const teamId = parseInt(params.id || "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.teams.get.useQuery({ id: teamId });
  const hasEvaluated = trpc.evaluations.hasEvaluated.useQuery({ teamId });

  // 완료·나가기 확인 — 제어형 AlertDialog(모바일 하단·PC 레일 버튼이 공용).
  const [completeOpen, setCompleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // AI 보고서 초안 — 주제 입력 → 서버(invokeLLM) → 마크다운 초안.
  const [reportTopic, setReportTopic] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const generateReport = trpc.ai.generateReport.useMutation({
    onSuccess: (res) => {
      setReport(res.content);
      toast.success("보고서 초안이 생성됐어요!");
    },
    onError: (err) => toast.error(err.message),
  });

  // 팀 일정 — 멤버 전용 CRUD + D-day 표시.
  const [eventTitle, setEventTitle] = useState("");
  const [eventDue, setEventDue] = useState("");
  const [eventAssignee, setEventAssignee] = useState<string>("none");
  const events = trpc.events.list.useQuery({ teamId });
  const invalidateEvents = () => {
    utils.events.list.invalidate({ teamId });
    utils.events.upcoming.invalidate();
  };
  const createEvent = trpc.events.create.useMutation({
    onSuccess: () => {
      invalidateEvents();
      setEventTitle("");
      setEventDue("");
      setEventAssignee("none");
      toast.success("일정을 추가했어요!");
    },
    onError: (err) => toast.error(err.message),
  });
  const setEventDone = trpc.events.setDone.useMutation({
    onSuccess: invalidateEvents,
    onError: (err) => toast.error(err.message),
  });
  const setAssignee = trpc.events.setAssignee.useMutation({
    onSuccess: invalidateEvents,
    onError: (err) => toast.error(err.message),
  });
  const removeEvent = trpc.events.remove.useMutation({
    onSuccess: invalidateEvents,
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = trpc.teams.leave.useMutation({
    onSuccess: () => {
      utils.teams.list.invalidate();
      utils.events.upcoming.invalidate();
      toast.success("팀에서 나왔어요.");
      setLocation("/teams");
    },
    onError: (err) => toast.error(err.message),
  });

  const completeMutation = trpc.teams.complete.useMutation({
    onSuccess: () => {
      utils.teams.get.invalidate();
      utils.teams.list.invalidate();
      // 팀플만 평가 단계로 — 스터디·멘토멘티는 평가 없이 종료.
      if (data?.team.teamType === "project") {
        toast.success("팀플이 완료되었습니다! 이제 팀원을 평가해주세요.");
        setLocation(`/teams/${teamId}/evaluate`);
      } else {
        toast.success("활동을 종료했어요!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // 평가 강제 마감 — 미제출 팀원을 무한정 기다리지 않고 지금까지의 평가로 배지 정산.
  const forceCloseMutation = trpc.evaluations.forceClose.useMutation({
    onSuccess: () => {
      utils.teams.get.invalidate();
      toast.success("평가를 마감하고 배지를 정산했어요.");
    },
    onError: (err) => toast.error(err.message),
  });

  // 산출물 제출 — 교수가 만든 제출 항목(마일스톤)에 링크+메모로 제출/수정.
  const deliverables = trpc.deliverables.forTeam.useQuery({ teamId });
  const [subInputs, setSubInputs] = useState<Record<number, { url: string; note: string }>>({});
  const submitDeliverable = trpc.deliverables.submit.useMutation({
    onSuccess: () => {
      utils.deliverables.forTeam.invalidate({ teamId });
      toast.success("제출했어요!");
    },
    onError: (err) => toast.error(err.message),
  });

  // 팀 메모 보드 — 결정사항·역할·링크를 앱 안에 기록
  const notes = trpc.notes.list.useQuery({ teamId });
  const [noteContent, setNoteContent] = useState("");
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ teamId });
      setNoteContent("");
    },
    onError: (err) => toast.error(err.message),
  });
  const removeNote = trpc.notes.remove.useMutation({
    onSuccess: () => utils.notes.list.invalidate({ teamId }),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 rounded-[18px]" />
        <Skeleton className="h-48 rounded-[18px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">팀을 찾을 수 없습니다.</p>
        <Button variant="link" onClick={() => setLocation("/teams")}>
          팀 목록으로
        </Button>
      </div>
    );
  }

  const isActive = data.team.status === "active";
  const isCompleted = data.team.status === "completed";
  const isProject = data.team.teamType === "project";
  const isMentoring = data.team.teamType === "mentoring";
  const hasMentor = data.members.some((m) => m.teamMember.role === "mentor");
  const typeLabel = MATCH_TYPE_LABELS[(data.team.teamType ?? "project") as MatchType];
  const needsEvaluation =
    isProject &&
    isCompleted &&
    data.team.evaluationStatus !== "done" &&
    !hasEvaluated.data;

  // 일정 진척 요약 — 일정 카드 헤더·PC 요약 레일에서 공용.
  const evData = events.data ?? [];
  const evTotal = evData.length;
  const evDone = evData.filter((e) => e.isDone).length;
  const evPct = evTotal ? Math.round((evDone / evTotal) * 100) : 0;
  const nowMs = Date.now();
  const myUndone = evData.filter((e) => !e.isDone && e.assigneeId === user?.id).length;
  const overdue = evData.filter((e) => !e.isDone && new Date(e.dueAt).getTime() < nowMs).length;

  const statusPill = (
    <span
      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isActive ? "badge-tag" : "badge-pos"}`}
    >
      {isActive ? "진행 중" : "완료"}
    </span>
  );

  // ── 히어로 (차분 카드) ──
  const heroEl = (
    <div className="rounded-2xl bg-card shadow-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="badge-tag text-xs font-bold px-2.5 py-0.5 rounded-full">{typeLabel}</span>
            {statusPill}
          </div>
          <h1 className="font-bold text-xl truncate">{data.course.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data.course.professor}</p>
        </div>
        <div className="flex -space-x-2 shrink-0">
          {data.members.slice(0, 4).map((m) => (
            <div
              key={m.teamMember.id}
              className="w-8 h-8 rounded-full gradient-primary ring-2 ring-card flex items-center justify-center text-xs font-bold text-white"
            >
              {m.user.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          ))}
          {data.members.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              +{data.members.length - 4}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── 팀원 ──
  const membersEl = (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 px-1">
        <h2 className="text-lg font-bold">팀원</h2>
        <span className="text-sm text-muted-foreground">{data.members.length}명</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card shadow-card divide-y divide-border/60">
        {data.members.map((member) => (
          <div key={member.teamMember.id} className="flex items-center justify-between gap-3 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl gradient-primary">
                <span className="text-sm font-bold text-white">
                  {member.user.name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[15px] font-semibold">
                  <span className="truncate">{member.user.name}</span>
                  {member.user.id === user?.id && (
                    <span className="text-[10px] font-bold px-1.5 py-0 rounded-full border border-border text-muted-foreground">
                      나
                    </span>
                  )}
                  {member.teamMember.role !== "member" && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        member.teamMember.role === "mentor" ? "badge-sky" : "badge-tag"
                      }`}
                    >
                      {ROLE_LABELS[member.teamMember.role as MentoringRole]}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {member.user.department} · {member.user.year}학년
                </div>
              </div>
            </div>
            {member.user.kakaoOpenChatUrl && (
              <a
                href={member.user.kakaoOpenChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                오픈채팅
              </a>
            )}
          </div>
        ))}
      </div>
      {isMentoring && !hasMentor && isActive && (
        <div className="notice-soft rounded-xl p-3 text-[11px] leading-relaxed">
          👋 아직 멘토가 없는 멘토링 그룹이에요. 멘토가 커넥트하면 합류할 수 있어요.
        </div>
      )}
    </section>
  );

  // ── 팀 메모 ──
  const memoEl = (
    <div className="rounded-2xl bg-card shadow-card p-4">
      <div className="text-base font-bold flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-primary" /> 팀 메모
      </div>
      <div className="flex gap-2 mb-2">
        <Textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="결정사항·역할 분담·링크를 남겨보세요"
          rows={2}
          maxLength={1000}
        />
        <Button
          variant="secondary"
          className="shrink-0 self-end"
          disabled={createNote.isPending}
          onClick={() => {
            if (!noteContent.trim()) {
              toast.error("내용을 입력해주세요.");
              return;
            }
            createNote.mutate({ teamId, content: noteContent.trim() });
          }}
        >
          남기기
        </Button>
      </div>
      {notes.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          아직 메모가 없어요. 회의 결정사항이나 역할을 기록해보세요.
        </p>
      )}
      <div className="space-y-2">
        {notes.data?.map((n) => (
          <div key={n.id} className="p-2.5 rounded-lg bg-muted">
            <p className="text-sm whitespace-pre-wrap">{n.content}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-muted-foreground">
                {n.authorName} ·{" "}
                {new Date(n.createdAt).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <button
                onClick={() => removeNote.mutate({ noteId: n.id })}
                className="text-muted-foreground hover:text-destructive"
                aria-label="메모 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── 팀 일정 ──
  const scheduleEl = (
    <div className="rounded-2xl bg-card shadow-card p-4">
      <div className="text-base font-bold flex items-center gap-2 mb-1">
        <CalendarDays className="h-4 w-4 text-primary" /> 일정
      </div>
      {evTotal > 0 && (
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              진행률 {evDone}/{evTotal}
            </span>
            <span className="font-medium">{evPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${evPct}%` }} />
          </div>
          {(myUndone > 0 || overdue > 0) && (
            <div className="flex gap-2 text-[11px] pt-0.5">
              {myUndone > 0 && <span className="text-primary">내 담당 미완료 {myUndone}</span>}
              {overdue > 0 && <span className="text-destructive">마감 지남 {overdue}</span>}
            </div>
          )}
        </div>
      )}
      {evData.length === 0 && (
        <p className="text-sm text-muted-foreground">
          아직 일정이 없어요. 과제 마감일이나 회의 일정을 등록해보세요!
        </p>
      )}
      <div className="space-y-2.5">
        {evData.map((ev) => {
          const d = dday(ev.dueAt);
          return (
            <div key={ev.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted">
              <button
                type="button"
                onClick={() => setEventDone.mutate({ eventId: ev.id, isDone: !ev.isDone })}
                disabled={setEventDone.isPending}
                aria-label={ev.isDone ? "완료 해제" : "완료 처리"}
              >
                {ev.isDone ? (
                  <CheckCircle2 className="h-5 w-5" style={{ color: "var(--pos-fg)" }} />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium truncate ${
                    ev.isDone ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {ev.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(ev.dueAt).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {!isActive &&
                    (() => {
                      if (!ev.assigneeId) return null;
                      const m = data.members.find((x) => x.user.id === ev.assigneeId);
                      if (!m) return null;
                      const mine = ev.assigneeId === user?.id;
                      return (
                        <>
                          {" · 담당 "}
                          <span className={mine ? "font-medium text-primary" : ""}>
                            {m.user.name}
                            {mine ? " (나)" : ""}
                          </span>
                        </>
                      );
                    })()}
                </div>
                {/* 활성 팀은 행에서 담당자를 바로 바꿀 수 있다 */}
                {isActive && (
                  <Select
                    value={String(ev.assigneeId ?? "none")}
                    onValueChange={(v) =>
                      setAssignee.mutate({
                        eventId: ev.id,
                        assigneeId: v === "none" ? null : Number(v),
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-6 w-fit gap-1 border-dashed px-2 py-0 text-xs text-muted-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">담당 없음</SelectItem>
                      {data.members.map((m) => (
                        <SelectItem key={m.user.id} value={String(m.user.id)}>
                          {m.user.name}
                          {m.user.id === user?.id ? " (나)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {ev.isDone ? (
                <span className="badge-pos text-xs font-bold px-2.5 py-0.5 rounded-full">완료</span>
              ) : (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    d.tone === "over"
                      ? "badge-danger"
                      : d.tone === "soon"
                        ? "badge-notice"
                        : "badge-tag"
                  }`}
                >
                  {d.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeEvent.mutate({ eventId: ev.id })}
                disabled={removeEvent.isPending}
                className="text-muted-foreground hover:text-destructive"
                aria-label="일정 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {isActive && (
          <div className="flex flex-col gap-2 pt-1">
            <Input
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="일정 제목 (예: 발표자료 마감)"
              maxLength={200}
            />
            <Select value={eventAssignee} onValueChange={setEventAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="담당자 (선택)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">담당 없음 (공동)</SelectItem>
                {data.members.map((m) => (
                  <SelectItem key={m.user.id} value={String(m.user.id)}>
                    {m.user.name}
                    {m.user.id === user?.id ? " (나)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={eventDue}
                onChange={(e) => setEventDue(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!eventTitle.trim()) {
                    toast.error("일정 제목을 입력해주세요.");
                    return;
                  }
                  const due = new Date(eventDue);
                  if (!eventDue || isNaN(due.getTime())) {
                    toast.error("마감 일시를 선택해주세요.");
                    return;
                  }
                  createEvent.mutate({
                    teamId,
                    title: eventTitle.trim(),
                    dueAt: due,
                    assigneeId: eventAssignee !== "none" ? Number(eventAssignee) : undefined,
                  });
                }}
                disabled={createEvent.isPending}
              >
                <Plus className="mr-1 h-4 w-4" /> 추가
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── 평가 완료 안내 ──
  const evalDoneEl =
    isProject && hasEvaluated.data ? (
      <div className="rounded-2xl p-4 text-center" style={{ background: "var(--pos-bg)" }}>
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--pos-fg)" }} />
        <p className="font-semibold" style={{ color: "var(--pos-fg)" }}>
          평가를 완료했습니다
        </p>
        {data.team.evaluationStatus === "done" ? (
          <p className="text-xs mt-1" style={{ color: "var(--pos-fg)" }}>
            모든 평가가 끝나 배지가 부여되었습니다
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mt-1">
              아직 평가하지 않은 팀원이 있어요. 기다리거나 지금 마감할 수 있어요.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={forceCloseMutation.isPending}
              onClick={() => forceCloseMutation.mutate({ teamId })}
            >
              지금 평가 마감하고 배지 정산
            </Button>
          </>
        )}
      </div>
    ) : null;

  // ── 제출 항목 ──
  const deliverablesEl =
    deliverables.data && deliverables.data.length > 0 ? (
      <div className="rounded-2xl bg-card shadow-card p-4">
        <div className="text-base font-bold flex items-center gap-2 mb-3">
          <FolderOpen className="h-4 w-4 text-primary" /> 제출 항목
        </div>
        <div className="space-y-3">
          {deliverables.data.map(({ milestone, submission }) => {
            const input = subInputs[milestone.id] ?? { url: "", note: "" };
            return (
              <div key={milestone.id} className="rounded-xl bg-muted p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{milestone.title}</span>
                  {milestone.dueAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(milestone.dueAt).toLocaleDateString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                      })}{" "}
                      마감
                    </span>
                  )}
                </div>
                {milestone.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {milestone.description}
                  </p>
                )}
                {submission ? (
                  <div
                    className="flex items-center gap-2 text-xs rounded-md p-2"
                    style={{ background: "var(--pos-bg)", color: "var(--pos-fg)" }}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>제출 완료</span>
                    <a
                      href={submission.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 underline ml-auto"
                    >
                      링크 <ExternalLink className="h-3 w-3" />
                    </a>
                    {submission.reviewedAt && <span className="shrink-0">· 교수 확인함</span>}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--notice-fg)" }}>
                    아직 제출하지 않았어요.
                  </p>
                )}
                <Input
                  placeholder="결과물 링크 (https://… 구글드라이브·노션·깃허브)"
                  value={input.url}
                  onChange={(e) =>
                    setSubInputs((prev) => ({
                      ...prev,
                      [milestone.id]: { ...input, url: e.target.value },
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="메모 (선택)"
                    value={input.note}
                    onChange={(e) =>
                      setSubInputs((prev) => ({
                        ...prev,
                        [milestone.id]: { ...input, note: e.target.value },
                      }))
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    disabled={submitDeliverable.isPending}
                    onClick={() => {
                      if (!input.url.trim()) {
                        toast.error("결과물 링크를 입력해주세요.");
                        return;
                      }
                      submitDeliverable.mutate({
                        teamId,
                        milestoneId: milestone.id,
                        url: input.url.trim(),
                        note: input.note.trim() || undefined,
                      });
                    }}
                  >
                    {submission ? "수정 제출" : "제출"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  // ── AI 보고서 초안 ──
  const aiReportEl = (
    <div className="rounded-2xl bg-card shadow-card p-4">
      <div className="text-base font-bold flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" /> AI 보고서 초안
      </div>
      <div className="space-y-3">
        <Input
          value={reportTopic}
          onChange={(e) => setReportTopic(e.target.value)}
          placeholder="보고서 주제 (예: 인공지능 윤리 사례 분석)"
          maxLength={200}
        />
        <Textarea
          value={reportDetails}
          onChange={(e) => setReportDetails(e.target.value)}
          placeholder="추가 요구사항 (선택) — 분량, 꼭 들어갈 내용, 강조점 등"
          rows={2}
          maxLength={2000}
        />
        <Button
          className="w-full"
          onClick={() => {
            if (!reportTopic.trim()) {
              toast.error("보고서 주제를 입력해주세요.");
              return;
            }
            generateReport.mutate({
              teamId,
              topic: reportTopic.trim(),
              details: reportDetails.trim() || undefined,
            });
          }}
          disabled={generateReport.isPending}
        >
          <Sparkles className="mr-1 h-4 w-4" />
          {generateReport.isPending ? "생성 중... (최대 1분)" : "초안 생성"}
        </Button>

        {report && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                ⚠️ AI가 만든 초안이에요. 사실·출처는 직접 확인 후 사용하세요.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(report);
                  toast.success("초안을 복사했어요!");
                }}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> 복사
              </Button>
            </div>
            <div className="whitespace-pre-wrap text-sm rounded-lg p-3 bg-muted max-h-96 overflow-y-auto">
              {report}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── 주요 액션 (모바일 하단 · PC 레일 공용) ──
  const primaryActions = (
    <>
      {isActive && (
        <Button className="w-full" size="lg" onClick={() => setCompleteOpen(true)}>
          <CheckCircle2 className="mr-2 h-5 w-5" />
          {isProject ? "팀플 완료하기" : `${typeLabel} 종료하기`}
        </Button>
      )}
      {needsEvaluation && (
        <Button className="w-full" size="lg" onClick={() => setLocation(`/teams/${teamId}/evaluate`)}>
          <Star className="mr-2 h-5 w-5" /> 팀원 평가하기
        </Button>
      )}
      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-destructive"
          disabled={leaveMutation.isPending}
          onClick={() => setLeaveOpen(true)}
        >
          <LogOut className="mr-1 h-4 w-4" /> 팀 나가기
        </Button>
      )}
    </>
  );

  // ── PC 우측 요약 레일 ──
  const summaryRailEl = (
    <div className="rounded-2xl bg-card shadow-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="badge-tag text-xs font-bold px-2.5 py-0.5 rounded-full">{typeLabel}</span>
        {statusPill}
      </div>
      <div className="font-bold text-[15px] truncate">{data.course.name}</div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {data.course.professor} · 팀원 {data.members.length}명
      </div>
      {evTotal > 0 && (
        <>
          <div className="flex items-center justify-between text-xs mt-3">
            <span className="text-muted-foreground">진행률</span>
            <span className="font-bold">{evPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
            <div className="h-full bg-primary rounded-full" style={{ width: `${evPct}%` }} />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <button
        onClick={() => setLocation("/teams")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 팀 목록
      </button>

      {heroEl}

      <div className="lg:grid lg:grid-cols-[1.55fr_1fr] lg:gap-6 lg:items-start">
        {/* MAIN */}
        <div className="space-y-4">
          {membersEl}
          {memoEl}
          {scheduleEl}
          {evalDoneEl}
          {deliverablesEl}
          {aiReportEl}
          {/* 액션 — 모바일 하단 */}
          <div className="lg:hidden space-y-3">{primaryActions}</div>
        </div>

        {/* RIGHT RAIL (PC) */}
        <div className="hidden lg:block space-y-3">
          {summaryRailEl}
          {primaryActions}
        </div>
      </div>

      {/* 완료/종료 확인 */}
      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isProject ? "팀플을 완료하시겠습니까?" : `${typeLabel}을(를) 종료하시겠습니까?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isProject
                ? "팀플을 완료하면 팀원 평가가 시작됩니다. 이 작업은 되돌릴 수 없습니다."
                : "활동을 종료하면 완료 상태로 바뀝니다. 이 작업은 되돌릴 수 없습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => completeMutation.mutate({ teamId })}>
              {isProject ? "완료하기" : "종료하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 팀 나가기 확인 */}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>팀을 나가시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              나가면 다시 초대받아야 들어올 수 있어요. 내 담당 일정은 공동으로 전환되고, 마지막
              멤버가 나가면 그룹이 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveMutation.mutate({ teamId })}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
