# A+ Mate — 아키텍처 상세

> 빠른 참고는 루트 `CLAUDE.md`. 이 문서는 구조를 깊게 파고든다.

## 1. 전체 그림

A+ Mate는 **단일 저장소(monorepo 성격)** 풀스택 TypeScript 앱이다. 하나의 Express 서버가 tRPC API와 (개발 시) Vite 프런트엔드를 함께 서빙한다.

```
┌─────────────────────────────────────────────────────────┐
│  브라우저 (React 19 SPA)                                  │
│  pages/ ── trpc hooks ── TanStack Query 캐시              │
└───────────────┬─────────────────────────────────────────┘
                │ POST /api/trpc (쿠키 세션 동봉, superjson)
┌───────────────▼─────────────────────────────────────────┐
│  Express (server/_core/index.ts)                          │
│   ├ /api/oauth/callback   ← Manus OAuth                    │
│   ├ /manus-storage/*      ← S3 프록시                      │
│   ├ /api/trpc/*           ← appRouter                      │
│   └ Vite 미들웨어(dev) / 정적파일(prod)                    │
└───────────────┬─────────────────────────────────────────┘
                │
┌───────────────▼──────────┐   ┌──────────────────────────┐
│ routers.ts (검증/권한)    │──▶│ db.ts (Drizzle 쿼리)      │──▶ MySQL
└──────────────────────────┘   └──────────────────────────┘
```

## 2. 레이어별 책임

### 클라이언트 (`client/src`)
- **`pages/`** — URL 라우트당 화면 1개. `App.tsx`의 `<Switch>`와 1:1 대응.
  - `Home`(랜딩, 비로그인) · `Dashboard` · `ProfileSetup`(최초 가입) · `Profile` · `Courses` · `CourseDetail`(수업정보+팀원찾기) · `MatchingRequests` · `Teams` · `TeamDetail`(오픈채팅 공개) · `TeamEvaluate` · `NotFound`
- **`components/`** — `AppLayout`(하단 네비 모바일 우선), `DashboardLayout`, `ErrorBoundary`, `AIChatBox`, `Map` 등. `components/ui/`는 shadcn 생성 컴포넌트라 직접 수정 거의 안 함.
- **`lib/trpc.ts`** — `createTRPCReact<AppRouter>()`. 서버 라우터 타입을 그대로 가져와 타입세이프.
- **`_core/hooks/useAuth.ts`** — `trpc.auth.me`로 현재 유저 조회 + 로그아웃. Manus 프레임워크.
- **`App.tsx`** — 라우트 + `ProtectedPage`(비로그인 시 `/`로 리다이렉트, 로그인+프로필 미완성 시 `/profile/setup`).
- **`main.tsx`** — tRPC/QueryClient Provider 마운트, 401(`Please login`) 감지 시 OAuth 포탈로 리다이렉트.

### 라우터 (`server/routers.ts`) — API의 단일 진입점
모든 tRPC 프로시저가 여기 모여 있다. 도메인별 서브라우터:

| 서브라우터 | 주요 프로시저 | 역할 |
|-----------|--------------|------|
| `auth` | me, logout | 세션 |
| `profile` | get, update, getPublic | 프로필(getPublic은 비공개정보 제거) |
| `dashboard` | getData | 대시보드 집계 |
| `courses` | search, get, create, enroll, unenroll, myCourses, students | 수업/수강 |
| `posts` | list, create | 수업 게시판(족보/과제팁/후기/스터디) |
| `matching` | request, received, pendingCount, accept, reject | 팀원 매칭 |
| `teams` | list, get, complete | 팀(멤버만 조회/완료) |
| `evaluations` | submit, hasEvaluated | 블라인드 평가 |
| `badges` | get | 배지 조회 |

여기서 **zod 입력검증 + `protectedProcedure` 인증 + 권한체크(isMember, isEnrolled 등)**를 모두 처리한다. 비즈니스 데이터 조작은 db.ts에 위임.

### 데이터 레이어 (`server/db.ts`) — DB 접근 단일 출처
모든 Drizzle 쿼리가 여기 있다. `getDb()`가 커넥션을 lazy 생성하며, `DATABASE_URL`이 없으면 `null` 반환 → 호출부는 빈값/no-op으로 폴백.

도메인 함수: `upsertUser`, `getUserById`, `updateUserProfile` / `createCourse`, `searchCourses`, `enrollCourse`, `getCourseStudents`, `isUserEnrolled` / `createPost`, `getCoursePosts` / `createMatchRequest`, `acceptMatch`, `rejectMatch`, `getReceivedMatchRequests` / `getUserTeams`, `getTeamDetail`, `completeTeam` / `submitEvaluationBatch`, `hasUserEvaluated`, `calculateBadges`(private) / `getUserBadges`, `getDashboardData`.

### 스키마 (`drizzle/schema.ts`) — 테이블 9개

