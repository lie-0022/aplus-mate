import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MATCH_TYPE_LABELS, ROLE_LABELS, type MatchType, type MentoringRole } from "@shared/const";
import { parseSkillTags, parseJsonStringArray } from "@/lib/utils-parse";
import {
  Presentation,
  Users,
  Megaphone,
  ClipboardList,
  Plus,
  Trash2,
  Search,
  BarChart3,
  Lock,
  UserCheck,
  Wand2,
  FolderOpen,
  CheckCircle2,
  ExternalLink,
  CalendarClock,
  Download,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

// 설문 빌더의 문항 편집 상태
type DraftQuestion = {
  type: "scale" | "choice" | "text";
  text: string;
  options: string[];
};

// 대시보드 요약 통계 카드
function StatCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${highlight ? "border-amber-300 bg-amber-50" : "bg-card"}`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// 설문 빌더 부담을 줄이는 원클릭 템플릿(교수는 제목·문항을 직접 짜지 않아도 된다)
const SURVEY_TEMPLATES: { label: string; title: string; questions: DraftQuestion[] }[] = [
  {
    label: "중간 강의 만족도",
    title: "중간 강의 만족도 조사",
    questions: [
      { type: "scale", text: "강의 내용에 전반적으로 만족하시나요?", options: [] },
      { type: "scale", text: "강의 진도(속도)는 적절한가요?", options: [] },
      { type: "scale", text: "과제·실습의 양은 적절한가요?", options: [] },
      { type: "text", text: "강의에 바라는 점이 있다면 자유롭게 적어주세요.", options: [] },
    ],
  },
  {
    label: "팀플 운영 점검",
    title: "팀 프로젝트 운영 점검",
    questions: [
      { type: "scale", text: "팀 활동에 잘 참여하고 있나요?", options: [] },
      { type: "scale", text: "팀원 간 협업은 원활한가요?", options: [] },
      {
        type: "choice",
        text: "팀 운영에서 가장 어려운 점은 무엇인가요?",
        options: ["일정 조율", "역할 분담", "소통", "실력 차이", "특별히 없음"],
      },
      { type: "text", text: "팀 활동 중 도움이 필요한 부분을 적어주세요.", options: [] },
    ],
  },
];

// CSV 셀 이스케이프 + UTF-8 BOM 다운로드(엑셀 한글 깨짐 방지)
function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Professor() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isProfessor = user?.role === "professor" || user?.role === "admin";

  const myCourses = trpc.professor.myCourses.useQuery(undefined, { enabled: isProfessor });
  const [courseId, setCourseId] = useState<number | null>(null);
  // 첫 로드 시 첫 수업 자동 선택
  const selectedCourseId = courseId ?? myCourses.data?.[0]?.id ?? null;

  // ── 수업 클레임 ──
  const [claimQuery, setClaimQuery] = useState("");
  // 교수는 보통 세팅(수업 배정)이 끝나 있으므로 클레임 검색은 기본 접어 둔다.
  const [showClaim, setShowClaim] = useState(false);
  const claimSearch = trpc.courses.search.useQuery(
    { query: claimQuery },
    { enabled: isProfessor && claimQuery.length > 0 }
  );
  const claimMutation = trpc.professor.claimCourse.useMutation({
    onSuccess: () => {
      utils.professor.myCourses.invalidate();
      setClaimQuery("");
      toast.success("담당 수업으로 등록했어요!");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── 수업별 데이터 ──
  const dashboard = trpc.professor.dashboard.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );
  const students = trpc.professor.students.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );
  const teams = trpc.professor.teams.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );
  const announcements = trpc.announcements.list.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );
  const surveysList = trpc.surveys.listForCourse.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );

  // ── 산출물(마일스톤) ──
  const milestones = trpc.professor.milestones.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );
  const submissions = trpc.professor.submissions.useQuery(
    { courseId: selectedCourseId! },
    { enabled: isProfessor && selectedCourseId != null }
  );
  const [msTitle, setMsTitle] = useState("");
  const [msDesc, setMsDesc] = useState("");
  const [msDue, setMsDue] = useState("");
  const createMilestone = trpc.professor.createMilestone.useMutation({
    onSuccess: () => {
      utils.professor.milestones.invalidate();
      setMsTitle("");
      setMsDesc("");
      setMsDue("");
      toast.success("제출 항목을 만들었어요.");
    },
    onError: (err) => toast.error(err.message),
  });
  const removeMilestone = trpc.professor.removeMilestone.useMutation({
    onSuccess: () => {
      utils.professor.milestones.invalidate();
      utils.professor.submissions.invalidate();
      toast.success("삭제했어요.");
    },
    onError: (err) => toast.error(err.message),
  });
  const reviewSubmission = trpc.professor.reviewSubmission.useMutation({
    onSuccess: () => utils.professor.submissions.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  // ── 공지 작성 ──
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const createAnnouncement = trpc.announcements.create.useMutation({
    onSuccess: () => {
      utils.announcements.list.invalidate();
      setAnnTitle("");
      setAnnContent("");
      toast.success("공지를 올렸어요!");
    },
    onError: (err) => toast.error(err.message),
  });
  const removeAnnouncement = trpc.announcements.remove.useMutation({
    onSuccess: () => {
      utils.announcements.list.invalidate();
      toast.success("공지를 삭제했어요.");
    },
    onError: (err) => toast.error(err.message),
  });

  // ── 설문 빌더 ──
  const [surveyTitle, setSurveyTitle] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { type: "scale", text: "", options: [] },
  ]);
  const createSurvey = trpc.surveys.create.useMutation({
    onSuccess: () => {
      utils.surveys.listForCourse.invalidate();
      setSurveyTitle("");
      setQuestions([{ type: "scale", text: "", options: [] }]);
      toast.success("설문을 시작했어요! 수강생에게 보입니다.");
    },
    onError: (err) => toast.error(err.message),
  });
  const closeSurvey = trpc.surveys.close.useMutation({
    onSuccess: () => {
      utils.surveys.listForCourse.invalidate();
      toast.success("설문을 마감했어요.");
    },
    onError: (err) => toast.error(err.message),
  });

  // 결과 보기 — 선택된 설문 1개
  const [resultSurveyId, setResultSurveyId] = useState<number | null>(null);
  const results = trpc.surveys.results.useQuery(
    { surveyId: resultSurveyId! },
    { enabled: isProfessor && resultSurveyId != null }
  );

  if (!isProfessor) {
    return (
      <div className="text-center py-12">
        <Presentation className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">교수 전용 페이지예요</h2>
        <p className="text-sm text-muted-foreground">
          교수 계정 등록은 운영자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const updateQuestion = (i: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };

  const handleCreateSurvey = () => {
    if (!surveyTitle.trim()) {
      toast.error("설문 제목을 입력해주세요.");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        toast.error(`${i + 1}번 문항 내용을 입력해주세요.`);
        return;
      }
      if (q.type === "choice") {
        const opts = q.options.map((o: string) => o.trim()).filter(Boolean);
        if (opts.length < 2) {
          toast.error(`${i + 1}번 객관식 문항에 선택지를 2개 이상 넣어주세요.`);
          return;
        }
      }
    }
    createSurvey.mutate({
      courseId: selectedCourseId!,
      title: surveyTitle.trim(),
      questions: questions.map((q) => ({
        type: q.type,
        text: q.text.trim(),
        options:
          q.type === "choice"
            ? q.options.map((o) => o.trim()).filter(Boolean)
            : undefined,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Presentation className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">교수 페이지</h1>
      </div>

      {/* 담당 수업 선택 / 클레임 */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-3">
          {myCourses.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : myCourses.data && myCourses.data.length > 0 ? (
            <Select
              value={selectedCourseId != null ? String(selectedCourseId) : undefined}
              onValueChange={(v) => setCourseId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="담당 수업 선택" />
              </SelectTrigger>
              <SelectContent>
                {myCourses.data.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.professor})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              아직 담당 수업이 없어요. 아래에서 수업을 검색해 등록하세요.
            </p>
          )}

          {/* 클레임 — 담당 수업이 이미 있으면 접어 두고, 필요할 때만 펼친다 */}
          {myCourses.data && myCourses.data.length > 0 && !showClaim ? (
            <button
              onClick={() => setShowClaim(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> 다른 수업 담당 등록
            </button>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={claimQuery}
                  onChange={(e) => setClaimQuery(e.target.value)}
                  placeholder="담당할 수업 검색 (수업명·교수명·코드)"
                  className="pl-10"
                />
              </div>
              {claimQuery.length > 0 &&
                claimSearch.data?.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {c.professor} {c.courseCode && `· ${c.courseCode}`}
                      </span>
                    </div>
                    {c.professorId != null ? (
                      <Badge variant="secondary" className="text-xs">
                        담당 교수 있음
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => claimMutation.mutate({ courseId: c.id })}
                        disabled={claimMutation.isPending}
                      >
                        담당 등록
                      </Button>
                    )}
                  </div>
                ))}
            </>
          )}
        </CardContent>
      </Card>

      {selectedCourseId != null && (
        <Tabs defaultValue="dashboard">
          <TabsList className="w-full">
            <TabsTrigger value="dashboard" className="flex-1">
              현황
            </TabsTrigger>
            <TabsTrigger value="students" className="flex-1">
              수강생
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex-1">
              팀
            </TabsTrigger>
            <TabsTrigger value="announce" className="flex-1">
              공지
            </TabsTrigger>
            <TabsTrigger value="survey" className="flex-1">
              설문
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="flex-1">
              제출
            </TabsTrigger>
          </TabsList>

          {/* 현황 대시보드 */}
          <TabsContent value="dashboard" className="mt-4 space-y-3">
            {dashboard.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
            {dashboard.data &&
              (() => {
                const d = dashboard.data;
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        label="수강생"
                        value={d.studentCount}
                        sub={`프로필 완성 ${d.profileCompletedCount}명`}
                        icon={<Users className="h-4 w-4" />}
                      />
                      <StatCard
                        label="진행 중 팀"
                        value={d.activeTeamCount}
                        sub={`완료 ${d.completedTeamCount}팀`}
                        icon={<Presentation className="h-4 w-4" />}
                      />
                      <StatCard
                        label="팀 합류"
                        value={d.assignedCount}
                        sub={`전체 ${d.studentCount}명 중`}
                        icon={<UserCheck className="h-4 w-4" />}
                      />
                      <StatCard
                        label="팀 미배정"
                        value={d.unassignedStudents.length}
                        sub={d.unassignedStudents.length > 0 ? "독려가 필요해요" : "모두 합류!"}
                        icon={<Users className="h-4 w-4" />}
                        highlight={d.unassignedStudents.length > 0}
                      />
                    </div>

                    <Card className="border shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" /> 팀 미배정 학생 (
                          {d.unassignedStudents.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-4">
                        {d.unassignedStudents.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            모든 학생이 팀에 합류했어요 🎉
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {d.unassignedStudents.map((s) => (
                              <div
                                key={s.id}
                                className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                              >
                                <span className="font-medium">{s.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {s.department} · {s.year}학년
                                  {!s.profileCompleted && " · 프로필 미완성"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {d.surveys.length > 0 && (
                      <Card className="border shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-primary" /> 설문 응답률
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 space-y-2.5">
                          {d.surveys.map((sv) => {
                            const rate =
                              d.studentCount > 0
                                ? Math.round((sv.respondents / d.studentCount) * 100)
                                : 0;
                            return (
                              <div key={sv.id}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="font-medium truncate">
                                    {sv.title}
                                    {sv.status === "closed" && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        (마감)
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                    {sv.respondents}/{d.studentCount}명 ({rate}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })()}

            {/* 마감 주의 산출물 — 마감 지남/임박인데 미제출 팀이 있는 항목 */}
            {(() => {
              const msList = (milestones.data ?? []).filter((m) => m.dueAt);
              const teamList = teams.data ?? [];
              if (msList.length === 0 || teamList.length === 0) return null;
              const now = Date.now();
              const rows = msList.flatMap((m) => {
                const due = new Date(m.dueAt!).getTime();
                const submitted = new Set(
                  (submissions.data ?? [])
                    .filter((s) => s.milestoneId === m.id)
                    .map((s) => s.teamId)
                );
                const missing = teamList.filter((t) => !submitted.has(t.team.id)).length;
                if (missing === 0) return [];
                const overdue = due < now;
                const soon = !overdue && due - now < 48 * 3600 * 1000;
                if (!overdue && !soon) return [];
                return [{ id: m.id, title: m.title, missing, overdue }];
              });
              if (rows.length === 0) return null;
              return (
                <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-amber-600" /> 마감 주의 산출물
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-1.5">
                    {rows.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{r.title}</span>
                        <span
                          className={`text-xs shrink-0 ml-2 ${r.overdue ? "text-destructive" : "text-amber-700"}`}
                        >
                          {r.overdue ? "마감 지남" : "임박"} · 미제출 {r.missing}팀
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>

          {/* 수강생 */}
          <TabsContent value="students" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> 수강생 {students.data?.length ?? 0}명
            </p>
            {students.data?.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  아직 등록한 수강생이 없어요
                </CardContent>
              </Card>
            )}
            {students.data?.map((s) => (
              <Card key={s.userCourse.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{s.user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.user.department} · {s.user.year}학년
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                      {parseSkillTags(s.user.skillTags).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 팀 현황 */}
          <TabsContent value="teams" className="mt-4 space-y-2">
            {teams.data?.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  아직 구성된 팀이 없어요
                </CardContent>
              </Card>
            )}
            {teams.data?.map((t) => (
              <Card key={t.team.id} className="border shadow-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {MATCH_TYPE_LABELS[(t.team.teamType ?? "project") as MatchType]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={
                        t.team.status === "active"
                          ? "text-xs bg-blue-100 text-blue-700"
                          : "text-xs bg-green-100 text-green-700"
                      }
                    >
                      {t.team.status === "active" ? "진행 중" : "완료"}
                    </Badge>
                    {t.team.teamType === "project" && t.team.status === "completed" && (
                      <Badge variant="secondary" className="text-xs">
                        평가{" "}
                        {t.team.evaluationStatus === "done"
                          ? "완료"
                          : t.team.evaluationStatus === "in_progress"
                            ? "진행 중"
                            : "대기"}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {t.members.length}명
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.members.map((m) => (
                      <span
                        key={m.teamMember.id}
                        className="text-xs bg-muted rounded-full px-2.5 py-1"
                      >
                        {m.user.name}
                        {m.teamMember.role !== "member" &&
                          ` (${ROLE_LABELS[m.teamMember.role as MentoringRole]})`}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 공지 */}
          <TabsContent value="announce" className="mt-4 space-y-3">
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" /> 공지 작성
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Input
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="공지 제목"
                  maxLength={300}
                />
                <Textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="공지 내용"
                  rows={3}
                  maxLength={5000}
                />
                <Button
                  className="w-full gradient-primary text-white border-0"
                  onClick={() => {
                    if (!annTitle.trim() || !annContent.trim()) {
                      toast.error("제목과 내용을 입력해주세요.");
                      return;
                    }
                    createAnnouncement.mutate({
                      courseId: selectedCourseId,
                      title: annTitle.trim(),
                      content: annContent.trim(),
                    });
                  }}
                  disabled={createAnnouncement.isPending}
                >
                  공지 올리기
                </Button>
              </CardContent>
            </Card>

            {announcements.data?.map((a) => (
              <Card key={a.id} className="border shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{a.title}</div>
                    <button
                      onClick={() => removeAnnouncement.mutate({ announcementId: a.id })}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="공지 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                    {a.content}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(a.createdAt).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 설문 */}
          <TabsContent value="survey" className="mt-4 space-y-3">
            {/* 빌더 */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" /> 새 설문 만들기
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                {/* 원클릭 템플릿 — 교수가 문항을 직접 짜지 않아도 되도록 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-full">
                    템플릿으로 빠르게 시작 (불러온 뒤 자유롭게 수정):
                  </span>
                  {SURVEY_TEMPLATES.map((tpl) => (
                    <Button
                      key={tpl.label}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setSurveyTitle(tpl.title);
                        setQuestions(
                          tpl.questions.map((q) => ({ ...q, options: [...q.options] }))
                        );
                        toast.success(`'${tpl.label}' 템플릿을 불러왔어요.`);
                      }}
                    >
                      <Wand2 className="mr-1 h-3 w-3" /> {tpl.label}
                    </Button>
                  ))}
                </div>
                <Input
                  value={surveyTitle}
                  onChange={(e) => setSurveyTitle(e.target.value)}
                  placeholder="설문 제목 (예: 중간 강의 만족도 조사)"
                  maxLength={300}
                />
                {questions.map((q, i) => (
                  <div key={i} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        {i + 1}번
                      </span>
                      <Select
                        value={q.type}
                        onValueChange={(v) =>
                          updateQuestion(i, {
                            type: v as "scale" | "choice" | "text",
                            options: v === "choice" && q.options.length === 0 ? ["", ""] : q.options,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scale">5점 척도</SelectItem>
                          <SelectItem value="choice">객관식</SelectItem>
                          <SelectItem value="text">주관식</SelectItem>
                        </SelectContent>
                      </Select>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          className="ml-auto text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setQuestions((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          aria-label="문항 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Input
                      value={q.text}
                      onChange={(e) => updateQuestion(i, { text: e.target.value })}
                      placeholder={
                        q.type === "scale"
                          ? "질문 (예: 강의 난이도가 적절했나요?)"
                          : q.type === "choice"
                            ? "질문 (예: 선호하는 평가 방식은?)"
                            : "질문 (예: 수업에서 개선되면 좋을 점을 적어주세요)"
                      }
                      maxLength={500}
                    />
                    {q.type === "scale" && (
                      <p className="text-[11px] text-muted-foreground">
                        학생은 1점(전혀 아니다) ~ 5점(매우 그렇다)으로 응답해요.
                      </p>
                    )}
                    {q.type === "text" && (
                      <p className="text-[11px] text-muted-foreground">
                        학생이 자유롭게 서술해요. (최대 2,000자)
                      </p>
                    )}
                    {q.type === "choice" && (
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-1.5">
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const next = [...q.options];
                                next[oi] = e.target.value;
                                updateQuestion(i, { options: next });
                              }}
                              placeholder={`선택지 ${oi + 1}`}
                              className="h-8 text-sm"
                              maxLength={200}
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() =>
                                  updateQuestion(i, {
                                    options: q.options.filter((_, idx) => idx !== oi),
                                  })
                                }
                                aria-label="선택지 삭제"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {q.options.length < 10 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              updateQuestion(i, { options: [...q.options, ""] })
                            }
                          >
                            <Plus className="h-3 w-3 mr-1" /> 선택지 추가
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      setQuestions((prev) => [
                        ...prev,
                        { type: "scale", text: "", options: [] },
                      ])
                    }
                    disabled={questions.length >= 20}
                  >
                    <Plus className="h-4 w-4 mr-1" /> 문항 추가
                  </Button>
                  <Button
                    className="flex-1 gradient-primary text-white border-0"
                    onClick={handleCreateSurvey}
                    disabled={createSurvey.isPending}
                  >
                    설문 시작
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 설문 목록 + 결과 */}
            {surveysList.data?.map(({ survey }) => (
              <Card key={survey.id} className="border shadow-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm flex-1">{survey.title}</span>
                    <Badge
                      variant="secondary"
                      className={
                        survey.status === "open"
                          ? "text-xs bg-blue-100 text-blue-700"
                          : "text-xs"
                      }
                    >
                      {survey.status === "open" ? "진행 중" : "마감"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setResultSurveyId(resultSurveyId === survey.id ? null : survey.id)
                      }
                    >
                      <BarChart3 className="h-3.5 w-3.5 mr-1" />
                      {resultSurveyId === survey.id ? "결과 닫기" : "결과 보기"}
                    </Button>
                    {survey.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-muted-foreground"
                        onClick={() => closeSurvey.mutate({ surveyId: survey.id })}
                        disabled={closeSurvey.isPending}
                      >
                        <Lock className="h-3.5 w-3.5 mr-1" /> 마감하기
                      </Button>
                    )}
                  </div>

                  {resultSurveyId === survey.id && results.data && (
                    <div className="space-y-3 pt-1 border-t">
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-muted-foreground">
                          응답자 {results.data.respondentCount}명
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            const data = results.data!;
                            const lines: string[] = [];
                            lines.push(`설문,${csvCell(survey.title)}`);
                            lines.push(`응답자수,${data.respondentCount}`);
                            lines.push("");
                            lines.push("번호,문항,유형,응답수,결과");
                            data.questions.forEach((r, i) => {
                              const typeKo =
                                r.question.type === "scale"
                                  ? "척도"
                                  : r.question.type === "choice"
                                    ? "객관식"
                                    : "주관식";
                              let result = "";
                              if (r.question.type === "scale") {
                                const dist = (r.distribution ?? [])
                                  .map((c, di) => `${di + 1}점:${c}`)
                                  .join(" ");
                                result = `평균 ${r.average} / ${dist}`;
                              } else if (r.question.type === "choice") {
                                const opts = parseJsonStringArray(r.question.options);
                                result = opts
                                  .map((o, oi) => `${o}:${r.choiceCounts?.[oi] ?? 0}`)
                                  .join(" / ");
                              } else {
                                result = (r.textAnswers ?? []).join(" || ");
                              }
                              lines.push(
                                `${i + 1},${csvCell(r.question.text)},${typeKo},${r.count},${csvCell(result)}`
                              );
                            });
                            downloadCsv(`${survey.title}_결과.csv`, lines.join("\n"));
                          }}
                        >
                          <Download className="mr-1 h-3 w-3" /> CSV
                        </Button>
                      </div>
                      {results.data.questions.map((r, qi) => (
                        <div key={r.question.id} className="space-y-1">
                          <div className="text-sm font-medium">
                            {qi + 1}. {r.question.text}
                          </div>
                          {r.question.type === "scale" ? (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">
                                평균 <span className="font-bold text-foreground">{r.average}</span>점 · {r.count}명 응답
                              </div>
                              <div className="flex gap-1 items-end h-12">
                                {r.distribution?.map((cnt, di) => {
                                  const max = Math.max(...(r.distribution ?? [1]), 1);
                                  return (
                                    <div key={di} className="flex-1 flex flex-col items-center gap-0.5">
                                      <div
                                        className="w-full bg-primary/70 rounded-t"
                                        style={{ height: `${(cnt / max) * 32 + (cnt > 0 ? 4 : 0)}px` }}
                                      />
                                      <span className="text-[10px] text-muted-foreground">
                                        {di + 1}점({cnt})
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : r.question.type === "choice" ? (
                            <div className="space-y-1">
                              {parseJsonStringArray(r.question.options).map((opt, oi) => {
                                const cnt = r.choiceCounts?.[oi] ?? 0;
                                const total = r.count || 1;
                                return (
                                  <div key={oi} className="flex items-center gap-2 text-xs">
                                    <span className="w-28 truncate">{opt}</span>
                                    <div className="flex-1 bg-muted rounded h-3 overflow-hidden">
                                      <div
                                        className="bg-primary/70 h-full rounded"
                                        style={{ width: `${(cnt / total) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-muted-foreground w-8 text-right">
                                      {cnt}명
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            // 주관식 — 익명 답변 나열
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {(r.textAnswers ?? []).length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  아직 답변이 없어요
                                </p>
                              )}
                              {(r.textAnswers ?? []).map((t, ti) => (
                                <div
                                  key={ti}
                                  className="text-xs p-2 rounded bg-muted/50 whitespace-pre-wrap"
                                >
                                  {t}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 산출물 제출 현황 */}
          <TabsContent value="deliverables" className="mt-4 space-y-3">
            {/* 제출 항목 만들기 */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" /> 제출 항목 만들기
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Input
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                  placeholder="제출 항목 제목 (예: 1차 기획안)"
                  maxLength={200}
                />
                <Textarea
                  value={msDesc}
                  onChange={(e) => setMsDesc(e.target.value)}
                  placeholder="설명 (선택) — 제출 방식·형식 안내"
                  rows={2}
                  maxLength={2000}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">마감(선택)</span>
                  <Input
                    type="datetime-local"
                    value={msDue}
                    onChange={(e) => setMsDue(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <Button
                  className="w-full gradient-primary text-white border-0"
                  disabled={createMilestone.isPending}
                  onClick={() => {
                    if (!msTitle.trim()) {
                      toast.error("제목을 입력해주세요.");
                      return;
                    }
                    createMilestone.mutate({
                      courseId: selectedCourseId,
                      title: msTitle.trim(),
                      description: msDesc.trim() || undefined,
                      dueAt: msDue ? new Date(msDue) : undefined,
                    });
                  }}
                >
                  만들기
                </Button>
              </CardContent>
            </Card>

            {milestones.data?.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  아직 제출 항목이 없어요. 위에서 만들어 학생들에게 결과물을 받아보세요.
                </CardContent>
              </Card>
            )}

            {milestones.data?.map((m) => {
              const subs = submissions.data?.filter((s) => s.milestoneId === m.id) ?? [];
              const teamList = teams.data ?? [];
              return (
                <Card key={m.id} className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{m.title}</CardTitle>
                        {m.dueAt && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CalendarClock className="h-3 w-3" />
                            마감{" "}
                            {new Date(m.dueAt).toLocaleString("ko-KR", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeMilestone.mutate({ milestoneId: m.id })}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                        {m.description}
                      </p>
                    )}
                    <p className="text-xs font-medium mt-1.5">
                      제출 {subs.length}/{teamList.length}팀
                    </p>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-1">
                    {teamList.length === 0 ? (
                      <p className="text-xs text-muted-foreground">아직 팀이 없어요.</p>
                    ) : (
                      teamList.map((t) => {
                        const sub = subs.find((s) => s.teamId === t.team.id);
                        const label =
                          t.members.map((mm) => mm.user.name).join(", ") || `팀 #${t.team.id}`;
                        return (
                          <div
                            key={t.team.id}
                            className="flex items-center justify-between gap-2 text-sm border-b last:border-0 py-1.5"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {sub ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              ) : (
                                <span className="h-4 w-4 rounded-full border border-muted-foreground/40 shrink-0" />
                              )}
                              <span className="truncate">{label}</span>
                            </div>
                            {sub ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <a
                                  href={sub.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                                >
                                  열기 <ExternalLink className="h-3 w-3" />
                                </a>
                                <button
                                  onClick={() =>
                                    reviewSubmission.mutate({
                                      submissionId: sub.id,
                                      reviewed: !sub.reviewedAt,
                                    })
                                  }
                                  className={`text-xs px-2 py-0.5 rounded-full border ${
                                    sub.reviewedAt
                                      ? "bg-green-100 text-green-700 border-green-200"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {sub.reviewedAt ? "확인함" : "확인"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground shrink-0">미제출</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
