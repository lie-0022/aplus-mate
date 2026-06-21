import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Star,
  Shield,
  Lightbulb,
  Clock,
  Send,
  UserCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

type EvalData = {
  evaluateeId: number;
  promiseScore: number;
  ideaScore: number;
  deadlineScore: number;
  grade: "A+" | "A" | "B+" | "B" | "C+";
};

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-0.5"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function TeamEvaluate() {
  const params = useParams<{ id: string }>();
  const teamId = parseInt(params.id || "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.teams.get.useQuery({ id: teamId });
  const hasEvaluated = trpc.evaluations.hasEvaluated.useQuery({ teamId });

  const [evalData, setEvalData] = useState<Record<number, EvalData>>({});

  const otherMembers = useMemo(
    () => data?.members.filter((m) => m.user.id !== user?.id) || [],
    [data, user]
  );

  const submitMutation = trpc.evaluations.submit.useMutation({
    onSuccess: () => {
      utils.evaluations.hasEvaluated.invalidate();
      utils.teams.get.invalidate();
      utils.teams.list.invalidate();
      toast.success("평가가 제출되었습니다!");
      setLocation(`/teams/${teamId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateEval = (userId: number, field: keyof EvalData, value: any) => {
    setEvalData((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        evaluateeId: userId,
        [field]: value,
      } as EvalData,
    }));
  };

  const handleSubmit = () => {
    const evaluations: EvalData[] = [];
    for (const member of otherMembers) {
      const ev = evalData[member.user.id];
      if (
        !ev ||
        !ev.promiseScore ||
        !ev.ideaScore ||
        !ev.deadlineScore ||
        !ev.grade
      ) {
        toast.error("모든 팀원의 평가를 완료해주세요.");
        return;
      }
      evaluations.push(ev);
    }
    submitMutation.mutate({ teamId, evaluations });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // 동료 평가는 팀플 전용 — 스터디·멘토멘티 그룹에는 평가 단계가 없다(서버도 차단).
  if (data && data.team.teamType !== "project") {
    return (
      <div className="text-center py-12">
        <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">팀플 팀만 평가할 수 있어요</h2>
        <p className="text-muted-foreground text-sm mb-4">
          스터디·멘토멘티 활동에는 동료 평가가 없어요.
        </p>
        <Button variant="outline" onClick={() => setLocation(`/teams/${teamId}`)}>
          팀 상세로 돌아가기
        </Button>
      </div>
    );
  }

  if (hasEvaluated.data) {
    return (
      <div className="text-center py-12">
        <Star className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">이미 평가를 완료했습니다</h2>
        <p className="text-muted-foreground text-sm mb-4">
          모든 팀원이 평가를 완료하면 배지가 부여됩니다
        </p>
        <Button variant="outline" onClick={() => setLocation(`/teams/${teamId}`)}>
          팀 상세로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setLocation(`/teams/${teamId}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 팀 상세
      </button>

      <div>
        <h1 className="text-xl font-bold">팀원 평가</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.course.name} · 팀원들의 활동을 평가해주세요
        </p>
      </div>

      {/* 평가 안내 (C3: 블라인드 고지 + 배지 프레이밍 + 보복성 저평가 신고·이의제기) */}
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
          <p>
            · 평가는{" "}
            <span className="font-medium text-foreground">익명(블라인드)</span>으로
            처리되며, 누가 어떤 점수를 줬는지는 공개되지 않아요.
          </p>
          <p>
            · 신뢰 배지는{" "}
            <span className="font-medium text-foreground">
              항목별 평균 4점 이상일 때 켜지는 보너스
            </span>
            예요. 배지가 없다고 낮은 평가를 받은 것은 아니에요.
          </p>
          <p>
            ·{" "}
            <span className="font-medium text-foreground">
              보복성·허위 저평가는 신고 대상
            </span>
            입니다. 부당한 평가를 받았다면{" "}
            <a
              href="mailto:jayjun.rim@gmail.com"
              className="text-primary underline"
            >
              운영자에게 이의제기
            </a>
            할 수 있어요.
          </p>
        </CardContent>
      </Card>

      {otherMembers.map((member) => {
        const ev = evalData[member.user.id] || {};
        return (
          <Card key={member.user.id} className="rounded-2xl border border-border/50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {member.user.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                {member.user.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {member.user.department} · {member.user.year}학년
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Promise Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">약속 철저</span>
                </div>
                <StarRating
                  value={ev.promiseScore || 0}
                  onChange={(v) => updateEval(member.user.id, "promiseScore", v)}
                />
              </div>

              {/* Idea Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-sky-brand" />
                  <span className="text-sm font-medium">아이디어 기여</span>
                </div>
                <StarRating
                  value={ev.ideaScore || 0}
                  onChange={(v) => updateEval(member.user.id, "ideaScore", v)}
                />
              </div>

              {/* Deadline Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">마감 준수</span>
                </div>
                <StarRating
                  value={ev.deadlineScore || 0}
                  onChange={(v) => updateEval(member.user.id, "deadlineScore", v)}
                />
              </div>

              {/* Grade */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">학점 결과</span>
                <Select
                  value={ev.grade || ""}
                  onValueChange={(v) => updateEval(member.user.id, "grade", v)}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {["A+", "A", "B+", "B", "C+"].map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button
        className="w-full gradient-primary text-white border-0"
        size="lg"
        onClick={handleSubmit}
        disabled={submitMutation.isPending}
      >
        <Send className="mr-2 h-5 w-5" />
        {submitMutation.isPending ? "제출 중..." : "평가 제출하기"}
      </Button>
    </div>
  );
}
