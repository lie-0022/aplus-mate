# A+ Mate — 대학생 팀플 팀원 매칭 플랫폼

카카오 오픈채팅 기반 연락 + 블라인드 평가로 쌓이는 신뢰 배지 시스템

## 기술 스택

- **Frontend:** Next.js 14 (App Router)
- **Backend:** Supabase (DB, Auth, RLS)
- **Styling:** Tailwind CSS
- **배포:** Vercel
- **언어:** TypeScript

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 Supabase 프로젝트 정보를 입력합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase 데이터베이스 설정

Supabase 대시보드의 SQL Editor에서 `supabase/schema.sql` 파일의 내용을 실행합니다.

이 파일에는 다음이 포함됩니다:
- 모든 테이블 생성 (users, courses, user_courses, posts, team_matches, teams, team_members, evaluations, badges)
- Row Level Security (RLS) 정책
- 배지 부여 함수 (`award_badges`)

### 4. 개발 서버 실행

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## Vercel 배포

### 방법 1: Vercel CLI

```bash
npx vercel
```

### 방법 2: GitHub 연동

1. 이 프로젝트를 GitHub 리포지토리에 push
2. [Vercel](https://vercel.com)에서 해당 리포지토리 Import
3. 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy 클릭

### Supabase 설정 시 주의사항

- Supabase 프로젝트 생성 후 **Authentication > URL Configuration**에서 Site URL을 Vercel 배포 URL로 설정
- **Authentication > Email Templates**에서 Confirm signup URL의 도메인을 배포 URL로 변경
- 개발 시에는 **Authentication > Providers > Email**에서 "Confirm email" 옵션을 비활성화하면 편리합니다

## 프로젝트 구조

```
src/
├── app/
│   ├── (protected)/          # 인증 필요 페이지
│   │   ├── dashboard/        # 메인 대시보드
│   │   ├── courses/          # 수업 검색/상세/게시판
│   │   ├── matching/         # 팀원 매칭
│   │   ├── teams/            # 팀 관리/평가
│   │   └── profile/          # 프로필
│   ├── login/                # 로그인
│   ├── signup/               # 회원가입
│   └── auth/callback/        # Auth 콜백
├── components/
│   ├── layout/               # 레이아웃 컴포넌트
│   └── ui/                   # UI 컴포넌트
├── lib/
│   └── supabase/             # Supabase 클라이언트
├── types/
│   └── database.ts           # DB 타입 정의
└── middleware.ts              # Auth 미들웨어
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| 회원가입/로그인 | Supabase Auth 기반 이메일 인증 |
| 수업 관리 | 수업 검색, 생성, 수강 추가 |
| 게시판 | 수업별 정보 공유 (족보/과제팁/후기/스터디) |
| 팀원 매칭 | 같은 수업 수강생 중 팀원 검색 및 커넥트 |
| 정보 공개 단계 | 매칭 전 블라인드 / 매칭 후 전체 공개 |
| 팀 관리 | 팀 생성, 카카오 오픈채팅 연결 |
| 블라인드 평가 | 팀플 완료 후 팀원 상호 평가 |
| 배지 시스템 | 평가 기반 신뢰 배지 자동 부여 |

## 디자인 가이드

- **메인 컬러:** 보라 (#5B2FBE) + 하늘색 (#4DA8DA)
- **보조 컬러:** 연보라 (#EDE7FF), 연하늘 (#E7F5FF)
- **폰트:** Apple SD Gothic Neo / Segoe UI (시스템 기본)
- **톤:** 신뢰감 있고 깔끔한 모바일 우선 UI

## 라이선스

MIT
