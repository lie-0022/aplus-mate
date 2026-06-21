# A+ Mate — 디자인 시스템 (현황 스냅샷)

> Stitch 리브랜딩 워크플로우 1단계 산출물. **현재** 디자인 토큰·컴포넌트·화면을 있는 그대로 기록한다.
> 색은 하드코딩 hex가 아니라 **shadcn CSS 변수명 + oklch 값** 기준. 소스: `client/src/index.css` (Tailwind v4 CSS-first, `@theme inline` + `:root` + `.dark`).
> 3단계에서 이 문서의 Color/Typography/Radius 섹션을 새 방향으로 교체하고, 4단계에서 `index.css`에 반영한다.

---

## Brand

- **이름**: A+ Mate — 대학생 팀플(조별과제) 팀원 매칭 모바일 웹앱
- **역할(role)**: `user`(학생) · `professor`(교수) · `admin`(운영자)
- **현재 무드**: 보라(primary) → 파랑(sky) 그라데이션을 시그니처로 쓰는 밝고 친근한 톤. 모바일 우선, 카드 기반, 둥근 모서리(12px), 부드러운 그림자.
- **시그니처 요소**: `.gradient-primary`(보라→파랑 135°)를 로고·주요 CTA·히어로·아바타 폴백에 일관 사용.
- **테마**: light 기본 + dark 지원 (`ThemeProvider defaultTheme="light"`, `.dark` 클래스 토글). **두 모드 모두 유지 필수**.
- **shadcn 설정**: style `new-york`, baseColor `neutral`, `cssVariables: true`, prefix 없음, oklch 색공간.

---

## Color

전부 **oklch**. 형식 `oklch(L C H)`. light = `:root`, dark = `.dark`.

### Core (shadcn 변수)

