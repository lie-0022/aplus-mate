# A+ Mate 화면 단위 리디자인 기록

2026-07 리브랜딩(소프트 클레이 라이트 / 딥 인디고 다크)의 **화면 단위 리디자인** 진행 기록.
디자인 시스템 원칙·토큰·레이아웃 기준은 [`../DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md)가 SSOT.
이 폴더는 **각 화면의 기존→수정본 결정과 목업, QA에서 잡은 문제**를 나중에 다시 볼 수 있게 남긴다.

## 진행 현황

| 순서 | 화면 | 상태 | 기록 |
|---|---|---|---|
| 1 | Dashboard | ✅ 구현·배포 | (DESIGN-SYSTEM §7) |
| 2 | Courses | ✅ 구현·배포 (커밋 `1be5263`) | 아래 "Courses" |
| 3 | **CourseDetail** | 🔄 목업 QA 완료 · 컨펌 대기 | [`coursedetail.md`](coursedetail.md) |
| 4 | MatchingRequests | ⬜ 예정 | |
| 5 | Teams | ⬜ 예정 | |
| 6 | TeamDetail | ⬜ 예정 | |
| 7 | Profile | ⬜ 예정 | |
| 8+ | ProfileSetup·Survey·Evaluate·PostDetail·PublicProfile | ⬜ 예정 | |
| — | Professor·Admin (차분 밀도) | ⬜ 예정 | |
| — | Privacy·Terms·Home | ⬜ 목업 생략(단순 텍스트) | |

## 목업 보는 법

`mockups/*.html`은 **로고까지 data URI로 임베드된 self-contained 파일**이라
브라우저로 바로 열면 된다(더블클릭 = `file://`). 라이트/다크 × 데이터/빈 × 모바일/PC를
한 페이지에서 기존 vs 수정본으로 나란히 비교.

- 아이콘(Tabler)·폰트(Pretendard)는 CDN 링크라 **인터넷 연결 시** 정확히 보인다(오프라인은 시스템 폰트로 폴백).
- 프리뷰 패널/서버로 볼 땐: `python -m http.server 8899 --directory docs/redesign/mockups` → `http://127.0.0.1:8899/coursedetail.html`.

| 화면 | 목업 |
|---|---|
| CourseDetail | [`mockups/coursedetail.html`](mockups/coursedetail.html) |

## 워크플로우 (참고)

화면 하나씩: **기존 vs 수정본 목업 → 사용자 컨펌 → 실제 코드 반영 → 배포 → 다음 화면.**
목업 매트릭스는 라이트/다크 × 데이터/빈 × 모바일/PC, 실제 보이는 화면 전체(헤더·탭바·사이드바 포함).
자세한 기준은 DESIGN-SYSTEM §5(레이아웃)·§6(목업 워크플로우).

---

## Courses (구현 완료)

**기존 문제 → 수정본**
- 수업 코드 참여 입력의 **모노스페이스 폰트 제거**, 카드를 `bg-secondary`+아이콘 배지로 강조.
- 수업 카드 `border shadow-none` → `rounded-[18px] bg-card shadow-card`, `팀플` 그라데이션 배지 → **중립 알약 태그**(`badge-tag`).
- 빈 상태 점선 → 카드화 + 2줄 카피. "수업 생성" 그라데이션 → 은은한 라벤더 `secondary`.
- **PC = 메인(2열 카드 그리드) + 우측 레일(수업 코드 참여·안내)** — 모바일틱 가운데 정렬 탈피.

구현: `client/src/pages/Courses.tsx` (커밋 `1be5263`).