| 테이블 | 핵심 컬럼 | 유니크 제약(동시성 방어) |
|--------|----------|------------------------|
| `users` | openId, role, university/department/year, skillTags(JSON), kakaoOpenChatUrl, profileCompleted | openId |
| `courses` | name, professor, credits, hasTeamProject, university, courseCode | (name, professor, university) |
| `user_courses` | userId, courseId, semester | (userId, courseId, semester) |
| `posts` | courseId, userId, title, content, category(enum) | — |
| `team_matches` | requesterId, receiverId, courseId, status(pending/accepted/rejected) | (requester, receiver, course, status) |
| `teams` | matchId, courseId, status(active/completed), evaluationStatus(pending/in_progress/done) | matchId |
| `team_members` | teamId, userId, hasEvaluated | (teamId, userId) |
| `evaluations` | teamId, evaluatorId, evaluateeId, promiseScore/ideaScore/deadlineScore(1~5), grade(enum) | (teamId, evaluator, evaluatee) |
| `badges` | userId, badgeType(promise/idea/deadline), count | (userId, badgeType) |

## 3. 인증 흐름 (Manus OAuth)

```
1. 비로그인 유저가 protected API 호출 → 401 "Please login (10001)"
2. main.tsx가 감지 → getLoginUrl()로 Manus OAuth 포탈 리다이렉트
3. 포탈 인증 후 /api/oauth/callback?code&state 로 복귀
4. oauth.ts: code→token→userInfo 교환 → db.upsertUser → 세션 쿠키 발급(jose JWT, 1년)
5. 이후 모든 요청에 app_session_id 쿠키 동봉
6. context.ts: sdk.authenticateRequest(req)로 매 요청 user 복원 → ctx.user
```

비밀번호를 직접 다루지 않는다. `OWNER_OPEN_ID`와 일치하는 유저는 자동 `admin`.

## 4. 도메인 규칙 (불변식)

- **수강 검증:** 매칭 요청 시 요청자·수신자 **둘 다** 해당 수업 수강 중이어야 함.
- **프로필 완성:** 매칭 요청 전제. `profileCompleted`는 필수 필드 충족 시 자동 true.
- **단계적 정보 공개:** 카카오 오픈채팅 링크는 **매칭 수락 후 팀 멤버에게만** 공개(`getTeamDetail`). 공개 프로필(`getPublic`)에는 제외.
- **2명 매칭:** accept 시 requester+receiver 2명 팀 생성. 3명+ 미지원.
- **평가 무결성:** 팀 `completed` 이후 + 자기 제외 전원 평가 필수 + 중복 불가.
- **배지:** 전원 평가 완료 → `calculateBadges` → 받은 평가의 항목별 평균 ≥ 4.0이면 해당 배지 +1(원자적 증가).

## 5. 동시성 처리 전략

트랜잭션 락 대신 **DB 유니크 인덱스 + try/catch(ER_DUP_ENTRY) + 멱등 처리**로 일관 처리한다.

| 위험 | 방어 |
|------|------|
| 중복 매칭 요청 | `uniq_team_match_pending` + 사전 조회 + catch |
| 한 매칭에 팀 2개 생성 | `uniq_team_per_match`(matchId) + accept 멱등(기존 팀 반환) |
| 동시 팀 완료 클릭 | `WHERE status='active'` 조건부 UPDATE → affectedRows 검사 |
| 중복 평가 | `uniq_evaluation` + catch |
| 배지 중복/유실 | `ON DUPLICATE KEY UPDATE count = count + 1`(원자적) |

→ **새 동시성 로직도 이 패턴을 따른다.**

## 6. 빌드 / 배포

- **개발:** `pnpm dev` → tsx가 `server/_core/index.ts` 감시 실행, Vite를 Express 미들웨어로 통합(HMR). 포트 3000부터 빈 포트 자동 탐색.
- **빌드:** `vite build`(→ `dist/public`) + `esbuild`로 서버 번들(→ `dist/index.js`, ESM, packages external).
- **프로덕션:** `pnpm start` → `node dist/index.js`, 정적 파일 서빙.
- **호스팅:** Manus 클라우드(Cloud Run 계열). `vite.config.ts`의 `allowedHosts`에 `*.manus*.computer` 등록됨. → 정기작업은 in-process 타이머 금지(§ CLAUDE.md 8.8).

## 7. 파일 맵 빠른 색인

| 하고 싶은 일 | 볼 파일 |
|-------------|---------|
| API 추가/수정 | `server/routers.ts` |
| DB 쿼리 추가/수정 | `server/db.ts` |
| 테이블/컬럼 변경 | `drizzle/schema.ts` → `pnpm db:push` |
| 화면 추가 | `client/src/pages/` + `App.tsx` 라우트 |
| 공유 타입/상수 | `shared/types.ts`, `shared/const.ts` |
| 인증 동작 | `server/_core/{oauth,context,sdk}.ts`, `client/src/_core/hooks/useAuth.ts` |
| 정기작업(cron) | `references/periodic-updates.md` |
| 진행상황/할일 | `todo.md` |
