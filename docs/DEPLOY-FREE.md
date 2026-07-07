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

## A. GitHub Student Pack → DigitalOcean $200 (추천, 학생)
1. **Student Pack 확인**: https://education.github.com/pack 로그인 → "You have access"면 OK.
   없으면 대학 이메일/재학증명으로 신청(https://education.github.com/discount_requests/application).
2. Pack 안 **DigitalOcean $200 크레딧(1년)** redeem.
3. **DO App Platform**로 배포:
   - Create → Apps → GitHub `lie-0022/aplus-mate` 연결, 브랜치 `main`.
   - Build Command `pnpm build`, Run Command `pnpm start`, HTTP Port `8080`(또는 자동).
   - Plan: Basic ($5/월 → $200으로 ~40개월). DB는 아래 TiDB 무료로 붙임(DO Managed DB는
     크레딧 소모 크니 지양).
   - Environment Variables에 `.env.example` 항목 입력.
   - Deploy. 부팅 시 마이그레이션(0018 포함) 자동 적용.
> Droplet($6/월 VM에 Node+MySQL 셀프호스팅)로 가면 $200이 ~33개월. MySQL이 로컬이라
> 외부 DB 불필요하지만 세팅이 더 많음(§C 참고).

## B. Render 무료 (학생 아니어도)
1. render.com → New Web Service → GitHub `lie-0022/aplus-mate`.
2. Build `pnpm build`, Start `pnpm start`, Runtime Node.
3. Environment에 `.env.example` 항목 입력. Instance Type **Free**.
   - ⚠️ 무료는 **15분 유휴 시 잠들었다가 첫 요청 ~50초** 콜드스타트. 파일럿엔 OK.
4. DB는 TiDB 무료(§DB) — Render 무료 Postgres는 90일 만료·MySQL 아님이라 쓰지 말 것.

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
