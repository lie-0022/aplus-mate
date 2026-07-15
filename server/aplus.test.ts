import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";

// ─── Helpers ─────────────────────────────────────────────

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "test-user-1",
    email: "test@example.com",
    name: "테스트유저",
    loginMethod: "manus",
    role: "user",
    university: "서울대학교",
    department: "컴퓨터공학과",
    year: 3,
    skillTags: ["Python", "React"],
    profileCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAuthContext(user: User): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ──────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
    expect(result?.name).toBe("테스트유저");
  });
});

// ─── Profile Tests ───────────────────────────────────────

describe("profile.update", () => {
  it("rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({
        name: "새이름",
        university: "서울대학교",
        department: "경영학과",
        year: 2,
      })
    ).rejects.toThrow();
  });

  it("validates year range (1-6)", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({ year: 0 })
    ).rejects.toThrow();
    await expect(
      caller.profile.update({ year: 7 })
    ).rejects.toThrow();
  });
});

// ─── Courses Tests ───────────────────────────────────────

describe("courses", () => {
  it("search requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.courses.search({ query: "데이터" })
    ).rejects.toThrow();
  });
});

// 리뷰 품질 게이트 — 리워드 이벤트에서 성의 없는 리뷰(별점만) farming을 막는다.
describe("reviews", () => {
  it("upsert rejects content shorter than the minimum (zod)", async () => {
    const caller = appRouter.createCaller(createAuthContext(createUser()));
    await expect(
      caller.reviews.upsert({ courseId: 1, rating: 5, content: "좋아요" })
    ).rejects.toThrow();
  });

  it("upsert rejects missing content", async () => {
    const caller = appRouter.createCaller(createAuthContext(createUser()));
    await expect(
      // @ts-expect-error content is now required
      caller.reviews.upsert({ courseId: 1, rating: 5 })
    ).rejects.toThrow();
  });

  // 수업 생성은 운영자 전용 — 학생이 만든 중복 수업이 후기를 갈라놓는 걸 막는다.
  // (validates* 테스트는 zod가 먼저 걸려도 통과하므로, 권한 회귀는 이 케이스가 잡는다.)
  it("create is admin-only — a valid payload from a student is rejected", async () => {
    const student = createUser({ role: "user" });
    const caller = appRouter.createCaller(createAuthContext(student));
    await expect(
      caller.courses.create({
        name: "학생이 만든 수업",
        professor: "김교수",
        credits: 3,
        university: "서울대학교",
      })
    ).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });

  it("create validates required fields", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.courses.create({
        name: "",
        professor: "김교수",
        credits: 3,
        university: "서울대학교",
      })
    ).rejects.toThrow();
  });

  it("create validates credits range (1-6)", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.courses.create({
        name: "테스트수업",
        professor: "김교수",
        credits: 0,
        university: "서울대학교",
      })
    ).rejects.toThrow();
  });

  it("enroll validates semester format", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.courses.enroll({ courseId: 1, semester: "" })
    ).rejects.toThrow();
  });
});

// ─── Matching Tests ──────────────────────────────────────

describe("matching", () => {
  it("request requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.matching.request({ receiverId: 2, courseId: 1 })
    ).rejects.toThrow();
  });

  it("received requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.matching.received()).rejects.toThrow();
  });

  it("pendingCount requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.matching.pendingCount()).rejects.toThrow();
  });

  it("accept requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.matching.accept({ matchId: 1 })
    ).rejects.toThrow();
  });

  it("reject requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.matching.reject({ matchId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Teams Tests ─────────────────────────────────────────

describe("teams", () => {
  it("list requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teams.list()).rejects.toThrow();
  });

  it("get requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teams.get({ id: 1 })).rejects.toThrow();
  });

  it("complete requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.teams.complete({ teamId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Evaluations Tests ───────────────────────────────────

describe("evaluations", () => {
  it("submit requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.submit({
        teamId: 1,
        evaluations: [
          {
            evaluateeId: 2,
            promiseScore: 5,
            ideaScore: 4,
            deadlineScore: 5,
            grade: "A+",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("submit validates score range (1-5)", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.submit({
        teamId: 1,
        evaluations: [
          {
            evaluateeId: 2,
            promiseScore: 0,
            ideaScore: 4,
            deadlineScore: 5,
            grade: "A+",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("submit validates score upper bound", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.submit({
        teamId: 1,
        evaluations: [
          {
            evaluateeId: 2,
            promiseScore: 6,
            ideaScore: 4,
            deadlineScore: 5,
            grade: "A+",
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("submit validates grade enum", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.submit({
        teamId: 1,
        evaluations: [
          {
            evaluateeId: 2,
            promiseScore: 5,
            ideaScore: 4,
            deadlineScore: 5,
            grade: "F" as any,
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("hasEvaluated requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.evaluations.hasEvaluated({ teamId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Badges Tests ────────────────────────────────────────

describe("badges", () => {
  it("get requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.badges.get({ userId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Posts Tests ─────────────────────────────────────────

describe("posts", () => {
  it("create requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.posts.create({
        courseId: 1,
        title: "테스트",
        content: "내용",
        category: "족보",
      })
    ).rejects.toThrow();
  });

  it("create validates category enum", async () => {
    const user = createUser();
    const ctx = createAuthContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.posts.create({
        courseId: 1,
        title: "테스트",
        content: "내용",
        category: "잘못된카테고리" as any,
      })
    ).rejects.toThrow();
  });

  it("list requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.posts.list({ courseId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Dashboard Tests ─────────────────────────────────────

describe("dashboard", () => {
  it("getData requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.getData()).rejects.toThrow();
  });

  it("getData returns myReviewCount for onboarding checklist (DB 없이 0 폴백)", async () => {
    const ctx = createAuthContext(createUser());
    const caller = appRouter.createCaller(ctx);
    const data = await caller.dashboard.getData();
    // 온보딩 "후기 남기기" 단계가 이 필드에 의존한다 — shape 회귀 방지.
    expect(data).toHaveProperty("myReviewCount");
    expect(typeof data.myReviewCount).toBe("number");
  });
});

// ─── Reports (신고) Tests ────────────────────────────────

describe("reports.create", () => {
  it("requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.create({ targetType: "review", targetId: 1, reason: "abuse" })
    ).rejects.toThrow();
  });

  it("accepts review targetType (익명 리뷰 신고 안전망)", async () => {
    const ctx = createAuthContext(createUser());
    const caller = appRouter.createCaller(ctx);
    const res = await caller.reports.create({
      targetType: "review",
      targetId: 1,
      reason: "abuse",
      detail: "비방성 내용",
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown targetType", async () => {
    const ctx = createAuthContext(createUser());
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error — 잘못된 타입 입력 검증
      caller.reports.create({ targetType: "course", targetId: 1, reason: "abuse" })
    ).rejects.toThrow();
  });
});
