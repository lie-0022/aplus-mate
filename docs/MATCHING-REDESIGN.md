# 매칭·모집 재설계 (Matching Redesign)

> 현행 매칭이 "게시판에 같이하실분? 올리기" 수준으로 원초적이라는 피드백에서 출발.
> 목표: **모집(공고)과 매칭(연결)을 하나의 구조화된 흐름**으로 통합해 "효율적으로 팀원 구하기".

---

## 1. 현행 진단 (코드 근거)

| # | 문제 | 근거 |
|---|---|---|
| 1 | **채널 이원화** | 매칭(`CourseDetail` 팀원찾기 → 커넥트, pull) vs 게시판(`posts` "스터디" 자유글, push)이 분리·혼란 |
| 2 | **의도 표현 불가** | `createMatchRequest`는 `receiverId/courseId/matchType/role`만 — **메시지 필드 없음** |
| 3 | **모집글 비구조화** | 게시판 글은 자유 텍스트. 정원·필요 스킬·모집 상태 없음 → 댓글로 협상 |
| 4 | **발견성 부족** | "지금 모집 중인 팀/개인"을 찾을 메커니즘 없음. 팀원찾기는 개인만 나열 |
| 5 | **상태/생명주기 불명확** | 요청 후 진행 안 보임, rejected 후 재요청 가능 여부 불명확 |

핵심: **모집 의사(나 팀 구해요)를 구조적으로 표현·발견·지원**하는 흐름이 없다.

---

## 2. 재설계: "모집 공고 + 원클릭 지원"

### 개념
- **모집 공고(Recruitment)**를 1급 기능으로. 게시판 자유글 → **구조화된 공고 카드**.
- 공고에 담기는 것: `모집 타입(팀플/스터디/멘토링) · 필요 인원 · 원하는 스킬/조건 · 한줄 소개 · 모집 상태(모집중/마감)`.
- 다른 학생은 공고를 보고 **"지원하기"** 한 번으로 매칭 요청(+메시지). 모집자가 지원자 목록에서 수락 → 팀 합류.

### 두 방향 모두 지원
- **Pull (기존, 개선)**: 팀원찾기에서 학생 카드 보고 **커넥트 + 메시지**.
- **Push (신규)**: 모집 공고 올리고 **지원받기**.

### 흐름 비교
```
[현행]  팀 필요 → (A) 학생 일일이 커넥트  OR  (B) 게시판에 "같이하실분?" → 댓글 협상
[재설계] 팀 필요 → 모집 공고 등록(타입·정원·스킬·상태)
                  ↓ 다른 학생이 공고 목록에서 발견
                  ↓ "지원하기"(+메시지) = 매칭 요청
                  ↓ 모집자가 지원자 보고 수락
                  ↓ 자동 팀 합류 (기존 acceptMatch 재사용)
```

---

## 3. 구현 단계

### 스키마 (drizzle/schema.ts)
- **`recruitments`** 신규 테이블:
  `id, courseId, authorId, teamId(nullable·기존 팀 추가모집), matchType, title, description, desiredSkills(JSON), neededCount, status(open|closed), createdAt, closedAt`
- **`teamMatches`** 컬럼 추가:
  `message text(지원/요청 메시지), recruitmentId int(공고 경유 지원이면 연결)`
- 지원(application)은 **teamMatches 재사용**: 지원자=requester, 모집자=receiver, message+recruitmentId. 수락은 기존 `acceptMatch`.

### 서버 (db.ts / routers.ts)
- `createRecruitment / listRecruitments(courseId, openOnly) / closeRecruitment`
- `applyToRecruitment` = createMatchRequest + message + recruitmentId
- `getRecruitmentApplicants(recruitmentId)` (모집자용 지원자 목록)
- 정원 차거나 수동 마감 시 status=closed

### UI
- **CourseDetail**: "팀원 찾기" 탭을 **① 모집 공고(둘러보기·지원) ② 직접 찾기(학생 카드·커넥트)** 로 재구성 + "모집 공고 올리기"
- **공고 카드**: 타입 배지·남은 자리·필요 스킬·모집중/마감
- **지원 모달**: 메시지 입력
- **MatchingRequests**: 내가 올린 공고의 지원자 / 내 지원 현황 통합

### 검증·배포
- 타입체크·빌드 → `redesign/...` 브랜치 → 검토 → 배포

---

## 4. 원칙
- 기존 매칭 함수(acceptMatch 정원·역할·트랜잭션)는 **재사용** — 검증 로직 중복 안 만든다.
- 게시판 "스터디" 카테고리는 정보 공유로 남기되, **모집은 공고로 분리**해 역할을 명확히.
- 메시지·상태 가시성으로 "왜 너를 골랐나 / 내 요청 어디까지 갔나"를 해소.
