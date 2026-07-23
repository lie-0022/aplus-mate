import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserBadges } from "@/components/UserBadges";
import { parseSkillTags } from "@/lib/utils-parse";
import { ArrowLeft, UserCircle, Github } from "lucide-react";
import { PortfolioList } from "@/components/PortfolioList";
import { useParams } from "wouter";

// 학생 공개 프로필 — 매칭 전 단계라 실명·연락처는 가리고, 학과·학년·스킬·신뢰배지만 노출.
export default function PublicProfile() {
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id || "0");
  const { data, isLoading } = trpc.profile.getPublic.useQuery({ userId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }
  if (!data?.user) {
    return (
      <div className="text-center py-12 text-muted-foreground">학생을 찾을 수 없습니다.</div>
    );
  }
  const u = data.user;
  const skills = parseSkillTags(u.skillTags);
  return (
    <div className="space-y-4">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 뒤로
      </button>
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center">
              <UserCircle className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold">
                {u.department || "학과 미입력"}
                {u.year ? ` · ${u.year}학년` : ""}
              </div>
              {u.university && (
                <div className="text-xs text-muted-foreground">{u.university}</div>
              )}
            </div>
          </div>

          {u.bio && <p className="text-[13px] leading-relaxed">{u.bio}</p>}

          {u.githubUsername && (
            <a
              href={`https://github.com/${u.githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline"
            >
              <Github className="h-4 w-4" />@{u.githubUsername}
            </a>
          )}

          {/* 작업물 — 스킬 태그(자기신고)보다 강한 판단 재료라 위에 둔다 */}
          {data.portfolio.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">작업물</p>
              <PortfolioList items={data.portfolio} />
            </div>
          )}

          {data.badges.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">획득한 신뢰 배지</p>
              <UserBadges badges={data.badges} />
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">스킬</p>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {skills.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">등록된 스킬이 없어요</p>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground pt-1 border-t">
            매칭이 성사되면 연락처(오픈채팅)가 공개돼요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
