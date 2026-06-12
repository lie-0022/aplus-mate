export const COOKIE_NAME = "app_session_id";
// 매칭/그룹 종류 — 팀플 외에 수업 기준 스터디·멘토멘티 매칭이 같은 파이프라인을 공유.
export const MATCH_TYPES = ["project", "study", "mentoring"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  project: "팀플",
  study: "스터디",
  mentoring: "멘토멘티",
};

// 종류별 정원 — 서버 acceptMatch 검증과 클라이언트 안내 문구가 공유.
// mentoring 5 = 멘토 1명 + 멘티 최대 4명 (멘토 수는 role로 별도 검증).
export const TEAM_SIZE_LIMITS: Record<MatchType, number> = {
  project: 6,
  study: 5,
  mentoring: 5,
};
export const MENTORING_MAX_MENTEES = 4;

// 멘토멘티 역할 — 커넥트 시 요청자가 자기 역할을 고르고, 상대는 반대 역할이 된다.
export type MentoringRole = "mentor" | "mentee";
export const ROLE_LABELS: Record<MentoringRole, string> = {
  mentor: "멘토",
  mentee: "멘티",
};
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
