# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 핵심 가이드다.
더 깊은 내용은 `docs/ARCHITECTURE.md`(구조)와 `docs/DEVELOPMENT.md`(개발 플로우)를 본다.

---

## 1. 프로젝트 한 줄 요약

**A+ Mate** — 대학 수업 단위로 **팀플 팀원을 매칭**하고, 팀플 종료 후 **블라인드 상호 평가**를 통해 **신뢰 배지**를 쌓는 웹 서비스.

핵심 플로우: `프로필 작성 → 수업 등록 → 같은 수업 학생에게 매칭 요청 → 수락 시 팀 생성 + 카카오 오픈채팅 공개 → 팀플 완료 → 전원 블라인드 평가 → 평균 4.0↑ 항목당 배지 +1`

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트 | React 19, Vite 7, Wouter(라우팅), TanStack Query, Tailwind v4, Radix UI(shadcn 스타일) |
| API | tRPC v11 (end-to-end 타입세이프), superjson |
| 백엔드 | Express 4, Node(ESM), tsx |
| DB | MySQL + Drizzle ORM / drizzle-kit |
| 인증 | **Google OAuth(OIDC)** + 쿠키 세션(JWT, jose) — `server/_core/googleAuth.ts`. `ALLOWED_EMAIL_DOMAINS`로 학교 도메인 제한(신규 가입만, 기존 유저·OWNER_EMAIL 예외). Manus OAuth(`oauth.ts`)는 남아 있으나 `OAUTH_SERVER_URL` 미설정이라 **미사용** |
| 스토리지/LLM | 스토리지=Manus Forge(S3 presigned). LLM=`LLM_API_URL`(현재 Gemini OpenAI 호환 엔드포인트) |
| 패키지매니저 | **pnpm** (npm/yarn 쓰지 말 것) |
| 테스트 | Vitest |

> 이 프로젝트는 **Manus AI 빌더**로 생성됐다. git 히스토리상 초기에 Next.js+Supabase였으나 현재 스택으로 완전히 교체됐다. **README나 옛 커밋 메시지의 Next.js/Supabase 언급은 무시**하고 현재 코드(Vite+tRPC+Drizzle)를 기준으로 삼는다.

## 3. 디렉토리 구조 (핵심만)

```
client/src/
  pages/          # 화면 단위 (Dashboard, Courses, Teams, ...) — wouter 라우트와 1:1
  components/     # AppLayout 등 공용 + ui/ (shadcn 컴포넌트, 거의 손대지 않음)
  lib/trpc.ts     # tRPC react 클라이언트
  _core/          # Manus 프레임워크 (useAuth 등) — 건드리지 말 것
  App.tsx         # 라우트 정의 + 인증 가드(ProtectedPage)
server/
  routers.ts      # ★ tRPC API 정의 (입력검증 + 권한체크) — 앱 API의 단일 진입점
  db.ts           # ★ DB 접근/비즈니스 로직 전부 (Drizzle 쿼리)
  storage.ts      # Manus S3 업로드 헬퍼
  *.test.ts       # vitest (aplus / e2e / auth.logout)
  _core/          # Manus 프레임워크(서버 진입점, oauth, trpc, sdk, context) — 건드리지 말 것
shared/
  const.ts, types.ts  # 클라/서버 공유 상수·타입
drizzle/
  schema.ts       # ★ DB 스키마(테이블 30개) — 스키마 변경의 단일 출처
  *.sql, meta/    # 마이그레이션(자동 생성물 — 직접 편집 금지)
```

**`_core` 폴더(client/server 양쪽)는 Manus 프레임워크 보일러플레이트다. 특별한 이유 없으면 수정하지 않는다.**

## 4. 데이터 흐름

```
React 컴포넌트 (trpc.xxx.useQuery/useMutation)
   → POST /api/trpc  (httpBatchLink, 쿠키 동봉)
   → server/routers.ts  (zod 입력검증 + protectedProcedure 인증 + 권한체크)
   → server/db.ts       (Drizzle 쿼리, 동시성 처리)
   → MySQL
```

- **타입은 자동 전파된다.** `server/routers.ts`의 `AppRouter` 타입을 클라이언트가 import → API 시그니처가 컴파일 타임에 맞춰진다. 라우터를 고치면 프론트 호출부 타입이 자동으로 따라온다.
- 인증: `publicProcedure`(누구나) vs `protectedProcedure`(로그인 필수, `ctx.user` 보장). 관리자는 `adminProcedure`.

## 5. 자주 쓰는 명령어

```bash
pnpm dev        # 개발 서버 (tsx watch, Vite 미들웨어 통합, 포트 3000~)
pnpm check      # tsc --noEmit 타입체크   ← 변경 후 필수
pnpm test       # vitest 전체 실행          ← 변경 후 필수
pnpm format     # prettier
pnpm db:push    # drizzle-kit generate && migrate (스키마 변경 반영, DATABASE_URL 필요)
pnpm build      # vite build + esbuild 서버 번들
pnpm start      # 프로덕션 실행 (dist/)
```

> ⚠️ **Windows에서 `pnpm dev`가 바로 안 된다.** `package.json`의 스크립트가 `NODE_ENV=development tsx ...` (bash 문법)이라 PowerShell/cmd에서 환경변수가 안 먹는다. 대응은 `docs/DEVELOPMENT.md` 참고(cross-env 도입 또는 `$env:NODE_ENV='development'; tsx watch server/_core/index.ts` 수동 실행).

## 6. 작업 체크 (변경 후 반드시)

순서대로 통과해야 "완료"로 간주한다:

