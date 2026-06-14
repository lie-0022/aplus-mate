# A+ Mate — 엣지 케이스 / 디테일 점검 · 보완 기록

> `/loop`로 영역별로 한 사이클씩 깊이 파면서 발견한 엣지 케이스·디테일 누락을 누적한다.
> 각 항목: **상태** · 심각도 · 위치 · 현상 · 조치.
> 라우터(`server/routers.ts`)에서 이미 막는 것은 제외하고, **실제로 남는 갭만** 기록한다.
>
> 상태 범례: ✅ 코드 보완 완료 · ⚠️ 부분 완화 + 정책 문서화 · 📋 정책 결정 필요(코드 보류) · 👁 관찰

---

## 사이클 1 — 매칭 / 팀 / 평가 / 일정 로직 (`server/db.ts`)

**점검일** 2026-06-13 · **보완 적용** 2026-06-14 — `tsc --noEmit` 통과, 기존 테스트 50건 통과.
이번 보완으로 **코드베이스에 처음 DB 트랜잭션(`db.transaction`)을 도입**했다(drizzle-orm/mysql2).

라우터 방어 확인 결과 다음은 **이미 잘 막혀 있어 제외**: 자기 자신 매칭 요청 차단([routers.ts:242](../server/routers.ts#L242)), 수강등록 검증(라우터+db 이중), 팀 멤버십 가드(getTeamDetail·completeTeam·events 전부), 일정 담당자 팀멤버 검증(create·setAssignee 양쪽), completeTeam 동시완료 원자 가드. → 표면 의심은 대부분 방어됨.

### 보완 요약

| 엣지 | 내용 | 심각도 | 상태 |
|---|---|:---:|---|
| **1-A** | `acceptMatch` 새 팀 생성이 비원자(매칭 accepted → 팀/멤버 insert 분리) | 중간 | ✅ 트랜잭션화 |
| **1-B** | `acceptMatch` 정원·멘토1명·멘티정원 TOCTOU race | 중간 | ✅ 트랜잭션 + `FOR UPDATE` 행잠금 |
| **1-F** | `submitEvaluationBatch` 평가 insert 부분 실패 시 재제출 갇힘 | 중간 | ✅ 트랜잭션화 |
| **1-D** | `leaveTeam` 4단계 쓰기 비원자 | 낮음 | ✅ 트랜잭션화 |
| **1-E** | 평가 미제출로 `evaluationStatus`가 `in_progress` 영구 정체 | 낮음 | ⚠️ 부분 완화 + 정책 문서화 |
| **1-C** | 멘토 0명 멘토링 팀이 active 유지·완료 가능 | 낮음 | 📋 현행 유지 권장 — 문서화 |
| **1-G** | 전원 평가 시 배지 계산 동시성 | 관찰 | 👁 `evaluationStatus!=done` 가드로 1차 방어 |

---

### ✅ 1-A. `acceptMatch` 새 팀 생성 원자화
- **위치**: `acceptMatch` ([db.ts](../server/db.ts) 내, "둘 다 그룹이 없으면 새 2인 그룹 생성")
- **현상(전)**: 매칭을 `status:"accepted"`로 먼저 업데이트한 뒤 별도 쿼리로 `teams`/`teamMembers` insert. 부분 실패 시 **accepted인데 팀 없음 / 멤버 0명 유령 팀**이 남음.
- **조치**: `db.transaction(tx => { update match → insert team → insert members })`로 묶어 all-or-nothing. `matchId` unique 충돌(동시 생성) 시 기존 팀 반환 로직은 유지.

### ✅ 1-B. `acceptMatch` 정원/역할 TOCTOU race 제거
- **위치**: `acceptMatch` 합류 경로(기존 팀에 한 명 합류)
- **현상(전)**: `memberRows.length >= maxSize`를 **읽고 나서** 별도로 insert. 두 수신자가 정원 직전(예: 5/6)에서 **동시에** 수락하면 둘 다 통과 → 7명. 멘토 1명·멘티 정원도 동일하게 깨질 수 있었음.
- **조치**: 합류를 트랜잭션으로 감싸고, 기존 멤버 행을 **`.for("update")`** 로 잠근 뒤 정원/역할을 재확인. 동시 수락이 **직렬화**되어 두 번째 트랜잭션은 첫 번째 커밋(정원 +1) 이후를 보므로 초과가 불가능.

### ✅ 1-F. `submitEvaluationBatch` 평가 제출 갇힘 제거 *(이번 사이클 신규 발견)*
- **위치**: `submitEvaluationBatch`
- **현상(전)**: 여러 평가를 for 루프로 개별 insert한 뒤 `hasEvaluated=true` 표시. 일부만 insert되고 실패하면, 재시도 시 `ER_DUP_ENTRY`("이미 평가를 완료했습니다")로 막혀 **나머지 평가를 영영 제출 못 하는 갇힘** + `hasEvaluated`는 여전히 false인 불일치.
- **조치**: insert 루프 + `hasEvaluated` 표시를 **한 트랜잭션**으로 묶어 all-or-nothing. 재시도가 항상 깨끗한 상태에서 시작.

### ✅ 1-D. `leaveTeam` 원자화
- **위치**: `leaveTeam`
- **현상(전)**: `delete member` → `update events(assignee=null)` → (마지막 1명) `delete events`+`delete team` 4단계가 비원자. 중간 실패 시 부분 정리 잔존.
- **조치**: 네 쓰기를 `db.transaction`으로 묶음. (검증 단계인 팀/멤버 조회는 트랜잭션 밖 유지 — 읽기라 무해.)

### ⚠️ 1-E. 평가 미제출 → `in_progress` 영구 정체
- **위치**: `completeTeam` / `submitEvaluationBatch`
- **현상**: 팀플 완료 시 `evaluationStatus:"in_progress"`. 한 명이라도 동료평가를 제출 안 하면 `allEvaluated`가 false라 **영원히 `in_progress`**. 독촉/만료/스킵 메커니즘 없음.
- **이번 조치(부분 완화)**: **평가할 동료가 없는(혼자 남은) 팀플**은 `completeTeam`에서 멤버 수를 세어 2명 미만이면 평가 단계를 건너뛰고 바로 `done` 처리. → "1인 팀플이 평가 불가 상태로 갇히는" 확실한 케이스는 제거.
- **남은 정책 결정**(아래 *정책 미결* 참조): 2명+ 팀에서 일부가 미제출한 채 방치되는 경우의 처리(만료 자동 done / 교수·팀장 강제 마감 / 현행 자율).

### 📋 1-C. 멘토 0명 멘토링 팀
- **위치**: `leaveTeam` + `completeTeam`
- **현상**: 멘토가 나가면 멘티만 남고, 새 멘토 합류는 허용(의도). 다만 **멘토 0명 상태로 active 유지·완료** 가능.
- **판단**: 코드로 강제(완료 차단/자동 해산)하면 "멘토가 중간에 빠진 팀이 영영 마무리 못 함"이라는 더 나쁜 부작용. **현행 유지 권장** — 멘토 이탈 후에도 멘티끼리 마무리하거나 새 멘토를 받을 수 있는 게 자연스러움. 정책으로 명문화하고 코드 변경 없음.

### ✅ 1-G. 배지 계산 동시성 → 사이클 5에서 해결(5-B)
- **위치**: `submitEvaluationBatch` 말미 `allEvaluated` → `calculateBadges`
- **현상**: badges는 `(userId, badgeType)` unique에 `count + 1` 누적(여러 팀 누적은 의도). 마지막 두 명이 동시 제출하면 `evaluationStatus !== "done"` 체크를 둘 다 통과해 `calculateBadges`가 **2회 호출 → 같은 팀 기여분이 count에 2배** 집계.
- **조치(5-B)**: `in_progress → done` 전환을 원자적 조건부 update로 **선점**하고, 전환에 성공한 호출만 `calculateBadges` 실행. 동시 호출 중 하나만 통과 → 중복 집계 차단.

---

## 정책 미결 — 코드 강제 보류, 사용자 결정 필요

- **1-E 잔여**: 2명+ 팀에서 동료평가 일부 미제출 시 → ① 완료 N일 후 자동 `done`(미제출자 배지 미지급) · ② 교수/팀장이 평가 강제 마감 · ③ 현행(자율, 미완은 영구 in_progress). **권장: ①** (베타에선 미제출이 흔함).
- **1-C**: 위 판단대로 현행 유지가 기본. 멘토 부재를 UI에 표시(예: "멘토 모집 중")만 추가하는 절충도 가능.

## 관찰(의도로 추정 — 기록만)
- 완료된 팀 멤버끼리 같은 수업에서 다시 매칭 가능(`getActiveTeamForCourse`가 `active`만 봄) → 재매칭 허용으로 보임.
- 일정 `dueAt` 과거 날짜 허용 → D-day 음수 표시될 뿐. 사소.

---

## 사이클 2 — 설문 빌더 / 응답 / 집계 (`server/db.ts`, `routers.ts`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

설문 라우터는 **매우 견고**: 마감 차단(`status !== "open"`), 수강생 검증, 전 문항 필수, 유형별 값 범위(scale 1~5·choice 인덱스·text 본문), 소유 검증(create·close·results는 `assertOwnsCourse`), zod 경계(문항 1~20·선택지 2~10·길이 제한). 표면 의심은 대부분 방어됨.

### ✅ 2-B. `getSurveyResults` scale 평균 정합성
- **위치**: `getSurveyResults`
- **현상(전)**: 분포는 `value 1~5`만 카운트하는데, 평균은 `rs.length`로 나누고 `value ?? 0`으로 합산 → **분모 불일치**. null·범위밖 값이 섞이면 평균이 분포와 어긋나고 0쪽으로 오염.
- **조치**: 평균을 분포와 **동일한 유효(1~5) 집합** 기준(`sum/valid`)으로 계산. 라우터가 정상 입력은 막지만, 집계 함수 자체의 정합성을 확보.

### 관찰
- **2-A**: `unique(questionId, userId)` + 단일 multi-row INSERT라 1인1응답·재제출이 원자적으로 안전 — `surveyId`가 unique에 없어도 `questionId`가 전역 PK라 충돌 없음. **실제 문제 아님**.
- **2-C**: 설문 reopen 없음(`close`만 노출). 의도로 추정.
- **2-D**: `listForCourse`가 수강생 검증 없이 설문 목록(제목·응답여부) 노출 — `get`/`submit`은 enrolled 검증하는데 목록만 안 함(불일치). 민감도 낮고 딥링크 둘러보기 정책([[profile-gate-deeplink-intended]])과 연관 → **정책 판단 후 결정**.

---

## 사이클 3 — 인증 / 프로필 / 세션 (`server/db.ts`, `_core/sdk.ts`, `routers.ts`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

### ✅ 3-A. 프로필 공백 입력 → 잘못된 "완성" 처리
- **위치**: 프로필 update 라우터 + `updateUserProfile`
- **현상(전)**: `university`/`department`가 `z.string().min(1)`이라 **공백만(" ")도 길이 1로 통과** → `updateUserProfile`의 `!!u.university`가 true → `profileCompleted`가 잘못 켜지고 공백이 그대로 저장.
- **조치**: `name`/`university`/`department`에 `.trim().min(1)` 적용 — 공백만 입력 거부 + 저장값 앞뒤 공백 정규화. (`year`는 이미 `min(1).max(6)`로 방어됨.)

### 👁 3-B. `verifySession` appId 미일치 검증 *(관찰 — 코드 보류)*
- **위치**: `_core/sdk.ts` `verifySession`
- **현상**: 세션 payload의 `appId`가 **비어있지 않은지만** 확인하고 `ENV.appId`와 **일치하는지는 미검증**. 단일 `JWT_SECRET` 환경이라 다른 앱 토큰은 `jwtVerify` 단계에서 이미 막히므로 영향 낮음.
- **판단**: 일치 검증을 켜면 과거 발급 토큰이 전부 무효화되어 재로그인을 유발할 수 있어 **보류**. 시크릿을 공유하는 멀티앱 구성으로 갈 때만 의미.

---

## 사이클 4 — 교수 공지 / 운영자 역할관리 / 게시판 / AI (`server/routers.ts`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

**견고 확인(보완 불필요)**: 공지 create(`professorProcedure` + `assertOwnsCourse` + 길이 제한), 운영자 `setUserRole`(`adminProcedure` + 자기 자신 변경 금지), AI `generateReport`(팀 멤버 검증 + zod `topic`/`details` 상한).

### ✅ 4-D. 게시판 쓰기에 수강생 검증 추가
- **위치**: `posts.create` / `posts.addComment`
- **현상(전)**: `courseId`만 받고 수강 여부 미검증 → **비수강생도 임의 수업 게시판에 글·댓글 작성 가능**. 설문(`submit`)은 막는데 게시판은 안 막아 불일치.
- **조치**: 둘 다 `isUserEnrolled` 검증. 읽기(`list`/`get`/`comments`)는 둘러보기로 유지 → **"읽기 개방 + 쓰기 수강생"** 정책으로 일관화([[profile-gate-deeplink-intended]]와 정합).

### ✅ 4-E. 게시글 길이 상한
- **위치**: `posts.create`
- **현상(전)**: `title`/`content`가 `min(1)`만, **max 없음**(댓글은 max 1000) → 거대 페이로드로 DB·렌더 부담 가능.
- **조치**: `title` max 200, `content` max 10000 + `trim`. (댓글도 `trim` 추가.)

### 관찰
- **4-A**: `setUserRole`에 "마지막 admin 강등 방지" 없음. 단 자기 자신 변경 금지 + `OWNER_EMAIL` 재로그인 자동 승격이 안전망이라 운영자 0명은 구조적으로 어려움 → 낮음. (강등 시 `courses.professorId`는 유지되어 role-담당 불일치가 잠깐 생길 수 있으나 재승격으로 복구.)
- **4-B**: `incrementPostView`가 `get`마다 무조건 +1(중복 조회 방지 없음) → 조회수 인플레. 단순 카운터 의도면 OK.
- **공지 `list`**: 수강생 검증 없음(2-D와 동일 패턴) — 읽기 개방 정책으로 일관 처리.

---

## 사이클 5 — 수업 클레임·수강신청 / 배지 멱등성 (`server/db.ts`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

**견고 확인(보완 불필요)**: `searchCourses`(LIKE 와일드카드 `% _ \` 이스케이프로 오작동·인젝션 방지), `enrollCourse`(unique + `ER_DUP_ENTRY`로 중복 수강 멱등 차단).

### ✅ 5-A. `claimCourse` 동시 클레임 경합 제거
- **위치**: `claimCourse`
- **현상(전)**: `select`(professorId null 확인) → `update`가 비원자. 두 교수가 동시에 같은 미배정 수업을 클레임하면 **둘 다 null을 읽고 둘 다 update → 나중 것이 덮어씀**(첫 교수는 담당인 줄 알지만 실제로는 둘째가 차지).
- **조치**: `professorId IS NULL`을 조건에 건 **원자적 조건부 update** + `affectedRows === 0`이면 "이미 담당 교수 있음" 거부. `completeTeam`과 동일한 선점 패턴.

### ✅ 5-B. 배지 중복 집계 제거 (= 1-G 해결)
- **위치**: `submitEvaluationBatch` 말미
- **현상(전)**: `select(status) → calculateBadges → update done` 순서라, 마지막 두 평가가 동시에 들어오면 둘 다 `!= done`을 통과해 배지가 2배 집계.
- **조치**: `in_progress → done` 전환을 **원자적으로 선점**(`affectedRows`)하고, 성공한 호출만 `calculateBadges` 실행. `calculateBadges`는 내부 try/catch로 실패해도 throw 안 하므로 done 선점 후 계산해도 정합성 유지.

---

## 사이클 6 — 동의 / 연락처 / 대시보드 (`server/routers.ts`, `db.ts`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

**견고 확인(보완 불필요)**: `recordConsent`(`ER_DUP_ENTRY` 멱등 + `consentVersion` 관리), `getDashboardData`(집계 read-only), 매칭 목록(`getReceivedMatchRequests`/`getSentMatchRequests`는 실명 제외 마스킹, 운영자만 실명·연락처).

### ✅ 6-A. kakao 오픈채팅 URL 도메인 고정
- **위치**: `profile.update` 라우터 (saveKakao·ProfileSetup·Profile 모든 입력 경로가 이 라우터 경유)
- **현상(전)**: `kakaoOpenChatUrl`이 `z.string().optional()`만 — 임의 문자열 저장. 이 값은 **매칭 수락 후 팀원·운영자 화면에서 `href`로 직접 링크**되므로([Admin.tsx:125](../client/src/pages/Admin.tsx#L125)) 피싱 URL·비정상 스킴(`javascript:`) 삽입 가능.
- **조치**: `https://open.kakao.com/`로 시작하는 링크만 허용(빈 값은 선택 필드라 허용) + max 300. 클라 placeholder 의도와 일치.

### ✅ 6-B. skillTags 입력 상한
- **위치**: `profile.update` 라우터
- **현상(전)**: `z.array(z.string())`로 개수·길이 무제한 → 거대 페이로드 가능.
- **조치**: 태그 **30개·각 50자** 상한 + `trim().min(1)`.

---

## 사이클 7 — 평가 입력 / 클라이언트 게이트 (`server/routers.ts`, `client/src/App.tsx`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

**견고 확인(보완 불필요)**: `evaluations.submit`(멤버·팀플·완료·중복·전원평가·자기평가 제외·점수 범위 전부 검증 + `unique(teamId, evaluatorId, evaluateeId)`), 클라 게이트(`ProtectedPage`가 딥링크를 `returnTo`로 보존·복원, 만료·제외 필터로 stale 납치 방지, 내부 pathname 전용이라 **open redirect 없음** — [[profile-gate-deeplink-intended]] 의도대로).

### ✅ 7-A. 평가 중복 evaluateeId 방어층
- **위치**: `evaluations.submit`
- **현상(전)**: `evaluateeIds`를 Set으로 비교 → 실제로는 `unique` + 트랜잭션(1-F)으로 `[A,A,B]` 중복이 `ER_DUP_ENTRY` 롤백되어 막히지만, **에러 메시지가 부정확("이미 평가 완료")하고 DB 롤백에 의존**.
- **조치**: `input.evaluations.length === otherMembers.length` 선검증을 추가해 중복을 **명확한 메시지로 일찍 차단**(DB 롤백 의존 제거).

---

## 종합 수렴 (사이클 1~7 완료)

7개 사이클로 **서버 라우터 · DB 계층 · 클라이언트 게이트**까지 전 영역을 점검했다. **코드 보완 14건** + 정책/관찰 다수 문서화. 모든 사이클은 `tsc` 통과 + 테스트 50건 통과로 회귀 없음을 확인.

### 보완의 두 축
1. **동시성** — 코드베이스 최초 DB 트랜잭션 도입(`acceptMatch`·`leaveTeam`·`submitEvaluationBatch`) + 원자적 선점(`claimCourse`·배지 `done` 전환) + `FOR UPDATE` 행잠금(정원). 비원자 다단계 쓰기와 TOCTOU race를 제거.
2. **입력 경계** — `trim`/길이 상한(프로필·게시글·태그) + 도메인 고정(kakao, 보안) + 쓰기 수강생 검증(게시판). 거대 페이로드·피싱·비수강생 쓰기를 차단.

### 코드 보완 14건 색인
| ID | 영역 | 한 줄 |
|---|---|---|
| 1-A | 매칭 | acceptMatch 새 팀 생성 트랜잭션화 |
| 1-B | 매칭 | 정원/멘토/멘티 race를 트랜잭션+FOR UPDATE로 차단 |
| 1-D | 팀 | leaveTeam 트랜잭션화 |
| 1-E | 평가 | 혼자 남은 팀플 자동 done(영구 정체 제거) |
| 1-F | 평가 | submitEvaluationBatch 트랜잭션화(제출 갇힘 제거) |
| 1-G/5-B | 배지 | done 선점 후 계산으로 중복 집계 차단 |
| 2-B | 설문 | scale 평균을 분포와 동일 유효집합 기준으로 |
| 3-A | 프로필 | name/대학/학과 trim(공백 완성 방지) |
| 4-D | 게시판 | 쓰기 수강생 검증 |
| 4-E | 게시판 | 게시글 title/content 길이 상한 |
| 5-A | 클레임 | claimCourse 원자적 조건부 update |
| 6-A | 연락처 | kakao URL 도메인 고정(피싱 차단) |
| 6-B | 프로필 | skillTags 개수·길이 상한 |
| 7-A | 평가 | 중복 evaluateeId 명시 차단 |

### 정책 미결 (코드 보류 — 사용자 결정 필요)
- **1-E 잔여**: 2명+ 팀 동료평가 일부 미제출 시 처리 → ①완료 N일 후 자동 마감(권장) ②교수/팀장 강제 마감 ③현행 자율.
- **1-C**: 멘토 0명 멘토링 팀 → 현행 유지 권장(강제 시 더 나쁜 부작용).
- **2-D**: `listForCourse` 설문 목록 비수강생 노출 → 읽기 개방 정책으로 현행 유지.

### 배포
모든 보완은 `server/*`·`client/*` 변경 → 프로덕션 반영은 **main 푸시(Railway 자동배포)** 필요. 사용자 요청 시 진행.

---

## 후속 개발 — 정책 미결/관찰 항목 구현 (2026-06-14)

사용자 지시("정리해둔 엣지케이스를 커버하도록 개발")로, 앞서 보류했던 항목을 구현으로 전환. `tsc` 통과·테스트 50건 통과.

### ✅ 1-E 평가 마감 기능 (완전 구현)
- **서버**: `closeEvaluation`(in_progress→done 원자 선점 후 `calculateBadges`, 5-B 패턴 재사용) + `evaluations.forceClose` 라우터(멤버·팀플·완료 검증).
- **클라**: TeamDetail — 내가 평가 완료 + 미제출자 대기(in_progress)면 **"지금 평가 마감하고 배지 정산"** 버튼, 전원 완료면 "배지 부여됨" 표시.
- **효과**: 2명+ 팀 일부 미제출로 영구 정체되던 1-E 잔여를, 팀원이 능동 마감 → 지금까지의 평가로 배지 정산.

### ✅ 4-A 마지막 운영자 강등 방지 (구현)
- **서버**: `countUsersByRole` + `admin.setUserRole` 가드 — 대상이 admin이고 강등인데 admin이 1명뿐이면 차단("마지막 운영자는 강등할 수 없습니다").

### ✅ 1-C 멘토 없는 멘토링 그룹 안내 (구현)
- **클라**: TeamDetail — 멘토링 팀 + 멘토 0명 + active면 "아직 멘토가 없는 멘토링 그룹" 안내. 정책(현행 유지)은 유지하되 사용자 인지를 보강.

### 남은 판단 필요(부작용·정책 충돌로 보류 — 사용자 결정 모아둠)
- **2-D**: `listForCourse` 설문 목록 비수강생 노출 → read 차단은 [[profile-gate-deeplink-intended]] 둘러보기 정책과 충돌. **현행 유지가 정책상 정합** — 바꾸려면 둘러보기 범위 재정의 필요.
- **3-B**: `verifySession` appId 일치 검증 → 켜면 기존 세션 토큰 무효화(전체 재로그인). 단일 시크릿이라 실익 낮음. **회귀 위험으로 보류**.
- **4-B**: 게시글 조회수 같은 유저 중복 카운트 → 방지하려면 `post_views`(postId,userId) 테이블 신설 = 마이그레이션. 단순 카운터 의도면 불필요. **비용 대비 가치 낮아 보류**.

---

## 사이클 8 — 수업 생성·수강 / 날짜·성능 (`server/routers.ts`, `db.ts`)

**점검·보완** 2026-06-14 — `tsc` 통과, 테스트 50건 통과.

**견고 확인**: `searchCourses`(와일드카드 이스케이프), `enrollCourse`(unique 멱등), 조회 함수 대부분 join 한방(N+1 아님).

### ✅ 8-A. 수업 생성 입력 길이 상한
- **위치**: `courses.create`
- **현상(전)**: `name`/`professor`/`university`가 `min(1)`만(max 없음) → 거대 페이로드.
- **조치**: name 200·professor/university 100·courseCode 50 상한 + `trim`.

### ✅ 8-E. 수강 취소 시 활성 팀 정합성 가드
- **위치**: `courses.unenroll` + `hasActiveTeamInCourse`(신규)
- **현상(전)**: 활성 팀이 있어도 수강 취소가 `userCourses`만 삭제 → **"비수강인데 그 수업 팀에 소속"** 불일치 + 팀 활동(일정·평가·AI) 지속.
- **조치**: 활성 팀이 있으면 수강 취소를 막고 "먼저 팀에서 나가라" 안내. (종류 무관 활성 팀 존재 검사 헬퍼 추가.)

### 관찰 (저영향)
- **8-B**: `courses.create`가 `protectedProcedure`라 누구나 수업 생성 + 중복 방지 없음 → 수업 직접 등록 모델로 보임(의도). 중복은 검색 품질에만 영향.
- **8-C**: `enroll`에 수업 존재/semester 형식 검증이 약함. 클라가 검색 결과에서 고르므로 낮음.
- **8-D**: `surveys.listForCourse`가 설문 수만큼 `hasRespondedSurvey` 호출(N+1). 수업당 설문 수가 적어 영향 미미 — 필요 시 배치 조회로 최적화 가능.

### 누적
코드 보완 **19건** (사이클 1~7: 14 + 후속 개발: 3 + 사이클 8: 2).

---

## 사이클 9 — 날짜·타임존 / 클라 상태 / 스키마 무결성 (견고 확인 — 보완 0)

**점검** 2026-06-14.

- **날짜/타임존 — 견고**: 일정 입력은 `datetime-local` + 로컬 파싱 + `isNaN` 검증, D-day는 today·due **양쪽 로컬 자정 정규화 + `Math.round`** → 타임존 오프바이원 없음.
- **클라 상태관리 — 견고**: mutation `onSuccess`의 `invalidate`가 적절(예: `forceClose`→`teams.get` 무효화로 평가 카드 자동 갱신).

### 👁 9-A. 스키마 외래키(FK) 부재 *(관찰 — 보류)*
- `references()`/`onDelete` **0개** — 정합성을 앱 레벨에서 관리(leaveTeam 수동 cascade 등). 잠재 고아: 팀 disband 시 `teamMatches`(accepted) 행이 잔존하나 조회되지 않아 영향 미미.
- FK 도입은 **마이그레이션 대공사 + 기존 고아 데이터 정리**가 필요 → 비용 대비 보류.

### 👁 9-B. 완료된 팀의 일정 추가 *(관찰 — 저영향)*
- `events.create`가 팀 `status`를 검사하지 않아 완료된 팀에도 일정 추가 가능. 무의미하나 무해.

### 수렴 판단
9개 사이클로 **서버 비즈니스 로직 · 라우터 · DB · 클라 게이트 · 날짜 · 수업 · 스키마**까지 전 영역 점검. **실질 코드 갭은 고갈 단계** — 남은 후보는 마이그레이션급 변경(FK·조회수 테이블) 또는 정책 결정 영역(2-D·3-B·4-B)으로, 자동 보완보다 사용자 판단이 맞는 영역.
