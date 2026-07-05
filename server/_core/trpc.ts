import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

// 서버 내부(DB/드라이버) raw 에러 메시지가 클라에 그대로 노출되는 것을 막는 마스킹 시그니처.
// 이 문자열이 담긴 INTERNAL_SERVER_ERROR는 일반 안내로 치환한다. 우리가 의도적으로 던지는
// 한국어 안내(throw new Error("…") / TRPCError)는 이 시그니처가 없으므로 그대로 통과한다.
const DB_ERROR_SIGNATURES = [
  "Failed query", // Drizzle이 감싼 쿼리 실패(테이블·컬럼·params 노출)
  "ER_", // MySQL errno 접두(ER_DUP_ENTRY, ER_NO_REFERENCED_ROW 등)
  "Duplicate entry",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "PROTOCOL_",
  "getaddrinfo",
  " resolver ", // superjson/직렬화 내부
];

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const rawMsg = String(error.cause?.message ?? error.message ?? "");
    const isInternalLeak =
      error.code === "INTERNAL_SERVER_ERROR" &&
      DB_ERROR_SIGNATURES.some((sig) => rawMsg.includes(sig));
    if (isInternalLeak) {
      // 원본은 서버 로그로만 남기고, 클라에는 안전한 일반 메시지만 보낸다.
      console.error("[trpc] internal error masked:", rawMsg);
      return { ...shape, message: "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요." };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// 교수 전용 — admin도 통과(운영·디버깅 편의).
export const professorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== "professor" && ctx.user.role !== "admin")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "교수 계정만 사용할 수 있습니다." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
