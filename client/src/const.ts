export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// 독립 배포: Google OAuth로 로그인한다. 서버 라우트가 동의화면으로 보내고
// 콜백에서 세션 쿠키를 심은 뒤 "/"로 돌려보낸다 (Manus OAuth와 동일한 착지 흐름).
export const getLoginUrl = () => "/api/auth/google";
