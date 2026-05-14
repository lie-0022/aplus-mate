import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  Plus,
  BookOpen,
  ArrowRight,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
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

  // Form state for creating course
  const [newName, setNewName] = useState("");
  const [newProf, setNewProf] = useState("");
  const [newCredits, setNewCredits] = useState("3");
  const [newTeamProject, setNewTeamProject] = useState(false);
  const [newCode, setNewCode] = useState("");

  const myCourses = trpc.courses.myCourses.useQuery({ semester: CURRENT_SEMESTER });

  const [debouncedQuery] = useState(() => searchQuery);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">수업</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-primary text-white border-0">
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
              <Button type="submit" className="w-full gradient-primary text-white border-0" disabled={createMutation.isPending}>
                {createMutation.isPending ? "생성 중..." : "수업 생성 및 등록"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="my" className="flex-1">내 수업</TabsTrigger>
          <TabsTrigger value="search" className="flex-1">수업 검색</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-4">
          {myCourses.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : myCourses.data?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-4">
                  등록한 수업이 없어요
                </p>
                <Button variant="outline" onClick={() => setTab("search")}>
                  수업 검색하기
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {myCourses.data?.map((item) => (
                <Card
                  key={item.userCourse.id}
                  className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/courses/${item.course.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{item.course.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.course.professor} · {item.course.credits}학점
                          {item.course.courseCode && ` · ${item.course.courseCode}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.course.hasTeamProject && (
                          <Badge variant="secondary" className="text-xs">팀플</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
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
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="mt-4 space-y-4">
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
            <div className="space-y-2">
              {searchResults.isLoading ? (
                [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              ) : searchResults.data?.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      검색 결과가 없어요
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                      <Plus className="mr-1 h-4 w-4" /> 직접 수업 만들기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                searchResults.data?.map((course) => (
                  <Card key={course.id} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{course.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {course.professor} · {course.credits}학점
                            {course.courseCode && ` · ${course.courseCode}`}
                          </div>
                        </div>
                        {enrolledCourseIds.has(course.id) ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> 등록됨
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
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
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
