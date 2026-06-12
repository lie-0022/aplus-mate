# 로컬 테스트 체크리스트 (Chrome) — 페이지별

> 환경: 로컬 dev 서버(localhost:3000) + Docker MySQL + 시드 데이터. 로그인: `http://localhost:3000/api/dev/login` (dev-local, admin). 로그아웃: `/api/dev/logout`. 다른 유저로: `/api/dev/login?as=dev-local-2`.
> 시드(`scripts/dev-seed.ts`): dev-local(개발테스트,admin)·dev-local-2(윤어진) / 인공지능(둘다수강)·소프트웨어공학(dev-local만).

| # | 페이지 | URL | 확인 항목 | 상태 |
|---|---|---|---|---|
| 1 | Home | `/` (로그아웃) | 카피(같은 수업 팀원 찾기/로그인 안내), 기능카드 | ✅ 확인됨 |
| 2 | Dashboard | `/dashboard` | 인사+카운트(수강2), 내 수업 카드 2개 | ⬜ |
| 3 | Courses | `/courses` | 내 수업 2개(해제 버튼), 수업 검색·생성 | ⬜ |
| 4 | **CourseDetail(공동수강)** | `/courses/{AI}` | 팀탭에 **윤어진 카드 + 커넥트** 노출(본인 제외) | ⬜ |
| 5 | **CourseDetail(솔로)** | `/courses/{SE}` | 팀탭 **"등록한 다른 학생 없어요 + 초대 링크 복사"** | ⬜ |
| 6 | **CourseDetail(미등록)** | `/courses/{새코스}` | 팀탭 **"이 수업 등록하기" CTA** → 등록 후 즉시 팀탭 활성 | ⬜ |
| 7 | **cold 딥링크** | 로그아웃→`/courses/{id}`→login→복원 | 로그인 후 그 수업으로 복원(/dashboard 아님) | ⬜ |
| 8 | MatchingRequests | `/matching/requests` | dev-local-2가 보낸 요청 수락 → **팀 화면 이동** | ⬜ |
| 9 | Teams | `/teams` | 팀 목록 | ⬜ |
| 10 | TeamDetail | `/teams/{id}` | 팀원·오픈채팅 링크 + **안전수칙 고지(신규)** | ⬜ |
| 11 | TeamEvaluate | `/teams/{id}/evaluate` | 평가 폼 + **이의제기/블라인드 고지(신규)** | ⬜ |
| 12 | 만19세 게이트 | ProfileSetup | 미체크 시 제출 차단 | ⬜ |
| 13 | admin API | `/api/trpc/admin.pendingMatches` | (admin) pending 매칭 JSON 반환 | ⬜ |

## 매칭 플로우 E2E (시드 후)
1. `/api/dev/login?as=dev-local-2` → 윤어진으로 로그인 → `/courses/{AI}` → 개발테스트에게 커넥트 전송
2. `/api/dev/login` → 개발테스트(admin)로 로그인 → `/matching/requests` → 수락 → 팀 생성·이동
3. `/teams/{id}` → 오픈채팅 링크·안전수칙 → 팀플 완료 → 평가 → 배지

## 발견 이슈 기록
(테스트하며 여기에 기록 → 수정 → 재테스트)
