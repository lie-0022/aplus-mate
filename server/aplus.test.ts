import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

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
    kakaoOpenChatUrl: "https://open.kakao.com/o/test",
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
});
