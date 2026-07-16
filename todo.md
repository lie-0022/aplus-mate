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

## 소프트런치 준비 & 리뷰 생태계 (2026-07)
> 아래는 초기 명세 이후 확장분 요약. 상세는 git 히스토리·docs/ 참조(이 파일은 개요만 유지).
- [x] 수업 후기 시스템: 별점·팀플 유무·팀규모·유형·미리팀 허용·한줄평(익명, 40자 필수), courseGroupId 단위 집계·학기 승계
- [x] 후기 "도움돼요"(1인 1표, 도움순 정렬) + 내가 쓴 후기 모아보기(프로필)
- [x] 익명 리뷰 신고 + 운영자 모더레이션(신고 내용 미리보기 → 삭제/무혐의)
- [x] 리워드 이벤트(선착순 + 40자) + 운영자 리뷰 현황 화면
- [x] 온보딩 체크리스트에 "들었던 수업 후기 남기기" 단계
- [x] 백석대 도메인 제한(ALLOWED_EMAIL_DOMAINS) + 인증 에러 브랜드 페이지 + prompt=select_account
- [x] OG 링크 미리보기(og-image) + 수업 공유 버튼(Web Share)
- [x] 시간표: 내 시간표 격자·개인일정·공강 매칭, 짜보기 플래너, 봐주세요 게시판, 에타 이미지 반입
- [x] 매칭 재설계: 모집공고+지원, 스터디·멘토링 courseGroupId 분반 확장

## 앱 전환 (docs/MOBILE.md)
- [x] PWA 완성(서비스워커·오프라인 폴백·manifest id) — iOS/안드로이드 "홈 화면에 추가"
- [x] 안드로이드 TWA 기반(업로드 키·assetlinks·패키지 com.aplusmate.app)
- [ ] Google Play 개발자 계정 $25 등록 → bubblewrap 빌드 → 비공개 테스트 트랙 (사용자 결정)
- [ ] iOS App Store: Capacitor + 구글 OAuth 딥링크 재작업($99/년, 수요 확인 후)

## 다음 개발 백로그 (value-ordered)
- [ ] 검색 정렬(리뷰순/별점순) — 단, courseGroupId 집계와 맞물린 SQL 정렬 필요(부분집합 정렬 금지)
- [ ] 초기 번들 코드 스플리팅(라우트 lazy) — 현재 ~870KB, Render 콜드스타트+모바일 첫 로드 개선
- [ ] 대시보드 "내 수업"에 후기 작성 여부 표시 → 미작성분 바로 쓰기 유도
- [ ] 실시간/푸시 알림(웹푸시 → 추후 TWA/네이티브)
