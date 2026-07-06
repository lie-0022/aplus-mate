import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ClipboardList, CheckCircle2 } from "lucide-react";
import { parseJsonStringArray } from "@/lib/utils-parse";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const SCALE_LABELS = ["전혀 아니다", "아니다", "보통", "그렇다", "매우 그렇다"];

// 학생 설문 응답 — 척도(1~5)·객관식 전 문항 필수, 1인 1회.
export default function SurveyAnswer() {
  const params = useParams<{ id: string }>();
  const surveyId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.surveys.get.useQuery({ surveyId });
  // scale/choice는 숫자, text는 문자열
  const [answers, setAnswers] = useState<Record<number, number | string>>({});

  const submit = trpc.surveys.submit.useMutation({
    onSuccess: () => {
      utils.surveys.get.invalidate({ surveyId });
      utils.surveys.listForCourse.invalidate();
      toast.success("설문에 응답했어요. 감사합니다!");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">설문을 찾을 수 없거나 권한이 없습니다.</p>
        <Button variant="link" onClick={() => setLocation("/courses")}>
          수업 목록으로
        </Button>
      </div>
    );
  }

  const backToCourse = () => setLocation(`/courses/${data.survey.courseId}`);

  if (data.responded) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">이미 응답한 설문이에요</h2>
        <p className="text-sm text-muted-foreground mb-4">참여해주셔서 감사합니다!</p>
        <Button variant="secondary" onClick={backToCourse}>
          수업으로 돌아가기
        </Button>
      </div>
    );
  }

  if (data.survey.status !== "open") {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">마감된 설문이에요</h2>
        <Button variant="secondary" onClick={backToCourse}>
          수업으로 돌아가기
        </Button>
      </div>
    );
  }

  const handleSubmit = () => {
    for (const q of data.questions) {
      const a = answers[q.id];
      const empty =
        a === undefined || (q.type === "text" && String(a).trim().length === 0);
      if (empty) {
        toast.error("모든 문항에 응답해주세요.");
        return;
      }
    }
    submit.mutate({
      surveyId,
      answers: data.questions.map((q) =>
        q.type === "text"
          ? { questionId: q.id, textValue: String(answers[q.id]).trim() }
          : { questionId: q.id, value: answers[q.id] as number }
      ),
    });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={backToCourse}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 수업으로
      </button>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          {data.survey.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          교수님 설문 · 응답은 익명으로 집계돼요
        </p>
      </div>

      {data.questions.map((q, i) => (
        <Card key={q.id} className="rounded-2xl border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium leading-snug">
              {i + 1}. {q.text}
              {answers[q.id] !== undefined &&
                !(q.type === "text" && String(answers[q.id]).trim() === "") && (
                  <Badge variant="secondary" className="ml-2 text-[10px] badge-pos border-0">
                    응답함
                  </Badge>
                )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {q.type === "scale" ? (
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    className={`flex-1 py-2 rounded-lg text-center transition-colors ${
                      answers[q.id] === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    <div className="text-sm font-bold">{v}</div>
                    <div className="text-[9px] leading-tight opacity-80">
                      {SCALE_LABELS[v - 1]}
                    </div>
                  </button>
                ))}
              </div>
            ) : q.type === "choice" ? (
              <div className="space-y-1.5">
                {parseJsonStringArray(q.options).map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                    className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                      answers[q.id] === oi
                        ? "border-primary bg-primary/5 font-medium"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              // 주관식 — 자유 서술
              <Textarea
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                placeholder="자유롭게 작성해주세요 (익명)"
                rows={3}
                maxLength={2000}
              />
            )}
          </CardContent>
        </Card>
      ))}

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={submit.isPending}
      >
        {submit.isPending ? "제출 중..." : "응답 제출하기"}
      </Button>
    </div>
  );
}
