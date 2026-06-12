export const COOKIE_NAME = "app_session_id";
// 한 팀 최대 인원 (3인+ 매칭). 서버 acceptMatch 정원 검증과 클라이언트 안내 문구가 공유.
export const MAX_TEAM_SIZE = 6;
// 멘토멘티는 1:1 페어 — 정원 2명 고정.
export const MENTORING_MAX_SIZE = 2;

// 매칭/그룹 종류 — 팀플 외에 수업 기준 스터디·멘토멘티 매칭이 같은 파이프라인을 공유.
export const MATCH_TYPES = ["project", "study", "mentoring"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  project: "팀플",
  study: "스터디",
  mentoring: "멘토멘티",
};
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
