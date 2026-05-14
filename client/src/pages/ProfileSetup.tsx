import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ProfileSetup() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [name, setName] = useState(user?.name || "");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState<string>("");
  const [kakaoUrl, setKakaoUrl] = useState("");

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("프로필이 설정되었습니다!");
      setLocation("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "프로필 설정에 실패했습니다.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !university.trim() || !department.trim() || !year) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }
    updateProfile.mutate({
      name: name.trim(),
      university: university.trim(),
      department: department.trim(),
      year: parseInt(year),
      kakaoOpenChatUrl: kakaoUrl.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="gradient-primary w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl">프로필 설정</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            팀원 매칭을 위해 기본 정보를 입력해주세요
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="university">학교 *</Label>
              <Input
                id="university"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="서울대학교"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">학과 *</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="컴퓨터공학과"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">학년 *</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="학년 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1학년</SelectItem>
                  <SelectItem value="2">2학년</SelectItem>
                  <SelectItem value="3">3학년</SelectItem>
                  <SelectItem value="4">4학년</SelectItem>
                  <SelectItem value="5">5학년 이상</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kakao">카카오 오픈채팅 URL (선택)</Label>
              <Input
                id="kakao"
                value={kakaoUrl}
                onChange={(e) => setKakaoUrl(e.target.value)}
                placeholder="https://open.kakao.com/o/..."
              />
              <p className="text-xs text-muted-foreground">
                매칭 수락 후에만 상대방에게 공개됩니다
              </p>
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary text-white border-0"
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "저장 중..." : "프로필 설정 완료"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