| 변수 | Light (`:root`) | Dark (`.dark`) | 비고 |
|---|---|---|---|
| `--background` | `0.985 0.002 290` | `0.15 0.015 285` | 살짝 보라빛 흰 / 어두운 보라 |
| `--foreground` | `0.18 0.02 285` | `0.92 0.01 285` | |
| `--card` | `1 0 0` | `0.2 0.02 285` | |
| `--card-foreground` | `0.18 0.02 285` | `0.92 0.01 285` | |
| `--popover` | `1 0 0` | `0.2 0.02 285` | |
| `--popover-foreground` | `0.18 0.02 285` | `0.92 0.01 285` | |
| `--primary` | `0.44 0.24 285` | `0.6 0.2 285` | **브랜드 보라 (#5B2FBE)** |
| `--primary-foreground` | `0.98 0.005 285` | `0.98 0.005 285` | |
| `--secondary` | `0.92 0.05 290` | `0.25 0.03 285` | 연보라 |
| `--secondary-foreground` | `0.3 0.15 285` | `0.8 0.02 285` | |
| `--muted` | `0.955 0.015 290` | `0.25 0.02 285` | |
| `--muted-foreground` | `0.5 0.03 285` | `0.65 0.02 285` | |
| `--accent` | `0.93 0.04 230` | `0.25 0.04 230` | 연하늘 |
| `--accent-foreground` | `0.25 0.1 230` | `0.9 0.02 230` | |
| `--destructive` | `0.577 0.245 27.325` | `0.704 0.191 22.216` | 빨강 |
| `--destructive-foreground` | `0.985 0 0` | `0.985 0 0` | |
| `--border` | `0.91 0.015 290` | `0.3 0.02 285` | |
| `--input` | `0.91 0.015 290` | `0.3 0.02 285` | |
| `--ring` | `0.44 0.24 285` | `0.6 0.2 285` | = primary |
| `--radius` | `0.75rem` | (공유) | 12px |

### Charts

| 변수 | Light | Dark |
|---|---|---|
| `--chart-1` | `0.44 0.24 285` (보라) | `0.6 0.2 285` |
| `--chart-2` | `0.65 0.12 230` (파랑) | `0.65 0.12 230` |
| `--chart-3` | `0.55 0.18 285` | `0.55 0.18 285` |
| `--chart-4` | `0.75 0.08 230` | `0.75 0.08 230` |
| `--chart-5` | `0.35 0.2 285` | `0.5 0.15 285` |

### Sidebar

| 변수 | Light | Dark |
|---|---|---|
| `--sidebar` | `0.985 0.002 290` | `0.2 0.02 285` |
| `--sidebar-foreground` | `0.18 0.02 285` | `0.92 0.01 285` |
| `--sidebar-primary` | `0.44 0.24 285` | `0.6 0.2 285` |
| `--sidebar-primary-foreground` | `0.98 0.005 285` | `0.98 0.005 285` |
| `--sidebar-accent` | `0.92 0.05 290` | `0.25 0.03 285` |
| `--sidebar-accent-foreground` | `0.18 0.02 285` | `0.985 0 0` |
| `--sidebar-border` | `0.91 0.015 290` | `0.3 0.02 285` |
| `--sidebar-ring` | `0.44 0.24 285` | `0.6 0.2 285` |

### 커스텀 브랜드 토큰 (`@theme inline`)

| 변수 | 값 | 용도 |
|---|---|---|
| `--color-violet` | `oklch(0.44 0.24 285)` | = primary (유틸 `bg-violet` 등) |
| `--color-violet-light` | `oklch(0.92 0.05 290)` | |
| `--color-sky-brand` | `oklch(0.65 0.12 230)` | 보조 파랑 (`text-sky-brand` 등) |
| `--color-sky-light` | `oklch(0.93 0.04 230)` | |

### 그라데이션 유틸 (`@layer components`)

| 클래스 | 정의 |
|---|---|
| `.gradient-primary` | `linear-gradient(135deg, oklch(0.44 0.24 285), oklch(0.65 0.12 230))` — 보라→파랑 |
| `.gradient-primary-soft` | `linear-gradient(135deg, oklch(0.92 0.05 290), oklch(0.93 0.04 230))` — 연보라→연하늘 |

> ⚠️ 그라데이션은 oklch 리터럴이 하드코딩돼 있음 — 4단계에서 새 primary/accent 토큰을 따르도록 `var()`화하거나 값을 함께 교체해야 함.

### 관용 색 (컴포넌트에 흩어진 Tailwind 팔레트 직접 사용 — 토큰화 대상)

화면 곳곳에서 상태 표현에 **Tailwind 기본 팔레트 클래스**를 직접 씀(토큰 아님). 리브랜딩 시 정책 결정 필요:

- 완료/성공: `bg-green-100 text-green-700`, `text-green-600`
- 임박/경고: `bg-amber-100 text-amber-700`, `bg-amber-50`
- 지남/위험: `bg-red-100 text-red-700` (또는 `destructive`)
- 진행 중: `bg-blue-100 text-blue-700`
- 멘토/정보: `bg-sky-100 text-sky-700`
- primary 틴트: `bg-primary/10`, `bg-primary/5`, `text-primary` (이건 토큰 기반 ✅)

---

## Typography

- **폰트 패밀리** (`body`): `'Apple SD Gothic Neo', 'Segoe UI', system-ui, -apple-system, sans-serif` — **별도 웹폰트 로딩 없음**(시스템 폰트). 한글 우선.
- **스케일**: Tailwind 기본(커스텀 `@theme` 폰트 토큰 없음). 실제 사용 패턴:
  - 페이지 제목: `text-2xl font-bold` (히어로) / `text-xl font-bold` (섹션 헤더)
  - 섹션 헤더: `text-lg font-semibold` / `font-bold`
  - 본문: `text-sm`, 보조: `text-xs`, 마이크로: `text-[10px]` `text-[11px]`
  - 카드 타이틀: shadcn `CardTitle` (기본 `text-base` 오버라이드 잦음)
- **웨이트**: `font-medium`, `font-semibold`, `font-bold` 주로.

> 새 방향에서 웹폰트(예: Inter/Pretendard) 도입 시 3단계에 기록, 4단계에서 self-host/Google Fonts 로딩 추가.

---

## Spacing

- Tailwind 기본 스페이싱(커스텀 토큰 없음).
- 관찰 패턴: 페이지 컨테이너 세로 리듬 `space-y-4` / `space-y-6`, 카드 내부 `p-4`(`CardContent`), 작은 요소 갭 `gap-2` `gap-3`, 칩/배지 갭 `gap-1.5`.
- `.container`(커스텀): `px-1rem`(모바일) → `px-1.5rem`(sm) → `px-2rem max-w-1280px`(lg).
- 레이아웃: 메인 `pb-20`(하단 탭바 공간) + `lg:ml-60`(데스크톱 사이드바).

---

## Radius

`--radius: 0.75rem` (12px) 기준, `@theme inline` 파생:

| 토큰 | 계산 | 값 |
|---|---|---|
| `--radius-sm` | `calc(var(--radius) - 4px)` | 8px |
| `--radius-md` | `calc(var(--radius) - 2px)` | 10px |
| `--radius-lg` | `var(--radius)` | 12px |
| `--radius-xl` | `calc(var(--radius) + 4px)` | 16px |

실사용: 카드/히어로 `rounded-2xl`(16px), 버튼/입력 기본(shadcn, `rounded-md`≈10px), 아바타/뱃지 `rounded-full`, 작은 칩 `rounded-lg`.

---

## Components

shadcn/ui 컴포넌트 **53종 설치됨**(`client/src/components/ui/`). 실제 화면에서 쓰이는 것 / 쇼케이스 전용을 구분:

### 실사용 (리브랜딩 핵심 대상)
`card`(+Header/Title/Content) · `button` · `badge` · `skeleton` · `input` · `textarea` · `label` · `select` · `tabs` · `dialog` · `alert-dialog` · `checkbox` · `switch` · `avatar`(+Fallback) · `dropdown-menu` · `sonner`(Toaster) · `tooltip`(Provider)

### 커스텀 패턴 (shadcn 외, 화면에 반복 등장)
- **그라데이션 아바타**: `gradient-primary` 원형 div + 이니셜(멤버 표시). shadcn `Avatar`는 헤더에서만.
- **그라데이션 히어로/CTA**: `gradient-primary text-white border-0` 버튼·배너 (Dashboard·TeamDetail 히어로는 redesign 브랜치에서 신규 도입).
- **진척도 막대**: `h-1.5 bg-muted rounded-full` + `bg-primary`/`gradient-primary` 채움 div.
- **상태 배지**: `Badge` + 관용 색(위 Color 참고).
- **알림 배지**: `bg-destructive text-white rounded-full` 카운터.

### 쇼케이스 전용 (`/`에 라우트 없음, `ComponentShowcase.tsx`에서만 — 현재 미사용)
accordion, alert, aspect-ratio, breadcrumb, calendar, carousel, command, context-menu, drawer, hover-card, input-otp, menubar, pagination, popover, progress, radio-group, resizable, scroll-area, separator, sheet, slider, toggle, toggle-group, table, navigation-menu, collapsible, item, field, empty, kbd, spinner, button-group, input-group, sidebar, chart, form, carousel
> 리브랜딩 범위는 **실사용 + 커스텀 패턴** 우선. 쇼케이스 전용은 토큰만 따라가면 자동 반영.

---

## Screens (Wouter 라우트)

공통 셸 `AppLayout`(보호 페이지 래퍼): **헤더**(그라데이션 로고 / 알림 `DropdownMenu`+카운터 / 아바타 메뉴—역할별 교수·운영자 진입) + **모바일 하단 탭바**(홈·수업·매칭·팀·프로필, `lg:hidden`) + **데스크톱 좌측 사이드바**(`lg+`, 동일 5탭). 비로그인 시 중앙 그라데이션 로그인 화면.

| 라우트 | 화면 | 접근 | 목적 | 주요 컴포넌트 |
|---|---|---|---|---|
| `/` | Home | 공개 | 랜딩/로그인(인증 시 `/dashboard`로 리다이렉트) | Button, gradient hero |
| `/dashboard` | Dashboard | 학생+ | 홈 — 히어로(인사·지표)·온보딩·다가오는 일정·내 수업·퀵액션 | Card, Button, Badge, Skeleton, **gradient hero** |
| `/profile/setup` | ProfileSetup | 신규 | 최초 프로필 설정(학교·학과·스킬) | Card, Input, Label, Checkbox, Select, Button |
| `/profile` | Profile | 본인 | 내 프로필·배지·스킬·설정·회원탈퇴 | Card, Input, Label, Badge, Select, AlertDialog, Skeleton |
| `/courses` | Courses | 학생 | 수업 목록·추가 | Card, Button, Input, Label, Badge, Tabs, Dialog, Switch, Select |
| `/courses/:id` | CourseDetail | 학생 | 수업 상세 — 팀원찾기·게시판·공지 | Card, Button, Badge, Tabs, Input, Label, Textarea, Dialog, Select |
| `/posts/:id` | PostDetail | 학생 | 게시글 상세·댓글 | Card, Button, Badge, Textarea, Skeleton |
| `/matching/requests` | MatchingRequests | 학생 | 받은/보낸 매칭 요청 관리 | Card, Button, Badge, Input, Tabs, Dialog |
| `/teams` | Teams | 학생 | 내 팀 목록 | Card, Button, Badge, Tabs, Skeleton |
| `/teams/:id` | TeamDetail | 팀원 | 팀 상세 — 멤버·메모·일정·산출물·AI 보고서 | Card, Button, Badge, Input, Textarea, Select, AlertDialog, **gradient hero** |
| `/teams/:id/evaluate` | TeamEvaluate | 팀원 | 동료 익명 평가 | Card, Button, Badge, Select |
| `/admin` | Admin | 운영자 | 대기매칭·전체 팀 현황·신고·역할관리·데모 | Card, Button, Badge, Select, Skeleton |
| `/professor` | Professor | 교수/운영자 | 수업 현황·수강생·팀·설문·제출·공지 | Card, Button, Badge, Input, Textarea, Tabs, Select |
| `/users/:id` | PublicProfile | 학생 | 공개 프로필(배지·스킬) | Card, Badge, Skeleton |
| `/surveys/:id` | SurveyAnswer | 학생 | 설문 응답 | Card, Button, Badge, Textarea, Skeleton |
| `/privacy` | Privacy | 공개 | 개인정보 처리방침 | 텍스트 |
| `/terms` | Terms | 공개 | 이용약관 | 텍스트 |
| `/404`, `*` | NotFound | 공개 | 404 | Button, Card |

---

## 리브랜딩 시 주의 (4·5단계 방어 포인트)

1. **`.gradient-primary`/`.gradient-primary-soft`의 oklch 리터럴** — 새 primary/accent로 교체 필수(`index.css`).
2. **관용 Tailwind 색**(green/amber/red/blue/sky 직접 클래스) — 새 시맨틱 토큰으로 치환할지 정책 결정.
3. **웹폰트 미사용(시스템 폰트)** — 새 폰트 도입 시 로딩 추가.
4. **Tailwind v4 CSS-first** — `tailwind.config.js` 없음. `@theme`/`:root`/`.dark`만 수정(v3 config 방식 금지).
5. **dark 모드 동시 유지** — 모든 변경은 light/dark 두 세트.
6. **Railway가 `main` 자동배포** — `redesign/stitch-rebrand` 브랜치에서 작업, PR로만 머지.
