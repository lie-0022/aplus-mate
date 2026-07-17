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
import { CalendarDays, CalendarPlus, Plus, Wifi, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CURRENT_SEMESTER, TIMETABLE_DAYS, MAX_PERIOD } from "@shared/const";
import TimetableGrid, { type GridBlock } from "@/components/TimetableGrid";

export default function Timetable() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  // 시간표는 학기 단위 — 선택한 학기의 수강 수업 + 그 학기 개인 일정만 보여준다.
  const [semester, setSemester] = useState<string>(CURRENT_SEMESTER);
  const semesters = trpc.timetable.semesters.useQuery();
  const tt = trpc.timetable.my.useQuery({ semester });

  const [addOpen, setAddOpen] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDay, setEvDay] = useState("월");
  const [evStart, setEvStart] = useState("1");
  const [evEnd, setEvEnd] = useState("1");

  const addEvent = trpc.timetable.addEvent.useMutation({
    onSuccess: () => {
      utils.timetable.my.invalidate();
      setAddOpen(false);
      setEvTitle("");
      toast.success("일정을 추가했어요.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteEvent = trpc.timetable.deleteEvent.useMutation({
    onSuccess: () => {
      utils.timetable.my.invalidate();
      toast.success("일정을 지웠어요.");
    },
    onError: (e) => toast.error(e.message),
  });

  // 학기 선택기 — 수강 학기 ∪ 현재 학기. 서버 목록이 오기 전엔 현재 학기만.
  const semesterOptions = semesters.data?.length ? semesters.data : [CURRENT_SEMESTER];

  const data = tt.data;

  const { blocks, cyberCourses, totalCredits } = useMemo(() => {
    const courses = data?.courses ?? [];
    const events = data?.events ?? [];

    // 수업 슬롯: 같은 수업·요일의 연속 교시(목4,5)는 한 블록으로 접는다.
    const blocks: GridBlock[] = [];
    courses.forEach((c, idx) => {
      const byDay = new Map<string, { period: number; room: string | null }[]>();
      for (const s of c.slots) {
        const arr = byDay.get(s.day) ?? [];
        arr.push({ period: s.period, room: s.room });
        byDay.set(s.day, arr);
      }
      byDay.forEach((slots, day) => {
        const sortedP = slots.sort((a, b) => a.period - b.period);
        let run: { start: number; end: number; room: string | null } | null = null;
        const flush = () => {
          if (!run) return;
          blocks.push({
            key: `c-${c.id}-${day}-${run.start}`,
            day,
            start: run.start,
            end: run.end,
            title: c.name,
            sub: run.room,
            section: c.section,
            colorIndex: idx,
            onReview: () => setLocation(`/courses/${c.id}`),
          });
          run = null;
        };
        for (const s of sortedP) {
          if (run && s.period === run.end + 1) {
            run.end = s.period;
            if (!run.room && s.room) run.room = s.room;
          } else {
            flush();
            run = { start: s.period, end: s.period, room: s.room };
          }
        }
        flush();
      });
    });
    for (const e of events) {
      blocks.push({
        key: `e-${e.id}`,
        day: e.dayOfWeek,
        start: e.startPeriod,
        end: e.endPeriod,
        title: e.title,
        dashed: true,
        onRemove: () => deleteEvent.mutate({ id: e.id }),
      });
    }

    return {
      blocks,
      cyberCourses: courses.filter((c) => c.cyber),
      totalCredits: courses.reduce((s, c) => s + (c.credits ?? 0), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const submitEvent = () => {
    if (!evTitle.trim()) {
      toast.error("일정 이름을 입력해주세요.");
      return;
    }
    const s = parseInt(evStart);
    const e = parseInt(evEnd);
    if (e < s) {
      toast.error("끝 교시는 시작 교시보다 빠를 수 없어요.");
      return;
    }
    addEvent.mutate({
      semester, // 현재 보고 있는 학기에 추가
      title: evTitle.trim(),
      dayOfWeek: evDay as (typeof TIMETABLE_DAYS)[number],
      startPeriod: s,
      endPeriod: e,
    });
  };

  if (tt.isLoading) {
    return (
      <div className="space-y-4 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[480px] rounded-[18px]" />
      </div>
    );
  }

  const isEmpty = (data?.courses.length ?? 0) === 0 && (data?.events.length ?? 0) === 0;

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      {/* 모바일은 제목/컨트롤 2행으로 — 한 줄에 넣으면 제목이 "내 시간/표"로 깨지고
          버튼이 화면 밖으로 잘린다(402px 기준). sm↑에서만 한 줄. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2 whitespace-nowrap">
            <CalendarDays className="h-5 w-5 text-primary shrink-0" /> 내 시간표
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {data?.courses.length
              ? `${data.courses.length}과목 · ${totalCredits}학점`
              : "등록한 수업 없음"}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* 학기 선택 — 선택한 학기의 수업·개인 일정만 표시된다 */}
          <Select value={semester} onValueChange={setSemester}>
            {/* "2026-1 (현재)"가 잘리지 않는 폭 */}
            <SelectTrigger className="h-9 w-[132px] shrink-0 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semesterOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                  {s === CURRENT_SEMESTER ? " (현재)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setLocation("/planner")}>
            <CalendarPlus className="h-4 w-4 mr-1" /> 시간표 짜기
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 일정 추가
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-[18px] bg-card shadow-card p-10 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-bold mb-1">아직 시간표가 비어 있어요</p>
          <p className="text-sm text-muted-foreground mb-4">
            수업을 등록하면 요일·교시가 자동으로 채워져요. 알바·동아리 같은 개인 일정도 직접
            추가할 수 있어요.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setLocation("/courses")}>
            <BookOpen className="mr-1 h-4 w-4" /> 수업 찾으러 가기
          </Button>
        </div>
      ) : (
        // 모바일은 에타처럼 화면에 딱 붙게(카드 액자 없이 격자 보더만), sm+는 카드 유지
        <div className="-mx-2 overflow-x-auto sm:mx-0 sm:rounded-[18px] sm:bg-card sm:shadow-card sm:p-4">
          <TimetableGrid blocks={blocks} maxPeriods={MAX_PERIOD} />
        </div>
      )}

      {/* 사이버(시간 미지정) 수업 */}
      {cyberCourses.length > 0 && (
        <div className="rounded-[18px] bg-card shadow-card p-4">
          <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
            <Wifi className="h-4 w-4 text-primary" /> 사이버 강의
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {cyberCourses.map((c) => (
              <button
                key={c.id}
                onClick={() => setLocation(`/courses/${c.id}`)}
                className="badge-sky text-xs font-bold px-2.5 py-1 rounded-full"
              >
                {c.name}
                {c.slots.length > 0 && " (병행)"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            시간이 정해져 있지 않아 격자에는 표시되지 않아요. 병행은 대면 교시도 함께 있는
            수업이에요.
          </p>
        </div>
      )}

      {/* 개인 일정 안내 */}
      {!isEmpty && (
        <p className="text-[11px] text-muted-foreground px-1">
          점선 블록이 개인 일정이에요. 수업과 개인 일정 모두 공강 계산에 반영돼요 — 팀원을
          찾을 때 "나와 공강이 겹치는 시간"이 자동으로 보여요.
        </p>
      )}

      {/* 일정 추가 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>개인 일정 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              placeholder="예: 알바, 동아리, 운동"
              maxLength={100}
            />
            <div className="flex gap-2">
              <Select value={evDay} onValueChange={setEvDay}>
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
              <Select value={evStart} onValueChange={setEvStart}>
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
              <Select value={evEnd} onValueChange={setEvEnd}>
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
            <p className="text-[11px] text-muted-foreground">
              개인 일정도 공강 계산에 포함돼요. 팀원들이 내 일정 내용을 보는 건 아니고, 바쁜
              시간으로만 반영돼요.
            </p>
            <Button className="w-full" onClick={submitEvent} disabled={addEvent.isPending}>
              {addEvent.isPending ? "추가 중..." : "추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
