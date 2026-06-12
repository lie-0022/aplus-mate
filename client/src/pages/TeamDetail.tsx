import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  UserCircle,
  MessageCircle,
  CheckCircle2,
  Star,
  ExternalLink,
  Shield,
  Lightbulb,
  Clock,
  Sparkles,
  Copy,
  CalendarDays,
  Circle,
  Trash2,
  Plus,
  LogOut,
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
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
  const typeLabel = MATCH_TYPE_LABELS[(data.team.teamType ?? "project") as MatchType];
  const needsEvaluation =
    isProject &&
    isCompleted &&
    data.team.evaluationStatus !== "done" &&
    !hasEvaluated.data;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setLocation("/teams")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 팀 목록
      </button>

      {/* Team Info */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-bold text-lg">{data.course.name}</h1>
              <p className="text-sm text-muted-foreground">{data.course.professor}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline">{typeLabel}</Badge>
              <Badge
                variant="secondary"
                className={
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
                }
              >
                {isActive ? "진행 중" : "완료"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-primary" />
            팀원 ({data.members.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.members.map((member) => (
            <div
              key={member.teamMember.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {member.user.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {member.user.name}
                    {member.user.id === user?.id && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        나
                      </Badge>
                    )}
                    {member.teamMember.role !== "member" && (
                      <Badge
                        variant="secondary"
                        className={
                          member.teamMember.role === "mentor"
                            ? "text-[10px] py-0 bg-sky-100 text-sky-700 border-0"
                            : "text-[10px] py-0"
                        }
                      >
                        {ROLE_LABELS[member.teamMember.role as MentoringRole]}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {member.user.department} · {member.user.year}학년
                  </div>
                </div>
              </div>
              {member.user.kakaoOpenChatUrl && (
                <a
                  href={member.user.kakaoOpenChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  오픈채팅
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
          {/* C3: 외부채널 안전수칙 고지 */}
          <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
            ⚠️ 외부 오픈채팅에서는{" "}
            <span className="font-medium text-foreground">
              실명·금융정보·송금 요구에 응하지 마세요.
            </span>{" "}
            문제가 있으면{" "}
            <a
              href="mailto:jayjun.rim@gmail.com"
              className="text-primary underline"
            >
              운영자에게 신고
            </a>
            할 수 있어요.
          </p>
        </CardContent>
      </Card>

      {/* 팀 일정 */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            일정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pb-4">
          {events.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              아직 일정이 없어요. 과제 마감일이나 회의 일정을 등록해보세요!
            </p>
          )}
          {events.data?.map((ev) => {
            const d = dday(ev.dueAt);
            return (
              <div
                key={ev.id}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() =>
                    setEventDone.mutate({ eventId: ev.id, isDone: !ev.isDone })
                  }
                  disabled={setEventDone.isPending}
                  aria-label={ev.isDone ? "완료 해제" : "완료 처리"}
                >
                  {ev.isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
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
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    완료
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className={
                      d.tone === "over"
                        ? "text-xs bg-red-100 text-red-700"
                        : d.tone === "soon"
                          ? "text-xs bg-amber-100 text-amber-700"
                          : "text-xs"
                    }
                  >
                    {d.label}
                  </Badge>
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
                  variant="outline"
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
                      assigneeId:
                        eventAssignee !== "none" ? Number(eventAssignee) : undefined,
                    });
                  }}
                  disabled={createEvent.isPending}
                >
                  <Plus className="mr-1 h-4 w-4" /> 추가
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full gradient-primary text-white border-0" size="lg">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {isProject ? "팀플 완료하기" : `${typeLabel} 종료하기`}
            </Button>
          </AlertDialogTrigger>
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
              <AlertDialogAction
                onClick={() => completeMutation.mutate({ teamId })}
                className="gradient-primary text-white border-0"
              >
                {isProject ? "완료하기" : "종료하기"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {needsEvaluation && (
        <Button
          className="w-full gradient-primary text-white border-0"
          size="lg"
          onClick={() => setLocation(`/teams/${teamId}/evaluate`)}
        >
          <Star className="mr-2 h-5 w-5" />
          팀원 평가하기
        </Button>
      )}

      {isProject && hasEvaluated.data && (
        <Card className="border border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-green-700">평가를 완료했습니다</p>
            <p className="text-xs text-green-600 mt-1">
              모든 팀원이 평가를 완료하면 배지가 부여됩니다
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI 보고서 초안 */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI 보고서 초안
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
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
            className="w-full gradient-primary text-white border-0"
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
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(report);
                    toast.success("초안을 복사했어요!");
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> 복사
                </Button>
              </div>
              <div className="whitespace-pre-wrap text-sm border rounded-lg p-3 bg-muted/30 max-h-96 overflow-y-auto">
                {report}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 팀 나가기 — 활성 그룹만 */}
      {isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              disabled={leaveMutation.isPending}
            >
              <LogOut className="mr-1 h-4 w-4" /> 팀 나가기
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>팀을 나가시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                나가면 다시 초대받아야 들어올 수 있어요. 내 담당 일정은 공동으로
                전환되고, 마지막 멤버가 나가면 그룹이 삭제됩니다.
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
      )}
    </div>
  );
}
