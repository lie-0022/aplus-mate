import { eq, and, or, inArray, desc, count, sql, like, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  courses,
  userCourses,
  posts,
  postComments,
  courseAnnouncements,
  surveys,
  surveyQuestions,
  surveyResponses,
  teamMatches,
  teams,
  teamMembers,
  teamEvents,
  evaluations,
  badges,
  consents,
  courseMilestones,
  teamSubmissions,
  reports,
  notifications,
  teamNotes,
  recruitments,
  type Course,
  type InsertCourse,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  TEAM_SIZE_LIMITS,
  MENTORING_MAX_MENTEES,
  type MatchType,
  type MentoringRole,
} from "@shared/const";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  const isOwner =
    user.openId === ENV.ownerOpenId ||
    (!!ENV.ownerEmail && !!user.email && user.email === ENV.ownerEmail);
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (isOwner) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(
  userId: number,
  data: {
    university?: string;
    department?: string;
    year?: number;
    skillTags?: string[];
    kakaoOpenChatUrl?: string;
    name?: string;
  }
) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.university !== undefined) updateSet.university = data.university;
  if (data.department !== undefined) updateSet.department = data.department;
  if (data.year !== undefined) updateSet.year = data.year;
  if (data.skillTags !== undefined) updateSet.skillTags = data.skillTags;
  if (data.kakaoOpenChatUrl !== undefined) updateSet.kakaoOpenChatUrl = data.kakaoOpenChatUrl;
  if (data.name !== undefined) updateSet.name = data.name;

  if (Object.keys(updateSet).length === 0) return;

  await db.update(users).set(updateSet).where(eq(users.id, userId));

  // Mark profile as completed if all required fields are set.
  // 게이트는 university/department/year만 요구한다.
  // kakaoOpenChatUrl은 ProfileSetup에서 "(선택)"으로 들어오고, skillTags는 ProfileSetup에서
  // 아예 수집하지 않는다(default []). 둘을 게이트에 포함하면 정상적으로 가입한 학생도
  // profileCompleted=false에 영구 고정되어 매칭(createMatchRequest의 profileCompleted 검증)이
  // 영영 열리지 않는다. kakao 연락처는 매칭 수락 후 단계에서 수집한다.
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user.length > 0) {
    const u = user[0];
    const completed = !!u.university && !!u.department && !!u.year;
    if (completed && !u.profileCompleted) {
      await db.update(users).set({ profileCompleted: true }).where(eq(users.id, userId));
    }
  }
}

// 회원 탈퇴 — PII 익명화 + 활성 팀 정리 + pending 매칭 삭제(소프트-파기).
// 평가·배지 통계는 보존하되 본인 식별정보를 끊어 PIPA 파기 의무를 이행한다.
export async function deleteSelf(userId: number) {
  const db = await getDb();
  if (!db) return;
  // 활성 팀에서 모두 나간다(담당 일정 정리·마지막이면 해산은 leaveTeam이 처리).
  const memberRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, userId), eq(teams.status, "active")));
  for (const m of memberRows) {
    try {
      await leaveTeam(m.teamId, userId);
    } catch {
      /* 이미 정리된 팀 등은 무시 */
    }
  }
  // pending 매칭 정리 + PII 익명화를 한 트랜잭션으로
  await db.transaction(async (tx) => {
    await tx
      .delete(teamMatches)
      .where(
        and(
          eq(teamMatches.status, "pending"),
          or(eq(teamMatches.requesterId, userId), eq(teamMatches.receiverId, userId))
        )
      );
    await tx
      .update(users)
      .set({
        name: "(탈퇴한 사용자)",
        email: null,
        kakaoOpenChatUrl: null,
        skillTags: [],
        profileCompleted: false,
        deletedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });
}

// ─── Courses ─────────────────────────────────────────────

export async function createCourse(data: InsertCourse) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(courses).values(data);
  return { id: result[0].insertId };
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function searchCourses(query: string, university?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [];
  if (query) {
    // 부분 일치(LIKE) — 수업명·교수명·수업코드 중 하나라도 포함하면 매칭.
    // 특수문자(%, _)는 와일드카드로 오작동하므로 이스케이프한다.
    const escaped = query.replace(/[%_\\]/g, (c) => `\\${c}`);
    const term = `%${escaped}%`;
    conditions.push(
      or(
        like(courses.name, term),
        like(courses.professor, term),
        like(courses.courseCode, term)
      )
    );
  }
  if (university) {
    conditions.push(eq(courses.university, university));
  }

  if (conditions.length === 0) {
    return db.select().from(courses).limit(50);
  }

  return db
    .select()
    .from(courses)
    .where(and(...conditions))
    .limit(50);
}

export async function enrollCourse(userId: number, courseId: number, semester: string) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(userCourses).values({ userId, courseId, semester });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("이미 해당 수업에 등록되어 있습니다.");
    }
    throw error;
  }
}

export async function unenrollCourse(userId: number, courseId: number, semester: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(userCourses)
    .where(
      and(eq(userCourses.userId, userId), eq(userCourses.courseId, courseId), eq(userCourses.semester, semester))
    );
}

// 해당 수업에서 사용자가 활성 팀(종류 무관)에 속해 있는지 — 수강 취소 전 정합성 검사용.
export async function hasActiveTeamInCourse(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: teams.id })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.courseId, courseId),
        eq(teams.status, "active")
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getUserCourses(userId: number, semester?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(userCourses.userId, userId)];
  if (semester) {
    conditions.push(eq(userCourses.semester, semester));
  }

  return db
    .select({
      userCourse: userCourses,
      course: courses,
    })
    .from(userCourses)
    .innerJoin(courses, eq(userCourses.courseId, courses.id))
    .where(and(...conditions))
    .orderBy(desc(userCourses.createdAt));
}

export async function isUserEnrolled(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(userCourses)
    .where(and(eq(userCourses.userId, userId), eq(userCourses.courseId, courseId)))
    .limit(1);
  return result.length > 0;
}

export async function getCourseStudents(courseId: number, semester?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(userCourses.courseId, courseId)];
  if (semester) {
    conditions.push(eq(userCourses.semester, semester));
  }

  return db
    .select({
      user: {
        // name(실명)은 매칭 전 단계에서 제외 — 자가등록만으로 같은 수업 실명 명단 수확 방지.
        // 실명은 매칭 수락 후 getTeamDetail에서만 공개한다.
        id: users.id,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
        university: users.university,
      },
      userCourse: userCourses,
    })
    .from(userCourses)
    .innerJoin(users, eq(userCourses.userId, users.id))
    // 프로필 미완성 유저는 제외 — 학과·학년이 비어 "· 학년"으로 보이고,
    // 커넥트해도 createMatchRequest의 profileCompleted 검증에서 막혀 dead-end가 된다.
    .where(and(...conditions, eq(users.profileCompleted, true)))
    .orderBy(desc(userCourses.createdAt));
}

// ─── Posts ───────────────────────────────────────────────

export async function createPost(data: {
  courseId: number;
  userId: number;
  title: string;
  content: string;
  category: "족보" | "과제팁" | "후기" | "스터디";
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(posts).values(data);
  return { id: result[0].insertId };
}

export async function getCoursePosts(courseId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(posts.courseId, courseId), isNull(posts.hiddenAt)];
  if (category) {
    conditions.push(eq(posts.category, category as any));
  }

  return db
    .select({
      post: posts,
      author: {
        // 게시글은 "익명"으로 노출되므로 author 실명은 payload에서 제외.
        id: users.id,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt));
}

// 게시글 단건 조회 (조회수 증가 없이)
export async function getPost(postId: number) {
  const db = await getDb();
  if (!db) return null;
  // 숨김 처리된 글은 상세에서도 보이지 않게 한다.
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.hiddenAt)))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function incrementPostView(postId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(posts)
    .set({ viewCount: sql`viewCount + 1` })
    .where(eq(posts.id, postId));
}

// 댓글 — 작성자 식별정보는 반환하지 않는다(게시글과 동일하게 익명 표시).
export async function getPostComments(postId: number, viewerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: postComments.id,
      content: postComments.content,
      createdAt: postComments.createdAt,
      userId: postComments.userId,
    })
    .from(postComments)
    .where(and(eq(postComments.postId, postId), isNull(postComments.hiddenAt)))
    .orderBy(postComments.createdAt);
  // 익명 유지 — 식별자는 빼고 '내 댓글' 여부만 노출(본인 삭제 버튼 표시용).
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
    isMine: viewerId != null && r.userId === viewerId,
  }));
}

export async function createPostComment(data: {
  postId: number;
  userId: number;
  content: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(postComments).values(data);
  return { id: result[0].insertId };
}

// 게시글 soft-hide — 작성자 본인 또는 운영자만. hiddenAt을 채워 목록·상세에서 가린다.
export async function hidePost(postId: number, userId: number, isAdmin: boolean) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (rows.length === 0) throw new Error("게시글을 찾을 수 없습니다.");
  if (!isAdmin && rows[0].userId !== userId) {
    throw new Error("본인 글만 삭제할 수 있습니다.");
  }
  await db.update(posts).set({ hiddenAt: new Date() }).where(eq(posts.id, postId));
}

export async function hidePostComment(commentId: number, userId: number, isAdmin: boolean) {
  const db = await getDb();
  if (!db) return;
  const rows = await db
    .select()
    .from(postComments)
    .where(eq(postComments.id, commentId))
    .limit(1);
  if (rows.length === 0) throw new Error("댓글을 찾을 수 없습니다.");
  if (!isAdmin && rows[0].userId !== userId) {
    throw new Error("본인 댓글만 삭제할 수 있습니다.");
  }
  await db.update(postComments).set({ hiddenAt: new Date() }).where(eq(postComments.id, commentId));
}

