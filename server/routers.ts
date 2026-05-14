import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

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
          name: z.string().min(1).optional(),
          university: z.string().min(1).optional(),
          department: z.string().min(1).optional(),
          year: z.number().min(1).max(6).optional(),
          skillTags: z.array(z.string()).optional(),
          kakaoOpenChatUrl: z.string().optional(),
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
          name: z.string().min(1),
          professor: z.string().min(1),
          credits: z.number().min(1).max(6),
          hasTeamProject: z.boolean().default(false),
          university: z.string().min(1),
          courseCode: z.string().optional(),
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
          title: z.string().min(1),
          content: z.string().min(1),
          category: z.enum(["족보", "과제팁", "후기", "스터디"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createPost({
          courseId: input.courseId,
          userId: ctx.user.id,
          title: input.title,
          content: input.content,
          category: input.category,
        });
      }),
  }),

  // ─── Matching ────────────────────────────────────────
  matching: router({
    request: protectedProcedure
      .input(
        z.object({
          receiverId: z.number(),
          courseId: z.number(),
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
        return db.createMatchRequest(ctx.user.id, input.receiverId, input.courseId);
      }),
    received: protectedProcedure.query(async ({ ctx }) => {
      return db.getReceivedMatchRequests(ctx.user.id);
    }),
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const cnt = await db.getPendingMatchCount(ctx.user.id);
      return { count: cnt };
    }),
    accept: protectedProcedure
      .input(z.object({ matchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.acceptMatch(input.matchId, ctx.user.id);
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

        // Team must be completed
        if (team.team.status !== "completed") {
          throw new Error("팀플이 완료된 후에만 평가할 수 있습니다.");
        }

        // Check not already evaluated
        const alreadyDone = await db.hasUserEvaluated(input.teamId, ctx.user.id);
        if (alreadyDone) throw new Error("이미 평가를 완료했습니다.");

        // Validate: must evaluate exactly all other team members
        const otherMembers = team.members.filter((m) => m.user.id !== ctx.user.id);
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
  }),

  // ─── Badges ──────────────────────────────────────────
  badges: router({
    get: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserBadges(input.userId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
