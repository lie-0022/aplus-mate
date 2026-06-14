# A+ Mate — 디벨롭 백로그 (개선 기회 발굴 + 구현 현황)

2026-06-14, 8개 영역 멀티에이전트 분석으로 40개 개선 기회를 발굴하고 효용×난이도로 우선순위화. 상위 12개 중 recommendNow 11건을 구현 진행.

## 구현 현황 (우선순위순)

| 순위 | 항목 | 영역 | 상태 |
|---|---|---|:---:|
| 1 | 게시글·댓글 삭제/숨김 (soft-hide, 작성자+운영자) | 안전 | ✅ 완료 |
| 2 | 학교명 자동완성·표준화 (university 정확일치 분절 방지) | 온보딩 | ✅ 완료 |
| 3 | 스킬 매칭도 정렬 + 공통 스킬 강조 | 매칭 | ✅ 완료 |
| 4 | 회원 탈퇴 (계정삭제·동의철회, PIPA 정합) | 안전 | ✅ 완료 |
| 5 | 팀 진척도 요약 바 (완료율·내담당·지연) | 협업 | ✅ 완료(TeamDetail) |
| 6 | 매칭·팀원 카드 신뢰 배지 노출 + 공개 프로필 | 배지 | ✅ 완료 |
| 7 | 첫 로그인 온보딩 체크리스트 | 온보딩 | ✅ 완료 |
| 8 | 설문 결과 CSV 내보내기 | 교수 | ✅ 완료 |
| 9 | 마감 임박/지연 산출물 대시보드(교수) | 교수 | ✅ 완료 |
| 10 | 인앱 알림센터 + notifications 테이블 | 알림 | ✅ 완료 |
| 12 | 사용자/콘텐츠 신고 기능 | 안전 | ✅ 완료 |

(11위 동료평가 교수 열람은 익명성 설계 판단 필요로 recommendNow=false — 별도 검토.)

## 완료 항목 구현 메모

- **1**: `posts`/`post_comments`에 `hiddenAt`(0011). `getCoursePosts`/`getPost`/`getPostComments`에 hidden 필터, 댓글은 익명 유지하며 `isMine`만 노출. `posts.remove`/`removeComment`(작성자 본인 or admin). PostDetail 삭제 버튼.
- **3**: CourseDetail 후보를 내 스킬과의 교집합 수로 정렬(useMemo 없이 렌더 내 계산), 겹치는 태그 강조 + "공통 스킬 N" 배지. 백엔드 무변경.
- **5**: TeamDetail 일정 카드 헤더에 진행률 바 + 내 담당 미완료·마감 지남 카운트. events.data 클라 집계. (Teams 목록 카드 버전은 getUserTeams 집계 보강 필요 — 추후.)
- **8**: Professor 설문 결과 카드에 CSV 버튼. getSurveyResults 데이터를 문항별 행으로 직렬화 + UTF-8 BOM 다운로드.
- **9**: Professor 현황 대시보드에 '마감 주의 산출물' 카드. milestones·submissions·teams 교차로 마감 지남/임박 + 미제출 N팀.

- **2**: `client/src/lib/universities.ts`(주요 대학 50) + ProfileSetup·Profile 학교 입력에 네이티브 `datalist`(검색·자동완성·직접입력). 표기 분절로 매칭풀이 쪼개지는 침묵형 버그 완화.
- **4**: `deletedAt`(0012) + `deleteSelf`(PII 익명화 + 활성팀 자동 leaveTeam + pending 매칭 정리, 트랜잭션) + Profile 탈퇴 다이얼로그→로그아웃. Privacy 약관-구현 불일치(PIPA) 해소.
- **6**: 공유 `UserBadges` 컴포넌트 + `/users/:id` 공개 프로필(`getPublic` 재사용, 실명 가림·배지·스킬) + CourseDetail 후보·MatchingRequests 요청자 카드 탭 연결. 배지를 의사결정자에게 노출.
- **7**: Dashboard 상단 '시작하기' 체크리스트(프로필/수업등록/첫커넥트, `matching.sent`·`courses`·`activeTeams`로 판정, 완료 시 자동 숨김).
- **10**: `notifications`(0014) + `createNotification` 헬퍼 + 매칭 수락 시 요청자 알림·공지 시 수강생 fanout + `notifications` 라우터(list/unreadCount/markRead/markAllRead) + AppLayout 헤더 Bell을 알림센터(미읽음 배지·목록·linkPath 이동·읽음처리)로 승격. 비대칭 매칭의 결과 통보 채널 확보.
- **12**: `reports`(0013, 중복신고 unique) + `reports.create`·`admin.reports/resolveReport` + 공유 `ReportDialog` + PostDetail 게시글·댓글 신고(본인이면 삭제) + Admin 신고 큐. mailto → in-app 자정 루프.

## 발굴되었으나 우선순위 밖(참고)

학년/스킬 칩 필터, bio 필드, 팀 메모 보드, 팀 R&R, AI보고서에 활동 컨텍스트 주입, 배지 티어, 동의 철회 흐름, 사용자 차단, 공지 수정/삭제, 교수 팀 진척도 등. (전체는 워크플로우 산출물 참조.)
