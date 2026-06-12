import { eq, and, or, inArray, desc, count, sql, like } from "drizzle-orm";
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

  let conditions = [eq(posts.courseId, courseId)];
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
  const rows = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
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
export async function getPostComments(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: postComments.id,
      content: postComments.content,
      createdAt: postComments.createdAt,
    })
    .from(postComments)
    .where(eq(postComments.postId, postId))
    .orderBy(postComments.createdAt);
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

// ─── Matching ────────────────────────────────────────────

export async function createMatchRequest(
  requesterId: number,
  receiverId: number,
  courseId: number,
  matchType: MatchType = "project",
  requesterRole?: MentoringRole
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
    });
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
    const memberRows = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, targetTeam.id));
    if (memberRows.length >= maxSize) {
      throw new Error(`정원(${maxSize}명)이 가득 찼어요.`);
    }
    // 그룹에 없는 쪽이 합류한다
    const joiningUserId = requesterTeam ? match.receiverId : match.requesterId;
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
    await db.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
    try {
      await db
        .insert(teamMembers)
        .values({ teamId: targetTeam.id, userId: joiningUserId, role: joinRole });
    } catch (error: any) {
      if (error.code !== "ER_DUP_ENTRY") throw error; // 이미 멤버면 무시
    }
    return { teamId: targetTeam.id };
  }

  // 둘 다 그룹이 없으면 새 2인 그룹 생성 (기존 동작)
  try {
    await db.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
    const teamResult = await db.insert(teams).values({
      matchId,
      courseId: match.courseId,
      teamType: matchType,
      status: "active",
      evaluationStatus: "pending",
    });
    const teamId = teamResult[0].insertId;
    await db.insert(teamMembers).values([
      { teamId, userId: match.requesterId, role: roleOf(match.requesterId) },
      { teamId, userId: match.receiverId, role: roleOf(match.receiverId) },
    ]);
    return { teamId };
  } catch (error: any) {
    // race condition: 동시에 다른 요청이 팀을 만든 경우
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

  try {
    // Atomic update: only update if status is still 'active'
    // This prevents race condition where multiple members click complete simultaneously
    const result = await db
      .update(teams)
      .set({ status: "completed", evaluationStatus: isProject ? "in_progress" : "done" })
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

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  await db
    .update(teamEvents)
    .set({ assigneeId: null })
    .where(and(eq(teamEvents.teamId, teamId), eq(teamEvents.assigneeId, userId)));

  if (memberRows.length <= 1) {
    await db.delete(teamEvents).where(eq(teamEvents.teamId, teamId));
    await db.delete(teams).where(eq(teams.id, teamId));
    return { disbanded: true };
  }
  return { disbanded: false };
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

  // Insert all evaluations first
  try {
    for (const evalItem of data.evaluations) {
      await db.insert(evaluations).values({
        teamId: data.teamId,
        evaluatorId: data.evaluatorId,
        ...evalItem,
      });
    }
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("이미 평가를 완료했습니다.");
    }
    throw error;
  }

  // Mark evaluator as evaluated AFTER all evals are inserted
  await db
    .update(teamMembers)
    .set({ hasEvaluated: true })
    .where(
      and(eq(teamMembers.teamId, data.teamId), eq(teamMembers.userId, data.evaluatorId))
    );

  // Check if all members have evaluated
  const allMembers = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.teamId, data.teamId));

  const allEvaluated = allMembers.every((m) => m.hasEvaluated);

  if (allEvaluated) {
    // Check if badges already calculated for this team
    const teamRow = await db.select().from(teams).where(eq(teams.id, data.teamId)).limit(1);
    if (teamRow.length > 0 && teamRow[0].evaluationStatus !== "done") {
      await calculateBadges(data.teamId);
      await db
        .update(teams)
        .set({ evaluationStatus: "done" })
        .where(eq(teams.id, data.teamId));
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
  await db.update(courses).set({ professorId }).where(eq(courses.id, courseId));
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
      rs.forEach((r) => {
        if (r.value != null && r.value >= 1 && r.value <= 5) dist[r.value - 1]++;
      });
      const avg =
        rs.length > 0 ? rs.reduce((s, r) => s + (r.value ?? 0), 0) / rs.length : 0;
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
