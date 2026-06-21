# Stitch 2단계 — 웹앱 입력 프롬프트 (복붙용)

> **사용법**: stitch.withgoogle.com 에서 새 프로젝트 → 아래 **영어 프롬프트**를 붙여넣고,
> 골라온 **레퍼런스 스크린샷을 함께 업로드**(이미지 입력)한다. `[[...]]` 부분만 너의 레퍼런스로 채운다.
> 결과(색·폰트·radius 값, View Code, 화면 캡처)를 받아오면 → 3~5단계로 코드에 반영(내가 처리).
>
> 영어가 Stitch에서 가장 안정적이다(워크플로우 권장). 한글 무드 설명을 덧붙여도 됨.

---

## ① Stitch에 붙여넣을 프롬프트

```
Redesign the UI for "A+ Mate" — a mobile-first web app where university students
find teammates for group projects, study groups, and mentoring WITHIN a course.
Three roles: student, professor, admin.

New visual direction:
[[ DESCRIBE THE MOOD HERE, or rely on the attached reference screenshots.
   e.g. "modern, calm, generous whitespace, rounded-2xl cards, soft subtle shadows,
   strong type hierarchy, one primary action per screen" ]]

Reference: I am attaching screenshots of the look & feel I want — match their
layout structure, component shapes (cards, buttons, inputs, tabs, badges), spacing,
and overall mood. [[ ATTACH 2-3 REFERENCE IMAGES IN THE STITCH UI ]]

Constraints to keep:
- Mobile-first (~390px), with a bottom tab bar: Home / Courses / Matching / Teams / Profile.
- Korean UI text is fine (or use English placeholders — I will localize).
- Must support BOTH light and dark mode.
- It maps onto shadcn/ui (new-york) + Tailwind v4 tokens, so output a REUSABLE DESIGN
  SYSTEM (one consistent set of buttons, cards, inputs, tabs, badges, navigation,
  progress bars, avatars) — not one-off screens.

Generate these core screens so I can lock the design system:
1. Login / landing (logo, one-line slogan, "Sign in with Google" CTA)
2. Student dashboard / home (greeting hero, my-team summary with progress bar,
   upcoming deadlines, quick actions)
3. Course detail — "find teammates" tab (student cards with skill tags + Connect button)
   + a board tab
4. Team detail (THE CORE screen): member list, team schedule with assignees & progress,
   team notes board, AI report draft card, deliverable submission section
5. Profile (avatar, trust badges earned from peer review, skill tags, settings)
6. Professor dashboard (class status cards, unassigned students, survey response rate,
   submission matrix)

Keep components consistent across ALL screens. Output a design system, not isolated mockups.
```

---

## ② 현재 디자인 시스템 컨텍스트 (필요하면 함께 첨부)

Stitch에 "현재 우리 구성"을 알려주고 싶으면 아래를 같이 넣는다(또는 `DESIGN.md` 전체 첨부).

```
Current system (for context — feel free to evolve the LOOK, keep the STRUCTURE):
- Stack: React 19 + Tailwind v4 (CSS-first @theme) + shadcn/ui (new-york, oklch tokens) + dark mode.
- Layout: top header (logo, notification bell, avatar menu) + mobile bottom tab bar
  + desktop left sidebar (same 5 tabs).
- Card-based, rounded corners (~12px), soft shadows.
- Current brand color is a violet→sky-blue gradient, but I am open to changing the
  overall design — color is secondary, LAYOUT & COMPONENT STYLE is what I want to refresh.
- 17 routes total; the 6 screens above are the system-defining ones.
```

---

## ③ 받아온 뒤 (3~5단계, 내가 처리)

확정되면 나에게 다음 중 가능한 것을 넘겨줘:
- **색/폰트/radius 값** (Stitch의 View Code 또는 토큰 패널) — 3단계에서 DESIGN.md에 반영
- **화면 캡처**(라이트/다크) — 5단계에서 컴포넌트 형태 정렬 기준(before/after 비교)
- **Stitch HTML export** (View Code) — 5단계에서 shadcn 컴포넌트로 재구성

→ 그러면 4단계(토큰 교체)·5단계(레이아웃·컴포넌트 형태 정렬)를 `redesign/stitch-rebrand` 브랜치에서 진행하고 PR로 정리한다.

---

*placeholder는 `[[...]]` 두 곳뿐: **무드 설명**과 **레퍼런스 이미지 첨부**. 나머지는 우리 앱에 맞춰 다 채워둠.*