// ─── Matching ────────────────────────────────────────────

export async function createMatchRequest(
  requesterId: number,
  receiverId: number,
  courseId: number,
  matchType: MatchType = "project",
  requesterRole?: MentoringRole,
  opts?: { message?: string; recruitmentId?: number }
) {
  // 역할은 멘토멘티 전용 — 다른 종류는 무시, 멘토멘티 미지정 시 멘티(멘토를 찾는 요청)가 기본.
  const role: MentoringRole | null =
    matchType === "mentoring" ? (requesterRole ?? "mentee") : null;
  const db = await getDb();
  if (!db) return null;

  // Validate: both users must be enrolled in course
  const requesterEnrolled = await isUserEnrolled(requesterId, courseId);
  const receiverEnrolled = await isUserEnrolled(receiverId, courseId);
  if (!requesterEnrolled || !receiverEnrolled) {
    throw new Error("두 사용자 모두 해당 수업에 등록되어 있어야 합니다.");
  }

  // Validate: both users must have completed profiles
  const requesterUser = await getUserById(requesterId);
  const receiverUser = await getUserById(receiverId);
  if (!requesterUser?.profileCompleted || !receiverUser?.profileCompleted) {
    throw new Error("프로필을 완성한 후 매칭을 요청할 수 있습니다.");
  }

  // Check for existing pending request between these users for this course+type
  // (팀플·스터디·멘토멘티는 독립 — 같은 쌍이라도 종류가 다르면 별개 요청)
  const pendingExisting = await db
    .select()
    .from(teamMatches)
    .where(
      and(
        eq(teamMatches.courseId, courseId),
        eq(teamMatches.matchType, matchType),
        eq(teamMatches.status, "pending"),
        or(
          and(eq(teamMatches.requesterId, requesterId), eq(teamMatches.receiverId, receiverId)),
          and(eq(teamMatches.requesterId, receiverId), eq(teamMatches.receiverId, requesterId))
        )
      )
    )
    .limit(1);

  if (pendingExisting.length > 0) {
    throw new Error("이미 매칭 요청을 보냈습니다.");
  }

  // 같은 종류의 그룹에서 이미 함께면 차단 (다른 종류 그룹은 허용 — 팀플 팀원과 스터디 가능)
  const requesterTeamsInCourse = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(
        eq(teamMembers.userId, requesterId),
        eq(teams.courseId, courseId),
        eq(teams.teamType, matchType)
      )
    );

  if (requesterTeamsInCourse.length > 0) {
    const teamIds = requesterTeamsInCourse.map((t) => t.teamId);
    const sharedTeam = await db
      .select()
      .from(teamMembers)
      .where(and(inArray(teamMembers.teamId, teamIds), eq(teamMembers.userId, receiverId)))
      .limit(1);
    if (sharedTeam.length > 0) {
      throw new Error("이미 해당 수업에서 함께하는 그룹이 있습니다.");
    }
  }

  try {
    const result = await db.insert(teamMatches).values({
      requesterId,
      receiverId,
      courseId,
      matchType,
      requesterRole: role,
      status: "pending",
      message: opts?.message ?? null,
      recruitmentId: opts?.recruitmentId ?? null,
    });
    // 수신자에게 요청 도착 알림 — 직접 커넥트·모집 지원 모두. (기존 누락 보완)
    // 알림 실패가 매칭 자체를 막지 않도록 격리.
    try {
      const courseForNoti = await getCourseById(courseId);
      await createNotification({
        userId: receiverId,
        type: opts?.recruitmentId ? "recruitment_applied" : "match_request",
        title: opts?.recruitmentId ? "내 모집 공고에 지원이 왔어요" : "새 커넥트 요청이 왔어요",
        body: `${courseForNoti?.name ?? "수업"} · ${requesterUser.department ?? ""} ${requesterUser.year ?? ""}학년`,
        linkPath: "/matching/requests",
      });
    } catch {
      /* 알림 실패 무시 */
    }
    return { id: result[0].insertId };
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("이미 매칭 요청을 보냈습니다.");
    }
    throw error;
  }
}

export async function getReceivedMatchRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      match: teamMatches,
      requester: {
        // 매칭 수락 전이므로 요청자 실명은 제외(UI도 학과·학년·대학·스킬만 노출).
        id: users.id,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
        university: users.university,
      },
      course: {
        id: courses.id,
        name: courses.name,
        professor: courses.professor,
      },
    })
    .from(teamMatches)
    .innerJoin(users, eq(teamMatches.requesterId, users.id))
    .innerJoin(courses, eq(teamMatches.courseId, courses.id))
    .where(and(eq(teamMatches.receiverId, userId), eq(teamMatches.status, "pending")))
    .orderBy(desc(teamMatches.createdAt));
  return rows;
}

// 내가 보낸 pending 요청 — 수신자 정보는 받은 요청과 동일하게 실명 제외 마스킹.
export async function getSentMatchRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      match: teamMatches,
      receiver: {
        id: users.id,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
        university: users.university,
      },
      course: {
        id: courses.id,
        name: courses.name,
        professor: courses.professor,
      },
    })
    .from(teamMatches)
    .innerJoin(users, eq(teamMatches.receiverId, users.id))
    .innerJoin(courses, eq(teamMatches.courseId, courses.id))
    .where(and(eq(teamMatches.requesterId, userId), eq(teamMatches.status, "pending")))
    .orderBy(desc(teamMatches.createdAt));
}

// 보낸 pending 요청 취소 — 행을 삭제해 같은 상대에게 재요청 가능한 상태로 되돌린다.
export async function cancelMatchRequest(matchId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const rows = await db
    .select()
    .from(teamMatches)
    .where(and(eq(teamMatches.id, matchId), eq(teamMatches.requesterId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("요청을 찾을 수 없습니다.");
  if (rows[0].status !== "pending") throw new Error("이미 처리된 요청은 취소할 수 없습니다.");
  await db.delete(teamMatches).where(eq(teamMatches.id, matchId));
}

// 매칭 단건 조회 — 수락 알림에서 요청자 식별용.
export async function getMatchById(matchId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamMatches).where(eq(teamMatches.id, matchId)).limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function getPendingMatchCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ cnt: count() })
    .from(teamMatches)
    .where(and(eq(teamMatches.receiverId, userId), eq(teamMatches.status, "pending")));
  return result[0]?.cnt ?? 0;
}

