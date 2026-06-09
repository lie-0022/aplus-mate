# A+ Mate — 코드 구현 계획 (Phase B, 단계별)

> 출처: `docs/FIRST-USERS-PLAN.md` §4 Phase B. 여기서는 **코드 레벨로 잘게 쪼갠 실행 로드맵**이다.
> 진행 방식: 각 Step마다 **① 스펙(프롬프트) 작성 → ② 구현 → ③ 검증(pnpm check + 해당 테스트) → ④ 커밋(요청 시)**.
> 브랜치: `feat/first-users-phase-b` (main 직접 수정 금지). 검증: `pnpm check`(타입), `pnpm test`(50건 유지), 동작은 §A2 라이브 스모크.

## 의존 순서 (작은 위험·높은 효과부터)

| Step | 내용 | 파일 | 위험 | 효과 | 상태 |
|---|---|---|---|---|---|
| **1** | profileCompleted 게이트 정합화 (kakao·skillTags 제거) | `server/db.ts` | 낮음(서버 1줄) | **매칭 차단 해제** | ✅ check+test 통과 |
| **2** | 수신자 navigate (1줄) + acceptMatch 반환 활용 | `client/.../MatchingRequests.tsx` | 낮음 | 수락 즉시 팀 화면 | ✅ check 통과 |
| **3** | enrollment-aware CourseDetail (students 게이트 + isError + enroll CTA + invalidate) | `client/.../CourseDetail.tsx` | 중간 | **딥링크 등록 동작** | ✅ check 통과 |
| **4** | cold 딥링크 경로 보존 (ProtectedPage 저장 + App.tsx/ProfileSetup 복원) | `client/src/App.tsx`, `ProfileSetup.tsx` | 중간 | **딥링크 온보딩 완성** | ✅ check+test 통과 |
| **5** | 카피 정직화 (미구현 기능 문구 제거 + 신뢰 이양) | `Home.tsx` | 낮음 | 정직성·이탈 방지 | ✅ check 통과 |
| **6** | 만 19세 확인 게이트 | `ProfileSetup.tsx` | 낮음 | 미성년 동의 안전 | ✅ check 통과 |
| **7** | (선택) 신규 회귀 테스트 | `server/*.test.ts` | 낮음 | 회귀 방지 | ⏸ 보류 — 현 테스트 인프라(라우터 단위·DB 없음)로는 클라/게이트 변경의 의미있는 회귀가 어려움. 실동작은 §A2 라이브 스모크로 검증 권장 |

> **이번 1차 코호트 범위:** Step 1~6. Step 7은 시간 되면. **제외:** consents 테이블·약관 페이지(B3, 스키마 변경 → 별도 세션), searchCourses LIKE, AI도구, 결제/보고서.
> consents/약관(B3)은 법적 출시 게이트이므로 **실제 학생 받기 직전**에 별도로. 단계 1~6은 "퍼널이 코드상 돌아가게" 만드는 작업.

## Phase C — 운영 준비 (결정 불필요 서버 코드)

| Step | 내용 | 파일 | 상태 |
|---|---|---|---|
| **8** | PII 실명 마스킹 (매칭 전 응답 payload에서 name 제거; getTeamDetail은 유지) | `server/db.ts` | ✅ check+test 통과 |
| **9** | 운영자 pending 매칭 조회 (admin 전용 read-only 라우터 `admin.pendingMatches`) | `server/routers.ts`, `db.ts` | ✅ check+test 통과 |

> B3(동의·약관·consents 테이블)은 스키마 변경 + 법적 텍스트라 **사용자 결정 필요** → 자동 진행 안 함. 나머지 Phase C(런북·SLA)는 코드가 아니라 문서.

## 자동 검증 & 코드 리뷰 (Step 1~9 완료 후)

정적·런타임·리뷰 4중 검증:

| 검사 | 결과 |
|---|---|
| `pnpm check` (타입) | ✅ |
| `pnpm test` (50건) | ✅ |
| `pnpm build` (vite+esbuild 프로덕션) | ✅ |
| 서버 부팅 + `/` 200 + tRPC `auth.me` 응답 (라우터 로드) | ✅ |
| 다각도 코드 리뷰 (7 앵글 → 검증, 40 후보) | 실제 버그 3건 발견 → **수정** |

**리뷰가 잡은 실제 버그 (전부 수정·재검증):**
1. **returnTo 자기참조** — `/profile/setup` 딥링크 시 완료 후 설정 화면에 갇힘 → 제외 경로 처리
2. **stale returnTo** — 중단된 값이 나중 로그인을 옛 딥링크로 납치 → TTL(30분) 만료
3. **학기 불일치** — `students` 쿼리에 semester 누락으로 과거 학기 수강생 혼합 → `CURRENT_SEMESTER` 스코프
- → returnTo 로직을 `client/src/lib/returnTo.ts` **단일 모듈로 중앙화**(altitude 개선).

**남긴 한계(버그 아님 / 스키마 필요):**
- skillTags 미수집 → 카드 스킬 배지 빈칸 (graceful, ProfileSetup에 skillTags UI 추가 시 해소)
- 만19세 클라 전용 (서버 강제는 나이 필드=B3 스키마 필요)
- 서버 `isUserEnrolled` 학기-무관 (코호트엔 영향 없음; 전체 학기-인지화는 매칭 게이트 변경=별도)

## 각 Step 공통 수용 기준
- `pnpm check` 타입 에러 0
- `pnpm test` 50건 유지(또는 의도된 변경 반영)
- 변경이 다른 사용처를 깨지 않음(grep로 사용처 확인)
- 사용자 대면 메시지는 한국어 톤 유지

---

## Step 1 — profileCompleted 게이트 정합화

**스펙(프롬프트):**
> `server/db.ts`의 `updateUserProfile`에서 `profileCompleted`를 결정하는 조건(현재 `university && department && year && kakaoOpenChatUrl && skillTags`)을 **`university && department && year`만**으로 바꾼다. 이유: ProfileSetup은 kakao를 "(선택)"으로 보내고 skillTags를 아예 수집하지 않으므로, 정상적으로 프로필을 채운 학생도 `profileCompleted=false`에 영구 고정되어 매칭(`createMatchRequest`의 `profileCompleted` 검증)이 영영 안 열린다. kakao는 매칭 수락 후(연락 단계)에 받으면 된다.

**파일:** `server/db.ts` (line 114-115)
**수용 기준:** university/department/year만 채우면 `profileCompleted=true`. `pnpm check` 통과. 매칭 게이트(db.ts:302)·라우팅(App.tsx:54) 사용처 무영향.

(Step 2~7 스펙은 각 단계 도달 시 작성)
