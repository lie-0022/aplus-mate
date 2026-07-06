# Teams (내 팀) 리디자인 기록

- 목업: [`mockups/teams.html`](mockups/teams.html) (라이트/다크 × 진행 중/완료 × 모바일/PC × 데이터/빈)
- 대상 코드: `client/src/pages/Teams.tsx`
- 상태: **✅ 구현·배포 완료** (2026-07-06)
- 화면 구성: 헤더(내 팀) + 탭 [진행 중 / 완료] + 팀 카드(수업·교수 + 타입·평가상태 뱃지 + 멤버 칩)

## 기존 → 수정본 (디자인 결정)

- **팀 카드**: `border+shadow-none` → `bg-card shadow-card rounded-[18px]`, 화살표 `ArrowRight` → `ChevronRight`.
- **타입 뱃지**(팀플/스터디/멘토·멘티): outline → **중립 알약**(`badge-tag`).
- **평가 상태**: `bg-amber-100 text-amber-700`(진행 중)·`bg-green-100 text-green-700`(완료) 하드코딩(다크에서 튐) → **다크안전 알약**: 진행 중=`badge-notice`(피치), 완료=`badge-pos`(그린).
- **멤버 칩**: `bg-muted rounded-full` 유지(적절).
- **빈 상태**: 점선 `Card` → 카드화(`bg-card shadow-card`) + 2줄 카피(탭별: 진행 중=팀 만들기 안내 / 완료=활동 끝난 팀).
- **PC = 메인+우측레일**: 메인=팀 카드 1열, **레일=팀 현황(진행 N·완료 N) + 안내**("팀 누르면 멤버·오픈채팅·일정·(팀플)평가, 새 팀은 수업 상세 팀원 찾기에서"). 진행·완료 탭 공통 레일.
- 죽은 import 제거(Card·CardContent·Badge·Button, ArrowRight).

## 토큰
신규 없음 — MatchingRequests에서 추가한 `notice`·`pos` 토큰과 `.badge-notice`·`.badge-pos` 유틸 재사용.

## QA (크롬 실측)
스캐폴드 유니크 클래스명 → `.pbody` 충돌 없음. PC `pbody` flex·사이드바 412px 전체높이·같은 행, 라이트/다크 × 진행/완료 × 모바일/PC × 데이터/빈 전 조합 정상(평가 상태칩 다크 안전 확인).
