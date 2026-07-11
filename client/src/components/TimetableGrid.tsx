import { X } from "lucide-react";
import { useMemo } from "react";

// ─── 시간표 격자 (공용) ─────────────────────────────────────
// /timetable(내 시간표)·플래너(편집)·봐주세요 게시판(읽기)이 같이 쓴다.
// 블록 = 연속 교시 한 덩어리. 겹치면 lane 분할로 나란히 그린다.

const ROW_H = 52; // 1교시 높이(px)
const WEEKDAYS = ["월", "화", "수", "목", "금"] as const;

// 블록 색 — 시맨틱 배지 변수 재사용(라이트·다크 모두 정의됨).
export const BLOCK_COLORS = [
  { bg: "var(--stat-b-bg)", fg: "var(--stat-b-fg)" },
  { bg: "var(--stat-c-bg)", fg: "var(--stat-c-fg)" },
  { bg: "var(--stat-a-bg)", fg: "var(--stat-a-fg)" },
  { bg: "var(--sky-badge-bg)", fg: "var(--sky-badge-fg)" },
  { bg: "var(--mine-bg)", fg: "var(--mine-fg)" },
  { bg: "var(--pos-bg)", fg: "var(--pos-fg)" },
];

export type GridBlock = {
  key: string;
  day: string; // 월~일
  start: number; // 교시(포함)
  end: number; // 교시(포함, start 이상)
  title: string;
  sub?: string | null;
  /** BLOCK_COLORS 인덱스. 생략하면 중립(태그) 색 — 개인 일정·커스텀 블록용. */
  colorIndex?: number;
  /** 점선 테두리(개인 일정·커스텀 표시) */
  dashed?: boolean;
  /** 시간 충돌 블록 — 빨간색으로 강조(colorIndex보다 우선) */
  danger?: boolean;
  /** 있으면 호버 시 ✕ 삭제 버튼 */
  onRemove?: () => void;
};

type Placed = GridBlock & { lane: number };

// 같은 요일에서 겹치는 블록을 나란히 배치 — lane 배정(그리디).
function layoutLanes(blocks: GridBlock[]): { placed: Placed[]; laneCount: number } {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnds: number[] = [];
  const placed = sorted.map((b) => {
    let lane = laneEnds.findIndex((end) => end < b.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.end);
    } else {
      laneEnds[lane] = b.end;
    }
    return { ...b, lane };
  });
  return { placed, laneCount: Math.max(1, laneEnds.length) };
}

export default function TimetableGrid({
  blocks,
  minPeriods = 9,
  maxPeriods = 14,
}: {
  blocks: GridBlock[];
  /** 항상 표시할 최소 교시 수(기본 1~9) */
  minPeriods?: number;
  maxPeriods?: number;
}) {
  const { days, periods, byDay } = useMemo(() => {
    const extraDays = (["토", "일"] as const).filter((d) => blocks.some((b) => b.day === d));
    const days = [...WEEKDAYS, ...extraDays];
    const maxUsed = Math.max(minPeriods, ...blocks.map((b) => b.end));
    const periods = Array.from({ length: Math.min(maxUsed, maxPeriods) }, (_, i) => i + 1);
    const byDay = new Map<string, ReturnType<typeof layoutLanes>>();
    for (const d of days) byDay.set(d, layoutLanes(blocks.filter((b) => b.day === d)));
    return { days, periods, byDay };
  }, [blocks, minPeriods, maxPeriods]);

  // 평일(≤5)만이면 화면에 꽉 채워 가로 스크롤 없이 한눈에. 토·일이 끼면 폭 확보 위해 스크롤.
  const minWidth = days.length <= 5 ? 0 : 520;
  return (
    <div
      className="grid"
      style={{
        minWidth,
        gridTemplateColumns: `1.7rem repeat(${days.length}, minmax(0, 1fr))`,
      }}
    >
      {/* 헤더 행 */}
      <div />
      {days.map((d) => (
        <div key={d} className="text-center text-[13px] font-bold pb-2">
          {d}
        </div>
      ))}

      {/* 교시 라벨 열 */}
      <div className="relative" style={{ height: periods.length * ROW_H }}>
        {periods.map((p) => (
          <div
            key={p}
            className="absolute left-0 right-1 text-right text-[11px] text-muted-foreground"
            style={{ top: (p - 1) * ROW_H + 2 }}
          >
            {p}
          </div>
        ))}
      </div>

      {/* 요일 열 */}
      {days.map((d) => {
        const { placed, laneCount } = byDay.get(d) ?? { placed: [], laneCount: 1 };
        return (
          <div
            key={d}
            className="relative border-l border-border/60"
            style={{ height: periods.length * ROW_H }}
          >
            {periods.map((p) => (
              <div
                key={p}
                className="absolute left-0 right-0 border-t border-border/40"
                style={{ top: (p - 1) * ROW_H }}
              />
            ))}
            {placed.map((b) => {
              const width = 100 / laneCount;
              const color = b.danger
                ? { bg: "var(--danger-bg)", fg: "var(--danger-fg)" }
                : b.colorIndex != null
                  ? BLOCK_COLORS[b.colorIndex % BLOCK_COLORS.length]
                  : { bg: "var(--tag-bg)", fg: "var(--tag-fg)" };
              return (
                <div
                  key={b.key}
                  className="absolute rounded-lg px-1.5 py-1 overflow-hidden group"
                  style={{
                    top: (b.start - 1) * ROW_H + 2,
                    height: (b.end - b.start + 1) * ROW_H - 4,
                    left: `calc(${b.lane * width}% + 2px)`,
                    width: `calc(${width}% - 4px)`,
                    background: color.bg,
                    color: color.fg,
                    border: b.dashed ? "1.5px dashed currentColor" : "none",
                  }}
                >
                  <p className="text-[11px] font-bold leading-tight break-keep line-clamp-3">
                    {b.title}
                  </p>
                  {b.sub && (
                    <p className="text-[10px] opacity-80 leading-tight truncate mt-0.5">{b.sub}</p>
                  )}
                  {b.onRemove && (
                    <button
                      onClick={b.onRemove}
                      className="absolute top-1 right-1 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/60"
                      aria-label="블록 삭제"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
