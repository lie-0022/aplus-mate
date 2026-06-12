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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// 설문 빌더의 문항 편집 상태
type DraftQuestion = {
  type: "scale" | "choice" | "text";
  text: string;
  options: string[];
};

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

          {/* 클레임 */}
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
        </CardContent>
      </Card>

      {selectedCourseId != null && (
        <Tabs defaultValue="students">
          <TabsList className="w-full">
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
          </TabsList>

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
                  <div className="font-medium text-sm">{a.title}</div>
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
                      <p className="text-xs text-muted-foreground pt-2">
                        응답자 {results.data.respondentCount}명
                      </p>
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
        </Tabs>
      )}
    </div>
  );
}
