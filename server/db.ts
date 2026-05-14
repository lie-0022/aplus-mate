import { eq, and, or, inArray, desc, count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  courses,
  userCourses,
  posts,
  teamMatches,
  teams,
  teamMembers,
  evaluations,
  badges,
  type Course,
  type InsertCourse,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
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

  // Mark profile as completed if all required fields are set
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user.length > 0) {
    const u = user[0];
    const completed =
      !!u.university && !!u.department && !!u.year && !!u.kakaoOpenChatUrl && !!u.skillTags;
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
    conditions.push(
      or(
        eq(courses.name, query),
        eq(courses.courseCode, query)
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
        id: users.id,
        name: users.name,
        department: users.department,
        year: users.year,
        skillTags: users.skillTags,
        university: users.university,
      },
      userCourse: userCourses,
    })
    .from(userCourses)
    .innerJoin(users, eq(userCourses.userId, users.id))
    .where(and(...conditions))
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
        id: users.id,
        name: users.name,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt));
}

// ─── Matching ────────────────────────────────────────────

export async function createMatchRequest(requesterId: number, receiverId: number, courseId: number) {
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

  // Check for existing pending request between these users for this course
  const pendingExisting = await db
    .select()
    .from(teamMatches)
    .where(
      and(
        eq(teamMatches.courseId, courseId),
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

  // Check if already in a team together for this course
  const existingTeam = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, requesterId));

  if (existingTeam.length > 0) {
    const teamIds = existingTeam.map((t) => t.teamId);
    const sharedTeam = await db
      .select()
      .from(teamMembers)
      .where(and(inArray(teamMembers.teamId, teamIds), eq(teamMembers.userId, receiverId)))
      .limit(1);
    if (sharedTeam.length > 0) {
      throw new Error("이미 해당 수업에서 매칭된 팀이 있습니다.");
    }
  }

  try {
    const result = await db.insert(teamMatches).values({
      requesterId,
      receiverId,
      courseId,
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
        id: users.id,
        name: users.name,
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

export async function getPendingMatchCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ cnt: count() })
    .from(teamMatches)
    .where(and(eq(teamMatches.receiverId, userId), eq(teamMatches.status, "pending")));
  return result[0]?.cnt ?? 0;
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

  // Check if team already exists for this match (idempotency)
  const existingTeam = await db
    .select()
    .from(teams)
    .where(eq(teams.matchId, matchId))
    .limit(1);
  if (existingTeam.length > 0) {
    // Team already created, just update match status if needed
    if (match.status === "pending") {
      await db.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));
    }
    return { teamId: existingTeam[0].id };
  }

  try {
    // Update match status
    await db.update(teamMatches).set({ status: "accepted" }).where(eq(teamMatches.id, matchId));

    // Create team (unique constraint on matchId prevents duplicates)
    const teamResult = await db.insert(teams).values({
      matchId,
      courseId: match.courseId,
      status: "active",
      evaluationStatus: "pending",
    });
    const teamId = teamResult[0].insertId;

    // Add both members (unique constraint on teamId+userId prevents duplicates)
    await db.insert(teamMembers).values([
      { teamId, userId: match.requesterId },
      { teamId, userId: match.receiverId },
    ]);

    return { teamId };
  } catch (error: any) {
    // Handle unique constraint violations gracefully
    if (error.code === "ER_DUP_ENTRY") {
      // Likely race condition: another request already created the team
      const existingTeam = await db
        .select()
        .from(teams)
        .where(eq(teams.matchId, matchId))
        .limit(1);
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

  try {
    // Atomic update: only update if status is still 'active'
    // This prevents race condition where multiple members click complete simultaneously
    const result = await db
      .update(teams)
      .set({ status: "completed", evaluationStatus: "in_progress" })
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
