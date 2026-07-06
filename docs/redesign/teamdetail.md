# TeamDetail 리디자인 기록

- 목업: [`mockups/teamdetail.html`](mockups/teamdetail.html) (라이트/다크 × 모바일[데이터·갓 생성]/PC)
- 대상 코드: `client/src/pages/TeamDetail.tsx`
- 상태: **✅ 구현·배포 완료** (2026-07-06)
- 화면 구성(긴 단일 스크롤): 히어로 + 팀원 + 팀 메모 + 일정(진행률·D-day) + 완료/평가 액션 + 평가완료 안내 + 제출 항목 + AI 보고서 초안 + 팀 나가기
- 밀도: **차분(정보 많은 화면)** — 하드섀도우·글로우 절제.

## 기존 → 수정본 (디자인 결정)

- **히어로**: `gradient-primary` 보라 블록(흰 텍스트/뱃지) → **차분 카드**(`bg-card shadow-card`, 타입·상태 중립/pos 알약, 수업명 foreground). 멤버 아바타만 `gradient-primary` 원으로 살짝 포인트.
- **상태색 전면 토큰화(다크 안전)**:
  - 일정 D-day: `bg-red-100`/`bg-amber-100`/neutral·`bg-green-100`(완료) 하드코딩 → **`badge-danger`(지남)·`badge-notice`(임박)·`badge-tag`(여유)·`badge-pos`(완료)**. 완료 체크 아이콘 = `--pos-fg`.
  - 멘토 역할 `bg-sky-100` → `badge-sky`. 멘티는 중립.
  - 평가완료 카드 `bg-green-50/green-200` → `--pos-bg`/`--pos-fg` 카드. 제출완료 `bg-green-50` → pos, 미제출 `text-amber-700` → `--notice-fg`.
  - 멘토 없음 안내 `bg-amber-50` → `notice-soft`.
- **버튼**: 완료하기·평가하기·초안생성 그라데이션 → **솔리드**(Button default); 남기기·추가·제출·복사·마감 outline → **소프트**(`secondary`); 팀 나가기 ghost 유지.
- **카드**(메모·일정·제출·AI): `border+shadow-none` → `bg-card shadow-card`. 팀원 리스트(토스식 `divide-y`)는 구조 유지 + `shadow-card`.
- **PC = 메인+요약레일**: 상단 차분 히어로(전체폭) + 메인(팀원·메모·일정·제출·AI) + **우측 레일(팀 요약: 타입·상태·수업·팀원 수·진행률 + 팀플 완료하기·팀 나가기)**. 액션은 **제어형 AlertDialog**(`completeOpen`/`leaveOpen` state)로 모바일 하단·PC 레일 버튼이 단일 다이얼로그 공용.
- 죽은 import 제거(Card·Badge·AlertDialogTrigger·UserCircle·Shield·Lightbulb·Clock).

### ⚠️ 기능 변경(사용자 요청)
- **외부 오픈채팅 안전 문구 제거**: "외부 오픈채팅에서는 실명·금융정보·송금 요구에 응하지 마세요 …운영자에게 신고" 고지(기존 C3 사기 방지 안내)를 팀원 섹션에서 삭제. 사용자 명시 요청("이거는 지우자").

## 추가된 토큰 (`client/src/index.css`)
- `--danger-bg/-fg` (마감 지남 등): 라이트 `#fdecec`/`#c0392b`, 다크 `rgba(229,112,107,.15)`/`#f0908b`.
- 유틸 `.badge-danger`. (notice·pos·sky는 기존 재사용.)

## QA (크롬 실측)
스캐폴드 유니크 클래스명 → `.pbody` 충돌 없음. PC `pbody` flex·사이드바 412px 전체높이·같은 행, 라이트/다크 × 모바일(데이터·빈)/PC 정상. 상태색(완료/D-DAY/지남) 다크에서 하드코딩 대비 통합 확인.
