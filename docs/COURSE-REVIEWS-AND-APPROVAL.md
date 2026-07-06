# 수업 리뷰 & 교수 팀 승인 (2026-07-07)

> 목표(사용자 /goal): 학생이 수업에 대해 **① 이 수업에 팀플이 있는지**, **② A+ Mate로 미리 팀을
> 짜면 교수님이 확인·허락해준다는 것**이 명확하게 드러나고, **③ 수강 리뷰를 작성**할 수 있게.

## 1. 수업 리뷰 (course_reviews)

**스키마** `drizzle/schema.ts` — `course_reviews`: courseId·userId·rating(1~5)·
hadTeamProject(bool|null)·content(≤500)·semester. `uniq(courseId,userId)` — 1인 1리뷰(업서트).
마이그레이션 `0018_loud_madame_hydra.sql` (부팅 자동 적용).

**서버** `server/db.ts` + `server/routers.ts` `reviews.*`
- `list` — 익명 목록(작성자 식별정보 없음, 내 것만 `isMine`).
- `summary` — `{count, avgRating, teamYes, teamNo}`. **teamYes/teamNo가 "이 수업 팀플 있나요?"를
  수강생 경험(크라우드소싱)으로 답한다** — 공식 `hasTeamProject` 플래그의 보완.
- `upsert` — **수강생만**(현·과거 학기, `isUserEnrolled`) 작성 가능. `onDuplicateKeyUpdate`로 재작성.
- `remove` — 본인 것만.

**UI** `CourseDetail.tsx` 정보 탭 — "수강 리뷰" 카드:
- 요약: 평균 별점(큰 숫자+별) · 리뷰 N개 · **"수강생 N명 중 M명이 '팀플 있었어요'"** 하이라이트.
- 목록 3개 + 더 보기 토글. 각 항목: 별점·팀플 있었음/없었음 알약·한줄평·학기·(내 리뷰 삭제).
- 작성 다이얼로그: 별점 5개(탭) · **"이 수업에 팀플이 있었나요?"** 세그먼트(있었어요/없었어요/기억 안 나요) ·
  한줄평(선택). 내 리뷰가 있으면 "내 리뷰 수정"으로 프리필.
- 배치: 모바일=공지·설문 아래 / PC=우측 레일.

## 2. 교수 팀 승인 (teams.professorApprovedAt)

**스키마** — `teams.professorApprovedAt: timestamp|null`.

**서버** — `db.setTeamProfessorApproval(professorId, teamId, approved)`:
팀→수업→담당 교수(courses.professorId) 검증 후 승인 시각 set/clear.
라우터 `professor.approveTeam {teamId, approved}` (professorProcedure).

**UI**
- **Professor 팀 현황**: 팀 카드에 "이 팀 승인"(secondary) / "승인 취소"(ghost) + "승인함" pos 칩.
- **학생**: `Teams` 카드·`TeamDetail` 히어로·요약 레일에 **"교수님 승인"**(BadgeCheck, `badge-pos`) 칩.
- **CourseDetail 팀원 찾기 탭 배너**(교수 인증 수업일 때, `bg-secondary`):
  "교수님이 함께 보는 수업이에요 — 여기서 미리 팀을 만들면 교수님 팀 현황에 그대로 표시되고,
  교수님 승인을 받을 수 있어요." (모바일=탭 상단 / PC=레일 상단)

**수업 검색 연동** — `courses.search`가 `getReviewSummariesForCourses`(벌크, N+1 방지)로
`reviewSummary`를 붙여 반환. Courses 검색 카드에 "⭐4.2 리뷰 12 · 팀플 있었대요 8/9" 표시 —
수업을 고르는 순간에 즉답.

## 팀플 유무가 드러나는 3중 신호
1. 공식 플래그: 수업 헤더 `팀플` 태그(hasTeamProject) + `교수님 인증` 칩(professorId).
2. 크라우드소싱: 리뷰 요약 "수강생 N명 중 M명 팀플 있었어요".
3. 살아있는 증거: 팀원 찾기 탭의 모집공고·팀 현황 + 교수 승인 칩.

## 검증
tsc ✓ · vitest 50/50 ✓ · build ✓ · DB 없는 프로덕션 부팅 스모크 ✓ (마이그레이션은 Railway 부팅서 자동).
