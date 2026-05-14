import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { parseSkillTags } from "@/lib/utils-parse";
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

  const course = trpc.courses.get.useQuery({ id: courseId });
  const posts = trpc.posts.list.useQuery({
    courseId,
    category: catFilter === "all" ? undefined : catFilter,
  });
  const students = trpc.courses.students.useQuery({ courseId });

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
              <Card key={item.post.id} className="border shadow-sm">
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
          {students.isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : students.data?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  아직 이 수업에 등록한 학생이 없어요
                </p>
              </CardContent>
            </Card>
          ) : (
            students.data
              ?.filter((s) => s.user.id !== user?.id)
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
                        onClick={() =>
                          matchRequest.mutate({
                            receiverId: student.user.id,
                            courseId,
                          })
                        }
                        disabled={matchRequest.isPending}
                        className="gradient-primary text-white border-0"
                      >
                        <Handshake className="mr-1 h-4 w-4" /> 커넥트
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
