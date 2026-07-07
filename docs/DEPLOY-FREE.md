# 무료 배포 가이드 (Railway 트라이얼 소진 이후)

> A+ Mate는 **상시 실행 Node 서버 + MySQL**이 필요. Vercel/Netlify 같은 서버리스 무료는
> AI 보고서(최대 1분)가 타임아웃이라 부적합. 아래는 **완전 무료** 조합.
>
> 이 앱은 원래 Manus forge 플랫폼(로그인·LLM·DB 내장) 위에서 만들어졌다. 독립 호스팅으로
> 옮기면 그 3가지를 무료 서비스로 각각 붙인다 — 코드는 이미 지원함(`server/_core/env.ts`).

## 0. 준비물(전부 무료)
| 항목 | 무료 소스 | 얻는 값 |
|---|---|---|
| MySQL | **TiDB Cloud Serverless**(5GB 무료, 안 잠듦) 또는 Aiven Free | `DATABASE_URL` |
| 로그인 | **Google OAuth**(Google Cloud Console) | `GOOGLE_CLIENT_ID/SECRET` |
| AI 보고서 | **Gemini API 키**(aistudio.google.com/app/apikey) | `LLM_API_KEY` |
| 서버 호스팅 | 아래 A/B 중 택1 | — |

## ★ 채택: Render 무료 (+ 무료 핑거로 안 재우기)
> DigitalOcean $200 학생 크레딧은 **2026-07-31 일괄 만료**라(오늘 기준 몇 주) 채택 안 함.
> Render 무료는 **카드 불필요·만료 없음**. 유일한 단점(15분 유휴 시 잠듦)은 핑거로 우회.

1. render.com → GitHub 로그인 → **New → Blueprint** → `lie-0022/aplus-mate` 선택
   → 레포의 `render.yaml`을 읽어 무료 웹서비스 자동 구성. (또는 New → Web Service 수동:
   Build `corepack enable && pnpm install --frozen-lockfile && pnpm build`, Start `pnpm start`,
   Instance **Free**, Region **Singapore**.)
2. 서비스 이름 `aplus-mate` → 주소 `https://aplus-mate.onrender.com` 확정.
3. **Environment**에 `sync:false` 값 입력(§DB·§Google OAuth에서 얻음):
   `DATABASE_URL`, `APP_URL=https://aplus-mate.onrender.com`, `OWNER_EMAIL`,
   `GOOGLE_CLIENT_ID/SECRET`, (선택)`LLM_API_KEY`. `JWT_SECRET`은 Blueprint가 자동 생성.
4. Deploy → 부팅 로그에서 마이그레이션(0018) 적용 확인.
5. **안 재우기(무료)**: uptimerobot.com(무료) 또는 cron-job.org에서 5~10분마다
   `https://aplus-mate.onrender.com/` GET. 월 750시간 무료 한도(≈상시) 안에서 상시 가동.

## DB 세팅 (TiDB Cloud Serverless, 무료·안 잠듦)
1. tidbcloud.com 가입 → Serverless 클러스터 생성(무료).
2. Connect → 언어 "General" → 연결 문자열에서 host/user/password 확보.
3. `DATABASE_URL=mysql://USER:PASSWORD@HOST:4000/DBNAME?ssl={"rejectUnauthorized":true}` 구성.
   (TiDB는 SSL 필수, 포트 4000. mysql2 드라이버 호환.)

## Google OAuth 세팅 (무료)
1. console.cloud.google.com → 프로젝트 → APIs & Services → OAuth consent screen(External).
2. Credentials → Create OAuth client ID → Web application.
3. 승인된 리디렉션 URI: `https://<배포주소>/api/auth/google/callback`.
4. Client ID/Secret → 환경변수. `APP_URL=https://<배포주소>`, `OWNER_EMAIL=내구글이메일`.

## 배포 후 확인
- 부팅 로그에 `[MIGRATE] ... 최신 상태` (0018 course_reviews·teams.professorApprovedAt 적용).
- Google 로그인 → 프로필 세팅 → 수업/매칭/팀/리뷰 동작.
- AI 보고서는 `LLM_API_KEY` 넣었을 때만.

## C. 대안 — Oracle Cloud 평생 무료 VM
안 잠들고 진짜 평생 무료(ARM Ampere). Ubuntu VM에 Node 20 + MySQL 8 설치, `pnpm build`,
`pm2`/systemd로 `node dist/index.js` 상시 실행, nginx 리버스프록시 + certbot(HTTPS).
DB가 로컬이라 외부 의존 없음. 세팅 스크립트가 필요하면 요청.
