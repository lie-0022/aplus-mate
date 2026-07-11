import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TimetableGrid, { type GridBlock } from "@/components/TimetableGrid";
import {
  CalendarPlus,
  Plus,
  ArrowLeft,
  Trash2,
  Search,
  Wifi,
  AlertTriangle,
  Megaphone,
  GraduationCap,
  MessageSquare,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CURRENT_SEMESTER, TIMETABLE_DAYS, MAX_PERIOD } from "@shared/const";

// 다음 학기 후보 — 카탈로그는 아직 2026-1뿐이라 라벨 용도. 2026-2 적재되면 그때 담긴다.
const SEMESTER_OPTIONS = ["2026-2", "2026-1"];

type Item = {
  id: number;
  courseId: number | null;
  title: string;
  section: string | null;
  professor: string | null;
  dayOfWeek: string | null;
  startPeriod: number | null;
  endPeriod: number | null;
  room: string | null;
  cyber: boolean;
};

// 같은 요일에서 [start,end]가 겹치는 아이템 id 집합.
function findConflicts(items: Item[]): Set<number> {
  const bad = new Set<number>();
  const timed = items.filter((i) => i.dayOfWeek && i.startPeriod != null && i.endPeriod != null);
  for (let a = 0; a < timed.length; a++) {
    for (let b = a + 1; b < timed.length; b++) {
      const x = timed[a];
      const y = timed[b];
      if (
        x.dayOfWeek === y.dayOfWeek &&
        x.startPeriod! <= y.endPeriod! &&
        y.startPeriod! <= x.endPeriod!
      ) {
        bad.add(x.id);
        bad.add(y.id);
      }
    }
  }
  return bad;
}

