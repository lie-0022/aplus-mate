import { Shield, Lightbulb, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// 신뢰 배지 표시 — Profile/PublicProfile/매칭·팀원 카드에서 공유.
const BADGE_INFO: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  promise: { label: "약속 철저", icon: Shield, color: "bg-primary/10 text-primary" },
  idea: { label: "아이디어 뱅크", icon: Lightbulb, color: "bg-sky-brand/10 text-sky-brand" },
  deadline: { label: "마감 준수", icon: Clock, color: "bg-primary/10 text-primary" },
};

export function UserBadges({
  badges,
  size = "default",
}: {
  badges: { badgeType: string; count: number }[];
  size?: "default" | "sm";
}) {
  const valid = (badges ?? []).filter((b) => BADGE_INFO[b.badgeType]);
  if (valid.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {valid.map((b) => {
        const info = BADGE_INFO[b.badgeType];
        const Icon = info.icon;
        return (
          <Badge
            key={b.badgeType}
            className={`${info.color} border-0 ${
              b.count >= 5
                ? "ring-1 ring-yellow-400"
                : b.count >= 3
                  ? "ring-1 ring-slate-400"
                  : ""
            } ${size === "sm" ? "text-[10px] py-0 px-1.5" : "text-xs"}`}
            title={b.count >= 5 ? "골드" : b.count >= 3 ? "실버" : "브론즈"}
          >
            <Icon className={size === "sm" ? "h-2.5 w-2.5 mr-0.5" : "h-3 w-3 mr-1"} />
            {info.label}
            {b.count > 1 ? ` ×${b.count}` : ""}
            {b.count >= 5 ? " 💎" : b.count >= 3 ? " ⭐" : ""}
          </Badge>
        );
      })}
    </div>
  );
}
