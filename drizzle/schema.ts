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
  // 회원 탈퇴 시각(소프트-파기). null이면 활성 계정.
  deletedAt: timestamp("deletedAt"),
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
    // 수업 조인 코드 — 교수가 발급, 학생이 입력하면 자동 등록(P1). 혼동문자 제외 6자.
    inviteCode: varchar("inviteCode", { length: 8 }),
    // 팀 구성 마감일 — 교수가 설정, 대시보드 D-day·미배정 독려 기준(P2). null이면 미설정.
    matchingDeadline: timestamp("matchingDeadline"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_course").on(table.name, table.professor, table.university),
    // 조인 코드 유일성(null은 MySQL에서 중복 허용 — 미발급 수업 공존 가능)
    uniqueIndex("uniq_invite_code").on(table.inviteCode),
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
  // 모더레이션 soft-hide — null이면 노출, 값이 있으면 숨김(작성자 삭제/운영자 차단).
  hiddenAt: timestamp("hiddenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;

// ─── Post Comments (게시글 댓글, 익명 표시) ───────────────
export const postComments = mysqlTable("post_comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  // 모더레이션 soft-hide — null이면 노출, 값이 있으면 숨김.
  hiddenAt: timestamp("hiddenAt"),
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
    // 지원/요청 메시지 — "왜 함께하고 싶은지" 의도 표현(재설계). null 허용.
    message: text("message"),
    // 모집 공고를 통한 지원이면 해당 공고 연결. 직접 커넥트는 null.
    recruitmentId: int("recruitmentId"),
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

// ─── Recruitments (팀원 모집 공고) ───────────────────────
// 게시판 자유글("같이하실분?") 대신 구조화된 모집 공고. 다른 학생이 "지원"하면
// teamMatches(요청자=지원자, 수신자=모집자, recruitmentId 연결)를 재사용한다.
export const recruitments = mysqlTable("recruitments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  authorId: int("authorId").notNull(),
  // 기존 팀이 추가 멤버를 모집하면 그 팀 id. 새로 팀을 꾸리려는 모집이면 null.
  teamId: int("teamId"),
  matchType: mysqlEnum("matchType", ["project", "study", "mentoring"])
    .default("project")
    .notNull(),
  // 모집자가 멘토멘티에서 고른 자기 역할(지원자는 반대). 다른 종류는 null.
  authorRole: mysqlEnum("authorRole", ["mentor", "mentee"]),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  // 원하는 스킬 태그(JSON 문자열 배열). 비면 무관.
  desiredSkills: text("desiredSkills"),
  // 추가로 필요한 인원(안내용). 정원 검증은 acceptMatch가 담당.
  neededCount: int("neededCount").default(1).notNull(),
  status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export type Recruitment = typeof recruitments.$inferSelect;

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
    // 교수 승인 — 교수 인증 수업에서 교수가 이 팀 구성을 확인·허락한 시각(null=미승인).
    // 학생 화면(내 팀·팀 상세)에 "교수님 승인" 칩으로 노출된다.
    professorApprovedAt: timestamp("professorApprovedAt"),
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

// ─── Course Milestones (교수 제출 항목) + Team Submissions (팀 산출물) ──
// 교수가 "1차 기획안" 같은 제출 항목(마일스톤)을 만들면 각 팀이 링크+메모로 제출한다.
// 교수는 마일스톤 × 팀 매트릭스로 제출 현황을 한눈에 본다. 파일 업로드 대신
// 외부 링크(구글드라이브·노션 등)로 받아 인프라를 단순하게 유지한다.
export const courseMilestones = mysqlTable("course_milestones", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  createdBy: int("createdBy").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  dueAt: timestamp("dueAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CourseMilestone = typeof courseMilestones.$inferSelect;

export const teamSubmissions = mysqlTable(
  "team_submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    milestoneId: int("milestoneId").notNull(),
    teamId: int("teamId").notNull(),
    submittedBy: int("submittedBy").notNull(),
    url: varchar("url", { length: 1000 }).notNull(),
    note: text("note"),
    // 교수가 제출물을 확인했음을 표시(검토 현황). null이면 미확인.
    reviewedAt: timestamp("reviewedAt"),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    // 마일스톤당 팀당 1개 — 재제출은 update
    uniqueIndex("uniq_team_submission").on(table.milestoneId, table.teamId),
  ]
);

export type TeamSubmission = typeof teamSubmissions.$inferSelect;

// ─── Reports (사용자·콘텐츠 신고) ─────────────────────────
// 운영자가 신고 큐로 처리한다. 한 사람이 같은 대상을 중복 신고하지 못하게 unique.
export const reports = mysqlTable(
  "reports",
  {
    id: int("id").autoincrement().primaryKey(),
    reporterId: int("reporterId").notNull(),
    targetType: mysqlEnum("targetType", ["post", "comment", "user"]).notNull(),
    targetId: int("targetId").notNull(),
    reason: mysqlEnum("reason", ["abuse", "spam", "privacy", "etc"]).notNull(),
    detail: text("detail"),
    status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uniq_report").on(table.reporterId, table.targetType, table.targetId),
  ]
);

export type Report = typeof reports.$inferSelect;

// ─── Notifications (인앱 알림) ────────────────────────────
// 매칭 수락·공지·일정 등 이벤트 발생 지점에서 적재. 헤더 알림센터가 소비한다.
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: varchar("body", { length: 500 }),
  linkPath: varchar("linkPath", { length: 200 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Team Notes (팀 메모/공지 보드) ───────────────────────
// 팀 내 결정사항·역할합의·링크를 앱 안에 남긴다(외부 카톡 휘발 방지).
export const teamNotes = mysqlTable("team_notes", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeamNote = typeof teamNotes.$inferSelect;

// ─── Course Reviews (수업 리뷰 — 별점·팀플 유무 확인·한줄평) ───
// 수강생(현·과거)만 작성, 수업당 1인 1리뷰(재작성=업서트). 목록은 익명 노출.
// hadTeamProject 집계가 "이 수업 팀플 있나요?"를 수강생 경험으로 답해준다.
export const courseReviews = mysqlTable(
  "course_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    courseId: int("courseId").notNull(),
    userId: int("userId").notNull(),
    rating: int("rating").notNull(), // 1~5
    // true=팀플 있었음 / false=없었음 / null=응답 안 함
    hadTeamProject: boolean("hadTeamProject"),
    // 이번 학기 본인 팀 인원(팀플 있었을 때). null=응답 안 함.
    teamSize: int("teamSize"),
    // 팀플 유형 태그(발표/개발·제작/보고서·논문/설계·기획/실험·실습/기타). json 배열.
    projectTypes: json("projectTypes").$type<string[]>(),
    // 미리 짠 팀을 교수님이 허용하는지 — true=허용 / false=불가 / null=모름.
    // (학생이 A+ Mate로 조를 미리 짜갈지 판단하는 핵심 데이터)
    preformAllowed: boolean("preformAllowed"),
    content: varchar("content", { length: 500 }),
    semester: varchar("semester", { length: 20 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uniq_review_user_course").on(table.courseId, table.userId)]
);

export type CourseReview = typeof courseReviews.$inferSelect;
