import type { GridBlock } from "@/components/TimetableGrid";

// timetable.my 응답 → TimetableGrid 블록. /timetable(풀 뷰)과 홈 히어로(미니 뷰)가 공유한다.
// 같은 수업·요일의 연속 교시(목4,5)는 한 블록으로 접는다.

type SlotCourse = {
  id: number;
  name: string;
  section: string | null;
  slots: { day: string; period: number; room: string | null }[];
};
type ScheduleEvent = {
  id: number;
  title: string;
  dayOfWeek: string;
  startPeriod: number;
  endPeriod: number;
};

export function buildTimetableBlocks(
  courses: SlotCourse[],
  events: ScheduleEvent[],
  opts?: {
    onReview?: (courseId: number) => void;
    onRemoveEvent?: (eventId: number) => void;
  }
): GridBlock[] {
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
          onReview: opts?.onReview ? () => opts.onReview!(c.id) : undefined,
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
      onRemove: opts?.onRemoveEvent ? () => opts.onRemoveEvent!(e.id) : undefined,
    });
  }
  return blocks;
}
