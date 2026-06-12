import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ─── 로컬 개발 전용 로그인 (DEV_LOCAL=1일 때만) ─────────────
  // httpOnly 세션 쿠키는 서버만 설정 가능하고, localhost HTTP에선 sameSite:"none"이
  // 브라우저에서 거부되므로 dev 전용으로 sameSite:"lax" 쿠키를 발급한다.
  // 프로덕션엔 DEV_LOCAL을 절대 설정하지 않는다(미설정 시 이 라우트는 등록되지 않음).
  if (process.env.DEV_LOCAL === "1") {
    const { COOKIE_NAME, ONE_YEAR_MS } = await import("@shared/const");
    const { sdk } = await import("./sdk");
    app.get("/api/dev/login", async (req, res) => {
      const openId =
        typeof req.query.as === "string" ? req.query.as : "dev-local";
      const token = await sdk.createSessionToken(openId, {
        name: "개발테스트",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false,
        maxAge: ONE_YEAR_MS,
      });
      // 실제 OAuth 콜백처럼 "/"로 착지 → App.tsx Router가 returnTo 복원/프로필 게이트 처리
      res.redirect(302, "/");
    });
    app.get("/api/dev/logout", (_req, res) => {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.redirect(302, "/");
    });
    console.log("[DEV] /api/dev/login & /api/dev/logout enabled (DEV_LOCAL=1)");
  }

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
