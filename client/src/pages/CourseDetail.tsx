import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { parseSkillTags } from "@/lib/utils-parse";
import {
  TEAM_SIZE_LIMITS,
  MENTORING_MAX_MENTEES,
  MATCH_TYPES,
  MATCH_TYPE_LABELS,
  type MatchType,
  type MentoringRole,
} from "@shared/const";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Users,
  FileText,
  Plus,
  Eye,
  Handshake,
  Shield,
  Lightbulb,
  Clock,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const BADGE_ICONS: Record<string, typeof Shield> = {
  promise: Shield,
  idea: Lightbulb,
  deadline: Clock,
};

const CATEGORIES = ["족보", "과제팁", "후기", "스터디"] as const;
// Courses.tsx와 동일 값 유지 (등록 학기). 추후 client/src/const.ts로 중앙화 가능.
const CURRENT_SEMESTER = "2026-1";

export default function CourseDetail() {
  const params = useParams<{ id: string }>();
  const courseId = parseInt(params.id || "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState("info");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showPostForm, setShowPostForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<string>("");
  const [connectKakaoOpen, setConnectKakaoOpen] = useState(false);
  const [pendingReceiverId, setPendingReceiverId] = useState<number | null>(null);
  const [kakaoInput, setKakaoInput] = useState("");
  // 커넥트 종류 — 팀플(기본)·스터디·멘토멘티가 같은 화면에서 전환된다.
  const [matchType, setMatchType] = useState<MatchType>("project");
  // 멘토멘티 전용: 내 역할 선택(기본 멘티 = 멘토를 찾는 요청).
  const [myRole, setMyRole] = useState<MentoringRole>("mentee");

  const course = trpc.courses.get.useQuery({ id: courseId });
  const posts = trpc.posts.list.useQuery({
    courseId,
    category: catFilter === "all" ? undefined : catFilter,
  });
  const myCourses = trpc.courses.myCourses.useQuery({ semester: CURRENT_SEMESTER });
  const isEnrolled = !!myCourses.data?.some((c) => c.course.id === courseId);
  // 미등록 상태에서는 students 쿼리를 호출하지 않는다 — courses.students는 미등록자에게
  // throw(routers.ts:138)하므로 enabled로 막아 빈 탭/에러를 방지하고 등록 CTA를 먼저 보여준다.
  // semester를 명시해 현재 학기 수강생만 노출(미지정 시 과거 학기 수강생까지 섞여 과거
  // 수강생에게 커넥트가 가능해짐). isEnrolled·enroll·roster가 모두 CURRENT_SEMESTER로 일관.
  const students = trpc.courses.students.useQuery(
    { courseId, semester: CURRENT_SEMESTER },
    { enabled: isEnrolled, retry: false }
  );

  // 내가 이 수업에서 이미 속한 같은 종류의 활성 그룹 — 있으면 커넥트가 "그룹 합류 초대"가 됨.
  // 팀플·스터디·멘토멘티는 독립이라 종류별로 따로 본다.
  const myTeams = trpc.teams.list.useQuery();
  const myTeamForCourse = myTeams.data?.find(
    (t) =>
      t.team.courseId === courseId &&
      t.team.status === "active" &&
      t.team.teamType === matchType
  );
  const inTeam = !!myTeamForCourse;
  const myTeamSize = myTeamForCourse?.members.length ?? 0;
  const maxSize = TEAM_SIZE_LIMITS[matchType];
  const teamFull = myTeamSize >= maxSize;

  const createPost = trpc.posts.create.useMutation({
    onSuccess: () => {
      utils.posts.list.invalidate();
      setShowPostForm(false);
      setPostTitle("");
      setPostContent("");
      setPostCategory("");
      toast.success("게시글이 작성되었습니다.");
    },
    onError: (err) => toast.error(err.message),
  });

  const matchRequest = trpc.matching.request.useMutation({
    onSuccess: () => {
      toast.success("커넥트 요청을 보냈습니다!");
    },
    onError: (err) => toast.error(err.message),
  });

  // 요청자가 오픈채팅 URL이 없으면 커넥트 시점에 받아 저장한 뒤 매칭 요청을 보낸다.
  // (매칭 성사 시 팀원에게 연락처가 필요한데, 운영자 개입 없는 self-serve 경로를 대비.)
  const saveKakao = trpc.profile.update.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      if (pendingReceiverId != null) {
        matchRequest.mutate({
          receiverId: pendingReceiverId,
          courseId,
          matchType,
          // 그룹이 이미 있으면 멘티 초대(상대=멘티)로 고정, 없으면 토글 선택값.
          requesterRole:
            matchType === "mentoring" ? (inTeam ? "mentor" : myRole) : undefined,
        });
      }
      setConnectKakaoOpen(false);
      setKakaoInput("");
      setPendingReceiverId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConnect = (receiverId: number) => {
    if (user?.kakaoOpenChatUrl) {
      matchRequest.mutate({
        receiverId,
        courseId,
        matchType,
        // 그룹이 이미 있으면 멘티 초대(상대=멘티)로 고정, 없으면 토글 선택값.
        requesterRole: matchType === "mentoring" ? (inTeam ? "mentor" : myRole) : undefined,
      });
    } else {
      setPendingReceiverId(receiverId);
      setKakaoInput("");
      setConnectKakaoOpen(true);
    }
  };

  const enroll = trpc.courses.enroll.useMutation({
    onSuccess: () => {
      // 등록 직후 같은 화면에서 팀탭이 바로 활성화되도록 관련 쿼리 무효화.
      utils.courses.myCourses.invalidate();
      utils.courses.students.invalidate();
      utils.courses.get.invalidate();
      toast.success("수업에 등록했어요. 이제 팀원을 찾을 수 있어요!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/courses/${courseId}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast.success("초대 링크를 복사했어요."),
        () => toast.error("복사에 실패했어요.")
      );
    } else {
      toast.error("이 환경에서는 복사가 지원되지 않아요.");
    }
  };

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim() || !postCategory) {
      toast.error("모든 항목을 입력해주세요.");
      return;
    }
    createPost.mutate({
      courseId,
      title: postTitle.trim(),
      content: postContent.trim(),
      category: postCategory as any,
    });
  };

  if (course.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const courseData = course.data;
  if (!courseData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">수업을 찾을 수 없습니다.</p>
        <Button variant="link" onClick={() => setLocation("/courses")}>
          수업 목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setLocation("/courses")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 수업 목록
      </button>

      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-bold text-lg">{courseData.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {courseData.professor} · {courseData.credits}학점
                {courseData.courseCode && ` · ${courseData.courseCode}`}
              </p>
            </div>
            {courseData.hasTeamProject && (
              <Badge variant="default" className="gradient-primary text-white border-0">
                팀플
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">
            <FileText className="mr-1 h-4 w-4" /> 정보
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-1">
            <Users className="mr-1 h-4 w-4" /> 팀원 찾기
          </TabsTrigger>
        </TabsList>

        {/* Info Tab - Posts */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 overflow-x-auto">
              <Button
                variant={catFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCatFilter("all")}
                className={catFilter === "all" ? "gradient-primary text-white border-0" : ""}
              >
                전체
              </Button>
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={catFilter === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCatFilter(cat)}
                  className={catFilter === cat ? "gradient-primary text-white border-0" : ""}
                >
                  {cat}
                </Button>
              ))}
            </div>
            <Dialog open={showPostForm} onOpenChange={setShowPostForm}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> 글쓰기
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>게시글 작성</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePostSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>카테고리 *</Label>
                    <Select value={postCategory} onValueChange={setPostCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>제목 *</Label>
                    <Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>내용 *</Label>
                    <Textarea
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full gradient-primary text-white border-0"
                    disabled={createPost.isPending}
                  >
                    {createPost.isPending ? "작성 중..." : "게시글 작성"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {posts.isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : posts.data?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">아직 게시글이 없어요</p>
              </CardContent>
            </Card>
          ) : (
            posts.data?.map((item) => (
              <Card
                key={item.post.id}
                className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setLocation(`/posts/${item.post.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <Badge variant="outline" className="text-xs">
                      {item.post.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {item.post.viewCount}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm mt-2">{item.post.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.post.content}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2">
                    익명 · {new Date(item.post.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Team Tab - Students */}
        <TabsContent value="team" className="mt-4 space-y-3">
          {/* 커넥트 종류 선택 — 팀플 / 스터디 / 멘토멘티 */}
          {!myCourses.isLoading && isEnrolled && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                {MATCH_TYPES.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={matchType === t ? "default" : "outline"}
                    className={matchType === t ? "gradient-primary text-white border-0" : ""}
                    onClick={() => setMatchType(t)}
                  >
                    {MATCH_TYPE_LABELS[t]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {matchType === "project" &&
                  `같은 수업에서 팀플 팀원을 찾아요. (최대 ${TEAM_SIZE_LIMITS.project}명)`}
                {matchType === "study" &&
                  `수업 내용을 함께 공부할 스터디원을 찾아요. (최대 ${TEAM_SIZE_LIMITS.study}명)`}
                {matchType === "mentoring" &&
                  `멘토 1명 + 멘티 최대 ${MENTORING_MAX_MENTEES}명으로 연결돼요.`}
              </p>
              {/* 역할 토글은 그룹이 없을 때만 — 이미 그룹이 있으면 커넥트=멘티 초대로 고정 */}
              {matchType === "mentoring" && !inTeam && (
                <div className="flex gap-1.5 pt-0.5">
                  <Button
                    size="sm"
                    variant={myRole === "mentee" ? "default" : "outline"}
                    className={myRole === "mentee" ? "gradient-primary text-white border-0" : ""}
                    onClick={() => setMyRole("mentee")}
                  >
                    멘토 찾기 (나는 멘티)
                  </Button>
                  <Button
                    size="sm"
                    variant={myRole === "mentor" ? "default" : "outline"}
                    className={myRole === "mentor" ? "gradient-primary text-white border-0" : ""}
                    onClick={() => setMyRole("mentor")}
                  >
                    멘티 찾기 (나는 멘토)
                  </Button>
                </div>
              )}
            </div>
          )}
          {myCourses.isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : !isEnrolled ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  이 수업에 등록하면 같은 수업 학생을 보고 팀원 커넥트를 보낼 수 있어요.
                </p>
                <Button
                  onClick={() => enroll.mutate({ courseId, semester: CURRENT_SEMESTER })}
                  disabled={enroll.isPending}
                  className="gradient-primary text-white border-0"
                >
                  {enroll.isPending ? "등록 중..." : "이 수업 등록하기"}
                </Button>
              </CardContent>
            </Card>
          ) : students.isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : students.isError ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">팀원 목록을 불러오지 못했어요.</p>
                <Button variant="outline" size="sm" onClick={() => students.refetch()}>
                  다시 시도
                </Button>
              </CardContent>
            </Card>
          ) : (students.data ?? []).filter((s) => s.user.id !== user?.id).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  아직 이 수업에 등록한 다른 학생이 없어요.
                  <br />
                  같은 수업 친구에게 이 페이지를 공유해보세요.
                </p>
                <Button variant="outline" size="sm" onClick={handleCopyInvite}>
                  초대 링크 복사
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {inTeam && (
                <Card className="border-primary/30 bg-primary/5 shadow-none">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">
                      이 수업에 이미{" "}
                      <span className="font-medium text-foreground">
                        {myTeamSize}명 {MATCH_TYPE_LABELS[matchType]}
                      </span>{" "}
                      그룹이 있어요. 커넥트하면 상대가 수락 시{" "}
                      <span className="font-medium text-foreground">내 그룹에 합류</span>해요{" "}
                      {matchType === "mentoring"
                        ? `(멘토 1명 + 멘티 최대 ${MENTORING_MAX_MENTEES}명)`
                        : `(최대 ${maxSize}명)`}
                      .{teamFull && " 정원이 가득 찼어요."}
                    </p>
                  </CardContent>
                </Card>
              )}
              {(students.data ?? [])
                .filter((s) => s.user.id !== user?.id)
                .map((student) => (
                  <Card key={student.user.id} className="border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {student.user.department} · {student.user.year}학년
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {parseSkillTags(student.user.skillTags).slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConnect(student.user.id)}
                          disabled={matchRequest.isPending || saveKakao.isPending || teamFull}
                          className="gradient-primary text-white border-0"
                        >
                          <Handshake className="mr-1 h-4 w-4" />
                          {inTeam
                            ? matchType === "mentoring"
                              ? "멘티 초대"
                              : `${MATCH_TYPE_LABELS[matchType]}에 초대`
                            : "커넥트"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 요청자 연락처(오픈채팅) 수집 — kakao 없을 때 커넥트 직전에 입력받음 */}
      <Dialog open={connectKakaoOpen} onOpenChange={setConnectKakaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카카오 오픈채팅 링크</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              매칭이 수락되면 팀원에게 이 링크가 공개돼요. 커넥트하려면 먼저 입력해주세요.
            </p>
            <Input
              value={kakaoInput}
              onChange={(e) => setKakaoInput(e.target.value)}
              placeholder="https://open.kakao.com/o/..."
            />
            <Button
              className="w-full gradient-primary text-white border-0"
              onClick={() => {
                if (!kakaoInput.trim()) {
                  toast.error("오픈채팅 링크를 입력해주세요.");
                  return;
                }
                saveKakao.mutate({ kakaoOpenChatUrl: kakaoInput.trim() });
              }}
              disabled={saveKakao.isPending || matchRequest.isPending}
            >
              {saveKakao.isPending ? "저장 중..." : "저장하고 커넥트"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
