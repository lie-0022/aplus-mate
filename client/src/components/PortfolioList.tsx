import { Github, ExternalLink, Star } from "lucide-react";

// 매칭용 작업물 목록 — 공개 프로필과 내 프로필이 같은 카드를 쓴다.
// GitHub 메타(언어·스타·최근 푸시)는 서버가 공개 API로 확인한 값이라
// 자기신고 스킬 태그와 달리 "검증된" 신호다. 없으면 그냥 링크로만 보인다.

export type PortfolioItemView = {
  id: number;
  title: string;
  summary?: string | null;
  role?: string | null;
  techTags?: string[] | null;
  repoUrl?: string | null;
  demoUrl?: string | null;
  ghStars?: number | null;
  ghLanguage?: string | null;
  ghPushedAt?: Date | string | null;
};

function pushedLabel(at: Date | string): string | null {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86400000);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return "오늘 커밋";
  if (days < 30) return `${days}일 전 커밋`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}개월 전 커밋`;
  return `${Math.floor(mo / 12)}년 전 커밋`;
}

export function PortfolioList({ items }: { items: PortfolioItemView[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((p) => {
        const pushed = p.ghPushedAt ? pushedLabel(p.ghPushedAt) : null;
        return (
          <div key={p.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{p.title}</div>
                {p.role && (
                  <div className="text-[12px] text-primary font-semibold mt-0.5">{p.role}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {p.repoUrl && (
                  <a
                    href={p.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="코드 저장소 열기"
                  >
                    <Github className="h-4 w-4" />
                  </a>
                )}
                {p.demoUrl && (
                  <a
                    href={p.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="결과물 열기"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
            {p.summary && (
              <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{p.summary}</p>
            )}
            {(p.techTags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {p.techTags!.map((t) => (
                  <span
                    key={t}
                    className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {/* 검증된 신호 — 서버가 GitHub 공개 API로 실제 확인한 값 */}
            {(p.ghLanguage || pushed || (p.ghStars ?? 0) > 0) && (
              <div className="flex items-center gap-2.5 mt-2 text-[11px] text-muted-foreground">
                {p.ghLanguage && <span>{p.ghLanguage}</span>}
                {(p.ghStars ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3" /> {p.ghStars}
                  </span>
                )}
                {pushed && <span>{pushed}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
