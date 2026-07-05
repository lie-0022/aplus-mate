export const ENV = {
  // 세션 payload의 필수 필드 — 독립 배포에선 단일 앱이라 식별만 되면 되므로
  // VITE_APP_ID 미설정 시 기본값을 쓴다(미설정 시 세션 검증이 전부 실패하는 것 방지).
  appId: process.env.VITE_APP_ID || "aplus-mate",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Google 로그인 전환 후 운영자 지정용 — sub(openId)를 미리 알 수 없으니 이메일로 매칭
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // ── 독립 배포(Railway 등)용 ──
  // Google OAuth 로그인 (설정 시 /api/auth/google 라우트 활성화)
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // 배포 공개 URL (OAuth redirect_uri 고정용, 예: https://aplusmate.up.railway.app)
  appUrl: process.env.APP_URL ?? "",
  // LLM 직접 연동 — 미설정 시 Manus forge 값으로 폴백
  llmApiUrl: process.env.LLM_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gemini-2.5-flash",
  // 파일럿 가입 제한 — 허용 학교 이메일 도메인(쉼표 구분, 예: "bu.ac.kr,skku.edu").
  // 미설정이면 무제한(아무 구글 계정 가능).
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
};