// 운영자 전용: 모든 pending 매칭을 요청자/수신자 연락정보·수업명과 함께 조회.
// 매칭 수락을 수동 푸시할 때 "누가 누구에게 요청했나"를 DB 직접 쿼리 없이 본다.
// (자기-조인 별칭 복잡성 회피 위해 매칭 조회 후 유저·수업을 별도 조회해 매핑.)
export async function getPendingMatchesForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const matches = await db
    .select()
    .from(teamMatches)
    .where(eq(teamMatches.status, "pending"))
    .orderBy(desc(teamMatches.createdAt));
  if (matches.length === 0) return [];

  const userIds = Array.from(new Set(matches.flatMap((m) => [m.requesterId, m.receiverId])));
  const courseIds = Array.from(new Set(matches.map((m) => m.courseId)));

  const us = await db
    .select({
      id: users.id,
      name: users.name,
      department: users.department,
      year: users.year,
      kakaoOpenChatUrl: users.kakaoOpenChatUrl,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  const cs = await db
    .select({ id: courses.id, name: courses.name, professor: courses.professor })
    .from(courses)
    .where(inArray(courses.id, courseIds));

  const uMap = new Map(us.map((u) => [u.id, u]));
  const cMap = new Map(cs.map((c) => [c.id, c]));

  return matches.map((m) => ({
    match: m,
    requester: uMap.get(m.requesterId) ?? null,
    receiver: uMap.get(m.receiverId) ?? null,
    course: cMap.get(m.courseId) ?? null,
  }));
}

// 사용자가 해당 수업에서 현재 속한 '활성' 그룹(같은 종류, 완료 전)을 반환. 없으면 null.
// 팀플·스터디·멘토멘티는 독립 — 같은 수업에서 동시에 하나씩 가질 수 있다.
async function getActiveTeamForCourse(userId: number, courseId: number, teamType: MatchType) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ id: teams.id })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.courseId, courseId),
        eq(teams.teamType, teamType),
        eq(teams.status, "active")
      )
    )
    .orderBy(desc(teams.createdAt))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function acceptMatch(matchId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Verify the match exists and user is receiver
  const matchRows = await db
    .select()
    .from(teamMatches)
    .where(and(eq(teamMatches.id, matchId), eq(teamMatches.receiverId, userId)))
    .limit(1);
  if (matchRows.length === 0) throw new Error("매칭 요청을 찾을 수 없습니다.");
  const match = matchRows[0];
  if (match.status !== "pending") throw new Error("이미 처리된 요청입니다.");

  // 이 매칭으로 이미 팀이 생성됐으면 멱등 반환
  const teamByMatch = await db.select().from(teams).where(eq(teams.matchId, matchId)).limit(1);
  if (teamByMatch.length > 0) {
    await db.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
    return { teamId: teamByMatch[0].id };
  }

  // 3인+ 매칭: 요청자/수신자 중 한쪽이 이미 이 수업의 같은 종류 활성 그룹에 있으면
  // 새 그룹을 만들지 않고 그 그룹에 다른 한 명을 합류시킨다.
  const matchType = match.matchType as MatchType;
  const maxSize = TEAM_SIZE_LIMITS[matchType];
  // 멘토멘티 역할: 요청자가 고른 역할(기본 멘티), 수신자는 반대 역할.
  const requesterRole: MentoringRole | null =
    matchType === "mentoring" ? ((match.requesterRole as MentoringRole) ?? "mentee") : null;
  const roleOf = (userId: number): "member" | "mentor" | "mentee" => {
    if (matchType !== "mentoring") return "member";
    const isRequester = userId === match.requesterId;
    return (isRequester ? requesterRole : requesterRole === "mentor" ? "mentee" : "mentor")!;
  };

  const requesterTeam = await getActiveTeamForCourse(match.requesterId, match.courseId, matchType);
  const receiverTeam = await getActiveTeamForCourse(match.receiverId, match.courseId, matchType);

  // 이미 같은 그룹이면 매칭만 수락 처리
  if (requesterTeam && receiverTeam && requesterTeam.id === receiverTeam.id) {
    await db.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
    return { teamId: requesterTeam.id };
  }
  // 둘 다 서로 다른 그룹이면 합칠 수 없음(평가/팀 모델 단순화)
  if (requesterTeam && receiverTeam) {
    throw new Error("두 사람이 이미 서로 다른 그룹에 속해 있어 합칠 수 없어요.");
  }

  const targetTeam = requesterTeam ?? receiverTeam;
  if (targetTeam) {
    // 그룹에 없는 쪽이 합류한다
    const joiningUserId = requesterTeam ? match.receiverId : match.requesterId;
    // 정원·역할 검증과 합류 insert를 한 트랜잭션에서 처리한다. 기존 멤버 행을
    // FOR UPDATE로 잠가, 두 수신자가 동시에 수락할 때 정원/멘토 제약을 함께
    // 통과해 초과되는 TOCTOU race를 직렬화로 막는다(엣지 1-B).
    return await db.transaction(async (tx) => {
      const memberRows = await tx
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, targetTeam.id))
        .for("update");
      if (memberRows.length >= maxSize) {
        throw new Error(`정원(${maxSize}명)이 가득 찼어요.`);
      }
      let joinRole: "member" | "mentor" | "mentee" = "member";
      if (matchType === "mentoring") {
        joinRole = roleOf(joiningUserId);
        // 멘토는 1명만 — 단, 멘토가 나간 그룹에는 새 멘토가 합류할 수 있다.
        if (joinRole === "mentor" && memberRows.some((m) => m.role === "mentor")) {
          throw new Error("이미 멘토가 있는 그룹이에요. 멘티로 요청해보세요.");
        }
        const menteeCount = memberRows.filter((m) => m.role === "mentee").length;
        if (menteeCount >= MENTORING_MAX_MENTEES) {
          throw new Error(`멘티 정원(${MENTORING_MAX_MENTEES}명)이 가득 찼어요.`);
        }
      }
      await tx.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
      try {
        await tx
          .insert(teamMembers)
          .values({ teamId: targetTeam.id, userId: joiningUserId, role: joinRole });
      } catch (error: any) {
        if (error.code !== "ER_DUP_ENTRY") throw error; // 이미 멤버면 무시
      }
      return { teamId: targetTeam.id };
    });
  }

  // 둘 다 그룹이 없으면 새 2인 그룹 생성 — 매칭 수락 + 팀/멤버 생성을 한
  // 트랜잭션으로 묶어, 부분 실패 시 "accepted인데 팀 없음 / 멤버 0명 유령 팀"이
  // 남는 비원자 쓰기 문제를 막는다(엣지 1-A).
  try {
    return await db.transaction(async (tx) => {
      await tx.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
      const teamResult = await tx.insert(teams).values({
        matchId,
        courseId: match.courseId,
        teamType: matchType,
        status: "active",
        evaluationStatus: "pending",
      });
      const teamId = teamResult[0].insertId;
      await tx.insert(teamMembers).values([
        { teamId, userId: match.requesterId, role: roleOf(match.requesterId) },
        { teamId, userId: match.receiverId, role: roleOf(match.receiverId) },
      ]);
      return { teamId };
    });
  } catch (error: any) {
    // race condition: 동시에 다른 요청이 팀을 만든 경우(matchId unique 충돌) → 기존 팀 반환
    if (error.code === "ER_DUP_ENTRY") {
      const existingTeam = await db.select().from(teams).where(eq(teams.matchId, matchId)).limit(1);
      if (existingTeam.length > 0) {
        return { teamId: existingTeam[0].id };
      }
    }
    throw error;
  }
}

export async function rejectMatch(matchId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(teamMatches)
    .set({ status: "rejected" })
    .where(and(eq(teamMatches.id, matchId), eq(teamMatches.receiverId, userId)));
}

// ─── Teams ───────────────────────────────────────────────

export async function getUserTeams(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  if (memberRows.length === 0) return [];

  const teamIds = memberRows.map((r) => r.teamId);
  const teamRows = await db
    .select({
      team: teams,
      course: {
        id: courses.id,
        name: courses.name,
        professor: courses.professor,
      },
    })
    .from(teams)
    .innerJoin(courses, eq(teams.courseId, courses.id))
    .where(inArray(teams.id, teamIds))
    .orderBy(desc(teams.createdAt));

  // Get members for each team
  const allMembers = await db
    .select({
      teamMember: teamMembers,
      user: {
        id: users.id,
        name: users.name,
        department: users.department,
        year: users.year,
      },
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(inArray(teamMembers.teamId, teamIds));

  return teamRows.map((row) => ({
    ...row,
    members: allMembers.filter((m) => m.teamMember.teamId === row.team.id),
  }));
}

export async function getTeamDetail(teamId: number) {
  const db = await getDb();
  if (!db) return null;

  const teamRow = await db
    .select({
      team: teams,
      course: {
        id: courses.id,
        name: courses.name,
        professor: courses.professor,
      },
    })
    .from(teams)
    .innerJoin(courses, eq(teams.courseId, courses.id))
    .where(eq(teams.id, teamId))
    .limit(1);

  if (teamRow.length === 0) return null;

  const memberRows = await db
    .select({
      teamMember: teamMembers,
      user: {
        id: users.id,
        name: users.name,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
        kakaoOpenChatUrl: users.kakaoOpenChatUrl,
        university: users.university,
      },
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));

  return {
    ...teamRow[0],
    members: memberRows,
  };
}

export async function completeTeam(teamId: number) {
  const db = await getDb();
  if (!db) return;

  // 팀플(project)만 동료 평가 단계로 진입 — 스터디·멘토멘티는 평가 없이 바로 종료.
  const teamRow = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const isProject = teamRow.length === 0 || teamRow[0].teamType === "project";

  // 평가할 동료가 없는(혼자 남은) 팀플은 평가 단계를 건너뛰고 바로 종료한다.
  // 동료가 0명이면 평가가 영원히 들어올 수 없어 evaluationStatus가 in_progress로
  // 영구 정체되므로, 멤버 2명 이상일 때만 평가 단계로 보낸다(엣지 1-E 부분 완화).
  let needsEvaluation = isProject;
  if (isProject) {
    const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    needsEvaluation = members.length >= 2;
  }

  try {
    // Atomic update: only update if status is still 'active'
    // This prevents race condition where multiple members click complete simultaneously
    const result = await db
      .update(teams)
      .set({ status: "completed", evaluationStatus: needsEvaluation ? "in_progress" : "done" })
      .where(and(eq(teams.id, teamId), eq(teams.status, "active")));

    // Check if update actually happened (affected rows > 0)
    // If 0 rows affected, team was already completed by another request
    if (result[0]?.affectedRows === 0) {
      throw new Error("이미 완료된 팀입니다.");
    }
  } catch (error: any) {
    // Handle any other errors
    if (error.message?.includes("이미 완료된")) {
      throw error; // Re-throw our custom error
    }
    throw error;
  }
}

// 팀 나가기 — 활성 그룹만. 내 담당 일정은 공동으로 전환, 마지막 1명이면 그룹·일정 삭제.
export async function leaveTeam(teamId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const teamRows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (teamRows.length === 0) throw new Error("팀을 찾을 수 없습니다.");
  if (teamRows[0].status !== "active") {
    throw new Error("완료된 팀은 나갈 수 없습니다.");
  }
  const memberRows = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  if (!memberRows.some((m) => m.userId === userId)) {
    throw new Error("팀 멤버가 아닙니다.");
  }

  // 멤버 삭제 → 담당 일정 해제 → (마지막 1명이면) 일정·팀 삭제를 한 트랜잭션으로
  // 묶어, 중간 실패 시 부분 정리 상태가 남지 않게 한다(엣지 1-D).
  return await db.transaction(async (tx) => {
    await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    await tx
      .update(teamEvents)
      .set({ assigneeId: null })
      .where(and(eq(teamEvents.teamId, teamId), eq(teamEvents.assigneeId, userId)));

    if (memberRows.length <= 1) {
      await tx.delete(teamEvents).where(eq(teamEvents.teamId, teamId));
      await tx.delete(teams).where(eq(teams.id, teamId));
      return { disbanded: true };
    }
    return { disbanded: false };
  });
}

// ─── Team Events (팀 일정) ────────────────────────────────
// 권한(멤버 검증)은 라우터에서 getTeamDetail 멤버십으로 확인한다.

export async function getTeamEvents(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(teamEvents)
    .where(eq(teamEvents.teamId, teamId))
    .orderBy(teamEvents.dueAt);
}

export async function getTeamEventById(eventId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(teamEvents).where(eq(teamEvents.id, eventId)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function createTeamEvent(data: {
  teamId: number;
  createdBy: number;
  title: string;
  dueAt: Date;
  assigneeId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(teamEvents).values(data);
  return { id: result[0].insertId };
}

export async function setTeamEventAssignee(eventId: number, assigneeId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(teamEvents).set({ assigneeId }).where(eq(teamEvents.id, eventId));
}

export async function setTeamEventDone(eventId: number, isDone: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(teamEvents).set({ isDone }).where(eq(teamEvents.id, eventId));
}

export async function deleteTeamEvent(eventId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(teamEvents).where(eq(teamEvents.id, eventId));
}

// 대시보드용: 내가 속한 활성 그룹들의 미완료 일정(마감 임박순).
export async function getUpcomingEventsForUser(userId: number, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      event: teamEvents,
      team: { id: teams.id, teamType: teams.teamType },
      course: { name: courses.name },
    })
    .from(teamEvents)
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teamEvents.teamId), eq(teamMembers.userId, userId))
    )
    .innerJoin(teams, eq(teams.id, teamEvents.teamId))
    .innerJoin(courses, eq(courses.id, teams.courseId))
    .where(and(eq(teamEvents.isDone, false), eq(teams.status, "active")))
    .orderBy(teamEvents.dueAt)
    .limit(limit);
}