export default function Planner() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = trpc.planner.listMine.useQuery();
  const detail = trpc.planner.get.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId != null }
  );

  // ── 생성 다이얼로그 ──
  const [createOpen, setCreateOpen] = useState(false);
  const [cSemester, setCSemester] = useState(SEMESTER_OPTIONS[0]);
  const [cTitle, setCTitle] = useState("");
  const create = trpc.planner.create.useMutation({
    onSuccess: (r) => {
      utils.planner.listMine.invalidate();
      setCreateOpen(false);
      setCTitle("");
      if (r?.id) setSelectedId(Number(r.id));
      toast.success("시간표를 만들었어요. 수업을 담아보세요.");
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.planner.remove.useMutation({
    onSuccess: () => {
      utils.planner.listMine.invalidate();
      setSelectedId(null);
      toast.success("시간표를 지웠어요.");
    },
    onError: (e) => toast.error(e.message),
  });

  const refreshDetail = () => {
    utils.planner.get.invalidate({ id: selectedId ?? 0 });
    utils.planner.listMine.invalidate();
  };
  const addCourse = trpc.planner.addCourse.useMutation({
    onSuccess: () => {
      refreshDetail();
      toast.success("수업을 담았어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeItem = trpc.planner.removeItem.useMutation({
    onSuccess: refreshDetail,
    onError: (e) => toast.error(e.message),
  });
  const addBlock = trpc.planner.addBlock.useMutation({
    onSuccess: () => {
      refreshDetail();
      setBlockOpen(false);
      setBlkTitle("");
      toast.success("블록을 추가했어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const setPosted = trpc.planner.setPosted.useMutation({
    onSuccess: (r) => {
      refreshDetail();
      toast.success(r?.posted ? "봐주세요 게시판에 올렸어요." : "게시를 내렸어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const enroll = trpc.planner.enroll.useMutation({
    onSuccess: (r) => {
      toast.success(
        `${r?.enrolled ?? 0}과목 수강 등록했어요.${r?.skipped ? ` (${r.skipped}개는 건너뜀)` : ""}`
      );
    },
    onError: (e) => toast.error(e.message),
  });

  // ── 수업 검색(담기) ──
  const [query, setQuery] = useState("");
  const search = trpc.courses.search.useQuery(
    { query: query.trim() },
    { enabled: selectedId != null && query.trim().length > 0 }
  );

  // ── 커스텀 블록 다이얼로그 ──
  const [blockOpen, setBlockOpen] = useState(false);
  const [blkTitle, setBlkTitle] = useState("");
  const [blkDay, setBlkDay] = useState("월");
  const [blkStart, setBlkStart] = useState("1");
  const [blkEnd, setBlkEnd] = useState("1");

  // ── 에타 시간표 참고 이미지 — 서버에 저장하지 않고 이 기기(localStorage)에만.
  // 본인 스크린샷을 옆에 띄워두고 보면서 수업을 담는 용도(크롤링 아님·프라이버시 보존).
  const [refImage, setRefImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refKey = selectedId != null ? `planner-ref-${selectedId}` : null;
  useEffect(() => {
    if (!refKey) return;
    try {
      setRefImage(localStorage.getItem(refKey));
    } catch {
      setRefImage(null);
    }
  }, [refKey]);
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !refKey) return;
    if (!f.type.startsWith("image/")) return toast.error("이미지 파일만 올릴 수 있어요.");
    if (f.size > 4 * 1024 * 1024) return toast.error("이미지가 너무 커요 (4MB 이하).");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      try {
        localStorage.setItem(refKey, url);
        setRefImage(url);
      } catch {
        toast.error("이미지를 저장하지 못했어요 (용량 초과).");
      }
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };
  const clearRefImage = () => {
    if (refKey) localStorage.removeItem(refKey);
    setRefImage(null);
  };

  const items = (detail.data?.items ?? []) as Item[];
  const { blocks, conflicts, cyberItems, courseCount } = useMemo(() => {
    const conflicts = findConflicts(items);
    // 수업별 색 — 같은 courseId는 같은 색, 커스텀은 중립.
    const courseIds = Array.from(
      new Set(items.filter((i) => i.courseId != null).map((i) => i.courseId!))
    );
    const colorOf = new Map(courseIds.map((id, i) => [id, i]));
    const blocks: GridBlock[] = items
      .filter((i) => i.dayOfWeek && i.startPeriod != null && i.endPeriod != null)
      .map((i) => ({
        key: `it-${i.id}`,
        day: i.dayOfWeek!,
        start: i.startPeriod!,
        end: i.endPeriod!,
        title: i.title,
        sub: i.room ?? i.professor,
        section: i.section,
        colorIndex: i.courseId != null ? colorOf.get(i.courseId) : undefined,
        dashed: i.courseId == null,
        danger: conflicts.has(i.id),
        onReview: i.courseId != null ? () => setLocation(`/courses/${i.courseId}`) : undefined,
        onRemove: () => removeItem.mutate({ itemId: i.id }),
      }));
    const cyberItems = items.filter((i) => !i.dayOfWeek && i.cyber);
    return { blocks, conflicts, cyberItems, courseCount: courseIds.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const submitBlock = () => {
    const s = parseInt(blkStart);
    const e = parseInt(blkEnd);
    if (!blkTitle.trim()) return toast.error("이름을 입력해주세요.");
    if (e < s) return toast.error("끝 교시는 시작 교시보다 빠를 수 없어요.");
    addBlock.mutate({
      timetableId: selectedId!,
      title: blkTitle.trim(),
      dayOfWeek: blkDay as (typeof TIMETABLE_DAYS)[number],
      startPeriod: s,
      endPeriod: e,
    });
  };

  // ─── 목록 화면 ───
  if (selectedId == null) {
    return (
      <div className="space-y-4 mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" /> 시간표 짜기
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              수강신청 전 시간표를 미리 짜보고, 봐주세요 게시판에 올려 조언을 받아보세요.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 새 시간표
          </Button>
        </div>

        {list.isLoading ? (
          <Skeleton className="h-24 rounded-[18px]" />
        ) : (list.data?.length ?? 0) === 0 ? (
          <div className="rounded-[18px] bg-card shadow-card p-10 text-center">
            <CalendarPlus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-bold mb-1">아직 짠 시간표가 없어요</p>
            <p className="text-sm text-muted-foreground mb-4">
              "새 시간표"로 학기를 고르고 수업을 담아 시간표를 만들어보세요.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> 새 시간표 만들기
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {list.data!.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="rounded-[18px] bg-card shadow-card p-4 text-left hover:ring-2 hover:ring-primary/30 transition"
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {t.semester}
                  </span>
                  {t.postedAt && (
                    <span className="badge-sky text-[11px] font-bold px-2 py-0.5 rounded-full">
                      봐주세요 게시 중
                    </span>
                  )}
                </div>
                <p className="font-bold">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.itemCount > 0 ? `${t.itemCount}개 항목` : "비어 있음"}
                </p>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setLocation("/timetables")}
          className="w-full rounded-[18px] bg-card shadow-card p-4 text-left hover:ring-2 hover:ring-primary/30 transition flex items-center gap-3"
        >
          <MessageSquare className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-bold text-sm">봐주세요 게시판</p>
            <p className="text-xs text-muted-foreground">
              다른 학생들이 올린 시간표를 보고 조언을 남겨보세요.
            </p>
          </div>
        </button>

        {/* 새 시간표 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 시간표</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">학기</label>
                <Select value={cSemester} onValueChange={setCSemester}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">이름</label>
                <Input
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  placeholder="예: 2학기 A안, 오전 몰빵"
                  maxLength={100}
                />
              </div>
              <Button
                className="w-full"
                disabled={create.isPending}
                onClick={() => {
                  if (!cTitle.trim()) return toast.error("이름을 입력해주세요.");
                  create.mutate({ semester: cSemester, title: cTitle.trim() });
                }}
              >
                {create.isPending ? "만드는 중..." : "만들기"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── 편집 화면 ───
  const tt = detail.data;
  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <button
        onClick={() => setSelectedId(null)}
        className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 내 시간표 목록
      </button>

      {detail.isLoading || !tt ? (
        <Skeleton className="h-[480px] rounded-[18px]" />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {tt.semester}
                </span>
                {tt.postedAt && (
                  <span className="badge-sky text-[11px] font-bold px-2 py-0.5 rounded-full">
                    게시 중
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold">{tt.title}</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {courseCount}과목 · {items.filter((i) => i.dayOfWeek).length}블록
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                if (window.confirm("이 시간표를 삭제할까요? 되돌릴 수 없어요.")) {
                  remove.mutate({ id: selectedId });
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {conflicts.size > 0 && (
            <div className="rounded-[14px] badge-danger p-3 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              시간이 겹치는 수업이 있어요 (빨간 블록). 봐주세요 게시 전에 확인해보세요.
            </div>
          )}

          {/* 격자 — 모바일은 에타처럼 화면에 딱 붙게, sm+는 카드 유지 */}
          <div className="-mx-2 overflow-x-auto sm:mx-0 sm:rounded-[18px] sm:bg-card sm:shadow-card sm:p-4">
            {blocks.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">
                아래에서 수업을 검색해 담아보세요.
              </div>
            ) : (
              <TimetableGrid blocks={blocks} maxPeriods={MAX_PERIOD} />
            )}
          </div>

          {/* 에타 시간표 참고(이 기기에만 저장) */}
          <div className="rounded-[18px] bg-card shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <ImagePlus className="h-4 w-4 text-primary" /> 에타 시간표 참고
              </h3>
              {refImage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearRefImage}
                >
                  <X className="h-4 w-4 mr-1" /> 지우기
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4 mr-1" /> 이미지 올리기
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />
            </div>
            {refImage ? (
              <img
                src={refImage}
                alt="에타 시간표 참고"
                className="mt-2 w-full rounded-lg border border-border max-h-[420px] object-contain bg-muted"
              />
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                본인 에타 시간표를 캡처해 올려두면, 여기 보면서 같은 수업을 담기 편해요.
                이미지는 서버에 올라가지 않고 이 기기에만 저장돼요.
              </p>
            )}
          </div>

          {/* 사이버 */}
          {cyberItems.length > 0 && (
            <div className="rounded-[18px] bg-card shadow-card p-4">
              <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                <Wifi className="h-4 w-4 text-primary" /> 사이버 강의
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {cyberItems.map((i) => (
                  <span
                    key={i.id}
                    className="badge-sky text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                  >
                    {i.title}
                    <button
                      onClick={() => removeItem.mutate({ itemId: i.id })}
                      aria-label="삭제"
                      className="opacity-70 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 수업 검색해서 담기 */}
          <div className="rounded-[18px] bg-card shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">수업 담기</h3>
              <Button size="sm" variant="secondary" onClick={() => setBlockOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> 직접 블록
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="수업명·교수명으로 검색"
                className="pl-9"
              />
            </div>
            {query.trim() && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {search.isLoading ? (
                  <p className="text-xs text-muted-foreground py-2">검색 중…</p>
                ) : (search.data?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">검색 결과가 없어요.</p>
                ) : (
                  search.data!.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.name}
                          {c.section && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              {Number(c.section)}분반
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.professor ?? "미배정"}
                          {c.scheduleLabel ? ` · ${c.scheduleLabel}` : " · 시간 미지정"}
                          {c.credits ? ` · ${c.credits}학점` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0"
                        disabled={addCourse.isPending}
                        onClick={() =>
                          addCourse.mutate({ timetableId: selectedId, courseId: c.id })
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 액션 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1"
              variant={tt.postedAt ? "secondary" : "default"}
              disabled={setPosted.isPending || blocks.length === 0}
              onClick={() => setPosted.mutate({ id: selectedId, posted: !tt.postedAt })}
            >
              <Megaphone className="h-4 w-4 mr-1" />
              {tt.postedAt ? "게시 내리기" : "봐주세요 게시하기"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={enroll.isPending || courseCount === 0}
              onClick={() => {
                if (
                  window.confirm(
                    `${tt.semester} 학기에 이 시간표의 수업들을 실제 수강 등록할까요?`
                  )
                ) {
                  enroll.mutate({ id: selectedId });
                }
              }}
            >
              <GraduationCap className="h-4 w-4 mr-1" /> 이대로 수강 등록
            </Button>
          </div>
        </>
      )}

      {/* 직접 블록 다이얼로그 */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>직접 블록 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={blkTitle}
              onChange={(e) => setBlkTitle(e.target.value)}
              placeholder="예: 알바, 비는 시간 확보"
              maxLength={100}
            />
            <div className="flex gap-2">
              <Select value={blkDay} onValueChange={setBlkDay}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMETABLE_DAYS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}요일
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={blkStart} onValueChange={setBlkStart}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_PERIOD }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}교시부터
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={blkEnd} onValueChange={setBlkEnd}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_PERIOD }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}교시까지
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={submitBlock} disabled={addBlock.isPending}>
              {addBlock.isPending ? "추가 중..." : "추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
