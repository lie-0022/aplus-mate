// 딥링크 경로 보존 — 로그아웃 상태로 보호 페이지(예: /courses/:id)에 진입했을 때
// 로그인 후 그 경로로 복원하기 위한 헬퍼. (OAuth 콜백은 무조건 '/'로 착지하므로 필요.)
//
// 중앙화 이유: 저장(App.tsx ProtectedPage)·복원(App.tsx Router landing, ProfileSetup)이
// 여러 곳에 흩어지면 규칙(제외 경로·만료)이 어긋나기 쉽다. 한 곳에 모은다.

const KEY = "returnTo";
const TS_KEY = "returnToTs";

// OAuth 왕복 + 프로필 작성 시간을 커버하되, 중단 후 다음 세션의 stale 값은 만료시킨다.
const TTL_MS = 30 * 60 * 1000; // 30분

// 복원 대상이 아닌 경로: 홈('/')과 온보딩 라우트('/profile/setup').
// (자기참조로 프로필 완료 후 다시 설정 화면에 갇히는 것을 방지.)
const EXCLUDED = new Set<string>(["/", "/profile/setup"]);

/** 로그아웃 상태로 보호 경로에 진입한 시점에 호출 — 복원 대상 경로만 저장. */
export function saveReturnTo(path: string): void {
  if (!path || EXCLUDED.has(path)) return;
  try {
    localStorage.setItem(KEY, path);
    localStorage.setItem(TS_KEY, String(Date.now()));
  } catch {
    /* localStorage 비가용 환경 무시 */
  }
}

/**
 * 로그인 후 착지 시점에 호출 — 저장된 경로를 반환하고 즉시 제거(1회성).
 * 만료됐거나(>TTL) 제외 경로면 null. 항상 키를 정리해 stale 누적을 막는다.
 */
export function consumeReturnTo(): string | null {
  try {
    const path = localStorage.getItem(KEY);
    const ts = Number(localStorage.getItem(TS_KEY) || 0);
    localStorage.removeItem(KEY);
    localStorage.removeItem(TS_KEY);
    if (!path || EXCLUDED.has(path)) return null;
    if (!ts || Date.now() - ts > TTL_MS) return null; // stale
    return path;
  } catch {
    return null;
  }
}