// ─── Evaluations ─────────────────────────────────────────

export async function submitEvaluationBatch(data: {
  teamId: number;
  evaluatorId: number;
  evaluations: Array<{
    evaluateeId: number;
    promiseScore: number;
    ideaScore: number;
    deadlineScore: number;
    grade: "A+" | "A" | "B+" | "B" | "C+";
  }>;
}) {
  const db = await getDb();
  if (!db) return;

  // 여러 평가 insert와 "평가 완료" 표시를 한 트랜잭션으로 원자화한다. 일부 평가만
  // insert된 채 실패하면, 재시도 때 ER_DUP_ENTRY("이미 평가 완료")로 막혀 나머지를
  // 영영 제출하지 못하는 갇힘이 생긴다 — all-or-nothing으로 막는다(엣지 1-F).
  try {
    await db.transaction(async (tx) => {
      for (const evalItem of data.evaluations) {
        await tx.insert(evaluations).values({
          teamId: data.teamId,
          evaluatorId: data.evaluatorId,
          ...evalItem,
        });
      }
      // 모든 평가가 들어간 뒤에야 평가자를 '평가 완료'로 표시(같은 트랜잭션)
      await tx
        .update(teamMembers)
        .set({ hasEvaluated: true })
        .where(
          and(eq(teamMembers.teamId, data.teamId), eq(teamMembers.userId, data.evaluatorId))
        );
    });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("이미 평가를 완료했습니다.");
    }
    throw error;
  }

  // Check if all members have evaluated
  const allMembers = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, data.teamId));

  const allEvaluated = allMembers.every((m) => m.hasEvaluated);

  if (allEvaluated) {
    // done으로의 전환을 원자적으로 선점한다. 마지막 평가가 동시에 들어와도
    // in_progress→done 전환에 성공하는 호출은 하나뿐이고, 그 호출만 배지를
    // 계산하므로 같은 팀 기여분이 중복 집계되지 않는다(엣지 5-B / 1-G).
    const claimed = await db
      .update(teams)
      .set({ evaluationStatus: "done" })
      .where(and(eq(teams.id, data.teamId), eq(teams.evaluationStatus, "in_progress")));
    if ((claimed[0]?.affectedRows ?? 0) > 0) {
      await calculateBadges(data.teamId);
    }
  }
}

export async function hasUserEvaluated(teamId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return result.length > 0 && result[0].hasEvaluated;
}

export async function getTeamEvaluations(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluations).where(eq(evaluations.teamId, teamId));
}

// ─── Badges ──────────────────────────────────────────────

async function calculateBadges(teamId: number) {
  const db = await getDb();
  if (!db) return;

  const memberRows = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  const evalRows = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.teamId, teamId));

  for (const member of memberRows) {
    const receivedEvals = evalRows.filter((e) => e.evaluateeId === member.userId);
    if (receivedEvals.length === 0) continue;

    const avgPromise =
      receivedEvals.reduce((sum, e) => sum + e.promiseScore, 0) / receivedEvals.length;
    const avgIdea =
      receivedEvals.reduce((sum, e) => sum + e.ideaScore, 0) / receivedEvals.length;
    const avgDeadline =
      receivedEvals.reduce((sum, e) => sum + e.deadlineScore, 0) / receivedEvals.length;

    const badgeTypes: Array<{ type: "promise" | "idea" | "deadline"; avg: number }> = [
      { type: "promise", avg: avgPromise },
      { type: "idea", avg: avgIdea },
      { type: "deadline", avg: avgDeadline },
    ];

    for (const badge of badgeTypes) {
      if (badge.avg >= 4.0) {
        try {
          // Use ON DUPLICATE KEY UPDATE for atomic increment
          // This prevents race condition where two threads read old count and write same value
          await db
            .insert(badges)
            .values({
              userId: member.userId,
              badgeType: badge.type,
              count: 1,
            })
            .onDuplicateKeyUpdate({
              set: { count: sql`count + 1` },
            });
        } catch (error: any) {
          console.error("[Badge] Error calculating badge:", error);
          // Silently ignore - badge count may be slightly off but data integrity maintained
        }
      }
    }
  }
}

export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(badges).where(eq(badges.userId, userId));
}

// 평가 강제 마감 — 미제출자가 있어도 현재까지 제출된 평가로 배지를 계산하고
// 평가 단계를 종료한다. in_progress→done 전환을 원자적으로 선점해(5-B와 동일 패턴)
// 동시 호출/중복 집계를 막는다. 미제출자는 받은 평가가 적어 배지를 덜/안 받는다(엣지 1-E).
export async function closeEvaluation(teamId: number) {
  const db = await getDb();
  if (!db) return;
  const claimed = await db
    .update(teams)
    .set({ evaluationStatus: "done" })
    .where(and(eq(teams.id, teamId), eq(teams.evaluationStatus, "in_progress")));
  if ((claimed[0]?.affectedRows ?? 0) > 0) {
    await calculateBadges(teamId);
  }
}

// ─── Professor (담당 수업·수강생·팀 현황) ─────────────────

// 담당 교수 없는 수업을 클레임. 이미 배정돼 있으면 거부.
export async function claimCourse(courseId: number, professorId: number) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (rows.length === 0) throw new Error("수업을 찾을 수 없습니다.");
  if (rows[0].professorId != null) {
    throw new Error("이미 담당 교수가 등록된 수업입니다.");
  }
  // professorId가 여전히 NULL일 때만 갱신 — 두 교수가 동시에 클레임해도
  // 한 명만 성공하도록 원자적 조건부 update로 경합을 막는다(엣지 5-A).
  const claimed = await db
    .update(courses)
    .set({ professorId })
    .where(and(eq(courses.id, courseId), isNull(courses.professorId)));
  if ((claimed[0]?.affectedRows ?? 0) === 0) {
    throw new Error("이미 담당 교수가 등록된 수업입니다.");
  }
}

// ─── 수업 조인 코드 / 마감일 (교수 주도 도입 P1·P2) ──────────
const INVITE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 혼동문자 0,O,1,I,L 제외
function genInviteCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return s;
}

// 교수가 수업 조인 코드를 발급/재발급 — 유일성 충돌 시 재시도.
export async function generateInviteCode(courseId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = genInviteCode(6);
    const exists = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.inviteCode, code))
      .limit(1);
    if (exists.length > 0) continue;
    await db.update(courses).set({ inviteCode: code }).where(eq(courses.id, courseId));
    return code;
  }
  return null;
}

export async function getCourseByInviteCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.inviteCode, code.trim().toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function setMatchingDeadline(courseId: number, deadline: Date | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(courses).set({ matchingDeadline: deadline }).where(eq(courses.id, courseId));
}

// 미배정 학생 전원에게 독려 알림(교수가 누름) — 공지 팬아웃 패턴 재사용.
export async function nudgeUnassignedStudents(courseId: number) {
  const db = await getDb();
  if (!db) return { notified: 0 };
  const dash = await getCourseDashboard(courseId);
  if (!dash) return { notified: 0 };
  const course = await getCourseById(courseId);
  let n = 0;
  for (const s of dash.unassignedStudents) {
    await createNotification({
      userId: s.id,
      type: "matching_nudge",
      title: "아직 팀이 없어요!",
      body: `${course?.name ?? "수업"} 팀 구성을 서둘러 주세요.`,
      linkPath: `/courses/${courseId}`,
    });
    n++;
  }
  return { notified: n };
}

export async function getProfessorCourses(professorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(courses)
    .where(eq(courses.professorId, professorId))
    .orderBy(desc(courses.createdAt));
}

