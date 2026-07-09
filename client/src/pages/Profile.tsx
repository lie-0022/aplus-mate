import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { COHORT_UNIVERSITIES, COHORT_DEPARTMENTS } from "@/lib/universities";
import { parseSkillTags } from "@/lib/utils-parse";
import { SkillTagsInput } from "@/components/SkillTagsInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  UserCircle,
  Edit3,
  Save,
  X,
  Shield,
  Lightbulb,
  Clock,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// 신뢰 배지 3종 — 다크안전 시맨틱 틴트(pos/sky/notice)로 구분.
const BADGE_INFO: Record<string, { label: string; icon: typeof Shield; tint: string }> = {
  promise: { label: "약속 철저", icon: Shield, tint: "badge-pos" },
  idea: { label: "아이디어 뱅크", icon: Lightbulb, tint: "badge-sky" },
  deadline: { label: "마감 준수", icon: Clock, tint: "badge-notice" },
};

export default function Profile() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.profile.get.useQuery();
  const deleteSelf = trpc.profile.deleteSelf.useMutation({
    onSuccess: () => {
      toast.success("탈퇴 처리됐어요. 이용해주셔서 감사합니다.");
      logout();
    },
    onError: (err) => toast.error(err.message),
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
      setEditing(false);
      toast.success("프로필이 수정되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = () => {
    if (data?.user) {
      setName(data.user.name || "");
      setUniversity(data.user.university || "");
      setDepartment(data.user.department || "");
      setYear(data.user.year?.toString() || "");
      setSkillTags(parseSkillTags(data.user.skillTags));
    }
    setEditing(true);
  };

  const handleSave = () => {
    updateProfile.mutate({
      name: name.trim(),
      university: university.trim(),
      department: department.trim(),
      year: parseInt(year),
      skillTags,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-[18px]" />
        <Skeleton className="h-32 rounded-[18px]" />
      </div>
    );
  }

  const profile = data?.user;
  const badges = data?.badges || [];
  const displaySkillTags = editing ? skillTags : parseSkillTags(profile?.skillTags);

  // ── 프로필 카드 ──
  const profileCardEl = (
    <div className="rounded-2xl bg-card shadow-card p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
          <UserCircle className="h-8 w-8 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-semibold text-lg h-8"
            />
          ) : (
            <div className="font-bold text-lg">{profile?.name}</div>
          )}
          <div className="text-sm text-muted-foreground">
            {profile?.university} · {profile?.department}
          </div>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">학교</Label>
              <Select value={university} onValueChange={setUniversity}>
                <SelectTrigger>
                  <SelectValue placeholder="학교 선택" />
                </SelectTrigger>
                <SelectContent>
                  {COHORT_UNIVERSITIES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">학과</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="학과 선택" />
                </SelectTrigger>
                <SelectContent>
                  {COHORT_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">학년</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}학년{y === 5 ? " 이상" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b">
            <span className="text-muted-foreground">학년</span>
            <span className="font-medium">{profile?.year}학년</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{profile?.email || "-"}</span>
          </div>
        </div>
      )}
    </div>
  );

  // ── 스킬 태그 ──
  const skillsEl = (
    <div className="rounded-2xl bg-card shadow-card p-5">
      <div className="text-base font-bold flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-primary" /> 스킬 태그
      </div>
      {editing ? (
        <SkillTagsInput value={skillTags} onChange={setSkillTags} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {displaySkillTags.map((tag) => (
            <span key={tag} className="badge-tag text-xs font-semibold px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
          {displaySkillTags.length === 0 && (
            <span className="text-sm text-muted-foreground">아직 등록된 스킬 태그가 없어요</span>
          )}
        </div>
      )}
    </div>
  );

  // ── 신뢰 배지 ──
  const badgesEl = (
    <div className="rounded-2xl bg-card shadow-card p-5">
      <div className="text-base font-bold flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-primary" /> 신뢰 배지
      </div>
      {badges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 획득한 배지가 없어요. 팀플 평가를 통해 배지를 모아보세요!
        </p>
      ) : (
        <div className="space-y-3">
          {badges.map((badge) => {
            const info = BADGE_INFO[badge.badgeType];
            if (!info) return null;
            const Icon = info.icon;
            return (
              <div key={badge.id} className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${info.tint} flex items-center justify-center`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{info.label}</div>
                  <div className="text-xs text-muted-foreground">{badge.count}회 획득</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── 회원 탈퇴 ──
  const deleteEl = (
    <div className="pt-2 text-center">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
          >
            회원 탈퇴
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle>
            <AlertDialogDescription>
              프로필·연락처 정보가 삭제되고, 진행 중인 팀에서 나가게 됩니다. 이 작업은 되돌릴 수
              없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSelf.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              탈퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">내 프로필</h1>
        {!editing ? (
          <Button variant="secondary" size="sm" onClick={startEdit}>
            <Edit3 className="mr-1 h-4 w-4" /> 수정
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="mr-1 h-4 w-4" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
              <Save className="mr-1 h-4 w-4" /> 저장
            </Button>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
        {/* MAIN */}
        <div className="space-y-4">
          {profileCardEl}
          {skillsEl}
          {/* 모바일: 배지·탈퇴도 세로 스택 */}
          <div className="lg:hidden space-y-4">
            {badgesEl}
            {deleteEl}
          </div>
        </div>

        {/* RIGHT RAIL (PC) */}
        <div className="hidden lg:block space-y-3">
          {badgesEl}
          {deleteEl}
        </div>
      </div>
    </div>
  );
}
