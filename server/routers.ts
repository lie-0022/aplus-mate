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
          // 카카오 오픈채팅 링크만 허용 — 매칭 수락 후 상대에게 그대로 노출·링크되므로
          // 도메인을 고정해 피싱·비정상 스킴(javascript: 등)을 차단한다(엣지 6-A).
          kakaoOpenChatUrl: z
            .string()
            .trim()
            .max(300)
            .refine((v) => v === "" || /^https:\/\/open\.kakao\.com\//.test(v), {
              message: "카카오 오픈채팅 링크(https://open.kakao.com/...)를 입력해주세요.",
            })
            .optional(),
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
  }),

  // ─── Courses ─────────────────────────────────────────
  courses: router({
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().default(""),
          university: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.searchCourses(input.query, input.university);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCourseById(input.id);
      }),
    create: protectedProcedure
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
        return db.getUserCourses(ctx.user.id, input?.semester);
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.receiverId) {
          throw new Error("자기 자신에게 매칭 요청을 보낼 수 없습니다.");
        }
        // Verify both users are enrolled
        const requesterEnrolled = await db.isUserEnrolled(ctx.user.id, input.courseId);
        const receiverEnrolled = await db.isUserEnrolled(input.receiverId, input.courseId);
        if (!requesterEnrolled || !receiverEnrolled) {
          throw new Error("두 사용자 모두 해당 수업에 등록되어 있어야 합니다.");
        }
        return db.createMatchRequest(
          ctx.user.id,
          input.receiverId,
          input.courseId,
          input.matchType,
          input.requesterRole
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
        // 요청자에게 수락 알림 — 비대칭 매칭(요청자는 결과를 알 채널이 없던 문제) 해소
        if (match && result?.teamId) {
          const course = await db.getCourseById(match.courseId);
          await db.createNotification({
            userId: match.requesterId,
            type: "match_accepted",
            title: "매칭이 수락됐어요!",
            body: `${course?.name ?? "수업"} 팀이 만들어졌어요.`,
            linkPath: `/teams/${result.teamId}`,
          });
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
              grade: z.enum(["A+", "A", "B+", "B", "C+"]),
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
    // 수업 현황 한눈에 — 참여·팀 구성·미배정 학생·설문 응답률
    dashboard: professorProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertOwnsCourse(ctx.user.id, ctx.user.role, input.courseId);
        return db.getCourseDashboard(input.courseId);
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
          professor: team.course.professor,
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
  }),
});

export type AppRouter = typeof appRouter;