// 교수 대시보드 집계 — 수업 한 개의 참여·팀 구성·설문 응답 현황을 한 번에.
// 교수가 로그인하면 "내 수업이 어떻게 돌아가는지"를 한눈에 보도록 한다.
export async function getCourseDashboard(courseId: number) {
  const db = await getDb();
  if (!db) return null;

  // 수강생(실명·프로필 완성 여부)
  const studentRows = await db
    .select({
      id: users.id,
      name: users.name,
      department: users.department,
      year: users.year,
      profileCompleted: users.profileCompleted,
      skillTags: users.skillTags,
    })
    .from(userCourses)
    .innerJoin(users, eq(userCourses.userId, users.id))
    .where(eq(userCourses.courseId, courseId));

  // 이 수업의 팀과 (활성 팀) 멤버
  const teamRows = await db.select().from(teams).where(eq(teams.courseId, courseId));
  const activeTeamIds = teamRows.filter((t) => t.status === "active").map((t) => t.id);
  let assignedIds = new Set<number>();
  if (activeTeamIds.length > 0) {
    const mem = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, activeTeamIds));
    assignedIds = new Set(mem.map((m) => m.userId));
  }
  // 활성 팀에 속하지 않은 수강생 = 팀 미배정
  const unassignedStudents = studentRows.filter((s) => !assignedIds.has(s.id));

  // 설문별 응답자 수(응답률 표시용)
  const surveyRows = await db
    .select()
    .from(surveys)
    .where(eq(surveys.courseId, courseId))
    .orderBy(desc(surveys.createdAt));
  const surveyStats = await Promise.all(
    surveyRows.map(async (sv) => {
      const resp = await db
        .select({ userId: surveyResponses.userId })
        .from(surveyResponses)
        .where(eq(surveyResponses.surveyId, sv.id));
      const respondents = new Set(resp.map((r) => r.userId)).size;
      return { id: sv.id, title: sv.title, status: sv.status, respondents };
    })
  );

  return {
    studentCount: studentRows.length,
    profileCompletedCount: studentRows.filter((s) => s.profileCompleted).length,
    activeTeamCount: teamRows.filter((t) => t.status === "active").length,
    completedTeamCount: teamRows.filter((t) => t.status === "completed").length,
    assignedCount: assignedIds.size,
    unassignedStudents,
    surveys: surveyStats,
  };
}

// ─── Milestones & Submissions (팀 산출물 제출) ────────────
// 교수가 제출 항목(마일스톤)을 만들면 각 팀이 링크+메모로 제출하고,
// 교수는 마일스톤 × 팀 매트릭스로 제출/미제출·확인 여부를 한눈에 본다.

export async function createMilestone(data: {
  courseId: number;
  createdBy: number;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.insert(courseMilestones).values({
    courseId: data.courseId,
    createdBy: data.createdBy,
    title: data.title,
    description: data.description ?? null,
    dueAt: data.dueAt ?? null,
  });
  return { id: r[0].insertId };
}

export async function getCourseMilestones(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(courseMilestones)
    .where(eq(courseMilestones.courseId, courseId))
    .orderBy(courseMilestones.createdAt);
}

export async function getMilestoneCourseId(milestoneId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ courseId: courseMilestones.courseId })
    .from(courseMilestones)
    .where(eq(courseMilestones.id, milestoneId))
    .limit(1);
  return rows.length > 0 ? rows[0].courseId : null;
}

export async function deleteMilestone(milestoneId: number) {
  const db = await getDb();
  if (!db) return;
  // FK가 없으므로 제출물도 함께 정리한다.
  await db.transaction(async (tx) => {
    await tx.delete(teamSubmissions).where(eq(teamSubmissions.milestoneId, milestoneId));
    await tx.delete(courseMilestones).where(eq(courseMilestones.id, milestoneId));
  });
}

// 교수 매트릭스용: 이 수업 마일스톤들에 달린 모든 제출.
export async function getCourseSubmissions(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  const ms = await getCourseMilestones(courseId);
  if (ms.length === 0) return [];
  return db
    .select()
    .from(teamSubmissions)
    .where(
      inArray(
        teamSubmissions.milestoneId,
        ms.map((m) => m.id)
      )
    );
}

// 팀 관점: 우리 수업의 마일스톤 목록 + 우리 팀 제출(있으면).
export async function getTeamMilestones(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  const teamRows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (teamRows.length === 0) return [];
  const ms = await getCourseMilestones(teamRows[0].courseId);
  const subs = await db
    .select()
    .from(teamSubmissions)
    .where(eq(teamSubmissions.teamId, teamId));
  return ms.map((m) => ({
    milestone: m,
    submission: subs.find((s) => s.milestoneId === m.id) ?? null,
  }));
}

// 팀 산출물 제출/수정 — 마일스톤당 팀당 1개. 재제출은 갱신하고 교수 확인표시는 리셋.
export async function submitDeliverable(data: {
  milestoneId: number;
  teamId: number;
  submittedBy: number;
  url: string;
  note?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(teamSubmissions)
    .values({
      milestoneId: data.milestoneId,
      teamId: data.teamId,
      submittedBy: data.submittedBy,
      url: data.url,
      note: data.note ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        url: data.url,
        note: data.note ?? null,
        submittedBy: data.submittedBy,
        reviewedAt: null,
      },
    });
}

export async function setSubmissionReviewed(submissionId: number, reviewed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(teamSubmissions)
    .set({ reviewedAt: reviewed ? new Date() : null })
    .where(eq(teamSubmissions.id, submissionId));
}

export async function getSubmissionCourseId(submissionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ courseId: courseMilestones.courseId })
    .from(teamSubmissions)
    .innerJoin(courseMilestones, eq(courseMilestones.id, teamSubmissions.milestoneId))
    .where(eq(teamSubmissions.id, submissionId))
    .limit(1);
  return rows.length > 0 ? rows[0].courseId : null;
}

// 교수용 수강생 목록 — 학생 간 매칭 전 마스킹과 달리 교수에게는 실명을 공개한다.
export async function getCourseStudentsForProfessor(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      user: {
        id: users.id,
        name: users.name,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
      },
      userCourse: userCourses,
    })
    .from(userCourses)
    .innerJoin(users, eq(userCourses.userId, users.id))
    .where(eq(userCourses.courseId, courseId))
    .orderBy(desc(userCourses.createdAt));
}

// 교수용 팀 현황 — 수업의 모든 그룹과 멤버(실명·역할), 평가 진행 상태까지.
export async function getCourseTeamsForProfessor(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.courseId, courseId))
    .orderBy(desc(teams.createdAt));
  if (teamRows.length === 0) return [];

  const teamIds = teamRows.map((t) => t.id);
  const memberRows = await db
    .select({
      teamMember: teamMembers,
      user: { id: users.id, name: users.name, department: users.department, year: users.year },
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(inArray(teamMembers.teamId, teamIds));

  return teamRows.map((team) => ({
    team,
    members: memberRows.filter((m) => m.teamMember.teamId === team.id),
  }));
}

// ─── Announcements (교수 공지) ────────────────────────────

export async function createAnnouncement(data: {
  courseId: number;
  professorId: number;
  title: string;
  content: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(courseAnnouncements).values(data);
  return { id: result[0].insertId };
}

export async function getCourseAnnouncements(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(courseAnnouncements)
    .where(eq(courseAnnouncements.courseId, courseId))
    .orderBy(desc(courseAnnouncements.createdAt));
}

export async function getAnnouncementCourseId(announcementId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ courseId: courseAnnouncements.courseId })
    .from(courseAnnouncements)
    .where(eq(courseAnnouncements.id, announcementId))
    .limit(1);
  return rows.length > 0 ? rows[0].courseId : null;
}

export async function deleteAnnouncement(announcementId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(courseAnnouncements).where(eq(courseAnnouncements.id, announcementId));
}

// ─── Surveys (교수 설문) ──────────────────────────────────

export async function createSurvey(data: {
  courseId: number;
  professorId: number;
  title: string;
  questions: Array<{ type: "scale" | "choice" | "text"; text: string; options?: string[] }>;
}) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(surveys).values({
    courseId: data.courseId,
    professorId: data.professorId,
    title: data.title,
    status: "open",
  });
  const surveyId = result[0].insertId;
  await db.insert(surveyQuestions).values(
    data.questions.map((q, i) => ({
      surveyId,
      order: i,
      type: q.type,
      text: q.text,
      options: q.type === "choice" ? (q.options ?? []) : null,
    }))
  );
  return { id: surveyId };
}

export async function getCourseSurveys(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(surveys)
    .where(eq(surveys.courseId, courseId))
    .orderBy(desc(surveys.createdAt));
}

export async function getSurveyById(surveyId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function getSurveyQuestions(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(surveyQuestions)
    .where(eq(surveyQuestions.surveyId, surveyId))
    .orderBy(surveyQuestions.order);
}

export async function setSurveyStatus(surveyId: number, status: "open" | "closed") {
  const db = await getDb();
  if (!db) return;
  await db.update(surveys).set({ status }).where(eq(surveys.id, surveyId));
}

export async function hasRespondedSurvey(surveyId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: surveyResponses.id })
    .from(surveyResponses)
    .where(and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export async function submitSurveyResponses(data: {
  surveyId: number;
  userId: number;
  answers: Array<{ questionId: number; value?: number | null; textValue?: string | null }>;
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(surveyResponses).values(
      data.answers.map((a) => ({
        surveyId: data.surveyId,
        questionId: a.questionId,
        userId: data.userId,
        value: a.value ?? null,
        textValue: a.textValue ?? null,
      }))
    );
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("이미 설문에 응답했습니다.");
    }
    throw error;
  }
}

// MySQL json 컬럼이 드라이버에 따라 문자열로 올 수 있어 배열로 정규화.
export function parseOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* not JSON */
    }
  }
  return [];
}

