# A+ Mate — 개발 플로우 & 작업 체크

> 구조는 `docs/ARCHITECTURE.md`, 핵심 규칙은 루트 `CLAUDE.md`.
> 이 문서는 "실제로 어떻게 작업하고, 무엇으로 완료를 확인하는가"를 다룬다.

## 0. 사전 준비 (최초 1회)

```bash
pnpm install          # 의존성 설치 (wouter 패치 자동 적용됨)
```

### 환경변수 설정
저장소에 `.env`가 **없다.** 직접 만들어야 한다. 루트에 `.env` 생성:

```env
DATABASE_URL=mysql://user:pass@host:4000/aplusmate   # TiDB(프로덕션) 또는 로컬 MySQL
JWT_SECRET=<랜덤 시크릿>                              # 세션 쿠키 + OAuth state 서명
# ── 로그인은 Google OAuth 하나뿐 (Manus OAuth는 코드만 잔존·미사용) ──
GOOGLE_CLIENT_ID=<구글 콘솔 클라이언트 ID>
GOOGLE_CLIENT_SECRET=<구글 콘솔 시크릿>
APP_URL=http://localhost:3000                        # redirect_uri 고정(콘솔 등록값과 일치해야 함)
OWNER_EMAIL=<관리자 구글 이메일>                       # 이 이메일 유저가 자동 admin
ALLOWED_EMAIL_DOMAINS=bu.ac.kr                       # 선택 — 신규 가입 도메인 제한(비우면 무제한)
LLM_API_URL=<OpenAI 호환 엔드포인트>                   # 선택 — AI 보고서
LLM_MODEL=gemini-2.5-flash
DEV_LOCAL=1                                          # 로컬 전용 /api/dev/login 백도어
```

> ⚠️ **프로덕션 실값은 Render Environment에만 있다**(저장소·로컬에 없음).
> env는 **부팅 때 1회 로드** → 값 바꾸면 반드시 재배포해야 반영된다.
> `DEV_LOCAL=1`이어도 **DB가 없으면 로그인 안 된다** — `authenticateRequest`가
> `getUserByOpenId`로 DB를 타기 때문(로컬에서 로그인하려면 DB + 유저 행 필요).

없을 때의 동작:
- `DATABASE_URL` 없음 → `getDb()`가 null → DB 함수가 빈값 폴백(앱은 뜨지만 데이터 없음)
- OAuth 변수 없음 → 로그인 불가
- Forge 변수 없음 → 스토리지/LLM/이미지 기능 에러

> 실제 Manus 클라우드에서는 이 변수들이 플랫폼에서 주입된다. 로컬에서 풀 동작을 보려면 직접 채워야 한다.

### ⚠️ Windows에서 `pnpm dev` 환경변수 문제
`package.json`의 `dev` 스크립트가 `NODE_ENV=development tsx watch ...`로 **bash 문법**이다. Windows(PowerShell/cmd)에서는 `NODE_ENV` 할당이 안 먹어 실패한다. 셋 중 하나:

1. **수동 실행(임시):**
   ```powershell
   $env:NODE_ENV='development'; pnpm exec tsx watch server/_core/index.ts
   ```
2. **cross-env 도입(권장, 영구):**
   ```bash
   pnpm add -D cross-env
   # package.json: "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts"
   #               "start": "cross-env NODE_ENV=production node dist/index.js"
   ```
3. WSL/Git Bash에서 실행.

## 1. 표준 개발 루프

```
① 이해   → 관련 파일 읽기 (routers.ts → db.ts → schema.ts 순으로 따라가면 빠름)
② 변경   → 아래 "기능 추가 패턴" 따라 레이어별로 수정
③ 타입   → pnpm check        (tsc --noEmit, 에러 0)
④ 테스트 → pnpm test         (vitest 전체 통과)
⑤ 동작   → pnpm dev 후 화면/플로우 직접 확인
⑥ 정리   → pnpm format, git status로 의도한 변경만 확인
⑦ 기록   → todo.md 갱신
⑧ 커밋   → 사용자가 요청할 때만 (커밋/푸시는 명시 요청 시에만)
```

## 2. 기능 추가 패턴 (레이어 순서대로)

새 기능은 **DB → db.ts → routers.ts → 프론트 → 테스트** 순으로 아래에서 위로 쌓는다.

### 예: "수업 즐겨찾기" 기능을 추가한다면

1. **스키마** — `drizzle/schema.ts`에 `course_favorites` 테이블 + 유니크 제약 추가
   ```bash
   pnpm db:push   # generate + migrate (DATABASE_URL 필요)
   ```
2. **데이터 함수** — `server/db.ts`에 `addFavorite/removeFavorite/getFavorites` 추가 (Drizzle 쿼리는 여기에만)
3. **API** — `server/routers.ts`에 `favorites` 서브라우터 추가
   - 입력검증은 `zod`, 인증은 `protectedProcedure`, 권한체크(예: 본인 것만)는 여기서
