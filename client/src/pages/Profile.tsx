import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { parseSkillTags } from "@/lib/utils-parse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCircle,
  Edit3,
  Save,
  X,
  Shield,
  Lightbulb,
  Clock,
  Plus,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const BADGE_INFO: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  promise: { label: "약속 철저", icon: Shield, color: "bg-primary/10 text-primary" },
  idea: { label: "아이디어 뱅크", icon: Lightbulb, color: "bg-sky-brand/10 text-sky-brand" },
  deadline: { label: "마감 준수", icon: Clock, color: "bg-primary/10 text-primary" },
};

export default function Profile() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.profile.get.useQuery();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [kakaoUrl, setKakaoUrl] = useState("");
  const [skillInput, setSkillInput] = useState("");
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
      setKakaoUrl(data.user.kakaoOpenChatUrl || "");
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
      kakaoOpenChatUrl: kakaoUrl.trim(),
    });
  };

  const addSkillTag = () => {
    const tag = skillInput.trim();
    if (tag && !skillTags.includes(tag)) {
      setSkillTags([...skillTags, tag]);
      setSkillInput("");
    }
  };

  const removeSkillTag = (tag: string) => {
    setSkillTags(skillTags.filter((t) => t !== tag));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  const profile = data?.user;
  const badges = data?.badges || [];
  const displaySkillTags = editing ? skillTags : parseSkillTags(profile?.skillTags);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">내 프로필</h1>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Edit3 className="mr-1 h-4 w-4" /> 수정
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="mr-1 h-4 w-4" /> 취소
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="gradient-primary text-white border-0"
            >
              <Save className="mr-1 h-4 w-4" /> 저장
            </Button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <Card className="border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
              <UserCircle className="h-8 w-8 text-white" />
            </div>
            <div>
              {editing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-semibold text-lg h-8"
                />
              ) : (
                <div className="font-semibold text-lg">{profile?.name}</div>
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
                  <Input value={university} onChange={(e) => setUniversity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">학과</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
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
              <div className="space-y-1">
                <Label className="text-xs">카카오 오픈채팅 URL</Label>
                <Input
                  value={kakaoUrl}
                  onChange={(e) => setKakaoUrl(e.target.value)}
                  placeholder="https://open.kakao.com/o/..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">학년</span>
                <span className="font-medium">{profile?.year}학년</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">이메일</span>
                <span className="font-medium">{profile?.email || "-"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">오픈채팅</span>
                <span className="font-medium">
                  {profile?.kakaoOpenChatUrl ? "설정됨" : "미설정"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Tags */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            스킬 태그
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {displaySkillTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
                {editing && (
                  <button
                    onClick={() => removeSkillTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {displaySkillTags.length === 0 && (
              <span className="text-sm text-muted-foreground">
                아직 등록된 스킬 태그가 없어요
              </span>
            )}
          </div>
          {editing && (
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkillTag())}
                placeholder="스킬 입력 (예: Python)"
                className="text-sm"
              />
              <Button variant="outline" size="sm" onClick={addSkillTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            신뢰 배지
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
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
                      className={`w-10 h-10 rounded-xl ${info.color} flex items-center justify-center`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{info.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {badge.count}회 획득
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
