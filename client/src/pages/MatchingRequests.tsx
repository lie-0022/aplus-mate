import { trpc } from "@/lib/trpc";
import { parseSkillTags } from "@/lib/utils-parse";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useLocation } from "wouter";
import { useState } from "react";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";

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
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.matching.received.useQuery();
  const sent = trpc.matching.sent.useQuery();

  const cancelMutation = trpc.matching.cancel.useMutation({
    onSuccess: () => {
      utils.matching.sent.invalidate();
      toast.success("요청을 취소했어요. 다시 커넥트할 수 있어요.");
    },
    onError: (err) => toast.error(err.message),
  });

  // 수락 시점 kakao 수집(연락처 없는 수신자) — 요청자 커넥트 흐름과 대칭.
  const [kakaoModalOpen, setKakaoModalOpen] = useState(false);
  const [pendingMatchId, setPendingMatchId] = useState<number | null>(null);
  const [kakaoInput, setKakaoInput] = useState("");

  const acceptMutation = trpc.matching.accept.useMutation({
    onSuccess: (result) => {
      utils.matching.received.invalidate();
      utils.matching.pendingCount.invalidate();
      utils.teams.list.invalidate();
      toast.success("매칭을 수락했어요! 팀 화면으로 이동할게요.");
      // 수락 직후 생성된 팀 화면으로 이동(수신자는 항상 팀 멤버라 teams.get 권한 통과).
      if (result?.teamId) {
        setLocation(`/teams/${result.teamId}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const saveKakao = trpc.profile.update.useMutation({
    onSuccess: () => {
      // 모달을 먼저 닫고 후속 mutate는 다음 틱으로 — 닫힘 애니메이션과 리렌더가
      // 겹치면 Radix Presence가 잔존(body pointer-events 잠김)할 수 있다.
      const matchId = pendingMatchId;
      setKakaoModalOpen(false);
      setKakaoInput("");
      setPendingMatchId(null);
      utils.auth.me.invalidate();
      if (matchId != null) {
        setTimeout(() => acceptMutation.mutate({ matchId }), 0);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // 연락처 있으면 바로 수락, 없으면 모달로 받고 저장 후 수락.
  const handleAccept = (matchId: number) => {
    if (user?.kakaoOpenChatUrl) {
      acceptMutation.mutate({ matchId });
    } else {
      setPendingMatchId(matchId);
      setKakaoInput("");
      setKakaoModalOpen(true);
    }
  };

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

      <Tabs defaultValue="received">
        <TabsList className="w-full">
          <TabsTrigger value="received" className="flex-1">
            받은 요청 ({data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex-1">
            보낸 요청 ({sent.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-4 space-y-3">
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
                <div
                  onClick={() => setLocation(`/users/${item.requester.id}`)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-1 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {item.course.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                    </Badge>
                    {item.match.matchType === "mentoring" && (
                      <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700">
                        {item.match.requesterRole === "mentor"
                          ? "멘토로 지원했어요"
                          : "멘토를 찾고 있어요"}
                      </Badge>
                    )}
                  </div>
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
                  onClick={() => handleAccept(item.match.id)}
                  disabled={acceptMutation.isPending || saveKakao.isPending}
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
        </TabsContent>

        <TabsContent value="sent" className="mt-4 space-y-3">
          {sent.data?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-1">보낸 요청이 없어요</p>
                <p className="text-sm text-muted-foreground">
                  수업 상세의 팀원 찾기에서 커넥트를 보내보세요
                </p>
              </CardContent>
            </Card>
          ) : (
            sent.data?.map((item) => (
              <Card key={item.match.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.course.name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                        </Badge>
                        {item.match.matchType === "mentoring" && (
                          <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700">
                            {item.match.requesterRole === "mentor"
                              ? "멘토로 지원"
                              : "멘토 찾는 중"}
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium text-sm">
                        {item.receiver.department} · {item.receiver.year}학년
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.receiver.university} · 수락 대기 중
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-muted-foreground hover:text-destructive"
                    size="sm"
                    onClick={() => cancelMutation.mutate({ matchId: item.match.id })}
                    disabled={cancelMutation.isPending}
                  >
                    <X className="mr-1 h-4 w-4" /> 요청 취소
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={kakaoModalOpen} onOpenChange={setKakaoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카카오 오픈채팅 링크</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              수락하면 팀원에게 이 링크가 공개돼요. 수락하려면 먼저 입력해주세요.
            </p>
            <Input
              value={kakaoInput}
              onChange={(e) => setKakaoInput(e.target.value)}
              placeholder="https://open.kakao.com/o/..."
            />
            <Button
              className="w-full gradient-primary text-white border-0"
              onClick={() => {
                if (!kakaoInput.trim()) {
                  toast.error("오픈채팅 링크를 입력해주세요.");
                  return;
                }
                saveKakao.mutate({ kakaoOpenChatUrl: kakaoInput.trim() });
              }}
              disabled={saveKakao.isPending || acceptMutation.isPending}
            >
              {saveKakao.isPending ? "저장 중..." : "저장하고 수락"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
