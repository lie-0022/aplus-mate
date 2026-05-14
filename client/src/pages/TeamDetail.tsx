import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function TeamDetail() {
  const params = useParams<{ id: string }>();
  const teamId = parseInt(params.id || "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.teams.get.useQuery({ id: teamId });
  const hasEvaluated = trpc.evaluations.hasEvaluated.useQuery({ teamId });

  const completeMutation = trpc.teams.complete.useMutation({
    onSuccess: () => {
      utils.teams.get.invalidate();
      utils.teams.list.invalidate();
      toast.success("팀플이 완료되었습니다! 이제 팀원을 평가해주세요.");
      setLocation(`/teams/${teamId}/evaluate`);
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
  const needsEvaluation =
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
        </CardContent>
      </Card>

      {/* Actions */}
      {isActive && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full gradient-primary text-white border-0" size="lg">
              <CheckCircle2 className="mr-2 h-5 w-5" />
              팀플 완료하기
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>팀플을 완료하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                팀플을 완료하면 팀원 평가가 시작됩니다. 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => completeMutation.mutate({ teamId })}
                className="gradient-primary text-white border-0"
              >
                완료하기
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

      {hasEvaluated.data && (
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
    </div>
  );
}
