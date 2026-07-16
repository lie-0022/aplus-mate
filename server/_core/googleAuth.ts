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

// 외부에서 온 값(구글 프로필 이메일 도메인 등)을 HTML에 넣기 전 이스케이프.
// 구글이 이메일 형식을 검증하므로 실제 악용은 어렵지만, 인증 에러 페이지는
// 로그인 전 누구나 도달하는 공개 표면이라 defense-in-depth로 항상 막는다.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 인증 실패 안내 페이지 — OAuth 콜백은 SPA 밖이라 생 텍스트가 그대로 노출된다.
// 브랜드 스타일(웜 아이보리 배경 + 카드 + 그라데이션 버튼)을 입힌 최소 HTML로 응답.
// primaryLabel 버튼은 /api/auth/google로 재진입 — 시작 라우트가 prompt=select_account를
// 보내므로 개인 gmail로 거절당해도 계정 선택 화면이 다시 뜬다(무한 403 방지).
// ⚠️ message는 의도적으로 HTML(<br/>·<b>)을 허용하므로, 외부 유래 값은 호출부에서
//    반드시 escapeHtml()로 감싸 넣을 것.
function sendAuthErrorPage(
  res: Response,
  status: number,
  title: string,
  message: string,
  primaryLabel = "다시 로그인"
) {
  res.status(status).type("html").send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — A+ Mate</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" /></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff6ee;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:16px;box-sizing:border-box">
<div style="max-width:400px;width:100%;background:#fff;border-radius:20px;padding:36px 28px;text-align:center;box-shadow:0 8px 28px rgba(58,53,102,0.10)">
  <div style="font-size:26px;font-weight:900;font-style:italic;background:linear-gradient(92deg,#7a2fe6,#2e7df0);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:18px">A+ Mate</div>
  <h1 style="font-size:19px;color:#3a3566;margin:0 0 10px">${title}</h1>
  <p style="font-size:14px;line-height:1.65;color:#6b6787;margin:0 0 24px">${message}</p>
  <a href="/api/auth/google" style="display:block;padding:13px 16px;border-radius:12px;background:linear-gradient(92deg,#7a2fe6,#2e7df0);color:#fff;font-weight:700;font-size:15px;text-decoration:none">${primaryLabel}</a>
  <a href="/" style="display:block;margin-top:12px;font-size:13.5px;color:#8b87a3;text-decoration:none">홈으로 돌아가기</a>
</div></body></html>`);
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
    // 항상 계정 선택 화면을 띄운다 — 개인 gmail이 자동 재선택되면
    // 도메인 제한(403) 후 학교 계정으로 바꿀 방법이 없어지기 때문.
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });

  // 2) 콜백 — code 교환 → 프로필 조회 → upsert → 세션 쿠키 → "/"
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;

      if (!code || !verifyState(state)) {
        console.warn("[GoogleAuth] state 검증 실패", { hasCode: !!code, state });
        sendAuthErrorPage(
          res,
          400,
          "로그인 요청이 만료됐어요",
          "로그인 화면에 오래 머물렀거나 잘못된 경로로 들어왔어요. 아래 버튼으로 다시 시도해 주세요."
        );
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
        sendAuthErrorPage(
          res,
          502,
          "Google 로그인에 실패했어요",
          "Google과 통신하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요."
        );
        return;
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) {
        sendAuthErrorPage(
          res,
          502,
          "Google 로그인에 실패했어요",
          "Google과 통신하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요."
        );
        return;
      }

      const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userRes.ok) {
        console.error("[GoogleAuth] userinfo failed:", await userRes.text());
        sendAuthErrorPage(
          res,
          502,
          "Google 프로필 조회에 실패했어요",
          "Google에서 프로필 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요."
        );
        return;
      }
      const profile = (await userRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
      };
      if (!profile.sub) {
        sendAuthErrorPage(
          res,
          502,
          "Google 프로필 조회에 실패했어요",
          "Google에서 프로필 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요."
        );
        return;
      }

      const openId = `google:${profile.sub}`;

      // 파일럿: 허용 학교 이메일 도메인 제한(ALLOWED_EMAIL_DOMAINS 설정 시). 미설정이면 무제한.
      // 기존 가입자·운영자(OWNER_EMAIL)는 예외 — '신규 가입'만 도메인으로 거른다(운영자·기존 유저 잠김 방지).
      const allowedDomains = ENV.allowedEmailDomains;
      if (allowedDomains.length > 0) {
        const existing = await db.getUserByOpenId(openId);
        const isOwner = !!ENV.ownerEmail && profile.email === ENV.ownerEmail;
        const domain = (profile.email ?? "").split("@")[1]?.toLowerCase() ?? "";
        if (!existing && !isOwner && !allowedDomains.includes(domain)) {
          // domain은 구글 프로필 이메일에서 온 외부 값 → 반드시 이스케이프.
          const allowedLabel = allowedDomains.map((d) => `@${escapeHtml(d)}`).join(", ");
          const pickedLabel = domain ? `@${escapeHtml(domain)}` : "이메일 미확인";
          sendAuthErrorPage(
            res,
            403,
            "학교 구글 계정이 필요해요",
            `A+ Mate는 지금 ${allowedLabel} 재학생만 참여할 수 있어요.<br/>방금 선택한 계정(${pickedLabel})이 아니라 <b>학교 구글 계정</b>으로 다시 로그인해 주세요.`,
            "학교 계정으로 다시 로그인"
          );
          return;
        }
      }
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
      sendAuthErrorPage(
        res,
        500,
        "로그인 처리 중 오류가 발생했어요",
        "일시적인 문제일 수 있어요. 아래 버튼으로 다시 시도해 주세요."
      );
    }
  });

  console.log("[GoogleAuth] /api/auth/google 활성화");
}
