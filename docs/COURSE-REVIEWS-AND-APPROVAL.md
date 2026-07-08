# 수업 리뷰 & 교수 팀 승인 (2026-07-07)

> 목표(사용자 /goal): 학생이 수업에 대해 **① 이 수업에 팀플이 있는지**, **② A+ Mate로 미리 팀을
> 짜면 교수님이 확인·허락해준다는 것**이 명확하게 드러나고, **③ 수강 리뷰를 작성**할 수 있게.

## 1. 수업 리뷰 (course_reviews)

**스키마** `drizzle/schema.ts` — `course_reviews`: courseId·userId·rating(1~5)·
hadTeamProject(bool|null)·**teamSize(int|null)**·**projectTypes(json string[]|null)**·
**preformAllowed(bool|null)**·content(≤500)·semester. `uniq(courseId,userId)` — 1인 1리뷰(업서트).
마이그레이션 `0018_loud_madame_hydra.sql`(최초) + **`0019_busy_starhawk.sql`(팀 규모·유형·미리팀 3필드,
TiDB용 JSON DEFAULT 없이 생성)** — 부팅 자동 적용.

> **2026-07-08 확장(사용자 요청)**: 학생에게 더 풍부한 팀플 데이터를 받고, 그 데이터를 **메인으로**
> 노출해 다른 학생이 "이 수업에서 A+ Mate로 팀원을 구해갈지" 판단하게 한다.
> 받는 데이터: ① 팀플 유무 ② **이번 학기 본인 팀 인원(teamSize)** ③ **팀플 유형(projectTypes:
> 발표·개발·제작·보고서·논문·설계·기획·실험·실습·기타)** ④ **미리 짠 팀 교수 허용 여부(preformAllowed)**.

**서버** `server/db.ts` + `server/routers.ts` `reviews.*`
- `list` — 익명 목록(작성자 식별정보 없음, 내 것만 `isMine`). 각 항목에 teamSize·projectTypes·preformAllowed 포함.
- `summary` — `CourseReviewSummary {count, avgRating, teamYes, teamNo, avgTeamSize, preformYes,
  preformNo, projectTypes:{type,count}[]}`. **teamYes/teamNo가 "이 수업 팀플 있나요?"를
  수강생 경험(크라우드소싱)으로 답하고**, avgTeamSize·projectTypes·preform이 "어떤 팀플인지·미리 팀
  짜가도 되는지"까지 답한다 — 공식 `hasTeamProject` 플래그의 보완.
- `upsert` — **수강생만**(현·과거 학기, `isUserEnrolled`) 작성. 입력에 teamSize(1~20)·
  projectTypes(≤6)·preformAllowed 추가. `onDuplicateKeyUpdate`로 재작성.
- `remove` — 본인 것만.

**UI** `CourseDetail.tsx` 정보 탭 — "수강 리뷰" 카드:
- 요약: 평균 별점(큰 숫자+별) · 리뷰 N개.
- **"이 수업 팀플 한눈에" 데이터 블록**: 팀플(수강생 N명 중 M명) · 보통 팀 규모(약 X명) ·
  팀플 유형 상위 3개 칩(빈도) · 미리 짠 팀(교수 허용 P · 불가 Q).
- **종합 판정 배너**: 팀플 있고 미리팀 허용>불가 → "✨ 미리 팀 짜서 가기 좋은 수업"(pos);
  불가>허용 → "교수님이 팀을 직접 정하는 편"(notice). → A+ Mate로 팀원 구할지 결정 신호.
- 목록 3개 + 더 보기 토글. 각 항목: 별점·팀플 있었음/없었음·**N명 팀·유형 칩·미리팀 허용/불가 칩**·
  한줄평·학기·(내 리뷰 삭제).
- 작성 다이얼로그: 별점 5개(탭) · "이 수업에 팀플이 있었나요?" 세그먼트 · **팀플=있었어요일 때만**
  펼쳐지는 상세(팀 인원 숫자 입력 · 팀플 유형 멀티선택 칩 · 미리팀 허용 세그먼트) · 한줄평(선택).
  내 리뷰가 있으면 모든 필드 프리필.
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
`reviewSummary`(`CourseReviewMini`: count·avgRating·teamYes·teamNo·**avgTeamSize·preformYes·preformNo**)를
붙여 반환. Courses 검색 카드에 "⭐4.2 리뷰 12 · 팀플 있었대요 8/9 · **보통 4명 · 미리팀 OK**" 표시 —
수업을 고르는 순간에 즉답.

## 팀플 유무가 드러나는 3중 신호
1. 공식 플래그: 수업 헤더 `팀플` 태그(hasTeamProject) + `교수님 인증` 칩(professorId).
2. 크라우드소싱: 리뷰 요약 "수강생 N명 중 M명 팀플 있었어요" + 팀 규모·유형·미리팀 허용.
3. 살아있는 증거: 팀원 찾기 탭의 모집공고·팀 현황 + 교수 승인 칩.

## 검증
tsc ✓ · build ✓. 확장(0019) TiDB 적용 완료 — 마이그레이션은 Render 부팅서 자동.
