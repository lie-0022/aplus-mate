import { trpc } from "@/lib/trpc";
import { parseSkillTags } from "@/lib/utils-parse";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Handshake, Check, X, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState } from "react";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";

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

  // 오픈채팅방은 요청자가 커넥트/공고에서 이미 넣었고 수락 시 팀에 복사되므로,
  // 수락자는 아무것도 입력하지 않고 바로 수락한다.
  const handleAccept = (matchId: number) => {
    acceptMutation.mutate({ matchId });
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
      <div className="space-y-4 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-8 w-40" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[18px]" />
        ))}
      </div>
    );
  }

  const pill = "text-xs font-bold px-2.5 py-0.5 rounded-full";

  // PC 우측 레일 — 요청 현황 + 안내 (받은·보낸 탭 공통)
  const railEl = (
    <div className="hidden lg:block space-y-3">
      <div className="rounded-[18px] bg-card shadow-card p-4">
        <div className="text-xs font-bold text-muted-foreground mb-2">요청 현황</div>
        <div className="flex items-center justify-between text-sm font-semibold py-1">
          <span>받은 요청</span>
          <span className="text-primary font-extrabold">{data?.length ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-semibold py-1">
          <span>보낸 요청</span>
          <span className="text-primary font-extrabold">{sent.data?.length ?? 0}</span>
        </div>
      </div>
      <div className="rounded-[18px] bg-card shadow-card p-4 text-[13px] text-muted-foreground leading-relaxed">
        수락하면 오픈채팅으로 바로 연결되고 <span className="font-semibold text-foreground">팀이 자동 생성</span>
        돼요. 거절·취소는 상대에게 알림 없이 처리돼요.
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-extrabold">매칭 요청</h1>
        {data && data.length > 0 && (
          <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
            {data.length}
          </span>
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

        {/* ── 받은 요청 ── */}
        <TabsContent value="received" className="mt-4">
          <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-3">
              {data?.length === 0 ? (
                <div className="rounded-[18px] bg-card shadow-card p-12 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="font-semibold mb-1">받은 매칭 요청이 없어요</p>
                  <p className="text-sm text-muted-foreground">
                    수업에 등록하면 다른 학생들이 커넥트 요청을 보낼 수 있어요
                  </p>
                </div>
              ) : (
                data?.map((item) => (
                  <div key={item.match.id} className="rounded-[18px] bg-card shadow-card p-4">
                    <div
                      onClick={() => setLocation(`/users/${item.requester.id}`)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className={`badge-tag ${pill}`}>{item.course.name}</span>
                        <span className={`badge-tag ${pill}`}>
                          {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                        </span>
                        {item.match.matchType === "mentoring" && (
                          <span className={`badge-sky ${pill}`}>
                            {item.match.requesterRole === "mentor"
                              ? "멘토로 지원했어요"
                              : "멘토를 찾고 있어요"}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm">
                        {item.requester.department} · {item.requester.year}학년
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.requester.university}
                      </div>
                    </div>

                    {parseSkillTags(item.requester.skillTags).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {parseSkillTags(item.requester.skillTags).map((tag) => (
                          <span key={tag} className={`badge-tag ${pill}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 지원/요청 메시지 — "왜 함께하고 싶은지" 의도 표현 */}
                    {item.match.message && (
                      <div className="mt-3 p-2.5 rounded-lg bg-muted text-sm">
                        {item.match.recruitmentId && (
                          <span className="text-[11px] font-bold text-primary block mb-0.5">
                            📋 내 모집 공고에 지원
                          </span>
                        )}
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {item.match.message}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button
                        className="flex-1"
                        size="sm"
                        onClick={() => handleAccept(item.match.id)}
                        disabled={acceptMutation.isPending}
                      >
                        <Check className="mr-1 h-4 w-4" /> 수락
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        size="sm"
                        onClick={() => rejectMutation.mutate({ matchId: item.match.id })}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="mr-1 h-4 w-4" /> 거절
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {railEl}
          </div>
        </TabsContent>

        {/* ── 보낸 요청 ── */}
        <TabsContent value="sent" className="mt-4">
          <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-3">
              {sent.data?.length === 0 ? (
                <div className="rounded-[18px] bg-card shadow-card p-12 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="font-semibold mb-1">보낸 요청이 없어요</p>
                  <p className="text-sm text-muted-foreground">
                    수업 상세의 팀원 찾기에서 커넥트를 보내보세요
                  </p>
                </div>
              ) : (
                sent.data?.map((item) => (
                  <div key={item.match.id} className="rounded-[18px] bg-card shadow-card p-4">
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className={`badge-tag ${pill}`}>{item.course.name}</span>
                      <span className={`badge-tag ${pill}`}>
                        {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                      </span>
                      {item.match.matchType === "mentoring" && (
                        <span className={`badge-sky ${pill}`}>
                          {item.match.requesterRole === "mentor" ? "멘토로 지원" : "멘토 찾는 중"}
                        </span>
                      )}
                      {item.match.recruitmentId && (
                        <span className={`badge-notice ${pill}`}>📋 모집 지원</span>
                      )}
                    </div>
                    <div className="font-bold text-sm">
                      {item.receiver.department} · {item.receiver.year}학년
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {item.receiver.university} · 수락 대기 중
                    </div>
                    {item.match.message && (
                      <p className="text-xs text-muted-foreground mt-2 p-2.5 rounded-lg bg-muted whitespace-pre-wrap">
                        “{item.match.message}”
                      </p>
                    )}
                    <Button
                      variant="secondary"
                      className="w-full mt-3 text-muted-foreground hover:text-destructive"
                      size="sm"
                      onClick={() => cancelMutation.mutate({ matchId: item.match.id })}
                      disabled={cancelMutation.isPending}
                    >
                      <X className="mr-1 h-4 w-4" /> 요청 취소
                    </Button>
                  </div>
                ))
              )}
            </div>
            {railEl}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
