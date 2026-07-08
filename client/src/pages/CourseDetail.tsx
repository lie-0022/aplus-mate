import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { parseSkillTags } from "@/lib/utils-parse";
import { cn } from "@/lib/utils";
import RecruitmentSection from "@/components/RecruitmentSection";
import { ReportDialog } from "@/components/ReportDialog";
import {
  TEAM_SIZE_LIMITS,
  MENTORING_MAX_MENTEES,
  MATCH_TYPES,
  MATCH_TYPE_LABELS,
  type MatchType,
  type MentoringRole,
} from "@shared/const";
import { Button } from "@/components/ui/button";
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
  Megaphone,
  ClipboardList,
  BadgeCheck,
  Link2,
  Star,
  GraduationCap,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const CATEGORIES = ["족보", "과제팁", "후기", "스터디"] as const;
// 수강 리뷰 — 팀플 유형 태그(다음 수강생이 "어떤 식의 팀플인지" 파악)
const PROJECT_TYPE_OPTIONS = ["발표", "개발·제작", "보고서·논문", "설계·기획", "실험·실습", "기타"] as const;
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
  // 수강 리뷰 — 별점·"팀플 있었나요?" 집계가 다음 수강생에게 팀플 유무를 알려준다.
  const reviewSummary = trpc.reviews.summary.useQuery({ courseId });
  const reviewList = trpc.reviews.list.useQuery({ courseId });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [revRating, setRevRating] = useState(0);
  const [revTeam, setRevTeam] = useState<"yes" | "no" | "na">("na");
  const [revTeamSize, setRevTeamSize] = useState<string>("");
  const [revTypes, setRevTypes] = useState<string[]>([]);
  const [revPreform, setRevPreform] = useState<"yes" | "no" | "na">("na");
  const [revContent, setRevContent] = useState("");
  const [showAllReviews, setShowAllReviews] = useState(false);
  const invalidateReviews = () => {
    utils.reviews.summary.invalidate({ courseId });
    utils.reviews.list.invalidate({ courseId });
  };
  const upsertReview = trpc.reviews.upsert.useMutation({
    onSuccess: () => {
      invalidateReviews();
      setReviewOpen(false);
      toast.success("리뷰를 남겼어요. 다음 수강생에게 큰 도움이 돼요!");
    },
    onError: (err) => toast.error(err.message),
  });
  const removeReview = trpc.reviews.remove.useMutation({
    onSuccess: () => {
      invalidateReviews();
      toast.success("리뷰를 삭제했어요.");
    },
    onError: (err) => toast.error(err.message),
  });
  // 교수 공지·설문 — 정보 탭 상단에 노출
  const courseAnnouncements = trpc.announcements.list.useQuery({ courseId });
  const courseSurveys = trpc.surveys.listForCourse.useQuery({ courseId });
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
      // 모달을 먼저 닫고 나서 후속 mutate를 보낸다 — 닫힘 애니메이션과 mutate 리렌더가
      // 같은 틱에 겹치면 Radix Presence가 잔존(body pointer-events 잠김)할 수 있다.
      const receiverId = pendingReceiverId;
      setConnectKakaoOpen(false);
      setKakaoInput("");
      setPendingReceiverId(null);
      utils.auth.me.invalidate();
      if (receiverId != null) {
        setTimeout(() => {
          matchRequest.mutate({
            receiverId,
            courseId,
            matchType,
            // 그룹이 이미 있으면 멘티 초대(상대=멘티)로 고정, 없으면 토글 선택값.
            requesterRole:
              matchType === "mentoring" ? (inTeam ? "mentor" : myRole) : undefined,
          });
        }, 0);
      }
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
      <div className="space-y-4 mx-auto w-full max-w-[980px]">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 rounded-[18px]" />
        <Skeleton className="h-48 rounded-[18px]" />
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

  // ─── 재사용 요소 ─────────────────────────────────────────
  const noticeEl =
    courseAnnouncements.data && courseAnnouncements.data.length > 0 ? (
      <div className="notice-soft rounded-[16px] p-3.5 space-y-2.5">
        {courseAnnouncements.data.slice(0, 3).map((a) => (
          <div key={a.id}>
            <div className="text-sm font-bold flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 shrink-0" /> {a.title}
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{a.content}</p>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              교수님 공지 ·{" "}
              {new Date(a.createdAt).toLocaleDateString("ko-KR", {
                month: "numeric",
                day: "numeric",
              })}
            </div>
          </div>
        ))}
      </div>
    ) : null;

  const surveyEls = courseSurveys.data
    ?.filter((s) => s.survey.status === "open")
    .map(({ survey, responded }) => (
      <div
        key={survey.id}
        className="rounded-[16px] bg-secondary p-3 flex items-center justify-between gap-2"
      >
        <div className="min-w-0 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{survey.title}</div>
            <div className="text-[11px] text-muted-foreground">교수님 설문 · 익명 집계</div>
          </div>
        </div>
        {responded ? (
          <span className="badge-pos text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
            참여 완료
          </span>
        ) : (
          <Button size="sm" className="shrink-0" onClick={() => setLocation(`/surveys/${survey.id}`)}>
            참여하기
          </Button>
        )}
      </div>
    ));
  const hasNews = !!noticeEl || (Array.isArray(surveyEls) && surveyEls.length > 0);

  // ── 수강 리뷰 ──
  const myReview = reviewList.data?.find((r) => r.isMine);
  const openReviewDialog = () => {
    if (myReview) {
      setRevRating(myReview.rating);
      setRevTeam(
        myReview.hadTeamProject === true ? "yes" : myReview.hadTeamProject === false ? "no" : "na"
      );
      setRevTeamSize(myReview.teamSize != null ? String(myReview.teamSize) : "");
      setRevTypes(myReview.projectTypes ?? []);
      setRevPreform(
        myReview.preformAllowed === true ? "yes" : myReview.preformAllowed === false ? "no" : "na"
      );
      setRevContent(myReview.content ?? "");
    } else {
      setRevRating(0);
      setRevTeam("na");
      setRevTeamSize("");
      setRevTypes([]);
      setRevPreform("na");
      setRevContent("");
    }
    setReviewOpen(true);
  };
  const toggleRevType = (t: string) =>
    setRevTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const starRow = (value: number, cls = "h-4 w-4") => (
    <span className="inline-flex items-center gap-0.5 text-primary">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(cls, i <= Math.round(value) ? "fill-current" : "opacity-25")} />
      ))}
    </span>
  );
  const sum = reviewSummary.data;
  const teamAnswers = (sum?.teamYes ?? 0) + (sum?.teamNo ?? 0);
  const preformAnswers = (sum?.preformYes ?? 0) + (sum?.preformNo ?? 0);
  // 종합 판정 — A+ Mate로 미리 팀 짜갈 만한 수업인지 신호.
  const worthPreform =
    (sum?.teamYes ?? 0) > 0 && (sum?.preformYes ?? 0) > (sum?.preformNo ?? 0);
  const preformHard =
    (sum?.teamYes ?? 0) > 0 && (sum?.preformNo ?? 0) > (sum?.preformYes ?? 0);
  const visibleReviews = showAllReviews ? reviewList.data : reviewList.data?.slice(0, 3);
  const preformLabel = (v: boolean | null) =>
    v === true ? "미리팀 허용" : v === false ? "미리팀 불가" : null;
  const reviewEl = (
    <div className="rounded-[18px] bg-card shadow-card p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-base font-bold flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" /> 수강 리뷰
        </div>
        {isEnrolled && (
          <Button size="sm" variant="secondary" onClick={openReviewDialog}>
            {myReview ? "내 리뷰 수정" : "리뷰 남기기"}
          </Button>
        )}
      </div>
      {!sum || sum.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 리뷰가 없어요.{" "}
          {isEnrolled
            ? "첫 후기를 남겨 다음 수강생을 도와주세요!"
            : "수강생이 남긴 별점·팀플 정보가 여기 모여요."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-extrabold leading-none">{sum.avgRating}</span>
            {starRow(sum.avgRating)}
            <span className="text-xs text-muted-foreground">리뷰 {sum.count}개</span>
          </div>
          {/* 이 수업 팀플 한눈에 — 수강생 데이터 집계 */}
          {(teamAnswers > 0 ||
            sum.avgTeamSize != null ||
            sum.projectTypes.length > 0 ||
            preformAnswers > 0) && (
            <div className="mt-2.5 rounded-xl bg-muted p-3 space-y-1.5 text-[13px]">
              {teamAnswers > 0 && (
                <div>
                  <span className="font-bold text-foreground">팀플</span> · 수강생 {teamAnswers}명 중{" "}
                  <span className="font-bold text-primary">{sum.teamYes}명</span>이 있었다고 답했어요
                </div>
              )}
              {sum.avgTeamSize != null && (
                <div>
                  <span className="font-bold text-foreground">보통 팀 규모</span> · 약{" "}
                  <span className="font-bold">{sum.avgTeamSize}명</span>
                </div>
              )}
              {sum.projectTypes.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-foreground">팀플 유형</span>
                  {sum.projectTypes.slice(0, 3).map((t) => (
                    <span
                      key={t.type}
                      className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full"
                    >
                      {t.type} {t.count}
                    </span>
                  ))}
                </div>
              )}
              {preformAnswers > 0 && (
                <div>
                  <span className="font-bold text-foreground">미리 짠 팀</span> · 교수님 허용{" "}
                  <span className="font-bold" style={{ color: "var(--pos-fg)" }}>
                    {sum.preformYes}
                  </span>{" "}
                  · 불가{" "}
                  <span className="font-bold" style={{ color: "var(--danger-fg)" }}>
                    {sum.preformNo}
                  </span>
                </div>
              )}
            </div>
          )}
          {/* 종합 판정 — A+ Mate로 팀 짜갈 만한 수업인지 */}
          {worthPreform && (
            <div
              className="mt-2 rounded-xl p-3 text-[13px] font-semibold flex items-center gap-2"
              style={{ background: "var(--pos-bg)", color: "var(--pos-fg)" }}
            >
              ✨ 미리 팀 짜서 가기 좋은 수업이에요 — A+ Mate에서 팀원을 구해보세요!
            </div>
          )}
          {!worthPreform && preformHard && (
            <div className="notice-soft mt-2 rounded-xl p-3 text-[13px] leading-relaxed">
              교수님이 팀을 직접 정하는 편일 수 있어요(미리 짠 팀 불가 응답이 더 많음). 커넥트 전에 참고하세요.
            </div>
          )}
          <div className="mt-3 space-y-2.5">
            {visibleReviews?.map((r) => (
              <div key={r.id} className="rounded-xl bg-muted p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {starRow(r.rating, "h-3.5 w-3.5")}
                    {r.hadTeamProject === true && (
                      <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
                        팀플 있었음
                      </span>
                    )}
                    {r.hadTeamProject === false && (
                      <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
                        팀플 없었음
                      </span>
                    )}
                    {r.teamSize != null && (
                      <span className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {r.teamSize}명 팀
                      </span>
                    )}
                    {(r.projectTypes ?? []).map((t) => (
                      <span
                        key={t}
                        className="badge-tag text-[11px] font-bold px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                    {r.preformAllowed === true && (
                      <span className="badge-pos text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {preformLabel(true)}
                      </span>
                    )}
                    {r.preformAllowed === false && (
                      <span className="badge-danger text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {preformLabel(false)}
                      </span>
                    )}
                  </div>
                  {r.isMine && (
                    <button
                      onClick={() => removeReview.mutate({ reviewId: r.id })}
                      disabled={removeReview.isPending}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="내 리뷰 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {r.content && (
                  <p className="text-[13px] mt-1.5 whitespace-pre-wrap">{r.content}</p>
                )}
                <div className="text-[11px] text-muted-foreground mt-1.5">
                  익명{r.semester ? ` · ${r.semester} 수강` : ""}
                  {r.isMine && " · 내 리뷰"}
                </div>
              </div>
            ))}
            {(reviewList.data?.length ?? 0) > 3 && (
              <button
                onClick={() => setShowAllReviews((v) => !v)}
                className="w-full text-center text-xs font-bold text-primary py-1"
              >
                {showAllReviews ? "접기" : `리뷰 ${reviewList.data!.length - 3}개 더 보기`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  // 교수 인증 수업 안내 — 이 서비스로 미리 팀을 짜면 교수님이 보고 승인해준다는 걸 명확히.
  const professorBannerEl =
    courseData.professorId != null ? (
      <div className="rounded-[16px] bg-secondary p-3.5 flex items-start gap-2.5">
        <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">교수님이 함께 보는 수업이에요.</span> 여기서
          미리 팀을 만들면 교수님 팀 현황에 그대로 표시되고,{" "}
          <span className="font-bold text-foreground">교수님 승인</span>을 받을 수 있어요.
        </p>
      </div>
    ) : null;

  const filterChips = (
    <div className="flex gap-1.5 overflow-x-auto min-w-0 flex-1">
      {["all", ...CATEGORIES].map((cat) => (
        <button
          key={cat}
          onClick={() => setCatFilter(cat)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors",
            catFilter === cat ? "bg-primary text-primary-foreground" : "badge-tag"
          )}
        >
          {cat === "all" ? "전체" : cat}
        </button>
      ))}
    </div>
  );

  const postsBlock = posts.isLoading ? (
    <div className="grid gap-3 lg:grid-cols-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-[18px]" />
      ))}
    </div>
  ) : posts.data?.length === 0 ? (
    <div className="rounded-[18px] bg-card shadow-card p-8 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
      <p className="text-foreground text-sm font-semibold mb-1">아직 게시글이 없어요</p>
      <p className="text-muted-foreground text-[13px] mb-4">첫 글을 남겨 정보를 나눠보세요</p>
      <Button variant="secondary" size="sm" onClick={() => setShowPostForm(true)}>
        <Plus className="mr-1 h-4 w-4" /> 글쓰기
      </Button>
    </div>
  ) : (
    <div className="grid gap-3 lg:grid-cols-2">
      {posts.data?.map((item) => (
        <div
          key={item.post.id}
          className="rounded-[18px] bg-card shadow-card p-4 cursor-pointer transition-transform active:scale-[0.99]"
          onClick={() => setLocation(`/posts/${item.post.id}`)}
        >
          <div className="flex items-start justify-between mb-1">
            <span className="badge-tag text-xs font-bold px-2.5 py-1 rounded-full">
              {item.post.category}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> {item.post.viewCount}
            </span>
          </div>
          <h3 className="font-bold text-sm mt-2">{item.post.title}</h3>
          <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">{item.post.content}</p>
          <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between">
            <span>익명 · {new Date(item.post.createdAt).toLocaleDateString("ko-KR")}</span>
            {/* 카드 클릭(상세 이동)과 겹치지 않게 이벤트 전파 차단 */}
            <span onClick={(e) => e.stopPropagation()}>
              <ReportDialog targetType="post" targetId={item.post.id} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  const segBtn = "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors";
  const connectTypeEl = (
    <div className="space-y-1.5">
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {MATCH_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setMatchType(t)}
            className={cn(segBtn, matchType === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            {MATCH_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">
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
          <button
            onClick={() => setMyRole("mentee")}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-bold",
              myRole === "mentee" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            멘토 찾기 (나는 멘티)
          </button>
          <button
            onClick={() => setMyRole("mentor")}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-bold",
              myRole === "mentor" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            멘티 찾기 (나는 멘토)
          </button>
        </div>
      )}
    </div>
  );

  // 내 스킬과 겹치는 후보를 위로 — 등록순 대신 적합도 정렬(엣지 3)
  const mySkills = new Set(parseSkillTags(user?.skillTags));
  const candidates = (students.data ?? [])
    .filter((s) => s.user.id !== user?.id)
    .map((s) => {
      const tags = parseSkillTags(s.user.skillTags).sort(
        (a, b) => (mySkills.has(b) ? 1 : 0) - (mySkills.has(a) ? 1 : 0)
      );
      const common = tags.filter((t) => mySkills.has(t)).length;
      return { student: s, tags, common };
    })
    .sort((a, b) => b.common - a.common);

  const studentListInner = students.isLoading ? (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-[18px]" />
      ))}
    </div>
  ) : students.isError ? (
    <div className="rounded-[18px] bg-card shadow-card p-8 text-center space-y-3">
      <p className="text-sm text-muted-foreground">팀원 목록을 불러오지 못했어요.</p>
      <Button variant="secondary" size="sm" onClick={() => students.refetch()}>
        다시 시도
      </Button>
    </div>
  ) : candidates.length === 0 ? (
    <div className="rounded-[18px] bg-card shadow-card p-8 text-center space-y-3">
      <Users className="h-10 w-10 text-muted-foreground/50 mx-auto" />
      <p className="text-sm text-muted-foreground">
        아직 이 수업에 등록한 다른 학생이 없어요.
        <br />
        같은 수업 친구에게 이 페이지를 공유해보세요.
      </p>
      <Button variant="secondary" size="sm" onClick={handleCopyInvite}>
        초대 링크 복사
      </Button>
    </div>
  ) : (
    <div className="space-y-3">
      {inTeam && (
        <div className="rounded-[16px] bg-secondary p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            이 수업에 이미{" "}
            <span className="font-bold text-foreground">
              {myTeamSize}명 {MATCH_TYPE_LABELS[matchType]}
            </span>{" "}
            그룹이 있어요. 커넥트하면 상대가 수락 시{" "}
            <span className="font-bold text-foreground">내 그룹에 합류</span>해요{" "}
            {matchType === "mentoring"
              ? `(멘토 1명 + 멘티 최대 ${MENTORING_MAX_MENTEES}명)`
              : `(최대 ${maxSize}명)`}
            .{teamFull && " 정원이 가득 찼어요."}
          </p>
        </div>
      )}
      <div className="grid gap-3">
        {candidates.map(({ student, tags, common }) => (
          <div key={student.user.id} className="rounded-[18px] bg-card shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div
                onClick={() => setLocation(`/users/${student.user.id}`)}
                className="cursor-pointer min-w-0"
              >
                <div className="font-bold text-sm flex items-center gap-1.5 flex-wrap">
                  {student.user.department} · {student.user.year}학년
                  {common > 0 && (
                    <span className="badge-pos text-[11px] font-bold px-2 py-0.5 rounded-full">
                      공통 스킬 {common}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full",
                        mySkills.has(tag) ? "bg-secondary text-secondary-foreground" : "badge-tag"
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleConnect(student.user.id)}
                disabled={matchRequest.isPending || saveKakao.isPending || teamFull}
                className="shrink-0"
              >
                <Handshake className="mr-1 h-4 w-4" />
                {inTeam
                  ? matchType === "mentoring"
                    ? "멘티 초대"
                    : `${MATCH_TYPE_LABELS[matchType]}에 초대`
                  : "커넥트"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 mx-auto w-full max-w-[980px]">
      <button
        onClick={() => setLocation("/courses")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 수업 목록
      </button>

      {/* 수업 헤더 */}
      <div className="rounded-[18px] bg-card shadow-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-bold text-lg flex items-center gap-1.5 flex-wrap">
              {courseData.name}
              {courseData.professorId != null && (
                <span className="badge-pos inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  <BadgeCheck className="h-3 w-3" /> 교수님 인증
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {courseData.professor} · {courseData.credits}학점
              {courseData.courseCode && ` · ${courseData.courseCode}`}
            </p>
          </div>
          {courseData.hasTeamProject && (
            <span className="badge-tag text-xs font-bold px-2.5 py-1 rounded-full shrink-0">팀플</span>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="info" className="flex-1">
            <FileText className="mr-1 h-4 w-4" /> 정보
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-1">
            <Users className="mr-1 h-4 w-4" /> 팀원 찾기
          </TabsTrigger>
        </TabsList>

        {/* ── 정보 탭 ── */}
        <TabsContent value="info" className="mt-4">
          <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
            {/* MAIN */}
            <div className="space-y-4">
              {/* 공지·설문·리뷰 — 모바일은 상단, PC는 우측 레일에 */}
              <div className="lg:hidden space-y-3">
                {noticeEl}
                {surveyEls}
                {reviewEl}
              </div>
              <div className="flex items-center justify-between gap-2">
                {filterChips}
                <div className="lg:hidden shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => setShowPostForm(true)}>
                    <Plus className="mr-1 h-4 w-4" /> 글쓰기
                  </Button>
                </div>
              </div>
              {postsBlock}
            </div>

            {/* RIGHT RAIL (PC 전용) */}
            <div className="hidden lg:block space-y-3">
              {hasNews && (
                <div className="text-xs font-bold text-muted-foreground px-0.5">수업 소식</div>
              )}
              {noticeEl}
              {surveyEls}
              {reviewEl}
              <Button variant="secondary" className="w-full" onClick={() => setShowPostForm(true)}>
                <Plus className="mr-1 h-4 w-4" /> 글쓰기
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── 팀원 찾기 탭 ── */}
        <TabsContent value="team" className="mt-4">
          {myCourses.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-[18px]" />
              ))}
            </div>
          ) : !isEnrolled ? (
            <div className="rounded-[18px] bg-card shadow-card p-8 text-center space-y-3">
              <Users className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm text-muted-foreground">
                이 수업에 등록하면 같은 수업 학생을 보고 팀원 커넥트를 보낼 수 있어요.
              </p>
              <Button
                onClick={() => enroll.mutate({ courseId, semester: CURRENT_SEMESTER })}
                disabled={enroll.isPending}
              >
                {enroll.isPending ? "등록 중..." : "이 수업 등록하기"}
              </Button>
            </div>
          ) : (
            <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-6 lg:items-start">
              {/* MAIN */}
              <div className="space-y-3">
                {/* 교수 인증 안내 — 모바일은 상단, PC는 우측 레일에 */}
                <div className="lg:hidden">{professorBannerEl}</div>
                <RecruitmentSection courseId={courseId} isEnrolled={isEnrolled} />
                <div className="flex items-center gap-2 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground shrink-0">또는 직접 찾기</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {/* 커넥트 종류 — 모바일은 여기, PC는 우측 레일에 */}
                <div className="lg:hidden">{connectTypeEl}</div>
                {studentListInner}
              </div>

              {/* RIGHT RAIL (PC 전용) */}
              <div className="hidden lg:block space-y-3">
                {professorBannerEl}
                {connectTypeEl}
                <div className="rounded-[18px] bg-card shadow-card p-4 text-[13px] text-muted-foreground leading-relaxed">
                  마음에 드는 팀원에게 <span className="font-semibold text-foreground">커넥트</span>를
                  보내면 상대 수락 시 오픈채팅으로 바로 연결돼요.
                </div>
                <Button variant="secondary" className="w-full" onClick={handleCopyInvite}>
                  <Link2 className="mr-1 h-4 w-4" /> 초대 링크 복사
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 게시글 작성 (제어형 — 여러 트리거에서 열림) */}
      <Dialog open={showPostForm} onOpenChange={setShowPostForm}>
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
            <Button type="submit" className="w-full" disabled={createPost.isPending}>
              {createPost.isPending ? "작성 중..." : "게시글 작성"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 수강 리뷰 작성/수정 — 별점 + 팀플 유무 + 한줄평 */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{myReview ? "내 리뷰 수정" : "수강 리뷰 남기기"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>이 수업, 어땠나요? *</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRevRating(v)}
                    className="p-1"
                    aria-label={`${v}점`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 text-primary transition-transform",
                        v <= revRating ? "fill-current scale-105" : "opacity-25"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>이 수업에 팀플이 있었나요?</Label>
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {(
                  [
                    { key: "yes", label: "있었어요" },
                    { key: "no", label: "없었어요" },
                    { key: "na", label: "기억 안 나요" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRevTeam(opt.key)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors",
                      revTeam === opt.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                다음 수강생이 "이 수업 팀플 있나요?"를 미리 알 수 있게 도와줘요.
              </p>
            </div>

            {/* 팀플 있었을 때만 — 규모·유형·미리팀 허용 상세 */}
            {revTeam === "yes" && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-3">
                <div className="space-y-2">
                  <Label>몇 명이서 팀을 했나요?</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      inputMode="numeric"
                      value={revTeamSize}
                      onChange={(e) => setRevTeamSize(e.target.value)}
                      placeholder="예: 4"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">명</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>어떤 팀플이었나요? (여러 개 선택 가능)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROJECT_TYPE_OPTIONS.map((opt) => {
                      const on = revTypes.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleRevType(opt)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                            on
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground border border-border"
                          )}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>미리 짜온 팀, 교수님이 허용했나요?</Label>
                  <div className="flex gap-1 rounded-xl bg-muted p-1">
                    {(
                      [
                        { key: "yes", label: "허용했어요" },
                        { key: "no", label: "안 됐어요" },
                        { key: "na", label: "잘 몰라요" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setRevPreform(opt.key)}
                        className={cn(
                          "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors",
                          revPreform === opt.key
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A+ Mate로 팀을 미리 꾸려 가도 되는 수업인지 다음 사람이 판단할 수 있어요.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>한줄평 (선택)</Label>
              <Textarea
                value={revContent}
                onChange={(e) => setRevContent(e.target.value)}
                placeholder="팀플 난이도, 과제량, 꿀팁 등을 남겨주세요"
                rows={3}
                maxLength={500}
              />
            </div>
            <Button
              className="w-full"
              disabled={upsertReview.isPending}
              onClick={() => {
                if (revRating < 1) {
                  toast.error("별점을 선택해주세요.");
                  return;
                }
                const hadTeam =
                  revTeam === "yes" ? true : revTeam === "no" ? false : null;
                const size = parseInt(revTeamSize, 10);
                upsertReview.mutate({
                  courseId,
                  rating: revRating,
                  hadTeamProject: hadTeam,
                  teamSize: hadTeam && !Number.isNaN(size) ? size : null,
                  projectTypes: hadTeam ? revTypes : null,
                  preformAllowed: hadTeam
                    ? revPreform === "yes"
                      ? true
                      : revPreform === "no"
                        ? false
                        : null
                    : null,
                  content: revContent.trim() || undefined,
                  semester: CURRENT_SEMESTER,
                });
              }}
            >
              {upsertReview.isPending ? "저장 중..." : myReview ? "리뷰 수정" : "리뷰 남기기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              className="w-full"
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
