import { MoreVertical, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── 시간표 격자 (공용) ─────────────────────────────────────
// /timetable(내 시간표)·플래너(편집)·봐주세요 게시판(읽기)이 같이 쓴다.
// 블록 = 연속 교시 한 덩어리. 겹치면 lane 분할로 나란히 그린다.
// 블록을 길게 누르거나(모바일) 우클릭하면(PC) 메뉴 — 분반·시간 + 리뷰/지우기.

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
  sub?: string | null; // 보통 강의실
  section?: string | null; // 분반(예 "01")
  /** BLOCK_COLORS 인덱스. 생략하면 중립(태그) 색 — 개인 일정·커스텀 블록용. */
  colorIndex?: number;
  /** 점선 테두리(개인 일정·커스텀 표시) */
  dashed?: boolean;
  /** 시간 충돌 블록 — 빨간색으로 강조(colorIndex보다 우선) */
  danger?: boolean;
  /** 메뉴의 "리뷰 보기"(수업 상세로 이동). 없으면 메뉴에 안 뜸. */
  onReview?: () => void;
  /** 메뉴의 "지우기". 없으면 메뉴에 안 뜸. */
  onRemove?: () => void;
};

type Placed = GridBlock & { lane: number };

function secLabel(section?: string | null): string | null {
  if (!section) return null;
  const n = Number(section);
  return Number.isNaN(n) ? `${section}분반` : `${n}분반`;
}

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

  // ── 컨텍스트 메뉴(길게 누르기/우클릭) ──
  const [menu, setMenu] = useState<{ block: GridBlock; x: number; y: number } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const openMenu = (block: GridBlock, x: number, y: number) => {
    if (!block.onReview && !block.onRemove) return;
    const W = 180;
    const nx = Math.min(Math.max(8, x), window.innerWidth - W - 8);
    const ny = Math.min(y, window.innerHeight - 170);
    setMenu({ block, x: nx, y: ny });
  };
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const minWidth = days.length <= 5 ? 0 : 520;

  return (
    <div
      className="grid select-none"
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
              const actionable = !!(b.onReview || b.onRemove);
              const sec = secLabel(b.section);
              const sub2 = [sec, b.sub].filter(Boolean).join(" · ");
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
                    touchAction: actionable ? "none" : undefined,
                  }}
                  onContextMenu={
                    actionable
                      ? (e) => {
                          e.preventDefault();
                          openMenu(b, e.clientX, e.clientY);
                        }
                      : undefined
                  }
                  onTouchStart={
                    actionable
                      ? (e) => {
                          longPressed.current = false;
                          const t = e.touches[0];
                          pressTimer.current = setTimeout(() => {
                            longPressed.current = true;
                            openMenu(b, t.clientX, t.clientY);
                          }, 420);
                        }
                      : undefined
                  }
                  onTouchEnd={() => {
                    if (pressTimer.current) clearTimeout(pressTimer.current);
                  }}
                  onTouchMove={() => {
                    if (pressTimer.current) clearTimeout(pressTimer.current);
                  }}
                >
                  <p className="text-[11px] font-bold leading-tight break-words line-clamp-3">
                    {b.title}
                  </p>
                  {sub2 && (
                    <p className="text-[10px] opacity-80 leading-tight line-clamp-2 mt-0.5">
                      {sub2}
                    </p>
                  )}
                  {actionable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        openMenu(b, r.right, r.bottom);
                      }}
                      aria-label="메뉴"
                      className="absolute top-0.5 right-0.5 rounded p-0.5 opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 메뉴 팝업 */}
      {menu && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMenu(null)}>
          <div
            className="absolute rounded-xl bg-popover shadow-lg border border-border py-1 w-[180px]"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-bold leading-tight break-words">{menu.block.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {menu.block.day} {menu.block.start}
                {menu.block.end > menu.block.start ? `~${menu.block.end}` : ""}교시
                {secLabel(menu.block.section) ? ` · ${secLabel(menu.block.section)}` : ""}
                {menu.block.sub ? ` · ${menu.block.sub}` : ""}
              </p>
            </div>
            {menu.block.onReview && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                onClick={() => {
                  menu.block.onReview?.();
                  setMenu(null);
                }}
              >
                <Star className="h-4 w-4" /> 리뷰 보기
              </button>
            )}
            {menu.block.onRemove && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                onClick={() => {
                  menu.block.onRemove?.();
                  setMenu(null);
                }}
              >
                <Trash2 className="h-4 w-4" /> 지우기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
