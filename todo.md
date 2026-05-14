# A+ Mate - Project TODO

## DB & Schema
- [x] users 테이블 확장 (university, department, year, skill_tags, kakao_openchat_url)
- [x] courses 테이블 생성
- [x] user_courses 테이블 생성
- [x] posts 테이블 생성
- [x] team_matches 테이블 생성
- [x] teams 테이블 생성
- [x] team_members 테이블 생성
- [x] evaluations 테이블 생성
- [x] badges 테이블 생성
- [x] 유니크 제약 추가 (중복 방지)

## Design & Layout
- [x] 보라(#5B2FBE) + 하늘색(#4DA8DA) 테마 적용
- [x] 모바일 우선 반응형 글로벌 레이아웃 (하단 네비게이션)
- [x] 랜딩 페이지 (비로그인 사용자용)

## Backend API (tRPC)
- [x] 프로필 설정/수정 API (university, department, year, skill_tags, kakao_openchat_url)
- [x] 수업 CRUD API (생성, 검색, 조회)
- [x] 수강 등록/해제 API
- [x] 게시글 CRUD API
- [x] 팀원 매칭 요청/수락/거절 API (중복 매칭 방지 포함)
- [x] 팀 생성/관리 API
- [x] 블라인드 평가 제출 API
- [x] 배지 자동 부여 로직 API
- [x] 대시보드 데이터 조회 API

## Frontend Pages
- [x] 대시보드 페이지 (/dashboard)
- [x] 프로필 설정 페이지 (/profile/setup) - 최초 가입 후
- [x] 프로필 조회/수정 페이지 (/profile)
- [x] 수업 목록/검색/등록 페이지 (/courses)
- [x] 수업 상세 페이지 (/courses/:id) - 정보 + 팀원 찾기
- [x] 매칭 요청 페이지 (/matching/requests)
- [x] 팀 목록 페이지 (/teams)
- [x] 팀 상세 페이지 (/teams/:id) - 팀원 정보 + 오픈채팅 링크
- [x] 팀원 평가 페이지 (/teams/:id/evaluate)

## Business Logic
- [x] 수강 검증 (매칭 전 양쪽 모두 해당 수업 수강 확인)
- [x] 중복 매칭 방지 (같은 수업에서 이미 accepted 매칭 있으면 불가)
- [x] 정보 단계 공개 (매칭 수락 후에만 카카오 오픈채팅 링크 공개)
- [x] 배지 트리거 (전원 평가 완료 시 배지 부여)
- [x] 배지 기준 (항목별 평균 ≥ 4.0이면 배지 +1)

## Testing & Bug Fixes
- [x] 핵심 API 라우터 vitest 테스트 (27개 통과)
- [x] skillTags JSON 문자열 파싱 에러 수정
- [x] E2E 테스트 시나리오 문서화 (23개 E2E 테스트 케이스)
- [x] 총 50개 테스트 통과 (auth 1 + aplus 26 + e2e 23)

## Concurrency & Race Condition Fixes
- [x] DB 유니크 제약 추가 (중복 방지: teamMatches, teamMembers, evaluations, teams)
- [x] 매칭 요청 중복 방지 검증 (unique constraint on requesterId+receiverId+courseId+status)
- [x] 팀 생성 시 중복 팀 생성 방지 (unique constraint on matchId + idempotency)
- [x] 팀 완료 프로세스 동시성 문제 해결 (WHERE status='active' 조건부 UPDATE)
- [x] 평가 제출 시 모든 팀원 평가 필수 검증 (router 로직)
- [x] 평가 제출 후 자동 배지 부여 검증 (calculateBadges 호출)
- [x] 이미 평가한 사람이 다시 평가 시도 방지 (unique constraint + try-catch)
- [x] 팀원 권한 검증 (teams.get, teams.complete에서 isMember 체크)
- [x] 프로필 미완성 상태에서 매칭 요청 방지 (profileCompleted 검증)
- [x] 수업 미등록 상태에서 매칭 요청 방지 (isUserEnrolled 검증)
- [x] 동시 다중 요청 처리 (unique constraints + try-catch)
- [x] 중복 팀 생성 race condition 처리 (acceptMatch에서 idempotency 추가)
- [x] 배지 중복 계산 race condition 처리 (ON DUPLICATE KEY UPDATE로 원자적 증가)
- [x] 에러 메시지 개선 (사용자 친화적 메시지 추가)

## Known Limitations & Future Work
- [ ] 세 명 이상 직접 매칭: 현재 2명 매칭만 지원 (향후 팀 초대 기능으로 확장 가능)
- [ ] 팀원 추방/탈퇴 기능: 현재 미구현
- [ ] 평가 수정 기능: 현재 미구현
- [ ] 실시간 알림: 매칭 요청/수락 시 알림 기능
- [ ] 프로필 사진 업로드: S3 스토리지 연동
- [ ] 수업 게시판 UI 확장: 게시글 작성/조회 UI 개선


## Layout & UX Fixes
- [x] 데스크탑 전체화면에서 왼쪽 메뉴바 오버레이 문제 해결 (섹션 분할 레이아웃)
- [x] 대시보드 라우팅 문제 해결 (App.tsx 리다이렉트 로직)
