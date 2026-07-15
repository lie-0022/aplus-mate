import { useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flag } from "lucide-react";
import { toast } from "sonner";

const REASONS = [
  { value: "abuse", label: "욕설·비방" },
  { value: "spam", label: "스팸·광고" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "etc", label: "기타" },
] as const;

// 게시글·댓글·사용자·수업리뷰 신고 — 운영자 큐로 들어간다.
export function ReportDialog({
  targetType,
  targetId,
  trigger,
}: {
  targetType: "post" | "comment" | "user" | "review";
  targetId: number;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const report = trpc.reports.create.useMutation({
    onSuccess: () => {
      toast.success("신고가 접수됐어요. 운영자가 확인합니다.");
      setOpen(false);
      setReason("");
      setDetail("");
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive">
            <Flag className="h-3 w-3" /> 신고
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신고하기</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="신고 사유를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="상세 내용 (선택)"
            rows={3}
            maxLength={500}
          />
          <Button
            className="w-full"
            disabled={!reason || report.isPending}
            onClick={() =>
              report.mutate({
                targetType,
                targetId,
                reason: reason as "abuse" | "spam" | "privacy" | "etc",
                detail: detail.trim() || undefined,
              })
            }
          >
            신고 제출
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
