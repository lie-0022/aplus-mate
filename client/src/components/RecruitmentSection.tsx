import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MATCH_TYPE_LABELS, type MatchType, type MentoringRole } from "@shared/const";
import { Megaphone, Plus, Send } from "lucide-react";
import { toast } from "sonner";

const TYPE_OPTS: MatchType[] = ["project", "study", "mentoring"];

// 구조화된 모집 공고 섹션 — 게시판 "같이하실분?" 자유글을 대체.
// 모집자는 타입·인원·스킬을 담아 공고를 올리고, 다른 학생은 메시지와 함께 원클릭 지원한다.
// 지원 = 매칭 요청(teamMatches)이므로, 수락은 기존 "매칭 → 받은 요청"에서 처리된다.
export default function RecruitmentSection({
  courseId,
  isEnrolled,
}: {
  courseId: number;
  isEnrolled: boolean;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.recruitment.list.useQuery(
    { courseId, openOnly: true },
    { enabled: isEnrolled }
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [cType, setCType] = useState<MatchType>("project");
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cSkills, setCSkills] = useState("");
  const [cCount, setCCount] = useState("1");
  const [cRole, setCRole] = useState<MentoringRole>("mentee");

  const [applyTo, setApplyTo] = useState<{ id: number; title: string } | null>(null);
  const [applyMsg, setApplyMsg] = useState("");

  const create = trpc.recruitment.create.useMutation({
    onSuccess: () => {
      utils.recruitment.list.invalidate({ courseId });
      setCreateOpen(false);
      setCTitle("");
      setCDesc("");
      setCSkills("");
      setCCount("1");
      setCType("project");
      toast.success("모집 공고를 올렸어요!");
    },
    onError: (e) => toast.error(e.message),
  });
  const apply = trpc.recruitment.apply.useMutation({
    onSuccess: () => {
      setApplyTo(null);
      setApplyMsg("");
      utils.recruitment.list.invalidate({ courseId });
      toast.success("지원했어요! 모집자가 수락하면 팀에 합류해요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const close = trpc.recruitment.close.useMutation({
    onSuccess: () => {
      utils.recruitment.list.invalidate({ courseId });
      toast.success("모집을 마감했어요.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!isEnrolled) return null;
  const items = list.data ?? [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Megaphone className="h-4 w-4 text-primary" /> 모집 중인 공고
          {items.length > 0 && (
            <span className="text-muted-foreground">({items.length})</span>
          )}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> 모집 올리기
        </Button>
      </div>

      {list.isLoading ? null : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-5 text-center text-sm text-muted-foreground">
            아직 모집 공고가 없어요. "모집 올리기"로 팀원을 구조적으로 모아보세요.
          </CardContent>
        </Card>
      ) : (
        items.map((r) => {
          const mine = r.authorId === user?.id;
          return (
            <Card key={r.id} className="rounded-2xl border border-border/50 shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {MATCH_TYPE_LABELS[r.matchType as MatchType]}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {r.neededCount}명 모집
                      </Badge>
                      {mine && (
                        <Badge className="text-[10px] py-0 bg-primary/15 text-primary border-0">
                          내 공고
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm mt-1.5">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.author.department ?? "학과 미입력"}
                      {r.author.year ? ` · ${r.author.year}학년` : ""}
                    </p>
                  </div>
                  {mine ? (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        지원 {r.pendingApplicants}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => close.mutate({ recruitmentId: r.id })}
                        disabled={close.isPending}
                      >
                        마감
                      </Button>
                    </div>
                  ) : r.hasApplied ? (
                    <Button size="sm" variant="outline" className="shrink-0" disabled>
                      지원함
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="gradient-primary text-white border-0 shrink-0"
                      onClick={() => setApplyTo({ id: r.id, title: r.title })}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> 지원
                    </Button>
                  )}
                </div>
                {r.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {r.description}
                  </p>
                )}
                {r.desiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.desiredSkills.map((s, i) => (
                      <Badge key={`${s}-${i}`} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                {mine && r.pendingApplicants > 0 && (
                  <p className="text-[11px] text-primary">
                    지원자는 '매칭 → 받은 요청'에서 메시지와 함께 확인·수락할 수 있어요.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* 모집 올리기 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>모집 공고 올리기</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={cType} onValueChange={(v) => setCType(v as MatchType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MATCH_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cType === "mentoring" && (
              <Select value={cRole} onValueChange={(v) => setCRole(v as MentoringRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mentee">나는 멘티 — 멘토를 구해요</SelectItem>
                  <SelectItem value="mentor">나는 멘토 — 멘티를 구해요</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder="한 줄 소개 (예: React 프로젝트 같이 할 팀원 구해요)"
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="상세 설명 (선택) — 무엇을, 어떻게, 일정 등"
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              rows={3}
              maxLength={2000}
            />
            <Input
              placeholder="원하는 스킬 (선택, 쉼표로 구분 — 예: React, Figma)"
              value={cSkills}
              onChange={(e) => setCSkills(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">모집 인원</span>
              <Input
                type="number"
                min={1}
                max={10}
                value={cCount}
                onChange={(e) => setCCount(e.target.value)}
                className="w-20"
              />
            </div>
            <Button
              className="w-full gradient-primary text-white border-0"
              disabled={create.isPending}
              onClick={() => {
                if (!cTitle.trim()) {
                  toast.error("한 줄 소개를 입력해주세요.");
                  return;
                }
                create.mutate({
                  courseId,
                  matchType: cType,
                  authorRole: cType === "mentoring" ? cRole : undefined,
                  title: cTitle.trim(),
                  description: cDesc.trim() || undefined,
                  desiredSkills: Array.from(
                    new Set(cSkills.split(",").map((s) => s.trim()).filter(Boolean))
                  ),
                  neededCount: Math.max(1, Math.min(10, parseInt(cCount) || 1)),
                });
              }}
            >
              {create.isPending ? "올리는 중..." : "공고 올리기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 지원 */}
      <Dialog open={!!applyTo} onOpenChange={(o) => !o && setApplyTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지원하기</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">"{applyTo?.title}"에 지원해요.</p>
            <Textarea
              placeholder="모집자에게 한마디 (선택) — 왜 함께하고 싶은지, 내 강점 등"
              value={applyMsg}
              onChange={(e) => setApplyMsg(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <Button
              className="w-full gradient-primary text-white border-0"
              disabled={apply.isPending}
              onClick={() => {
                if (applyTo)
                  apply.mutate({
                    recruitmentId: applyTo.id,
                    message: applyMsg.trim() || undefined,
                  });
              }}
            >
              {apply.isPending ? "지원 중..." : "지원 보내기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
