# MatchingRequests 리디자인 기록

- 목업: [`mockups/matchingrequests.html`](mockups/matchingrequests.html) (라이트/다크 × 받은/보낸 × 모바일/PC × 데이터/빈)
- 대상 코드: `client/src/pages/MatchingRequests.tsx`
- 상태: **✅ 구현·배포 완료** (2026-07-06)
- 화면 구성: 헤더(매칭 요청 + 카운트) + 탭 [받은 요청 / 보낸 요청] + 카드 리스트

## 기존 → 수정본 (디자인 결정)

- **카운트 뱃지**: `gradient-primary` → 솔리드 `bg-primary` 알약.
- **요청 카드**: `border+shadow-none` → `bg-card shadow-card rounded-[18px]`.
- **뱃지 정리**:
  - 수업(secondary)·타입(outline) → **중립 알약**(`badge-tag`).
  - 멘토링 역할 `bg-sky-100 text-sky-700`(하드코딩, 다크에서 뜸) → **다크안전 소프트 스카이**(`badge-sky` + `--sky-badge-*` 토큰).
  - 📋 모집 지원 보라칩(`bg-primary/15`) → **notice 알약**(`badge-notice`).
- **스킬 태그**: outline → 중립 알약.
- **액션**: 수락 `gradient-primary` → 솔리드 `Button`(default) / 거절·요청취소 outline → **테두리 없는 `secondary`**.
- **메시지 박스**: `bg-muted/50` → `bg-muted`.
- **빈 상태**: 점선 `Card` → 카드화(`bg-card shadow-card`).
- **PC = 메인+우측레일**: 메인=요청 카드 1열, **레일=요청 현황(받은 N·보낸 N) + 안내**("수락하면 오픈채팅 연결·팀 자동 생성, 거절·취소는 알림 없이"). 받은·보낸 탭 공통 레일.
- 죽은 코드 제거(BADGE_ICONS·BADGE_LABELS + Shield/Lightbulb/Clock).

## 추가된 토큰 (`client/src/index.css`)
- `--sky-badge-bg/-fg` (멘토링 등 정보 칩): 라이트 `#e7eefd`/`#2e7df0`, 다크 `rgba(143,196,255,.14)`/`#9ccbff`.
- 유틸: `.badge-sky`, `.badge-notice`(= notice 색 알약, 기존 `.notice-soft` 카드와 구분).

## QA (크롬 실측)
스캐폴드 재사용 시 **유니크 클래스명** 준수 → `.pbody` 충돌 없음. PC `pbody` flex·사이드바 412px 전체높이·같은 행, 수락 버튼 줄바꿈 없음, 라이트/다크 × 받은/보낸 × 모바일/PC × 데이터/빈 전 조합 정상.
