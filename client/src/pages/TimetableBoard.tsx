import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import TimetableGrid, { type GridBlock } from "@/components/TimetableGrid";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  CalendarPlus,
  Wifi,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_PERIOD } from "@shared/const";

const SEMESTER_TABS = ["전체", "2026-2", "2026-1"];

type Item = {
  id: number;
  courseId: number | null;
  title: string;
  professor: string | null;
  dayOfWeek: string | null;
  startPeriod: number | null;
  endPeriod: number | null;
  room: string | null;
  cyber: boolean;
};

// ─── 목록 화면 ───
function BoardList() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("전체");
  const list = trpc.timetableBoard.list.useQuery(
    tab === "전체" ? {} : { semester: tab }
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[720px]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> 봐주세요 게시판
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            다른 학생이 짠 시간표를 보고 조언을 남겨주세요.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setLocation("/planner")}>
          <CalendarPlus className="h-4 w-4 mr-1" /> 내 시간표 짜기
        </Button>
      </div>

      <div className="flex gap-1.5">
        {SEMESTER_TABS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={tab === s ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => setTab(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {list.isLoading ? (
        <Skeleton className="h-24 rounded-[18px]" />
      ) : (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-[18px] bg-card shadow-card p-10 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-bold mb-1">아직 올라온 시간표가 없어요</p>
          <p className="text-sm text-muted-foreground mb-4">
            시간표를 짜고 "봐주세요 게시하기"로 첫 글을 올려보세요.
          </p>
          <Button onClick={() => setLocation("/planner")}>
            <CalendarPlus className="mr-1 h-4 w-4" /> 시간표 짜러 가기
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.data!.map((t) => (
            <button
              key={t.id}
              onClick={() => setLocation(`/timetables/${t.id}`)}
              className="rounded-[18px] bg-card shadow-card p-4 text-left hover:ring-2 hover:ring-primary/30 transition"
            >
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {t.semester}
                </span>
              </div>
              <p className="font-bold truncate">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.authorDept ?? "학과 미입력"}
                {t.authorYear ? ` · ${t.authorYear}학년` : ""} · {t.blockCount}블록
              </p>
              <p className="text-[11px] text-primary mt-1.5 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> 조언 {t.commentCount}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 상세 화면 ───
function BoardDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const detail = trpc.timetableBoard.get.useQuery({ id });
  const comments = trpc.timetableBoard.comments.useQuery({ timetableId: id });
  const [text, setText] = useState("");

  const addComment = trpc.timetableBoard.addComment.useMutation({
    onSuccess: () => {
      utils.timetableBoard.comments.invalidate({ timetableId: id });
      setText("");
      toast.success("조언을 남겼어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteComment = trpc.timetableBoard.deleteComment.useMutation({
    onSuccess: () => utils.timetableBoard.comments.invalidate({ timetableId: id }),
    onError: (e) => toast.error(e.message),
  });

  const items = (detail.data?.items ?? []) as Item[];
  const { blocks, cyberItems } = useMemo(() => {
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
        colorIndex: i.courseId != null ? colorOf.get(i.courseId) : undefined,
        dashed: i.courseId == null,
      }));
    return { blocks, cyberItems: items.filter((i) => !i.dayOfWeek && i.cyber) };
  }, [items]);

  if (detail.isLoading) {
    return <Skeleton className="h-[480px] rounded-[18px] mx-auto w-full max-w-[980px]" />;
  }
  if (!detail.data) {
    return (
      <div className="mx-auto w-full max-w-[720px] text-center py-16">
        <p className="text-sm text-muted-foreground mb-3">
          시간표를 찾을 수 없거나 게시가 내려갔어요.
        </p>
        <Button variant="secondary" onClick={() => setLocation("/timetables")}>
          목록으로
        </Button>
      </div>
    );
  }
  const tt = detail.data;

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <button
        onClick={() => setLocation("/timetables")}
        className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 봐주세요 목록
      </button>

      <div>
        <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
          {tt.semester}
        </span>
        <h1 className="text-xl font-bold mt-1">{tt.title}</h1>
      </div>

      <div className="rounded-[18px] bg-card shadow-card p-3 sm:p-4 overflow-x-auto">
        {blocks.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            표시할 수업이 없어요.
          </div>
        ) : (
          <TimetableGrid blocks={blocks} maxPeriods={MAX_PERIOD} />
        )}
      </div>

      {cyberItems.length > 0 && (
        <div className="rounded-[18px] bg-card shadow-card p-4">
          <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
            <Wifi className="h-4 w-4 text-primary" /> 사이버 강의
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {cyberItems.map((i) => (
              <span
                key={i.id}
                className="badge-sky text-xs font-bold px-2.5 py-1 rounded-full"
              >
                {i.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 조언 */}
      <div className="rounded-[18px] bg-card shadow-card p-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4 text-primary" /> 조언
          {comments.data && comments.data.length > 0 && (
            <span className="text-muted-foreground">({comments.data.length})</span>
          )}
        </h3>
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="공강·동선·수업 조합 등 조언을 남겨주세요"
            rows={2}
            maxLength={500}
          />
          <Button
            className="shrink-0 self-end"
            disabled={addComment.isPending}
            onClick={() => {
              if (!text.trim()) return toast.error("내용을 입력해주세요.");
              addComment.mutate({ timetableId: id, content: text.trim() });
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {comments.isLoading ? null : (comments.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            아직 조언이 없어요. 첫 조언을 남겨보세요.
          </p>
        ) : (
          <div className="space-y-2">
            {comments.data!.map((c) => (
              <div key={c.id} className="rounded-lg bg-muted p-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] whitespace-pre-wrap">{c.content}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    익명 · {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                    {c.isMine && " · 내 댓글"}
                  </p>
                </div>
                {c.isMine && (
                  <button
                    onClick={() => deleteComment.mutate({ commentId: c.id })}
                    aria-label="삭제"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimetableBoard() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : null;
  return id != null && !Number.isNaN(id) ? <BoardDetail id={id} /> : <BoardList />;
}