1. `pnpm check` — 타입 에러 0
2. `pnpm test` — 전체 통과 (현재 67개: auth 1 + aplus 43 + e2e 23)
3. (DB 스키마 변경 시) `pnpm db:push` 후 마이그레이션 파일 커밋
4. 동작 검증 — `pnpm dev` 후 해당 화면/플로우 직접 확인
5. `git status`로 의도한 파일만 변경됐는지 확인 → 사용자 요청 시에만 커밋/푸시

## 7. 작업할 때 패턴 (이대로 따라가면 일관성 유지됨)

**새 기능 = API 1개 추가 시:**
1. (필요 시) `drizzle/schema.ts`에 테이블/컬럼 추가 → `pnpm db:push`
2. `server/db.ts`에 쿼리 함수 추가 (DB 접근은 전부 여기 모은다)
3. `server/routers.ts`에 프로시저 추가 (zod 입력검증 + 권한체크는 **여기서**)
4. `client/src/pages` 또는 `components`에서 `trpc.xxx.useQuery/useMutation`로 호출
5. `server/aplus.test.ts`에 라우터 테스트 추가

**규칙:**
- **재창조 금지.** 새로 만들기 전에 반드시 기존 것을 찾아 재사용한다 — 이미 있는 컴포넌트(`TimetableGrid`, `ui/*`), 헬퍼(`db.ts` 함수, `shared/const`), 패턴(유니크 제약+멱등, courseGroupId 스코프)을 두고 비슷한 것을 또 만들지 말 것. 작업 전에 Grep으로 기존 구현부터 찾고, 부족하면 **그것을 확장**한다. 새 라이브러리 추가도 기존 스택(Radix·Tailwind·date-fns 등)으로 안 되는지 먼저 확인.
- DB 쿼리는 **무조건 `server/db.ts`에만**. 라우터·컴포넌트에서 Drizzle 직접 호출 금지.
- 입력검증(zod)·인증·권한체크는 **`server/routers.ts`에서**. db.ts는 데이터 접근에 집중.
- 사용자 대면 에러 메시지는 **한국어**로(기존 코드 톤 유지: "해당 수업에 등록된 학생만...").
- import 별칭: `@/`=client/src, `@shared`=shared, 서버는 상대경로.

## 8. ★ 중요 / 주의사항 (자주 발 걸리는 지점)

1. **동시성은 "DB 유니크 제약 + try/catch(ER_DUP_ENTRY)" 패턴으로 막는다.** 매칭/팀생성/평가/배지가 전부 이 방식. 새 동시성 로직도 트랜잭션 락이 아니라 **유니크 인덱스 + 멱등 처리**로 간다 (`db.ts`의 `acceptMatch`, `completeTeam`, `calculateBadges` 참고). 임의로 다른 방식 쓰지 말 것.
2. **DB 미연결 시 graceful degradation.** `getDb()`는 `DATABASE_URL` 없으면 `null`을 반환하고, 대부분 db 함수가 빈 배열/`null`/no-op으로 빠진다. 그래서 **테스트는 DB 없이도 라우터의 검증/권한 로직을 돈다**(에러 throw 여부 중심). 실제 데이터 동작 확인은 DB 연결 후 직접 검증 필요.
3. **환경변수(.env가 저장소에 없음 — 실값은 Render Environment에만).** 실제 사용 중: `DATABASE_URL`(TiDB), `JWT_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `APP_URL`(OAuth redirect 고정), `OWNER_EMAIL`(admin 지정), `ALLOWED_EMAIL_DOMAINS`(학교 도메인 제한), `LLM_API_URL`/`LLM_MODEL`, `NODE_ENV`. **env는 부팅 때 1회 읽으므로 값 변경 시 반드시 재배포**해야 반영된다. 로컬은 `DEV_LOCAL=1`로 `/api/dev/login` 백도어를 켤 수 있으나 **DB가 없으면 인증이 안 된다**(`authenticateRequest`가 `getUserByOpenId`를 탐).
4. **현재 2명 매칭만 지원.** `acceptMatch`가 requester+receiver 2명으로 팀을 만든다. 3명 이상은 미구현(todo.md의 향후 과제). 팀원 추방/탈퇴, 평가 수정, 실시간 알림도 미구현.
5. **마이그레이션 SQL/meta는 자동 생성물.** 직접 편집하지 말고 `schema.ts` 수정 후 `pnpm db:push`로 재생성.
6. **`profileCompleted`는 자동 계산 — 게이트는 `university`·`department`·`year` 셋뿐.** skillTags는 ProfileSetup에서 안 받고(default []), 오픈채팅은 프로필이 아니라 공고/커넥트 단위로 받으므로 **게이트에 없다**(예전 문서엔 포함돼 있었으나 오류). 매칭·모집 요청 전제조건이라 프로필 필드 변경 시 이 로직 영향 확인.
7. **블라인드 평가 무결성:** 자기 자신 평가 금지, 모든 팀원 평가 필수(부분 제출 거부), 팀 `status='completed'` 이후에만 가능, 중복 평가는 유니크 제약으로 차단. 평가 관련 코드 수정 시 이 4개 불변식 유지.
8. **정기 작업(cron/digest 등)은 in-process 타이머 금지.** `setInterval`/`node-cron` 쓰지 말 것 — Cloud Run이 idle 인스턴스를 죽인다. 반드시 `references/periodic-updates.md`의 Heartbeat/Agent cron 방식을 따른다.

## 9. 진행 상황 추적

- `todo.md` = 기능별 완료 체크리스트(✅된 핵심 기능 + `[ ]` 미구현 과제). 새 기능은 여기에 항목 추가/체크.
- 미구현/향후 과제는 `todo.md`의 "Known Limitations & Future Work" 섹션에 모여 있다.
