import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, GraduationCap, CheckCircle2, Star as StarIcon } from "lucide-react";
import { RecruitingBadge } from "@/components/RecruitingBadge";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CURRENT_SEMESTER = "2026-1";

export default function Courses() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState("my");

  const [newName, setNewName] = useState("");
  const [newProf, setNewProf] = useState("");
  const [newCredits, setNewCredits] = useState("3");
  const [newTeamProject, setNewTeamProject] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const myCourses = trpc.courses.myCourses.useQuery({ semester: CURRENT_SEMESTER });

  const searchResults = trpc.courses.search.useQuery(
    { query: searchQuery, university: user?.university || undefined },
    { enabled: searchQuery.length > 0 }
  );

  const enrollMutation = trpc.courses.enroll.useMutation({
    onSuccess: () => {
      utils.courses.myCourses.invalidate();
      utils.dashboard.getData.invalidate();
      toast.success("수강 등록 완료!");
    },
    onError: (err) => toast.error(err.message),
  });

  const unenrollMutation = trpc.courses.unenroll.useMutation({
    onSuccess: () => {
      utils.courses.myCourses.invalidate();
      utils.dashboard.getData.invalidate();
      toast.success("수강 해제 완료");
    },
  });

  const joinMutation = trpc.courses.joinByCode.useMutation({
    onSuccess: (data) => {
      utils.courses.myCourses.invalidate();
      utils.dashboard.getData.invalidate();
      setJoinCode("");
      toast.success(`'${data.courseName}'에 참여했어요!`);
      setLocation(`/courses/${data.courseId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.courses.create.useMutation({
    onSuccess: (data) => {
      setShowCreate(false);
      setNewName("");
      setNewProf("");
      setNewCredits("3");
      setNewTeamProject(false);
      setNewCode("");
      if (data?.id) {
        enrollMutation.mutate({ courseId: data.id, semester: CURRENT_SEMESTER });
      }
      toast.success("수업이 생성되었습니다!");
    },
    onError: (err) => toast.error(err.message),
  });

  const enrolledCourseIds = useMemo(
    () => new Set(myCourses.data?.map((c) => c.course.id) || []),
    [myCourses.data]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newProf.trim()) {
      toast.error("수업명과 교수명은 필수입니다.");
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      professor: newProf.trim(),
      credits: parseInt(newCredits),
      hasTeamProject: newTeamProject,
      university: user?.university || "",
      courseCode: newCode.trim() || undefined,
    });
  };

  // 수업 코드 참여 카드 — 모바일은 탭 상단, PC는 우측 레일에 배치(같은 요소를 반응형으로).
  const joinCard = (
    <div className="rounded-[18px] bg-secondary p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <GraduationCap className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold text-foreground">수업 코드로 참여</span>
      </div>
      <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">
        교수님이 알려주신 코드를 입력하면 그 수업에 바로 참여돼요.
      </p>
      <div className="flex gap-2">
        <Input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="예: ABC123"
          maxLength={8}
          className="uppercase"
        />
        <Button
          className="shrink-0"
          disabled={joinMutation.isPending || joinCode.trim().length < 4}
          onClick={() =>
            joinMutation.mutate({ code: joinCode.trim(), semester: CURRENT_SEMESTER })
          }
        >
          참여
        </Button>
      </div>
    </div>
  );

  const courseCard = (item: NonNullable<typeof myCourses.data>[number]) => (
    <div
      key={item.userCourse.id}
      className="rounded-[18px] bg-card shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
      onClick={() => setLocation(`/courses/${item.course.id}`)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-[15px] truncate">{item.course.name}</div>
          <div className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {item.course.professor} · {item.course.credits}학점
            {item.course.courseCode && ` · ${item.course.courseCode}`}
          </div>
          {item.openRecruitCount > 0 && (
            <div className="mt-1.5">
              <RecruitingBadge count={item.openRecruitCount} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.course.hasTeamProject && (
            <span className="badge-tag text-xs font-bold px-2.5 py-1 rounded-full">팀플</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              unenrollMutation.mutate({
                courseId: item.course.id,
                semester: CURRENT_SEMESTER,
              });
            }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            해제
          </button>
        </div>
      </div>
    </div>
  );

  const myTabContent = (
    <>
      {/* 조인 카드 — 모바일 전용(PC는 우측 레일에) */}
      <div className="lg:hidden mb-3">{joinCard}</div>
      {myCourses.isLoading ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-[18px]" />
          ))}
        </div>
      ) : myCourses.data?.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-card p-8 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-foreground text-sm font-semibold mb-1">아직 등록한 수업이 없어요</p>
          <p className="text-muted-foreground text-[13px] mb-4">
            수업 코드로 참여하거나 검색해보세요
          </p>
          <Button variant="secondary" onClick={() => setTab("search")}>
            수업 검색하기
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {myCourses.data?.map((item) => courseCard(item))}
        </div>
      )}
    </>
  );

  const searchTabContent = (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="수업명, 교수명 또는 수업 코드로 검색"
          className="pl-10"
        />
      </div>

      {searchQuery.length > 0 && (
        <div className="grid gap-2 lg:grid-cols-2 mt-3">
          {searchResults.isLoading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-[18px]" />)
          ) : searchResults.data?.length === 0 ? (
            <div className="rounded-[18px] bg-card shadow-card p-6 text-center lg:col-span-2">
              <p className="text-sm text-muted-foreground mb-3">검색 결과가 없어요</p>
              <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="mr-1 h-4 w-4" /> 직접 수업 만들기
              </Button>
            </div>
          ) : (
            searchResults.data?.map((course) => (
              <div key={course.id} className="rounded-[18px] bg-card shadow-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[15px] truncate">{course.name}</div>
                    <div className="text-[13px] text-muted-foreground mt-0.5 truncate">
                      {course.professor} · {course.credits}학점
                      {course.courseCode && ` · ${course.courseCode}`}
                    </div>
                    {/* 수강 리뷰 요약 — 수업을 고르는 순간에 별점·팀플 유무 즉답 */}
                    {course.reviewSummary && course.reviewSummary.count > 0 && (
                      <div className="text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                          <StarIcon className="h-3 w-3 fill-current" />
                          {course.reviewSummary.avgRating}
                        </span>
                        <span className="text-muted-foreground">
                          리뷰 {course.reviewSummary.count}
                        </span>
                        {course.reviewSummary.teamYes + course.reviewSummary.teamNo > 0 && (
                          <span className="text-muted-foreground">
                            · 팀플 있었대요 {course.reviewSummary.teamYes}/
                            {course.reviewSummary.teamYes + course.reviewSummary.teamNo}
                          </span>
                        )}
                        {course.reviewSummary.avgTeamSize != null && (
                          <span className="text-muted-foreground">
                            · 보통 {course.reviewSummary.avgTeamSize}명
                          </span>
                        )}
                        {course.reviewSummary.teamYes > 0 &&
                          course.reviewSummary.preformYes >
                            course.reviewSummary.preformNo && (
                            <span className="badge-pos text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                              미리팀 OK
                            </span>
                          )}
                      </div>
                    )}
                    {course.openRecruitCount > 0 && (
                      <div className="mt-1.5">
                        <RecruitingBadge count={course.openRecruitCount} />
                      </div>
                    )}
                  </div>
                  {enrolledCourseIds.has(course.id) ? (
                    <span className="badge-tag text-xs font-bold px-2.5 py-1 rounded-full flex items-center shrink-0">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> 등록됨
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() =>
                        enrollMutation.mutate({
                          courseId: course.id,
                          semester: CURRENT_SEMESTER,
                        })
                      }
                      disabled={enrollMutation.isPending}
                    >
                      <Plus className="mr-1 h-3 w-3" /> 등록
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">수업</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <Plus className="mr-1 h-4 w-4" /> 수업 생성
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 수업 만들기</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>수업명 *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="데이터구조" />
              </div>
              <div className="space-y-2">
                <Label>교수명 *</Label>
                <Input value={newProf} onChange={(e) => setNewProf(e.target.value)} placeholder="김교수" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>학점</Label>
                  <Select value={newCredits} onValueChange={setNewCredits}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((c) => (
                        <SelectItem key={c} value={c.toString()}>
                          {c}학점
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>수업 코드</Label>
                  <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="CS101" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>팀 프로젝트 있음</Label>
                <Switch checked={newTeamProject} onCheckedChange={setNewTeamProject} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "생성 중..." : "수업 생성 및 등록"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 모바일: 단일 컬럼 / PC: 메인 + 우측 레일 */}
      <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
        {/* MAIN */}
        <div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="my" className="flex-1">내 수업</TabsTrigger>
              <TabsTrigger value="search" className="flex-1">수업 검색</TabsTrigger>
            </TabsList>
            <TabsContent value="my" className="mt-4">{myTabContent}</TabsContent>
            <TabsContent value="search" className="mt-4">{searchTabContent}</TabsContent>
          </Tabs>
        </div>

        {/* RIGHT RAIL (PC 전용) */}
        <div className="hidden lg:block space-y-3">
          {joinCard}
          <div className="rounded-[18px] bg-card shadow-card p-4 text-[13px] text-muted-foreground leading-relaxed">
            찾는 수업이 없다면 <span className="font-semibold text-foreground">수업 검색</span>에서 찾거나
            직접 만들어 첫 수강생이 되어보세요.
          </div>
        </div>
      </div>
    </div>
  );
}
