import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SkillTagsInput } from "@/components/SkillTagsInput";
import { PortfolioList, type PortfolioItemView } from "@/components/PortfolioList";
import { Briefcase, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MAX_PORTFOLIO_ITEMS } from "@shared/const";

// 내 작업물 관리 — 매칭 상대가 "이 사람 뭘 만들 줄 아나"를 판단할 재료.
// 파일 업로드는 없다(인프라 미구성) — GitHub/배포 링크로 대신한다.

const EMPTY = {
  id: 0,
  title: "",
  summary: "",
  role: "",
  techTags: [] as string[],
  repoUrl: "",
  demoUrl: "",
};

export function PortfolioEditor() {
  const utils = trpc.useUtils();
  const items = trpc.portfolio.mine.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const done = () => {
    utils.portfolio.mine.invalidate();
    setOpen(false);
  };
  const add = trpc.portfolio.add.useMutation({
    onSuccess: () => {
      done();
      toast.success("작업물을 추가했어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.portfolio.update.useMutation({
    onSuccess: () => {
      done();
      toast.success("작업물을 수정했어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.portfolio.remove.useMutation({
    onSuccess: () => {
      utils.portfolio.mine.invalidate();
      toast.success("작업물을 지웠어요.");
    },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => {
    setForm({ ...EMPTY });
    setOpen(true);
  };
  const openEdit = (p: PortfolioItemView) => {
    setForm({
      id: p.id,
      title: p.title,
      summary: p.summary ?? "",
      role: p.role ?? "",
      techTags: p.techTags ?? [],
      repoUrl: p.repoUrl ?? "",
      demoUrl: p.demoUrl ?? "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.title.trim()) {
      toast.error("작업물 이름을 입력해주세요.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      role: form.role.trim(),
      techTags: form.techTags,
      repoUrl: form.repoUrl.trim(),
      demoUrl: form.demoUrl.trim(),
    };
    if (form.id) update.mutate({ id: form.id, ...payload });
    else add.mutate(payload);
  };

  const list = items.data ?? [];
  const full = list.length >= MAX_PORTFOLIO_ITEMS;

  return (
    <div className="rounded-2xl bg-card shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-bold flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" /> 내 작업물
        </div>
        <Button size="sm" variant="secondary" onClick={openNew} disabled={full}>
          <Plus className="h-4 w-4 mr-1" /> 추가
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          만들어본 것을 올려두면 팀원을 구할 때 훨씬 유리해요. 수업 과제·토이 프로젝트도
          괜찮아요 — GitHub 링크를 넣으면 사용 언어와 최근 커밋이 자동으로 붙어요.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <div key={p.id} className="relative group">
              <PortfolioList items={[p]} />
              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(p)}
                  className="rounded bg-background/90 p-1 text-muted-foreground hover:text-foreground"
                  aria-label="작업물 수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate({ id: p.id })}
                  disabled={remove.isPending}
                  className="rounded bg-background/90 p-1 text-muted-foreground hover:text-destructive"
                  aria-label="작업물 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {full && (
        <p className="text-[11px] text-muted-foreground mt-2">
          최대 {MAX_PORTFOLIO_ITEMS}개까지 등록할 수 있어요.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "작업물 수정" : "작업물 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>이름 *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 백석대 팀플 매칭 서비스"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>내가 맡은 것</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="예: 프론트엔드 · 기획"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>한 줄 설명</Label>
              <Textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="무엇을 만들었는지 한 줄로"
                rows={2}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>사용 기술</Label>
              <SkillTagsInput
                value={form.techTags}
                onChange={(v) => setForm({ ...form, techTags: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>GitHub 저장소</Label>
              <Input
                value={form.repoUrl}
                onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                placeholder="https://github.com/아이디/저장소"
                maxLength={300}
              />
              <p className="text-[11px] text-muted-foreground">
                공개 저장소면 사용 언어·최근 커밋이 자동으로 표시돼요.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>결과물 링크</Label>
              <Input
                value={form.demoUrl}
                onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
                placeholder="배포 주소·영상·발표자료 등"
                maxLength={300}
              />
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={add.isPending || update.isPending}
            >
              {add.isPending || update.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
