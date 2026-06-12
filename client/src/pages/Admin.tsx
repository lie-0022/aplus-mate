import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MATCH_TYPE_LABELS, type MatchType } from "@shared/const";
import { ShieldCheck, RefreshCw, ExternalLink, Inbox, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ROLE_KO: Record<string, string> = { user: "학생", professor: "교수", admin: "운영자" };

// 운영자 전용 — pending 매칭 현황. 서버는 adminProcedure(role=admin)로 이중 가드.
// 운영자에게는 수동 운영(연락·푸시)을 위해 실명·오픈채팅이 보인다.
export default function Admin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const pending = trpc.admin.pendingMatches.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const usersList = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
  });
  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast.success("역할을 변경했어요.");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">운영자 전용 페이지예요</h2>
        <p className="text-sm text-muted-foreground">접근 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">운영자 — 대기 매칭</h1>
          {pending.data && pending.data.length > 0 && (
            <Badge variant="default" className="gradient-primary text-white border-0">
              {pending.data.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pending.refetch()}
          disabled={pending.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${pending.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {pending.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : pending.data?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">대기 중인 매칭이 없어요</p>
          </CardContent>
        </Card>
      ) : (
        pending.data?.map((item) => (
          <Card key={`match-${item.match.id}`} className="border shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {item.course?.name ?? "알 수 없는 수업"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {MATCH_TYPE_LABELS[(item.match.matchType ?? "project") as MatchType]}
                </Badge>
                {item.match.matchType === "mentoring" && (
                  <Badge variant="secondary" className="text-xs bg-sky-100 text-sky-700">
                    요청자가 {item.match.requesterRole === "mentor" ? "멘토" : "멘티"}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(item.match.createdAt).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "요청자", u: item.requester },
                  { label: "수신자", u: item.receiver },
                ].map(({ label, u }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-muted/50">
                    <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
                    <div className="font-medium text-sm">{u?.name ?? "?"}</div>
                    <div className="text-xs text-muted-foreground">
                      {u?.department} · {u?.year}학년
                    </div>
                    {u?.kakaoOpenChatUrl && (
                      <a
                        href={u.kakaoOpenChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 mt-1"
                      >
                        오픈채팅 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* 유저 역할 관리 — 교수 지정은 운영자가 직접(사칭 방지) */}
      <div className="flex items-center gap-2 pt-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">유저 역할 관리</h2>
      </div>
      {usersList.data?.map((u) => (
        <Card key={`user-${u.id}`} className="border shadow-sm">
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm flex items-center gap-1.5">
                {u.name ?? "(이름 없음)"}
                <Badge
                  variant="secondary"
                  className={
                    u.role === "admin"
                      ? "text-[10px] bg-red-100 text-red-700"
                      : u.role === "professor"
                        ? "text-[10px] bg-sky-100 text-sky-700"
                        : "text-[10px]"
                  }
                >
                  {ROLE_KO[u.role]}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {u.email} {u.department && `· ${u.department}`}
              </div>
            </div>
            {u.id === user?.id ? (
              <Badge variant="outline" className="text-xs shrink-0">
                나
              </Badge>
            ) : (
              <Select
                value={u.role}
                onValueChange={(v) =>
                  setRole.mutate({ userId: u.id, role: v as "user" | "professor" | "admin" })
                }
              >
                <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">학생</SelectItem>
                  <SelectItem value="professor">교수</SelectItem>
                  <SelectItem value="admin">운영자</SelectItem>
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
