import { describe, expect, it, vi, beforeEach } from "vitest";
import { escapeHtml } from "./_core/googleAuth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { NOT_ADMIN_ERR_MSG, REVIEW_FREE_PEEK } from "@shared/const";
import { applyReviewPeekGate } from "./db";

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
// 소프트 열람 게이트 — 후기를 안 쓴 사람은 남의 한줄평을 REVIEW_FREE_PEEK개까지만 본다.
// 별점·팀플 집계는 이 함수를 안 거치므로 항상 공개된다(정책상 의도).
describe("review peek gate", () => {
  const mk = (id: number, isMine = false) => ({ id, isMine, content: `후기 본문 ${id}` });

  it("후기를 쓴 사람에겐 전부 열린다", () => {
    const out = applyReviewPeekGate([mk(1), mk(2), mk(3), mk(4)], true);
    expect(out.every((r) => !r.contentLocked)).toBe(true);
    expect(out.every((r) => r.content !== null)).toBe(true);
  });

  it("안 쓴 사람에겐 REVIEW_FREE_PEEK개까지만 본문이 보인다", () => {
    const out = applyReviewPeekGate([mk(1), mk(2), mk(3), mk(4)], false);
    const open = out.filter((r) => !r.contentLocked);
    expect(open).toHaveLength(REVIEW_FREE_PEEK);
    // 잠긴 건 본문이 서버에서 제거돼야 한다 — 클라이언트 블러만으론 새어나간다.
    for (const r of out.filter((r) => r.contentLocked)) expect(r.content).toBeNull();
  });

  it("내 후기는 잠겨 있어도 항상 보이고, 무료 열람 몫을 쓰지 않는다", () => {
    const out = applyReviewPeekGate([mk(1, true), mk(2), mk(3), mk(4)], false);
    expect(out[0].contentLocked).toBe(false);
    // 내 것 1 + 남의 것 REVIEW_FREE_PEEK개가 열려야 한다
    expect(out.filter((r) => !r.contentLocked)).toHaveLength(REVIEW_FREE_PEEK + 1);
  });
});

// 작업물 링크는 남의 프로필에 앵커로 렌더된다 — javascript: 스킴이 통과하면
// 클릭 한 번에 스크립트가 돈다. zod가 http(s)만 받는지 고정한다.
describe("portfolio link safety", () => {
  const caller = () => appRouter.createCaller(createAuthContext(createUser()));

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd"])(
    "rejects %s",
    async (bad) => {
      await expect(caller().portfolio.add({ title: "내 작업", repoUrl: bad })).rejects.toThrow();
    }
  );

  it("rejects a title longer than the limit", async () => {
    await expect(caller().portfolio.add({ title: "가".repeat(101) })).rejects.toThrow();
  });

  it("허용된 http(s) 링크는 zod를 통과한다(DB 없어 저장은 실패)", async () => {
    // zod를 통과하면 db 레이어까지 가서 "데이터베이스에 연결할 수 없어요"로 실패한다.
    await expect(
      caller().portfolio.add({ title: "내 작업", repoUrl: "https://github.com/a/b" })
    ).rejects.toThrow(/데이터베이스/);
  });
});

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
        category: "과제팁",
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

describe("reviews.toggleHelpful", () => {
  it("requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reviews.toggleHelpful({ reviewId: 1 })).rejects.toThrow();
  });
});

// 인증 에러 페이지는 로그인 전 누구나 도달하는 공개 표면 —
// 구글 프로필에서 온 도메인이 그대로 HTML에 박히지 않게 막는다.
describe("escapeHtml (인증 에러 페이지 XSS 방어)", () => {
  it("HTML 특수문자를 모두 이스케이프한다", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    expect(escapeHtml("a'b&c")).toBe("a&#39;b&amp;c");
  });

  it("앰퍼샌드를 먼저 처리해 이중 이스케이프가 없다", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("평범한 도메인은 그대로 둔다", () => {
    expect(escapeHtml("bu.ac.kr")).toBe("bu.ac.kr");
  });
});

// 시간표는 학기 단위 — 수강 수업뿐 아니라 개인 일정도 학기별로 분리된다.
// (지난 학기 알바가 이번 학기 공강을 막지 않도록 getWeeklyOccupancies도 학기 필터)
describe("timetable 학기별 관리", () => {
  it("semesters 목록은 인증이 필요하다", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.timetable.semesters()).rejects.toThrow();
  });

  it("semesters는 최소한 현재 학기를 포함한다(DB 없어도)", async () => {
    const caller = appRouter.createCaller(createAuthContext(createUser()));
    const list = await caller.timetable.semesters();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain("2026-1");
  });

  it("addEvent는 semester 없이도 현재 학기로 기본 적용된다", async () => {
    const caller = appRouter.createCaller(createAuthContext(createUser()));
    // DB 없으면 addUserSchedule이 throw — zod 기본값이 먼저 통과했는지(입력 검증) 확인
    await expect(
      caller.timetable.addEvent({
        title: "알바",
        dayOfWeek: "월",
        startPeriod: 1,
        endPeriod: 2,
      })
    ).rejects.toThrow("데이터베이스");
  });

  it("addEvent는 끝 교시가 시작보다 빠르면 거부한다", async () => {
    const caller = appRouter.createCaller(createAuthContext(createUser()));
    await expect(
      caller.timetable.addEvent({
        semester: "2026-2",
        title: "알바",
        dayOfWeek: "월",
        startPeriod: 5,
        endPeriod: 2,
      })
    ).rejects.toThrow();
  });
});

describe("courses.favorites (관심 수업)", () => {
  it("toggleFavorite requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.courses.toggleFavorite({ courseId: 1 })).rejects.toThrow();
  });

  it("favorites list requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.courses.favorites()).rejects.toThrow();
  });

  it("favorites returns an array for authed users (DB 없이 빈 배열 폴백)", async () => {
    const ctx = createAuthContext(createUser());
    const caller = appRouter.createCaller(ctx);
    expect(Array.isArray(await caller.courses.favorites())).toBe(true);
  });
});

describe("reviews.mine", () => {
  it("requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.reviews.mine()).rejects.toThrow();
  });

  it("returns an array for authed users (DB 없이 빈 배열 폴백)", async () => {
    const ctx = createAuthContext(createUser());
    const caller = appRouter.createCaller(ctx);
    const res = await caller.reviews.mine();
    expect(Array.isArray(res)).toBe(true);
  });
});

describe("admin.deleteReview", () => {
  it("rejects non-admin users (모더레이션 권한 가드)", async () => {
    const ctx = createAuthContext(createUser());
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.deleteReview({ reviewId: 1 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});