// 문항별 집계 — scale: 평균·분포(1~5), choice: 선택지별 카운트.
export async function getSurveyResults(surveyId: number) {
  const db = await getDb();
  if (!db) return { questions: [], respondentCount: 0 };
  const questions = await getSurveyQuestions(surveyId);
  const responses = await db
    .select()
    .from(surveyResponses)
    .where(eq(surveyResponses.surveyId, surveyId));

  const respondentCount = new Set(responses.map((r) => r.userId)).size;
  const byQuestion = questions.map((q) => {
    const rs = responses.filter((r) => r.questionId === q.id);
    const base = {
      question: q,
      count: rs.length,
      average: null as number | null,
      distribution: null as number[] | null,
      choiceCounts: null as number[] | null,
      textAnswers: null as string[] | null,
    };
    if (q.type === "scale") {
      const dist = [0, 0, 0, 0, 0];
      let sum = 0;
      let valid = 0;
      rs.forEach((r) => {
        if (r.value != null && r.value >= 1 && r.value <= 5) {
          dist[r.value - 1]++;
          sum += r.value;
          valid++;
        }
      });
      // 평균 분모를 분포와 동일한 '유효(1~5) 응답 수'로 맞춘다 — null·범위밖 값이
      // 섞여도 평균이 분포와 어긋나거나 0쪽으로 오염되지 않는다(엣지 2-B).
      const avg = valid > 0 ? sum / valid : 0;
      return { ...base, average: Math.round(avg * 100) / 100, distribution: dist };
    }
    if (q.type === "choice") {
      const opts = parseOptions(q.options);
      const counts = opts.map((_, i) => rs.filter((r) => r.value === i).length);
      return { ...base, choiceCounts: counts };
    }
    // 주관식 — 응답 본문을 익명으로 나열
    const texts = rs
      .map((r) => r.textValue)
      .filter((t): t is string => !!t && t.trim().length > 0);
    return { ...base, textAnswers: texts };
  });

  return { questions: byQuestion, respondentCount };
}

// ─── Admin (역할 관리) ────────────────────────────────────

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      university: users.university,
      department: users.department,
      profileCompleted: users.profileCompleted,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function setUserRole(userId: number, role: "user" | "professor" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function countUsersByRole(role: "user" | "professor" | "admin") {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ cnt: count() }).from(users).where(eq(users.role, role));
  return r[0]?.cnt ?? 0;
}

// ─── Reports (신고) ──────────────────────────────────────
export async function createReport(data: {
  reporterId: number;
  targetType: "post" | "comment" | "user";
  targetId: number;
  reason: "abuse" | "spam" | "privacy" | "etc";
  detail?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(reports).values({
      reporterId: data.reporterId,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      detail: data.detail ?? null,
    });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("이미 신고한 대상이에요.");
    }
    throw error;
  }
}

export async function getOpenReports() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reports)
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt));
}

export async function resolveReport(reportId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, reportId));
}

// ─── Notifications (인앱 알림) ───────────────────────────
export async function createNotification(data: {
  userId: number;
  type: string;
  title: string;
  body?: string | null;
  linkPath?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values({
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body ?? null,
    linkPath: data.linkPath ?? null,
  });
}

export async function getNotifications(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const r = await db
    .select({ cnt: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return r[0]?.cnt ?? 0;
}

export async function markNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

// ─── Team Notes (팀 메모 보드) ───────────────────────────
export async function getTeamNotes(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: teamNotes.id,
      content: teamNotes.content,
      createdAt: teamNotes.createdAt,
      userId: teamNotes.userId,
      authorName: users.name,
    })
    .from(teamNotes)
    .innerJoin(users, eq(users.id, teamNotes.userId))
    .where(eq(teamNotes.teamId, teamId))
    .orderBy(desc(teamNotes.createdAt));
}

export async function createTeamNote(data: { teamId: number; userId: number; content: string }) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.insert(teamNotes).values(data);
  return { id: r[0].insertId };
}

export async function getTeamNoteById(noteId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamNotes).where(eq(teamNotes.id, noteId)).limit(1);
  return rows.length > 0 ? rows[0] : null;
}

export async function deleteTeamNote(noteId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(teamNotes).where(eq(teamNotes.id, noteId));
}

// ─── Demo Seed (교수 시연용 데모 데이터) ─────────────────
// 데모 학생(openId 'google:demo-N')·예시 수업(courseCode 'DEMO-SW')·매칭·팀·설문·공지·게시판을 일괄 생성.
// 운영자(레이)가 호출하면 자기 수업으로 클레임된다. 중복 방지: DEMO-SW가 이미 있으면 스킵.
export async function seedDemoData(professorUserId: number) {
  const db = await getDb();
  if (!db) return { skipped: true, reason: "DB 연결 없음" };
  const existing = await db
    .select()
    .from(courses)
    .where(eq(courses.courseCode, "DEMO-SW"))
    .limit(1);
  if (existing.length > 0) {
    return { skipped: true, reason: "이미 데모 데이터가 있어요. 초기화 후 다시 시도하세요.", courseId: existing[0].id };
  }

  const UNIV = "데모대학교";
  const SEM = "2026-1";
  const day = 86400000;
  const demos = [
    { openId: "google:demo-1", name: "김민준", dept: "컴퓨터공학과", year: 3, skills: ["React", "Node.js", "발표"] },
    { openId: "google:demo-2", name: "이서연", dept: "디자인학과", year: 3, skills: ["Figma", "UI/UX", "기획"] },
    { openId: "google:demo-3", name: "박지호", dept: "경영학과", year: 2, skills: ["기획", "PPT", "발표"] },
    { openId: "google:demo-4", name: "최유진", dept: "컴퓨터공학과", year: 4, skills: ["Python", "데이터분석", "ML"] },
    { openId: "google:demo-5", name: "정현우", dept: "전자공학과", year: 3, skills: ["C++", "임베디드", "하드웨어"] },
    { openId: "google:demo-6", name: "강수아", dept: "경영학과", year: 2, skills: ["마케팅", "기획", "영어"] },
  ];
  const ids: number[] = [];
  for (const d of demos) {
    await upsertUser({ openId: d.openId, name: d.name, loginMethod: "demo", lastSignedIn: new Date() });
    const u = await getUserByOpenId(d.openId);
    if (!u) continue;
    await updateUserProfile(u.id, {
      university: UNIV,
      department: d.dept,
      year: d.year,
      skillTags: d.skills,
      kakaoOpenChatUrl: "https://open.kakao.com/o/demo",
      name: d.name,
    });
    ids.push(u.id);
  }

  const c = await createCourse({
    name: "소프트웨어 캡스톤 디자인",
    professor: "데모 교수",
    credits: 3,
    hasTeamProject: true,
    university: UNIV,
    courseCode: "DEMO-SW",
  });
  const courseId = c!.id;
  await claimCourse(courseId, professorUserId);
  for (const id of ids) await enrollCourse(id, courseId, SEM);

  // 팀플 팀(1·2·3번 3인) — 매칭 수락으로 결성
  const m1 = await createMatchRequest(ids[0], ids[1], courseId, "project");
  const team = await acceptMatch(m1!.id, ids[1]);
  const teamId = team!.teamId;
  const m2 = await createMatchRequest(ids[0], ids[2], courseId, "project");
  await acceptMatch(m2!.id, ids[2]);

  // 팀 일정·메모·산출물
  await createTeamEvent({ teamId, createdBy: ids[0], title: "기획안 초안 작성", dueAt: new Date(Date.now() + 3 * day), assigneeId: ids[0] });
  await createTeamEvent({ teamId, createdBy: ids[0], title: "중간 발표 준비", dueAt: new Date(Date.now() + 10 * day), assigneeId: ids[1] });
  await createTeamNote({ teamId, userId: ids[0], content: "역할 분담 — 김민준: 백엔드 / 이서연: 디자인 / 박지호: 기획·발표" });
  const ms = await createMilestone({ courseId, createdBy: professorUserId, title: "1차 기획안", description: "팀별 기획안을 링크로 제출하세요.", dueAt: new Date(Date.now() + 7 * day) });
  await submitDeliverable({ milestoneId: ms!.id, teamId, submittedBy: ids[0], url: "https://docs.google.com/document/demo", note: "1차 기획안 초안입니다." });

  // 설문 + 응답 4명
  const sv = await createSurvey({
    courseId,
    professorId: professorUserId,
    title: "중간 강의 만족도 조사",
    questions: [
      { type: "scale", text: "강의 내용에 만족하시나요?" },
      { type: "scale", text: "강의 진도는 적절한가요?" },
      { type: "choice", text: "가장 어려운 점은?", options: ["내용 난이도", "과제량", "팀플", "기타"] },
      { type: "text", text: "바라는 점을 자유롭게 적어주세요." },
    ],
  });
  const qs = await getSurveyQuestions(sv!.id);
  const texts = ["과제가 조금 많아요", "팀플 일정 맞추기가 어려워요", "전반적으로 만족합니다", "발표가 부담돼요"];
  for (let i = 0; i < 4; i++) {
    await submitSurveyResponses({
      surveyId: sv!.id,
      userId: ids[i],
      answers: [
        { questionId: qs[0].id, value: 4 + (i % 2) },
        { questionId: qs[1].id, value: 3 + (i % 3) },
        { questionId: qs[2].id, value: i % 4 },
        { questionId: qs[3].id, textValue: texts[i] },
      ],
    });
  }

  await createAnnouncement({ courseId, professorId: professorUserId, title: "중간고사 안내", content: "중간고사는 10주차에 진행됩니다. 팀별 1차 기획안 제출도 잊지 마세요!" });
  await createPost({ courseId, userId: ids[3], title: "알고리즘 스터디 모집해요", content: "주 1회 알고리즘 스터디 같이 하실 분 환영합니다!", category: "스터디" });
  await createPost({ courseId, userId: ids[4], title: "지난 학기 자료 공유", content: "도움 되시길 바랍니다.", category: "후기" });

  // 미수락 매칭(받은 요청 체험) — 4번이 5번에게 스터디 요청
  await createMatchRequest(ids[3], ids[4], courseId, "study");

  return { skipped: false, courseId, teamId, students: ids.length };
}

