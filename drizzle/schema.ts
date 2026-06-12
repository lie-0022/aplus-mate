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
  // professor: 운영자가 지정하는 교수 계정 — 담당 수업의 학생·팀 조회, 공지, 설문 권한.
  role: mysqlEnum("role", ["user", "professor", "admin"]).default("user").notNull(),
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
    // 담당 교수(users.id, role=professor). null이면 미배정 — 교수가 클레임하거나 운영자가 지정.
    professorId: int("professorId"),
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

// ─── Post Comments (게시글 댓글, 익명 표시) ───────────────
export const postComments = mysqlTable("post_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PostComment = typeof postComments.$inferSelect;

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
    // 매칭 종류 — 같은 수업에서 팀플·스터디·멘토멘티가 독립 파이프라인으로 공존한다.
    matchType: mysqlEnum("matchType", ["project", "study", "mentoring"])
      .default("project")
      .notNull(),
    // 멘토멘티 전용: 요청자가 고른 자기 역할(상대는 반대 역할). 다른 종류는 null.
    requesterRole: mysqlEnum("requesterRole", ["mentor", "mentee"]),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // Prevent duplicate pending/accepted requests between same pair for same course+type
    // (allows rejected to coexist with new pending; A→B project와 A→B study는 별개)
    uniqueIndex("uniq_team_match_pending").on(
      table.requesterId,
      table.receiverId,
      table.courseId,
      table.matchType,
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
    // 그룹 종류 — project(팀플, 평가·배지 있음) / study·mentoring(평가 없음).
    teamType: mysqlEnum("teamType", ["project", "study", "mentoring"])
      .default("project")
      .notNull(),
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
    // 멘토멘티 그룹에서만 mentor/mentee, 팀플·스터디는 member.
    role: mysqlEnum("role", ["member", "mentor", "mentee"]).default("member").notNull(),
    hasEvaluated: boolean("hasEvaluated").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // Prevent duplicate team memberships (one user = one slot per team)
    uniqueIndex("uniq_team_member").on(table.teamId, table.userId),
  ]
);

export type TeamMember = typeof teamMembers.$inferSelect;

// ─── Team Events (팀 일정) ───────────────────────────────
// 그룹(팀플·스터디·멘토멘티) 단위 일정/마일스톤. 멤버 전용 CRUD.
export const teamEvents = mysqlTable("team_events", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull(),
  createdBy: int("createdBy").notNull(),
  // 담당자(팀 멤버 중 1명). null이면 공동/미배정.
  assigneeId: int("assigneeId"),
  title: varchar("title", { length: 200 }).notNull(),
  dueAt: timestamp("dueAt").notNull(),
  isDone: boolean("isDone").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeamEvent = typeof teamEvents.$inferSelect;

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

// ─── Course Announcements (교수 공지) ─────────────────────
export const courseAnnouncements = mysqlTable("course_announcements", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  professorId: int("professorId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CourseAnnouncement = typeof courseAnnouncements.$inferSelect;

// ─── Surveys (교수 설문) ──────────────────────────────────
// 교수가 문항을 직접 구성: scale(5점 척도) / choice(객관식, options에 선택지 배열).
export const surveys = mysqlTable("surveys", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  professorId: int("professorId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Survey = typeof surveys.$inferSelect;

export const surveyQuestions = mysqlTable("survey_questions", {
  id: int("id").autoincrement().primaryKey(),
  surveyId: int("surveyId").notNull(),
  order: int("order").default(0).notNull(),
  // scale: 5점 척도 / choice: 객관식 / text: 주관식(자유 서술)
  type: mysqlEnum("type", ["scale", "choice", "text"]).notNull(),
  text: varchar("text", { length: 500 }).notNull(),
  // choice 전용 선택지 목록. scale·text는 null.
  options: json("options").$type<string[]>(),
});

export type SurveyQuestion = typeof surveyQuestions.$inferSelect;

export const surveyResponses = mysqlTable(
  "survey_responses",
  {
    id: int("id").autoincrement().primaryKey(),
    surveyId: int("surveyId").notNull(),
    questionId: int("questionId").notNull(),
    userId: int("userId").notNull(),
    // scale: 1~5 점수, choice: 선택지 인덱스(0-base). text 문항은 null.
    value: int("value"),
    // 주관식 응답 본문 (text 문항 전용)
    textValue: text("textValue"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    // 문항당 1인 1응답
    uniqueIndex("uniq_survey_response").on(table.questionId, table.userId),
  ]
);

export type SurveyResponse = typeof surveyResponses.$inferSelect;

// ─── Consents (동의 기록) ─────────────────────────────────
// PIPA: 항목별·이벤트별 동의 증빙 + 버전 관리(약관 개정 시 재동의 추적).
// consentType: signup(가입 시 개인정보 수집·이용 + 이용약관), evaluation(평가 데이터 동의)
export const consents = mysqlTable(
  "consents",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    consentType: mysqlEnum("consentType", ["signup", "evaluation"]).notNull(),
    consentVersion: varchar("consentVersion", { length: 20 }).notNull(),
    agreedAt: timestamp("agreedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_consent").on(
      table.userId,
      table.consentType,
      table.consentVersion
    ),
  ]
);

export type Consent = typeof consents.$inferSelect;
