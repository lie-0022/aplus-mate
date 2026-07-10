import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  professorProcedure,
  adminProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateTeamReport } from "./aiReport";

// 동의 버전 — 약관/개인정보처리방침 개정 시 올리면 재동의가 추적된다.
const CURRENT_CONSENT_VERSION = "2026.1";

// 교수 권한 헬퍼 — 해당 수업의 담당 교수(또는 admin)만 통과.
async function assertOwnsCourse(userId: number, role: string, courseId: number) {
  const course = await db.getCourseById(courseId);
  if (!course) throw new Error("수업을 찾을 수 없습니다.");
  if (role !== "admin" && course.professorId !== userId) {
    throw new Error("담당 교수만 사용할 수 있습니다.");
  }
  return course;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Profile ─────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const userBadges = await db.getUserBadges(ctx.user.id);
      return { user, badges: userBadges };
    }),
    update: protectedProcedure
      .input(
        z.object({
          // trim 후 min(1) — 공백만(" ") 입력이 길이 1로 통과해 profileCompleted가
          // 잘못 켜지는 것을 막고, 저장값의 앞뒤 공백도 정규화한다(엣지 3-A).
          name: z.string().trim().min(1).optional(),
          university: z.string().trim().min(1).optional(),
          department: z.string().trim().min(1).optional(),
          year: z.number().min(1).max(6).optional(),
          // 개수·길이 상한으로 거대 페이로드를 차단한다(엣지 6-B)
          skillTags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
    getPublic: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        const userBadges = await db.getUserBadges(input.userId);
        // Strip private info from public view
        if (user) {
          return {
            user: {
              id: user.id,
              name: user.name,
              university: user.university,
              department: user.department,
              year: user.year,
              skillTags: user.skillTags,
              profileCompleted: user.profileCompleted,
            },
            badges: userBadges,
          };
        }
        return { user: null, badges: [] };
      }),
    // 회원 탈퇴 — PII 익명화 + 활성 팀 정리 + pending 매칭 삭제
    deleteSelf: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteSelf(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Dashboard ───────────────────────────────────────
  dashboard: router({
    getData: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardData(ctx.user.id);
    }),
    recommendedPeers: protectedProcedure.query(async ({ ctx }) => {
      return db.getRecommendedPeers(ctx.user.id);
    }),
  }),

  // ─── Courses ─────────────────────────────────────────
  courses: router({
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().default(""),
          university: z.string().optional(),
          department: z.string().optional(),
          category: z.enum(["교양", "전공", "교직", "기타"]).optional(),
          semester: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        // 검색 단계에서 별점·팀플 응답 + 지금 팀 구하는 신호까지 보이게(수업 선택 즉답).
        const list = await db.searchCourses(input.query, input.university, {
          department: input.department,
          category: input.category,
          semester: input.semester,
        });
        const ids = list.map((c) => c.id);
        const [sums, recruits] = await Promise.all([
          db.getReviewSummariesForCourses(ids),
          db.getOpenRecruitmentCountsForCourses(ids),
        ]);
        return list.map((c) => ({
          ...c,
          reviewSummary: sums[c.id] ?? null,
          openRecruitCount: recruits[c.id] ?? 0,
        }));
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const course = await db.getCourseById(input.id);
        if (!course) return course;
        const [recruits, schedules] = await Promise.all([
          db.getOpenRecruitmentCountsForCourses([input.id]),
          db.getCourseSchedules(input.id),
        ]);
        return { ...course, openRecruitCount: recruits[input.id] ?? 0, schedules };
      }),
    // 운영자 전용 — 수강편람 3,368개 개설이 이미 적재돼 있어 학생이 수업을 만들 이유가 없다.
    // 중복 수업이 생기면 후기가 진짜 과목(courseGroupId)과 갈라져 학기 승계가 끊긴다.
    create: adminProcedure
      .input(
        z.object({
          // 길이 상한으로 거대 페이로드를 차단하고 저장값을 정규화한다(엣지 8-A)
          name: z.string().trim().min(1).max(200),
          professor: z.string().trim().min(1).max(100),
          credits: z.number().min(1).max(6),
          hasTeamProject: z.boolean().default(false),
          university: z.string().trim().min(1).max(100),
          courseCode: z.string().trim().max(50).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return db.createCourse(input);
      }),
    enroll: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          semester: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.enrollCourse(ctx.user.id, input.courseId, input.semester);
        return { success: true };
      }),
    // 학생이 수업 조인 코드로 바로 등록(P1) — 검색·생성 없이 교수가 준 코드만으로.
    joinByCode: protectedProcedure
      .input(z.object({ code: z.string().trim().min(4).max(8), semester: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const course = await db.getCourseByInviteCode(input.code);
        if (!course) throw new Error("유효하지 않은 코드예요. 교수님께 코드를 다시 확인해주세요.");
        await db.enrollCourse(ctx.user.id, course.id, input.semester);
        return { courseId: course.id, courseName: course.name };
      }),
    unenroll: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          semester: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 활성 팀이 있는 채로 수강 취소하면 "비수강인데 팀 소속" 불일치가 생긴다.
        // 먼저 팀을 정리하도록 막는다(엣지 8-E).
        if (await db.hasActiveTeamInCourse(ctx.user.id, input.courseId)) {
          throw new Error("이 수업의 팀에 소속되어 있어요. 먼저 팀에서 나간 뒤 수강 취소해주세요.");
        }
        await db.unenrollCourse(ctx.user.id, input.courseId, input.semester);
        return { success: true };
      }),
    myCourses: protectedProcedure
      .input(z.object({ semester: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const list = await db.getUserCourses(ctx.user.id, input?.semester);
        const recruits = await db.getOpenRecruitmentCountsForCourses(
          list.map((c) => c.course.id)
        );
        return list.map((c) => ({ ...c, openRecruitCount: recruits[c.course.id] ?? 0 }));
      }),
    students: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          semester: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Verify requester is enrolled in this course
        const enrolled = await db.isUserEnrolled(ctx.user.id, input.courseId);
        if (!enrolled) {
          throw new Error("해당 수업에 등록된 학생만 조회할 수 있습니다.");
        }
        return db.getCourseStudents(input.courseId, input.semester);
      }),
  }),

  // ─── Course Reviews (수업 리뷰 — 별점·팀플 유무·한줄평) ──
  reviews: router({
    list: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getCourseReviews(input.courseId, ctx.user.id);
      }),
    summary: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return db.getCourseReviewSummary(input.courseId);
      }),
    upsert: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          rating: z.number().int().min(1).max(5),
          hadTeamProject: z.boolean().nullable().optional(),
          teamSize: z.number().int().min(1).max(20).nullable().optional(),
          projectTypes: z.array(z.string().max(20)).max(6).nullable().optional(),
          preformAllowed: z.boolean().nullable().optional(),
          content: z.string().trim().max(500).optional(),
          semester: z.string().max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertCourseReview(ctx.user.id, input.courseId, {
          rating: input.rating,
          hadTeamProject: input.hadTeamProject,
          teamSize: input.teamSize,
          projectTypes: input.projectTypes,
          preformAllowed: input.preformAllowed,
          content: input.content,
          semester: input.semester,
        });
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCourseReview(ctx.user.id, input.reviewId);
        return { success: true };
      }),
  }),

  // ─── Posts ───────────────────────────────────────────
  posts: router({
    list: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          category: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getCoursePosts(input.courseId, input.category);
      }),
    create: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          // 길이 무제한이면 거대 페이로드로 DB·렌더 부담 → 상한을 둔다(엣지 4-E)
          title: z.string().trim().min(1).max(200),
          content: z.string().trim().min(1).max(10000),
          category: z.enum(["족보", "과제팁", "후기", "스터디"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 글쓰기는 수강생만 — 읽기(list/get/comments)는 둘러보기 허용이지만
        // write는 수강생으로 제한한다(설문과 동일한 정책, 엣지 4-D).
        const enrolled = await db.isUserEnrolled(ctx.user.id, input.courseId);
        if (!enrolled) throw new Error("해당 수업 수강생만 글을 쓸 수 있습니다.");
        return db.createPost({
          courseId: input.courseId,
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          category: input.category,
        });
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        // 조회수를 먼저 올리고 읽어야 화면에 현재 조회수가 보인다.
        await db.incrementPostView(input.id);
        const post = await db.getPost(input.id);
        if (!post) throw new Error("게시글을 찾을 수 없습니다.");
        return post;
      }),
    comments: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getPostComments(input.postId, ctx.user.id);
      }),
    addComment: protectedProcedure
      .input(
        z.object({
          postId: z.number(),
          content: z.string().trim().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const post = await db.getPost(input.postId);
        if (!post) throw new Error("게시글을 찾을 수 없습니다.");
        // 댓글 작성도 수강생만(엣지 4-D)
        const enrolled = await db.isUserEnrolled(ctx.user.id, post.courseId);
        if (!enrolled) throw new Error("해당 수업 수강생만 댓글을 쓸 수 있습니다.");
        return db.createPostComment({
          postId: input.postId,
          userId: ctx.user.id,
          content: input.content,
        });
      }),
    // 게시글·댓글 삭제(soft-hide) — 작성자 본인 또는 운영자만.
    remove: protectedProcedure
      .input(z.object({ postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.hidePost(input.postId, ctx.user.id, ctx.user.role === "admin");
        return { success: true };
      }),
    removeComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.hidePostComment(input.commentId, ctx.user.id, ctx.user.role === "admin");
        return { success: true };
      }),
  }),

  // ─── Matching ────────────────────────────────────────
  matching: router({
    request: protectedProcedure
      .input(
        z.object({
          receiverId: z.number(),
          courseId: z.number(),
          matchType: z.enum(["project", "study", "mentoring"]).default("project"),
          // 멘토멘티 전용: 요청자가 고른 자기 역할(미지정 시 멘티). 다른 종류는 무시.
          requesterRole: z.enum(["mentor", "mentee"]).optional(),
          // 팀 오픈채팅방 링크 — 필수. 수락되면 팀에 복사돼 상대에게 공개된다(프로필 대신 커넥트 단위 방).
          kakaoOpenChatUrl: z
            .string()
            .trim()
            .regex(/^https:\/\/open\.kakao\.com\//, "카카오 오픈채팅방 링크(https://open.kakao.com/...)를 입력해주세요.")
            .max(300),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.receiverId) {
          throw new Error("자기 자신에게 매칭 요청을 보낼 수 없습니다.");
        }
        // 수강 확인 — 팀플은 같은 분반, 스터디·멘토링은 같은 과목(다른 분반 허용).
        const check =
          input.matchType === "project" ? db.isUserEnrolled : db.isUserEnrolledInGroup;
        const [requesterEnrolled, receiverEnrolled] = await Promise.all([
          check(ctx.user.id, input.courseId),
          check(input.receiverId, input.courseId),
        ]);
        if (!requesterEnrolled || !receiverEnrolled) {
          throw new Error(
            input.matchType === "project"
              ? "두 사용자 모두 해당 수업(분반)에 등록되어 있어야 합니다."
              : "두 사용자 모두 이 과목을 수강 중이어야 합니다."
          );
        }
        return db.createMatchRequest(
          ctx.user.id,
          input.receiverId,
          input.courseId,
          input.matchType,
          input.requesterRole,
          { kakaoOpenChatUrl: input.kakaoOpenChatUrl }
        );
      }),
    received: protectedProcedure.query(async ({ ctx }) => {
      return db.getReceivedMatchRequests(ctx.user.id);
    }),
    sent: protectedProcedure.query(async ({ ctx }) => {
      return db.getSentMatchRequests(ctx.user.id);
    }),
    cancel: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.cancelMatchRequest(input.matchId, ctx.user.id);
        return { success: true };
      }),
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const cnt = await db.getPendingMatchCount(ctx.user.id);
      return { count: cnt };
    }),
    accept: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const match = await db.getMatchById(input.matchId);
        const result = await db.acceptMatch(input.matchId, ctx.user.id);
        // 요청자에게 수락 알림 — 비대칭 매칭(요청자는 결과를 알 채널이 없던 문제) 해소.
        // 팀 생성은 acceptMatch에서 이미 커밋됐으므로, 이 후속 알림/공고마감이 실패해도
        // '수락' 자체를 500으로 되돌리지 않도록 격리한다(성공한 수락이 실패로 오인되는 것 방지).
        if (match && result?.teamId) {
          try {
            const course = await db.getCourseById(match.courseId);
            await db.createNotification({
              userId: match.requesterId,
              type: "match_accepted",
              title: "매칭이 수락됐어요!",
              body: `${course?.name ?? "수업"} 팀이 만들어졌어요.`,
              linkPath: `/teams/${result.teamId}`,
            });
            // 모집 공고 경유 지원이 수락돼 팀 정원이 차면 공고 자동 마감(dead-end 방지)
            if (match.recruitmentId) {
              await db.maybeCloseRecruitmentIfFull(match.recruitmentId, result.teamId);
            }
          } catch (e) {
            console.error("[matching.accept] 후속 알림/공고마감 실패(무시):", e);
          }
        }
        return result;
      }),
    reject: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.rejectMatch(input.matchId, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Teams ───────────────────────────────────────────
  teams: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserTeams(ctx.user.id);
    }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.id);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        // Authorization: only team members can view team details
        const isMember = team.members.some((m) => m.user.id === ctx.user.id);
        if (!isMember) {
          throw new Error("팀 멤버만 팀 정보를 조회할 수 있습니다.");
        }
        return team;
      }),
    complete: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Authorization: only team members can complete
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        const isMember = team.members.some((m) => m.user.id === ctx.user.id);
        if (!isMember) throw new Error("팀 멤버만 팀을 완료할 수 있습니다.");
        if (team.team.status !== "active") throw new Error("이미 완료된 팀입니다.");
        await db.completeTeam(input.teamId);
        return { success: true };
      }),
    leave: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.leaveTeam(input.teamId, ctx.user.id);
      }),
  }),

  // ─── Team Events (팀 일정) ────────────────────────────
  events: router({
    list: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        if (!team.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 일정을 볼 수 있습니다.");
        }
        return db.getTeamEvents(input.teamId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
          title: z.string().min(1).max(200),
          dueAt: z.date(),
          assigneeId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        if (!team.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 일정을 추가할 수 있습니다.");
        }
        // 담당자는 팀 멤버만 지정 가능
        if (
          input.assigneeId != null &&
          !team.members.some((m) => m.user.id === input.assigneeId)
        ) {
          throw new Error("담당자는 팀 멤버 중에서만 지정할 수 있습니다.");
        }
        return db.createTeamEvent({
          teamId: input.teamId,
          createdBy: ctx.user.id,
          title: input.title,
          dueAt: input.dueAt,
          assigneeId: input.assigneeId ?? null,
        });
      }),
    setAssignee: protectedProcedure
      .input(z.object({ eventId: z.number(), assigneeId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const ev = await db.getTeamEventById(input.eventId);
        if (!ev) throw new Error("일정을 찾을 수 없습니다.");
        const team = await db.getTeamDetail(ev.teamId);
        if (!team?.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 일정을 수정할 수 있습니다.");
        }
        if (
          input.assigneeId != null &&
          !team.members.some((m) => m.user.id === input.assigneeId)
        ) {
          throw new Error("담당자는 팀 멤버 중에서만 지정할 수 있습니다.");
        }
        await db.setTeamEventAssignee(input.eventId, input.assigneeId);
        return { success: true };
      }),
    setDone: protectedProcedure
      .input(z.object({ eventId: z.number(), isDone: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const ev = await db.getTeamEventById(input.eventId);
        if (!ev) throw new Error("일정을 찾을 수 없습니다.");
        const team = await db.getTeamDetail(ev.teamId);
        if (!team?.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 일정을 수정할 수 있습니다.");
        }
        await db.setTeamEventDone(input.eventId, input.isDone);
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ eventId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const ev = await db.getTeamEventById(input.eventId);
        if (!ev) throw new Error("일정을 찾을 수 없습니다.");
        const team = await db.getTeamDetail(ev.teamId);
        if (!team?.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 일정을 삭제할 수 있습니다.");
        }
        await db.deleteTeamEvent(input.eventId);
        return { success: true };
      }),
    // 대시보드: 내 활성 그룹들의 미완료 일정(임박순 5개)
    upcoming: protectedProcedure.query(async ({ ctx }) => {
      return db.getUpcomingEventsForUser(ctx.user.id, 5);
    }),
  }),

  // ─── Team Notes (팀 메모 보드) ────────────────────────
  notes: router({
    list: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team?.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 볼 수 있습니다.");
        }
        return db.getTeamNotes(input.teamId);
      }),
    create: protectedProcedure
      .input(z.object({ teamId: z.number(), content: z.string().trim().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team?.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 작성할 수 있습니다.");
        }
        return db.createTeamNote({
          teamId: input.teamId,
          userId: ctx.user.id,
          content: input.content,
        });
      }),
    remove: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getTeamNoteById(input.noteId);
        if (!note) throw new Error("메모를 찾을 수 없습니다.");
        const team = await db.getTeamDetail(note.teamId);
        if (!team?.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 삭제할 수 있습니다.");
        }
        await db.deleteTeamNote(input.noteId);
        return { success: true };
      }),
  }),

  // ─── Evaluations ─────────────────────────────────────
  evaluations: router({
    submit: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
          evaluations: z.array(
            z.object({
              evaluateeId: z.number(),
              promiseScore: z.number().min(1).max(5),
              ideaScore: z.number().min(1).max(5),
              deadlineScore: z.number().min(1).max(5),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Authorization: must be team member
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        const isMember = team.members.some((m) => m.user.id === ctx.user.id);
        if (!isMember) throw new Error("팀 멤버만 평가할 수 있습니다.");

        // 동료 평가는 팀플 전용 — 스터디·멘토멘티는 평가 단계가 없다.
        if (team.team.teamType !== "project") {
          throw new Error("팀플 팀만 평가할 수 있습니다.");
        }

        // Team must be completed
        if (team.team.status !== "completed") {
          throw new Error("팀플이 완료된 후에만 평가할 수 있습니다.");
        }

        // Check not already evaluated
        const alreadyDone = await db.hasUserEvaluated(input.teamId, ctx.user.id);
        if (alreadyDone) throw new Error("이미 평가를 완료했습니다.");

        // Validate: must evaluate exactly all other team members
        const otherMembers = team.members.filter((m) => m.user.id !== ctx.user.id);
        // 중복 evaluateeId([A,A,B] 등)를 명확히 차단 — Set 비교만으로는 길이를 맞춘
        // 중복이 통과할 수 있어, 정확히 '다른 멤버 수'만큼 왔는지 먼저 확인한다(엣지 7-A).
        if (input.evaluations.length !== otherMembers.length) {
          throw new Error("모든 팀원을 한 번씩만 평가해야 합니다.");
        }
        const evaluateeIds = new Set(input.evaluations.map((e) => e.evaluateeId));
        const expectedIds = new Set(otherMembers.map((m) => m.user.id));

        if (evaluateeIds.size !== expectedIds.size) {
          throw new Error("모든 팀원을 평가해야 합니다.");
        }
        for (const id of Array.from(expectedIds)) {
          if (!evaluateeIds.has(id)) {
            throw new Error("모든 팀원을 평가해야 합니다.");
          }
        }
        // Ensure no self-evaluation
        if (evaluateeIds.has(ctx.user.id)) {
          throw new Error("자기 자신을 평가할 수 없습니다.");
        }

        await db.submitEvaluationBatch({
          teamId: input.teamId,
          evaluatorId: ctx.user.id,
          evaluations: input.evaluations,
        });
        return { success: true };
      }),
    hasEvaluated: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.hasUserEvaluated(input.teamId, ctx.user.id);
      }),
    // 평가 강제 마감 — 팀원이 미제출자를 무한정 기다리지 않고 평가 단계를 종료한다.
    // 현재까지 제출된 평가로 배지를 계산한다(엣지 1-E).
    forceClose: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        if (!team.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 평가를 마감할 수 있습니다.");
        }
        if (team.team.teamType !== "project") {
          throw new Error("팀플 팀만 평가 마감이 있습니다.");
        }
        if (team.team.status !== "completed") {
          throw new Error("완료된 팀플만 평가를 마감할 수 있습니다.");
        }
        await db.closeEvaluation(input.teamId);
        return { success: true };
      }),
  }),

  // ─── Badges ──────────────────────────────────────────
  badges: router({
    get: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserBadges(input.userId);
      }),
  }),

  // ─── Consents (동의 기록) ─────────────────────────────
  consents: router({
    record: protectedProcedure
      .input(z.object({ consentType: z.enum(["signup", "evaluation"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.recordConsent(ctx.user.id, input.consentType, CURRENT_CONSENT_VERSION);
        return { success: true, version: CURRENT_CONSENT_VERSION };
      }),
    has: protectedProcedure
      .input(z.object({ consentType: z.enum(["signup", "evaluation"]) }))
      .query(async ({ ctx, input }) => {
        return db.hasConsent(ctx.user.id, input.consentType, CURRENT_CONSENT_VERSION);
      }),
  }),

  // ─── Professor (교수 — 담당 수업·수강생·팀·공지·설문) ──
  professor: router({
    myCourses: professorProcedure.query(async ({ ctx }) => {
      return db.getProfessorCourses(ctx.user.id);
    }),
    claimCourse: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.claimCourse(input.courseId, ctx.user.id);
        return { success: true };
      }),
    // P1: 수업 조인 코드 발급/재발급 (학생에게 공유)
    generateInviteCode: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        const code = await db.generateInviteCode(input.courseId);
        if (!code) throw new Error("코드 발급에 실패했어요. 다시 시도해주세요.");
        return { code };
      }),
    // P2: 팀 구성 마감일 설정/해제
    setMatchingDeadline: professorProcedure
      .input(z.object({ courseId: z.number(), deadline: z.string().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        await db.setMatchingDeadline(
          input.courseId,
          input.deadline ? new Date(input.deadline) : null
        );
        return { success: true };
      }),
    // P2: 미배정 학생 전원에게 독려 알림
    nudgeUnassigned: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.nudgeUnassignedStudents(input.courseId);
      }),
    students: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.getCourseStudentsForProfessor(input.courseId);
      }),
    teams: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.getCourseTeamsForProfessor(input.courseId);
      }),
    // 팀 승인/승인 취소 — 학생이 짠 팀을 교수가 확인·허락(학생 화면에 "교수님 승인" 칩).
    approveTeam: professorProcedure
      .input(z.object({ teamId: z.number(), approved: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await db.setTeamProfessorApproval(ctx.user.id, input.teamId, input.approved);
        return { success: true };
      }),
    // 수업 현황 한눈에 — 참여·팀 구성·미배정 학생·설문 응답률
    dashboard: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.getCourseDashboard(input.courseId);
      }),
    // P1·P2: 교수 화면용 수업 메타(조인 코드·마감일) — dashboard 타입과 분리
    courseInfo: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const course = await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return {
          inviteCode: course.inviteCode,
          matchingDeadline: course.matchingDeadline,
        };
      }),
    // ── 산출물(마일스톤) ──
    createMilestone: professorProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().max(2000).optional(),
          dueAt: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.createMilestone({
          courseId: input.courseId,
          createdBy: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          dueAt: input.dueAt ?? null,
        });
      }),
    milestones: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.getCourseMilestones(input.courseId);
      }),
    removeMilestone: professorProcedure
      .input(z.object({ milestoneId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const courseId = await db.getMilestoneCourseId(input.milestoneId);
        if (!courseId) throw new Error("제출 항목을 찾을 수 없습니다.");
        await assertOwnsCourse(ctx.user.id, ctx.user.role, courseId);
        await db.deleteMilestone(input.milestoneId);
        return { success: true };
      }),
    // 제출 현황(팀×마일스톤 매트릭스 조립용)
    submissions: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.getCourseSubmissions(input.courseId);
      }),
    reviewSubmission: professorProcedure
      .input(z.object({ submissionId: z.number(), reviewed: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const courseId = await db.getSubmissionCourseId(input.submissionId);
        if (!courseId) throw new Error("제출물을 찾을 수 없습니다.");
        await assertOwnsCourse(ctx.user.id, ctx.user.role, courseId);
        await db.setSubmissionReviewed(input.submissionId, input.reviewed);
        return { success: true };
      }),
  }),

  // ─── Announcements (교수 공지) ────────────────────────
  announcements: router({
    create: professorProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string().min(1).max(300),
          content: z.string().min(1).max(5000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        const created = await db.createAnnouncement({
          courseId: input.courseId,
          professorId: ctx.user.id,
          title: input.title,
          content: input.content,
        });
        // 수강생들에게 새 공지 알림(fanout)
        const students = await db.getCourseStudentsForProfessor(input.courseId);
        for (const s of students) {
          await db.createNotification({
            userId: s.user.id,
            type: "announcement",
            title: "새 공지가 올라왔어요",
            body: input.title,
            linkPath: `/courses/${input.courseId}`,
          });
        }
        return created;
      }),
    // 학생(수강생)·교수 모두 조회 가능
    list: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        return db.getCourseAnnouncements(input.courseId);
      }),
    remove: professorProcedure
      .input(z.object({ announcementId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const courseId = await db.getAnnouncementCourseId(input.announcementId);
        if (!courseId) throw new Error("공지를 찾을 수 없습니다.");
        await assertOwnsCourse(ctx.user.id, ctx.user.role, courseId);
        await db.deleteAnnouncement(input.announcementId);
        return { success: true };
      }),
  }),

  // ─── Surveys (교수 설문 — 5점 척도·객관식 빌더) ────────
  surveys: router({
    create: professorProcedure
      .input(
        z.object({
          courseId: z.number(),
          title: z.string().min(1).max(300),
          questions: z
            .array(
              z.object({
                type: z.enum(["scale", "choice", "text"]),
                text: z.string().min(1).max(500),
                options: z.array(z.string().min(1).max(200)).max(10).optional(),
              })
            )
            .min(1)
            .max(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        // 객관식은 선택지 2개 이상 필수
        for (const q of input.questions) {
          if (q.type === "choice" && (!q.options || q.options.length < 2)) {
            throw new Error("객관식 문항은 선택지를 2개 이상 추가해주세요.");
          }
        }
        return db.createSurvey({
          courseId: input.courseId,
          professorId: ctx.user.id,
          title: input.title,
          questions: input.questions,
        });
      }),
    close: professorProcedure
      .input(z.object({ surveyId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const survey = await db.getSurveyById(input.surveyId);
        if (!survey) throw new Error("설문을 찾을 수 없습니다.");
        await assertOwnsCourse(ctx.user.id, ctx.user.role, survey.courseId);
        await db.setSurveyStatus(input.surveyId, "closed");
        return { success: true };
      }),
    results: professorProcedure
      .input(z.object({ surveyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const survey = await db.getSurveyById(input.surveyId);
        if (!survey) throw new Error("설문을 찾을 수 없습니다.");
        await assertOwnsCourse(ctx.user.id, ctx.user.role, survey.courseId);
        return db.getSurveyResults(input.surveyId);
      }),
    // 학생: 수업의 설문 목록(+내 응답 여부)
    listForCourse: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const list = await db.getCourseSurveys(input.courseId);
        const withResponded = await Promise.all(
          list.map(async (s) => ({
            survey: s,
            responded: await db.hasRespondedSurvey(s.id, ctx.user.id),
          }))
        );
        return withResponded;
      }),
    // 학생: 응답용 설문 단건(문항 포함)
    get: protectedProcedure
      .input(z.object({ surveyId: z.number() }))
      .query(async ({ ctx, input }) => {
        const survey = await db.getSurveyById(input.surveyId);
        if (!survey) throw new Error("설문을 찾을 수 없습니다.");
        const enrolled = await db.isUserEnrolled(ctx.user.id, survey.courseId);
        const isProfessorSide =
          ctx.user.role === "admin" ||
          (ctx.user.role === "professor" && (await db.getCourseById(survey.courseId))?.professorId === ctx.user.id);
        if (!enrolled && !isProfessorSide) {
          throw new Error("해당 수업 수강생만 설문에 참여할 수 있습니다.");
        }
        const questions = await db.getSurveyQuestions(input.surveyId);
        const responded = await db.hasRespondedSurvey(input.surveyId, ctx.user.id);
        return { survey, questions, responded };
      }),
    submit: protectedProcedure
      .input(
        z.object({
          surveyId: z.number(),
          answers: z
            .array(
              z.object({
                questionId: z.number(),
                value: z.number().min(0).max(10).optional(),
                textValue: z.string().max(2000).optional(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const survey = await db.getSurveyById(input.surveyId);
        if (!survey) throw new Error("설문을 찾을 수 없습니다.");
        if (survey.status !== "open") throw new Error("마감된 설문입니다.");
        const enrolled = await db.isUserEnrolled(ctx.user.id, survey.courseId);
        if (!enrolled) throw new Error("해당 수업 수강생만 설문에 참여할 수 있습니다.");

        // 전 문항 응답 + 유형별 값 검증 (scale 1~5, choice 인덱스, text 본문)
        const questions = await db.getSurveyQuestions(input.surveyId);
        const answerMap = new Map(input.answers.map((a) => [a.questionId, a]));
        for (const q of questions) {
          const a = answerMap.get(q.id);
          if (!a) throw new Error("모든 문항에 응답해주세요.");
          if (q.type === "scale") {
            if (a.value === undefined || a.value < 1 || a.value > 5) {
              throw new Error("척도 문항은 1~5점으로 응답해주세요.");
            }
          }
          if (q.type === "choice") {
            const optCount = db.parseOptions(q.options).length;
            if (a.value === undefined || a.value < 0 || a.value >= optCount) {
              throw new Error("올바른 선택지를 골라주세요.");
            }
          }
          if (q.type === "text") {
            if (!a.textValue || a.textValue.trim().length === 0) {
              throw new Error("주관식 문항에 답변을 입력해주세요.");
            }
          }
        }

        await db.submitSurveyResponses({
          surveyId: input.surveyId,
          userId: ctx.user.id,
          answers: input.answers.map((a) => ({
            questionId: a.questionId,
            value: a.value ?? null,
            textValue: a.textValue?.trim() ?? null,
          })),
        });
        return { success: true };
      }),
  }),

  // ─── AI (보고서 초안 생성) ────────────────────────────
  ai: router({
    generateReport: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
          topic: z.string().min(1).max(200),
          details: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 팀 멤버만 자기 팀 컨텍스트로 생성할 수 있다.
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        const isMember = team.members.some((m) => m.user.id === ctx.user.id);
        if (!isMember) throw new Error("팀 멤버만 보고서를 생성할 수 있습니다.");

        // 팀이 실제로 한 활동(완료 일정·제출 산출물)을 컨텍스트로 넣어 초안을 구체화
        const events = await db.getTeamEvents(input.teamId);
        const milestones = await db.getTeamMilestones(input.teamId);
        const progress: string[] = [
          ...events.filter((e) => e.isDone).map((e) => `완료 일정: ${e.title}`),
          ...milestones
            .filter((m) => m.submission)
            .map(
              (m) =>
                `제출: ${m.milestone.title}${m.submission?.note ? ` (${m.submission.note})` : ""}`
            ),
        ];
        return generateTeamReport({
          courseName: team.course.name,
          professor: team.course.professor ?? "미배정",
          teamType: team.team.teamType,
          memberCount: team.members.length,
          topic: input.topic,
          details: input.details,
          progress,
        });
      }),
  }),

  // ─── Deliverables (팀 산출물 제출) ────────────────────
  deliverables: router({
    // 팀 관점: 우리 수업의 마일스톤 목록 + 우리 팀 제출 현황
    forTeam: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        if (!team.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 볼 수 있습니다.");
        }
        return db.getTeamMilestones(input.teamId);
      }),
    // 산출물 제출/수정 — 외부 링크(구글드라이브·노션 등) + 메모
    submit: protectedProcedure
      .input(
        z.object({
          teamId: z.number(),
          milestoneId: z.number(),
          url: z.string().trim().url().max(1000),
          note: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const team = await db.getTeamDetail(input.teamId);
        if (!team) throw new Error("팀을 찾을 수 없습니다.");
        if (!team.members.some((m) => m.user.id === ctx.user.id)) {
          throw new Error("팀 멤버만 제출할 수 있습니다.");
        }
        // 마일스톤이 이 팀의 수업 것인지 확인(다른 수업 제출 항목 차단)
        const msCourseId = await db.getMilestoneCourseId(input.milestoneId);
        if (msCourseId == null || msCourseId !== team.team.courseId) {
          throw new Error("이 팀의 수업 제출 항목이 아닙니다.");
        }
        await db.submitDeliverable({
          milestoneId: input.milestoneId,
          teamId: input.teamId,
          submittedBy: ctx.user.id,
          url: input.url,
          note: input.note ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Reports (신고) ───────────────────────────────────
  reports: router({
    create: protectedProcedure
      .input(
        z.object({
          targetType: z.enum(["post", "comment", "user"]),
          targetId: z.number(),
          reason: z.enum(["abuse", "spam", "privacy", "etc"]),
          detail: z.string().trim().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.createReport({
          reporterId: ctx.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          detail: input.detail ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Notifications (인앱 알림) ────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getNotifications(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return { count: await db.countUnreadNotifications(ctx.user.id) };
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationRead(input.notificationId, ctx.user.id);
        return { success: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ─── Admin (운영자 전용) ──────────────────────────────
  admin: router({
    // 운영자가 pending 매칭을 한눈에 보고 수락을 수동 푸시할 때 사용.
    // adminProcedure: ctx.user.role === 'admin'만 통과(OWNER_OPEN_ID 유저는 자동 admin).
    pendingMatches: adminProcedure.query(async () => {
      return db.getPendingMatchesForAdmin();
    }),
    // 유저 역할 관리 — 교수 지정은 운영자가 직접 한다(사칭 방지).
    listUsers: adminProcedure.query(async () => {
      return db.listAllUsers();
    }),
    setUserRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["user", "professor", "admin"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("자기 자신의 역할은 변경할 수 없습니다.");
        }
        // 마지막 운영자를 강등하면 역할 관리 자체가 불가능해지므로 차단(엣지 4-A).
        if (input.role !== "admin") {
          const target = await db.getUserById(input.userId);
          if (target?.role === "admin" && (await db.countUsersByRole("admin")) <= 1) {
            throw new Error("마지막 운영자는 강등할 수 없습니다.");
          }
        }
        await db.setUserRole(input.userId, input.role);
        return { success: true };
      }),
    // 신고 큐 — 미처리 신고 조회 + 처리 완료 표시
    reports: adminProcedure.query(async () => {
      return db.getOpenReports();
    }),
    resolveReport: adminProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input }) => {
        await db.resolveReport(input.reportId);
        return { success: true };
      }),
    // 교수 시연용 데모 데이터 생성/정리 (운영자 전용)
    seedDemo: adminProcedure.mutation(async ({ ctx }) => {
      return db.seedDemoData(ctx.user.id);
    }),
    clearDemo: adminProcedure.mutation(async () => {
      return db.clearDemoData();
    }),
    // 파일럿 리셋 — 운영자 본인 계정만 남기고 모든 테스트 데이터 영구 삭제.
    // 실제 학생을 받기 직전, 프로덕션을 깨끗이 비울 때만 사용(되돌릴 수 없음).
    wipeTestData: adminProcedure.mutation(async ({ ctx }) => {
      return db.wipeAllExceptOwner(ctx.user.id);
    }),
    // 시간표 시딩 — server/data/timetable_{semester}.json(파서 산출)을 멱등 적재.
    // 멱등(sourceKey 기준)이라 재실행/다음 학기 적재 안전. 앱 수동 수업은 안 건드림.
    seedTimetable: adminProcedure
      .input(z.object({ semester: z.string().default("2026-1") }).optional())
      .mutation(async ({ input }) => {
        const semester = input?.semester ?? "2026-1";
        const fs = await import("fs");
        const path = await import("path");
        const file = path.resolve(process.cwd(), `server/data/timetable_${semester}.json`);
        if (!fs.existsSync(file)) {
          throw new Error(`시간표 데이터 파일이 없어요: ${file}`);
        }
        const rows = JSON.parse(fs.readFileSync(file, "utf-8"));
        const res = await db.seedTimetableCourses(rows);
        return { semester, ...res };
      }),
    // QA용: 특정 유저(친구 계정)에게 데모 수업·매칭 요청 배정
    assignQa: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        return db.assignQaToUser(input.userId);
      }),
    setupClassTeam: adminProcedure
      .input(
        z.object({
          courseName: z.string(),
          courseCode: z.string(),
          university: z.string(),
          userIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        return db.setupClassTeam(input);
      }),
    allTeams: adminProcedure.query(async () => {
      return db.getAllTeamsForAdmin();
    }),
    teamDetail: adminProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        return db.getTeamDetailForAdmin(input.teamId);
      }),
  }),

  // 모집 공고 — 구조화된 모집 + 원클릭 지원(teamMatches 재사용)
  // ─── 내 시간표(격자 + 개인 일정) ─────────────────────────
  timetable: router({
    my: protectedProcedure
      .input(z.object({ semester: z.string().default("2026-1") }).optional())
      .query(async ({ ctx, input }) =>
        db.getMyTimetable(ctx.user.id, input?.semester ?? "2026-1")
      ),
    addEvent: protectedProcedure
      .input(
        z
          .object({
            title: z.string().trim().min(1, "일정 이름을 입력해주세요.").max(100),
            dayOfWeek: z.enum(["월", "화", "수", "목", "금", "토", "일"]),
            startPeriod: z.number().int().min(1).max(14),
            endPeriod: z.number().int().min(1).max(14),
          })
          .refine((v) => v.endPeriod >= v.startPeriod, {
            message: "끝 교시는 시작 교시보다 빠를 수 없어요.",
          })
      )
      .mutation(async ({ ctx, input }) => db.addUserSchedule(ctx.user.id, input)),
    deleteEvent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => db.deleteUserSchedule(ctx.user.id, input.id)),
  }),

  recruitment: router({
    list: protectedProcedure
      .input(z.object({ courseId: z.number(), openOnly: z.boolean().default(true) }))
      .query(async ({ ctx, input }) => {
        // 로스터(courses.students)와 동일 정책 — 수강생만 조회(마스킹 PII 수집면 차단)
        const enrolled = await db.isUserEnrolled(ctx.user.id, input.courseId);
        if (!enrolled) throw new Error("해당 수업에 등록된 학생만 모집을 볼 수 있어요.");
        return db.listRecruitments(input.courseId, input.openOnly, ctx.user.id);
      }),
    create: protectedProcedure
      .input(
        z.object({
          courseId: z.number(),
          matchType: z.enum(["project", "study", "mentoring"]).default("project"),
          authorRole: z.enum(["mentor", "mentee"]).optional(),
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().max(2000).optional(),
          desiredSkills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
          neededCount: z.number().int().min(1).max(10).default(1),
          teamId: z.number().optional(),
          // 팀 오픈채팅방 링크 — 필수. 수락된 팀원이 이 방으로 모인다(공고/팀마다 방).
          kakaoOpenChatUrl: z
            .string()
            .trim()
            .regex(/^https:\/\/open\.kakao\.com\//, "카카오 오픈채팅방 링크(https://open.kakao.com/...)를 입력해주세요.")
            .max(300),
        })
      )
      .mutation(async ({ ctx, input }) => db.createRecruitment(ctx.user.id, input)),
    applyTo: protectedProcedure
      .input(z.object({ recruitmentId: z.number(), message: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) =>
        db.applyToRecruitment(ctx.user.id, input.recruitmentId, input.message)
      ),
    close: protectedProcedure
      .input(z.object({ recruitmentId: z.number() }))
      .mutation(async ({ ctx, input }) => db.closeRecruitment(input.recruitmentId, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