// 데모 데이터 일괄 삭제 — 재시드/정리용.
export async function clearDemoData() {
  const db = await getDb();
  if (!db) return { cleared: false };
  const cRows = await db.select().from(courses).where(eq(courses.courseCode, "DEMO-SW")).limit(1);
  const courseId = cRows[0]?.id;
  const demoUsers = await db.select({ id: users.id }).from(users).where(like(users.openId, "google:demo-%"));
  const uids = demoUsers.map((u) => u.id);

  await db.transaction(async (tx) => {
    if (courseId) {
      const teamRows = await tx.select({ id: teams.id }).from(teams).where(eq(teams.courseId, courseId));
      const tids = teamRows.map((t) => t.id);
      if (tids.length) {
        await tx.delete(teamNotes).where(inArray(teamNotes.teamId, tids));
        await tx.delete(teamEvents).where(inArray(teamEvents.teamId, tids));
        await tx.delete(teamMembers).where(inArray(teamMembers.teamId, tids));
        await tx.delete(teamSubmissions).where(inArray(teamSubmissions.teamId, tids));
        await tx.delete(evaluations).where(inArray(evaluations.teamId, tids));
        await tx.delete(teams).where(inArray(teams.id, tids));
      }
      const msRows = await tx.select({ id: courseMilestones.id }).from(courseMilestones).where(eq(courseMilestones.courseId, courseId));
      const msids = msRows.map((m) => m.id);
      if (msids.length) {
        await tx.delete(teamSubmissions).where(inArray(teamSubmissions.milestoneId, msids));
        await tx.delete(courseMilestones).where(inArray(courseMilestones.id, msids));
      }
      const svRows = await tx.select({ id: surveys.id }).from(surveys).where(eq(surveys.courseId, courseId));
      const svids = svRows.map((s) => s.id);
      if (svids.length) {
        await tx.delete(surveyResponses).where(inArray(surveyResponses.surveyId, svids));
        await tx.delete(surveyQuestions).where(inArray(surveyQuestions.surveyId, svids));
        await tx.delete(surveys).where(inArray(surveys.id, svids));
      }
      const postRows = await tx.select({ id: posts.id }).from(posts).where(eq(posts.courseId, courseId));
      const pids = postRows.map((p) => p.id);
      if (pids.length) {
        await tx.delete(postComments).where(inArray(postComments.postId, pids));
        await tx.delete(posts).where(inArray(posts.id, pids));
      }
      await tx.delete(courseAnnouncements).where(eq(courseAnnouncements.courseId, courseId));
      await tx.delete(teamMatches).where(eq(teamMatches.courseId, courseId));
      await tx.delete(userCourses).where(eq(userCourses.courseId, courseId));
      await tx.delete(courses).where(eq(courses.id, courseId));
    }
    if (uids.length) {
      await tx.delete(notifications).where(inArray(notifications.userId, uids));
      await tx.delete(badges).where(inArray(badges.userId, uids));
      await tx.delete(users).where(inArray(users.id, uids));
    }
  });
  return { cleared: true, courseId: courseId ?? null, students: uids.length };
}

// QA용: 특정 유저(실제 친구 계정 등)를 데모 수업에 등록하고, 데모 학생들이
// 그 유저에게 매칭 요청(팀플·스터디·멘토멘티)을 보낸 상태로 만든다.
// 로그인하면 받은 요청 수락·커넥트·설문·게시판을 바로 체험할 수 있다.
export async function assignQaToUser(userId: number) {
  const db = await getDb();
  if (!db) return { ok: false, reason: "DB 연결 없음" };
  const cRows = await db.select().from(courses).where(eq(courses.courseCode, "DEMO-SW")).limit(1);
  if (cRows.length === 0) {
    return { ok: false, reason: "데모 수업이 없어요. 먼저 데모 데이터를 생성하세요." };
  }
  const courseId = cRows[0].id;
  const u = await getUserById(userId);
  if (!u) return { ok: false, reason: "대상 유저를 찾을 수 없어요." };
  // 매칭이 되려면 프로필 완성이 필요 — 미완성이면 최소값으로 채운다.
  if (!u.profileCompleted) {
    await updateUserProfile(userId, {
      university: u.university || "백석대학교",
      department: u.department || "컴퓨터공학과",
      year: u.year || 3,
    });
  }
  await enrollCourse(userId, courseId, "2026-1");

  const demoUsers = await db
    .select({ id: users.id, openId: users.openId })
    .from(users)
    .where(like(users.openId, "google:demo-%"));
  const byOpen = (n: number) => demoUsers.find((d) => d.openId === `google:demo-${n}`)?.id;
  const requests: string[] = [];
  const tryReq = async (
    fromN: number,
    type: "project" | "study" | "mentoring",
    role: "mentor" | "mentee" | undefined,
    label: string
  ) => {
    const from = byOpen(fromN);
    if (!from) return;
    try {
      await createMatchRequest(from, userId, courseId, type, role);
      requests.push(label);
    } catch {
      /* 이미 있으면 무시 */
    }
  };
  await tryReq(4, "project", undefined, "팀플");
  await tryReq(5, "study", undefined, "스터디");
  await tryReq(6, "mentoring", "mentor", "멘토멘티");
  return { ok: true, courseId, requests, profileFilled: !u.profileCompleted };
}

// QA용: 특정 수업을 만들고 지정한 유저들을 한 팀(팀플)으로 묶는다.
// 친구들끼리 같은 팀에서 팀 활동(일정·메모 등)을 바로 테스트하게 한다.
export async function setupClassTeam(data: {
  courseName: string;
  courseCode: string;
  university: string;
  userIds: number[];
}) {
  const db = await getDb();
  if (!db) return { ok: false, reason: "DB 연결 없음" };
  // 수업 — 있으면 재사용, 없으면 생성
  let courseId: number;
  const ex = await db.select().from(courses).where(eq(courses.courseCode, data.courseCode)).limit(1);
  if (ex.length > 0) {
    courseId = ex[0].id;
  } else {
    const c = await createCourse({
      name: data.courseName,
      professor: "데모 교수",
      credits: 3,
      hasTeamProject: true,
      university: data.university,
      courseCode: data.courseCode,
    });
    courseId = c!.id;
  }
  // 수강 등록 (+ 프로필 미완성이면 최소값 채움)
  for (const uid of data.userIds) {
    const u = await getUserById(uid);
    if (!u) continue;
    if (!u.profileCompleted) {
      await updateUserProfile(uid, {
        university: u.university || data.university,
        department: u.department || "게임학과",
        year: u.year || 3,
      });
    }
    await enrollCourse(uid, courseId, "2026-1");
  }
  // 한 팀(팀플, 최대 6명)으로 묶기 — ids[0] 중심으로 나머지 합류
  const ids = data.userIds;
  let teamId: number | undefined;
  if (ids.length >= 2) {
    try {
      const m = await createMatchRequest(ids[0], ids[1], courseId, "project");
      const t = await acceptMatch(m!.id, ids[1]);
      teamId = t!.teamId;
    } catch {
      /* 이미 묶였을 수 있음 */
    }
    for (let i = 2; i < ids.length && i < 6; i++) {
      try {
        const mi = await createMatchRequest(ids[0], ids[i], courseId, "project");
        await acceptMatch(mi!.id, ids[i]);
      } catch {
        /* 이미 멤버 등은 무시 */
      }
    }
  }
  // 팀에 일정·메모 시드(팀 활동 체험용)
  if (teamId) {
    const day = 86400000;
    try {
      await createTeamEvent({
        teamId,
        createdBy: ids[0],
        title: "게임 컨셉 기획안",
        dueAt: new Date(Date.now() + 5 * day),
        assigneeId: ids[0],
      });
    } catch {}
    try {
      await createTeamNote({
        teamId,
        userId: ids[0],
        content: "역할 분담 — 기획 / 아트 / 프로그래밍을 정해봅시다!",
      });
    } catch {}
  }
  return { ok: true, courseId, teamId, members: Math.min(ids.length, 6) };
}

