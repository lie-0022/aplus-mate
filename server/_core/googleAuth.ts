import crypto from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

// Google OAuth 2.0(OIDC) 로그인 — Manus OAuth를 대체하는 독립 배포용 입구.
// GOOGLE_CLIENT_ID/SECRET이 설정된 경우에만 활성화되며,
// 세션은 기존과 동일한 JWT 쿠키(sdk.createSessionToken)를 그대로 재사용한다.
// openId는 "google:{sub}" 형태로 저장해 기존 유저 모델과 충돌하지 않는다.

const STATE_TTL_MS = 10 * 60 * 1000;

// state를 쿠키 없이 검증한다(stateless CSRF) — cross-site 리다이렉트에서
// sameSite 쿠키가 유실되는 문제를 피하기 위해 HMAC 서명 토큰을 쓴다.
// 토큰 = "{timestamp}.{hex}.{sig}", sig = HMAC(secret, "{timestamp}.{hex}").
const STATE_SECRET = ENV.cookieSecret || "aplus-mate-oauth-state";

function makeState(): string {
  const ts = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const body = `${ts}.${nonce}`;
  const sig = crypto.createHmac("sha256", STATE_SECRET).update(body).digest("hex");
  return `${body}.${sig}`;
}

function verifyState(state: string | undefined): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const expected = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(`${ts}.${nonce}`)
    .digest("hex");
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const age = Date.now() - Number(ts);
  return Number.isFinite(age) && age >= 0 && age < STATE_TTL_MS;
}

// redirect_uri는 Google 콘솔 등록값과 정확히 일치해야 한다.
// APP_URL이 있으면 그것을(프록시 뒤에서 안전), 없으면 요청 호스트 기준으로 만든다.
function getRedirectUri(req: Request) {
  const base =
    ENV.appUrl.replace(/\/$/, "") ||
    `${req.protocol}://${req.get("host")}`;
  return `${base}/api/auth/google/callback`;
}

export function registerGoogleAuthRoutes(app: Express) {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    app.get("/api/auth/google", (_req, res) => {
      res
        .status(503)
        .send("Google 로그인이 아직 설정되지 않았습니다 (GOOGLE_CLIENT_ID/SECRET 필요).");
    });
    console.warn("[GoogleAuth] GOOGLE_CLIENT_ID/SECRET 미설정 — 로그인 비활성화");
    return;
  }

  // 1) 로그인 시작 — 서명된 state를 만들어 Google 동의화면으로(쿠키 불필요)
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const state = makeState();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", getRedirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    res.redirect(302, url.toString());
  });

  // 2) 콜백 — code 교환 → 프로필 조회 → upsert → 세션 쿠키 → "/"
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;

      if (!code || !verifyState(state)) {
        console.warn("[GoogleAuth] state 검증 실패", { hasCode: !!code, state });
        res.status(400).send("잘못된 로그인 요청입니다. 다시 시도해주세요.");
        return;
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: getRedirectUri(req),
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        console.error("[GoogleAuth] token exchange failed:", await tokenRes.text());
        res.status(502).send("Google 로그인에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) {
        res.status(502).send("Google 로그인에 실패했습니다. 다시 시도해주세요.");
        return;
      }

      const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userRes.ok) {
        console.error("[GoogleAuth] userinfo failed:", await userRes.text());
        res.status(502).send("Google 프로필 조회에 실패했습니다.");
        return;
      }
      const profile = (await userRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
      };
      if (!profile.sub) {
        res.status(502).send("Google 프로필 조회에 실패했습니다.");
        return;
      }

      const openId = `google:${profile.sub}`;
      // name이 비면 세션 payload 필수 필드 검증(verifySession)에 걸리므로 폴백을 둔다.
      const displayName = profile.name || profile.email || "사용자";
      await db.upsertUser({
        openId,
        name: displayName,
        email: profile.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Manus OAuth와 동일하게 "/" 착지 → 프로필 게이트/returnTo 복원이 이어진다
      res.redirect(302, "/");
    } catch (error) {
      console.error("[GoogleAuth] callback failed", error);
      res.status(500).send("로그인 처리 중 오류가 발생했습니다.");
    }
  });

  console.log("[GoogleAuth] /api/auth/google 활성화");
}
