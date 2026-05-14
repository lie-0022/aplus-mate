import { trpc } from "@/lib/trpc";
import { parseSkillTags } from "@/lib/utils-parse";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Handshake,
  Check,
  X,
  Shield,
  Lightbulb,
  Clock,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

const BADGE_ICONS: Record<string, typeof Shield> = {
  promise: Shield,
  idea: Lightbulb,
  deadline: Clock,
};
const BADGE_LABELS: Record<string, string> = {
  promise: "약속 철저",
  idea: "아이디어",
  deadline: "마감 준수",
};

export default function MatchingRequests() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.matching.received.useQuery();

  const acceptMutation = trpc.matching.accept.useMutation({
    onSuccess: () => {
      utils.matching.received.invalidate();
      utils.matching.pendingCount.invalidate();
      utils.teams.list.invalidate();
      toast.success("매칭을 수락했습니다! 팀이 생성되었어요.");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.matching.reject.useMutation({
    onSuccess: () => {
      utils.matching.received.invalidate();
      utils.matching.pendingCount.invalidate();
      toast.success("매칭을 거절했습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">매칭 요청</h1>
        {data && data.length > 0 && (
          <Badge variant="default" className="gradient-primary text-white border-0">
            {data.length}
          </Badge>
        )}
      </div>

      {data?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium mb-1">받은 매칭 요청이 없어요</p>
            <p className="text-sm text-muted-foreground">
              수업에 등록하면 다른 학생들이 커넥트 요청을 보낼 수 있어요
            </p>
          </CardContent>
        </Card>
      ) : (
        data?.map((item) => (
          <Card key={item.match.id} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge variant="secondary" className="text-xs mb-2">
                    {item.course.name}
                  </Badge>
                  <div className="font-medium text-sm">
                    {item.requester.department} · {item.requester.year}학년
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {item.requester.university}
                  </div>
                </div>
              </div>

              {/* Skill tags */}
              {parseSkillTags(item.requester.skillTags).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {parseSkillTags(item.requester.skillTags).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 gradient-primary text-white border-0"
                  size="sm"
                  onClick={() => acceptMutation.mutate({ matchId: item.match.id })}
                  disabled={acceptMutation.isPending}
                >
                  <Check className="mr-1 h-4 w-4" /> 수락
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  size="sm"
                  onClick={() => rejectMutation.mutate({ matchId: item.match.id })}
                  disabled={rejectMutation.isPending}
                >
                  <X className="mr-1 h-4 w-4" /> 거절
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