// 운영자용: 전체 팀 현황 — 수업·타입·상태·멤버·일정 진척을 한눈에.
export async function getAllTeamsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const teamRows = await db
    .select({
      id: teams.id,
      teamType: teams.teamType,
      status: teams.status,
      evaluationStatus: teams.evaluationStatus,
      courseName: courses.name,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .innerJoin(courses, eq(teams.courseId, courses.id))
    .orderBy(desc(teams.createdAt));
  if (teamRows.length === 0) return [];
  const tids = teamRows.map((t) => t.id);
  const mem = await db
    .select({ teamId: teamMembers.teamId, role: teamMembers.role, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(inArray(teamMembers.teamId, tids));
  const evs = await db
    .select({ teamId: teamEvents.teamId, isDone: teamEvents.isDone })
    .from(teamEvents)
    .where(inArray(teamEvents.teamId, tids));
  return teamRows.map((t) => {
    const events = evs.filter((e) => e.teamId === t.id);
    return {
      id: t.id,
      courseName: t.courseName,
      teamType: t.teamType,
      status: t.status,
      evaluationStatus: t.evaluationStatus,
      members: mem.filter((m) => m.teamId === t.id).map((m) => ({ name: m.name, role: m.role })),
      eventsDone: events.filter((e) => e.isDone).length,
      eventsTotal: events.length,
    };
  });
}

// 운영자용: 한 팀의 상세 — 멤버(오픈채팅 포함)·일정·메모·산출물 제출.
export async function getTeamDetailForAdmin(teamId: number) {
  const db = await getDb();
  if (!db) return null;
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      department: users.department,
      year: users.year,
      kakaoOpenChatUrl: users.kakaoOpenChatUrl,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId));
  const memberNameById = new Map(members.map((m) => [m.id, m.name]));
  // events는 members(assigneeName 매핑)에만 의존하고 notes·submissions는 서로 독립이라
  // 세 쿼리를 한 번에 병렬로 조회한다.
  const [evRows, notes, submissions] = await Promise.all([
    db.select().from(teamEvents).where(eq(teamEvents.teamId, teamId)).orderBy(teamEvents.dueAt),
    db
      .select({
        id: teamNotes.id,
        content: teamNotes.content,
        createdAt: teamNotes.createdAt,
        authorName: users.name,
      })
      .from(teamNotes)
      .innerJoin(users, eq(users.id, teamNotes.userId))
      .where(eq(teamNotes.teamId, teamId))
      .orderBy(desc(teamNotes.createdAt)),
    db
      .select({
        id: teamSubmissions.id,
        url: teamSubmissions.url,
        note: teamSubmissions.note,
        reviewedAt: teamSubmissions.reviewedAt,
        submittedAt: teamSubmissions.submittedAt,
        milestoneTitle: courseMilestones.title,
        submitterName: users.name,
      })
      .from(teamSubmissions)
      .innerJoin(courseMilestones, eq(courseMilestones.id, teamSubmissions.milestoneId))
      .innerJoin(users, eq(users.id, teamSubmissions.submittedBy))
      .where(eq(teamSubmissions.teamId, teamId))
      .orderBy(desc(teamSubmissions.submittedAt)),
  ]);
  const events = evRows.map((e) => ({
    id: e.id,
    title: e.title,
    dueAt: e.dueAt,
    isDone: e.isDone,
    assigneeName: e.assigneeId ? (memberNameById.get(e.assigneeId) ?? null) : null,
  }));
  return { members, events, notes, submissions };
}

// ─── Recruitments (모집 공고) — 게시판식 모집을 구조화 + 지원으로 통합 ─────
// desiredSkills(text JSON)를 안전하게 배열로 — 비정상 행이 목록 전체를 깨뜨리지 않게.
function parseRecruitmentSkills(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function createRecruitment(
  authorId: number,
  data: {
    courseId: number;
    matchType: MatchType;
    authorRole?: MentoringRole;
    title: string;
    description?: string;
    desiredSkills?: string[];
    neededCount?: number;
    teamId?: number;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const enrolled = await isUserEnrolled(authorId, data.courseId);
  if (!enrolled) throw new Error("해당 수업에 등록한 뒤 모집할 수 있어요.");
  const u = await getUserById(authorId);
  if (!u?.profileCompleted) throw new Error("프로필을 완성한 후 모집할 수 있어요.");
  // 팀 연결 시 — 작성자가 속한 '이 수업의' 팀만 허용(데이터 무결성).
  if (data.teamId != null) {
    const owned = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(
        and(
          eq(teamMembers.teamId, data.teamId),
          eq(teamMembers.userId, authorId),
          eq(teams.courseId, data.courseId)
        )
      )
      .limit(1);
    if (owned.length === 0)
      throw new Error("내가 속한 이 수업의 팀만 모집에 연결할 수 있어요.");
  }
  const role: MentoringRole | null =
    data.matchType === "mentoring" ? (data.authorRole ?? "mentee") : null;
  const r = await db.insert(recruitments).values({
    courseId: data.courseId,
    authorId,
    teamId: data.teamId ?? null,
    matchType: data.matchType,
    authorRole: role,
    title: data.title,
    description: data.description ?? null,
    desiredSkills: data.desiredSkills?.length ? JSON.stringify(data.desiredSkills) : null,
    neededCount: data.neededCount ?? 1,
    status: "open",
  });
  return { id: r[0].insertId };
}

export async function listRecruitments(courseId: number, openOnly = true, viewerId?: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      recruitment: recruitments,
      author: {
        id: users.id,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
      },
    })
    .from(recruitments)
    .innerJoin(users, eq(users.id, recruitments.authorId))
    .where(
      openOnly
        ? and(eq(recruitments.courseId, courseId), eq(recruitments.status, "open"))
        : eq(recruitments.courseId, courseId)
    )
    .orderBy(desc(recruitments.createdAt));
  if (rows.length === 0) return [];
  // 각 공고의 대기 지원자 수 + 내가 이미 지원했는지
  const ids = rows.map((r) => r.recruitment.id);
  const apps = await db
    .select({
      recruitmentId: teamMatches.recruitmentId,
      requesterId: teamMatches.requesterId,
    })
    .from(teamMatches)
    .where(and(inArray(teamMatches.recruitmentId, ids), eq(teamMatches.status, "pending")));
  const countByRec = new Map<number, number>();
  const appliedByMe = new Set<number>();
  for (const a of apps) {
    if (a.recruitmentId != null) {
      countByRec.set(a.recruitmentId, (countByRec.get(a.recruitmentId) ?? 0) + 1);
      if (viewerId && a.requesterId === viewerId) appliedByMe.add(a.recruitmentId);
    }
  }
  return rows.map((r) => ({
    ...r.recruitment,
    desiredSkills: parseRecruitmentSkills(r.recruitment.desiredSkills),
    author: r.author,
    pendingApplicants: countByRec.get(r.recruitment.id) ?? 0,
    hasApplied: appliedByMe.has(r.recruitment.id),
  }));
}

export async function getRecruitmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(recruitments).where(eq(recruitments.id, id)).limit(1);
  return rows[0] ?? null;
}

// 지원 = teamMatches 재사용(지원자 → 모집자), message·recruitmentId 연결.
export async function applyToRecruitment(
  applicantId: number,
  recruitmentId: number,
  message?: string
) {
  const rec = await getRecruitmentById(recruitmentId);
  if (!rec) throw new Error("모집 공고를 찾을 수 없어요.");
  if (rec.status !== "open") throw new Error("이미 마감된 모집이에요.");
  if (rec.authorId === applicantId) throw new Error("내가 올린 모집에는 지원할 수 없어요.");
  // 멘토멘티는 지원자 역할 = 모집자 역할의 반대.
  const applicantRole: MentoringRole | undefined =
    rec.matchType === "mentoring"
      ? rec.authorRole === "mentor"
        ? "mentee"
        : "mentor"
      : undefined;
  return createMatchRequest(applicantId, rec.authorId, rec.courseId, rec.matchType, applicantRole, {
    message,
    recruitmentId,
  });
}

export async function getRecruitmentApplicants(recruitmentId: number, authorId: number) {
  const db = await getDb();
  if (!db) return [];
  const rec = await getRecruitmentById(recruitmentId);
  if (!rec || rec.authorId !== authorId) throw new Error("권한이 없어요.");
  return db
    .select({
      match: teamMatches,
      applicant: {
        id: users.id,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
      },
    })
    .from(teamMatches)
    .innerJoin(users, eq(users.id, teamMatches.requesterId))
    .where(eq(teamMatches.recruitmentId, recruitmentId))
    .orderBy(desc(teamMatches.createdAt));
}

export async function closeRecruitment(recruitmentId: number, authorId: number) {
  const db = await getDb();
  if (!db) return null;
  const rec = await getRecruitmentById(recruitmentId);
  if (!rec || rec.authorId !== authorId) throw new Error("권한이 없어요.");
  await db
    .update(recruitments)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(recruitments.id, recruitmentId));
  return { ok: true };
}

export async function getMyRecruitments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(recruitments)
    .where(eq(recruitments.authorId, userId))
    .orderBy(desc(recruitments.createdAt));
  return rows.map((r) => ({ ...r, desiredSkills: parseRecruitmentSkills(r.desiredSkills) }));
}

// 모집 공고 경유 지원이 수락돼 팀 정원이 다 차면 공고를 자동 마감(지원자 dead-end 방지).
export async function maybeCloseRecruitmentIfFull(recruitmentId: number, teamId: number) {
  const db = await getDb();
  if (!db) return;
  const rec = await getRecruitmentById(recruitmentId);
  if (!rec || rec.status !== "open") return;
  const members = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  const maxSize = TEAM_SIZE_LIMITS[rec.matchType as MatchType];
  if (members.length >= maxSize) {
    await db
      .update(recruitments)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(recruitments.id, recruitmentId));
  }
}

// ─── Consents ────────────────────────────────────────────

export async function recordConsent(
  userId: number,
  consentType: "signup" | "evaluation",
  consentVersion: string
) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(consents).values({ userId, consentType, consentVersion });
  } catch (error: any) {
    // 이미 동의한 버전이면 멱등 처리(중복 무시)
    if (error.code === "ER_DUP_ENTRY") return;
    throw error;
  }
}

export async function hasConsent(
  userId: number,
  consentType: "signup" | "evaluation",
  consentVersion: string
) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(consents)
    .where(
      and(
        eq(consents.userId, userId),
        eq(consents.consentType, consentType),
        eq(consents.consentVersion, consentVersion)
      )
    )
    .limit(1);
  return result.length > 0;
}

// ─── Dashboard ───────────────────────────────────────────

export async function getDashboardData(userId: number) {
  const db = await getDb();
  if (!db) return { courses: [], pendingMatches: 0, activeTeams: 0 };

  const userCoursesData = await getUserCourses(userId);
  const pendingMatches = await getPendingMatchCount(userId);

  // Count active teams
  const memberRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  let activeTeams = 0;
  if (memberRows.length > 0) {
    const teamIds = memberRows.map((r) => r.teamId);
    const activeRows = await db
      .select({ cnt: count() })
      .from(teams)
      .where(and(inArray(teams.id, teamIds), eq(teams.status, "active")));
    activeTeams = activeRows[0]?.cnt ?? 0;
  }

  return {
    courses: userCoursesData,
    pendingMatches,
    activeTeams,
  };
}