4. **프론트** — `client/src/pages` 또는 `components`에서 `trpc.favorites.xxx.useQuery/useMutation`
   - 라우트가 필요하면 `App.tsx`에 `<Route>` + `ProtectedPage` 추가
5. **테스트** — `server/aplus.test.ts`에 라우터 테스트(인증/검증/권한 중심) 추가

### 동시성이 얽히면
유니크 인덱스 + try/catch(ER_DUP_ENTRY) + 멱등 처리 패턴을 따른다. `db.ts`의 `acceptMatch`, `completeTeam`, `calculateBadges`가 레퍼런스. (상세: ARCHITECTURE §5)

## 3. 작업 체크 — "완료" 판정 기준

아래를 **순서대로 전부** 통과해야 완료다.

| # | 명령 | 통과 기준 |
|---|------|----------|
| 1 | `pnpm check` | 타입 에러 0 |
| 2 | `pnpm test` | 전체 통과 (기준선 50개: auth 1 + aplus 26 + e2e 23) |
| 3 | `pnpm db:push` | (스키마 변경 시만) 마이그레이션 생성·적용, 새 SQL 파일 커밋 |
| 4 | `pnpm dev` 수동확인 | 바꾼 화면/플로우가 실제로 동작 |
| 5 | `git status` | 의도한 파일만 변경됨 |

테스트가 깨지면 고치기 전까지 완료 아님. 테스트를 임의로 삭제/skip하지 말 것 — 깨진 이유를 먼저 본다.

## 4. 테스트 작성 가이드

- 도구: **Vitest**. 파일: `server/*.test.ts`.
- 방식: `appRouter.createCaller(ctx)`로 라우터를 직접 호출. `ctx`는 `createAuthContext(user)` / `createPublicContext()` 헬퍼로 만든다 (`aplus.test.ts` 상단 참고).
- **DB 없이 돈다.** `DATABASE_URL` 미설정이라 db 함수는 빈값을 준다. 따라서 테스트는 주로 **인증·입력검증·권한·에러 throw 여부**를 검증한다(데이터 영속성 자체가 아니라).
- 새 API엔 최소: ① 비로그인 거부 ② 잘못된 입력 거부 ③ 권한 없는 유저 거부 ④ 정상 케이스. 이 4종을 기본 세트로.
- 멀티스텝 시나리오(매칭→팀→평가→배지)는 `e2e.test.ts` 스타일을 따른다.

## 5. 진행 상황 추적 (`todo.md`)

- `todo.md`가 단일 진행 보드다. 섹션별 체크리스트(`[x]`/`[ ]`).
- 새 기능 시작 시 항목 추가, 완료 시 `[x]`.
- 미구현/향후 과제는 **"Known Limitations & Future Work"** 섹션에 모은다. 현재 열린 항목:
  - 3명+ 직접 매칭 / 팀원 추방·탈퇴 / 평가 수정 / 실시간 알림 / 프로필 사진 업로드 / 게시판 UI 확장

## 6. 커밋 / 푸시

- 저장소: `github.com/lie-0022/aplus-mate` (origin/main). 푸시 권한·인증 정상.
- **커밋과 푸시는 사용자가 명시적으로 요청할 때만** 수행한다.
- 커밋 메시지 컨벤션(기존 히스토리 기준): `fix:` / `feat:` 프리픽스 + 한 줄 요약.
- 푸시 전 체크: `pnpm check` + `pnpm test` 통과 → `git status` 확인 → 커밋 → 푸시.

## 7. 흔한 함정 (요약)

1. Windows `pnpm dev` 환경변수 (§0 참고)
2. `.env` 부재 — 직접 생성
3. `_core/` 폴더는 Manus 프레임워크 → 수정 지양
4. Drizzle 직접 호출을 라우터/컴포넌트에 흩지 말고 `db.ts`로 집중
5. 마이그레이션 SQL 직접 편집 금지 → `schema.ts` 고치고 `db:push`
6. 정기작업에 `setInterval`/`node-cron` 금지 → `references/periodic-updates.md`
7. 에러 메시지는 한국어 톤 유지
8. **pnpm 설정 위치 변경(주의):** 현재 설치된 pnpm(v10+)이 `package.json`의 `pnpm.patchedDependencies`(wouter 패치)·`pnpm.overrides`(nanoid)를 더 이상 읽지 않는다(`pnpm check/test` 시 경고 출력). 동작·테스트엔 지장 없지만, **`pnpm install` 시 wouter 패치가 적용 안 될 수 있다.** 해결: 해당 설정을 `pnpm-workspace.yaml`로 이전(https://pnpm.io/settings).
