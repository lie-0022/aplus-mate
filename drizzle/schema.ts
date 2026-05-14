import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  uniqueIndex,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // A+ Mate profile fields
  university: varchar("university", { length: 100 }),
  department: varchar("department", { length: 100 }),
  year: int("year"), // 1~4
  skillTags: json("skillTags").$type<string[]>().default([]),
  kakaoOpenChatUrl: varchar("kakaoOpenChatUrl", { length: 500 }),
  profileCompleted: boolean("profileCompleted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Courses ─────────────────────────────────────────────
export const courses = mysqlTable(
  "courses",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    professor: varchar("professor", { length: 100 }).notNull(),
    credits: int("credits").notNull(),
    hasTeamProject: boolean("hasTeamProject").default(false).notNull(),
    university: varchar("university", { length: 100 }).notNull(),
    courseCode: varchar("courseCode", { length: 20 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_course").on(table.name, table.professor, table.university),
  ]
);

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

// ─── User Courses (수강 연결) ────────────────────────────
export const userCourses = mysqlTable(
  "user_courses",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    courseId: int("courseId").notNull(),
    semester: varchar("semester", { length: 10 }).notNull(), // e.g. "2026-1"
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_user_course").on(table.userId, table.courseId, table.semester),
  ]
);

export type UserCourse = typeof userCourses.$inferSelect;

// ─── Posts (수업 정보 게시판) ─────────────────────────────
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  content: text("content").notNull(),
  category: mysqlEnum("category", ["족보", "과제팁", "후기", "스터디"]).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;

// ─── Team Matches (매칭 요청) ────────────────────────────
// Unique constraint: prevent duplicate pending/accepted requests between same pair in same course
// Allows: A→B pending, then A→B accepted (different status)
// Prevents: A→B pending + A→B pending (same pair, same course, same status)
export const teamMatches = mysqlTable(
  "team_matches",
  {
    id: int("id").autoincrement().primaryKey(),
    requesterId: int("requesterId").notNull(),
    receiverId: int("receiverId").notNull(),
    courseId: int("courseId").notNull(),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // Prevent duplicate pending/accepted requests between same pair for same course
    // (allows rejected to coexist with new pending)
    uniqueIndex("uniq_team_match_pending").on(
      table.requesterId,
      table.receiverId,
      table.courseId,
      table.status
    ),
  ]
);

export type TeamMatch = typeof teamMatches.$inferSelect;

// ─── Teams ───────────────────────────────────────────────
export const teams = mysqlTable(
  "teams",
  {
    id: int("id").autoincrement().primaryKey(),
    matchId: int("matchId"),
    courseId: int("courseId").notNull(),
    name: varchar("name", { length: 100 }),
    status: mysqlEnum("status", ["active", "completed"]).default("active").notNull(),
    evaluationStatus: mysqlEnum("evaluationStatus", ["pending", "in_progress", "done"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // Prevent duplicate teams per match (one match = one team)
    uniqueIndex("uniq_team_per_match").on(table.matchId),
  ]
);

export type Team = typeof teams.$inferSelect;

// ─── Team Members ────────────────────────────────────────
export const teamMembers = mysqlTable(
  "team_members",
  {
    id: int("id").autoincrement().primaryKey(),
    teamId: int("teamId").notNull(),
    userId: int("userId").notNull(),
    hasEvaluated: boolean("hasEvaluated").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // Prevent duplicate team memberships (one user = one slot per team)
    uniqueIndex("uniq_team_member").on(table.teamId, table.userId),
  ]
);

export type TeamMember = typeof teamMembers.$inferSelect;

// ─── Evaluations (블라인드 평가) ─────────────────────────
export const evaluations = mysqlTable(
  "evaluations",
  {
    id: int("id").autoincrement().primaryKey(),
    teamId: int("teamId").notNull(),
    evaluatorId: int("evaluatorId").notNull(),
    evaluateeId: int("evaluateeId").notNull(),
    promiseScore: int("promiseScore").notNull(), // 1~5
    ideaScore: int("ideaScore").notNull(), // 1~5
    deadlineScore: int("deadlineScore").notNull(), // 1~5
    grade: mysqlEnum("grade", ["A+", "A", "B+", "B", "C+"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // Prevent duplicate evaluations (one evaluator → one evaluatee per team)
    uniqueIndex("uniq_evaluation").on(table.teamId, table.evaluatorId, table.evaluateeId),
  ]
);

export type Evaluation = typeof evaluations.$inferSelect;

// ─── Badges ──────────────────────────────────────────────
export const badges = mysqlTable(
  "badges",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    badgeType: mysqlEnum("badgeType", ["promise", "idea", "deadline"]).notNull(),
    count: int("count").default(1).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_user_badge").on(table.userId, table.badgeType),
  ]
);

export type Badge = typeof badges.$inferSelect;
