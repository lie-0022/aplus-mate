# A+ Mate × Google Stitch 리디자인 파이프라인

UI를 Google Stitch(AI UI 디자인 도구)로 일괄 리디자인하기 위한 조사 결과와, **키 하나만 넣으면 도는 자동화 파이프라인** 정리.

---

## 1. 조사 결론 — Stitch를 "직접 통제"하는 경로

Google Stitch는 텍스트/이미지 프롬프트로 UI를 생성하고 **HTML/CSS·Tailwind 코드로 export**하는 도구다(Gemini 3 기반, Google Labs). 우리가 프로그래밍적으로 통제할 수 있는 경로는 셋:

| 경로 | 내용 | 자격증명 |
|---|---|---|
| **공식 SDK** `@google/stitch-sdk` | Node 라이브러리. 화면 생성→HTML/이미지 추출까지 코드로 자동화 | `STITCH_API_KEY` |
| **stitch-mcp CLI** `@_davideast/stitch-mcp` | 로컬 프리뷰·사이트 생성·MCP 도구 노출 | `STITCH_API_KEY` 또는 gcloud OAuth |
| **웹앱** stitch.withgoogle.com | 수동 디자인 → 코드 export | Google 로그인 |

> 우리는 **SDK 경로**를 채택했다(완전 자동화 가능, 브라우저 자동화는 Stitch가 Flutter 앱이라 frozen·cross-origin으로 불안정).

### Stitch → shadcn 변환
Stitch는 현재 HTML/CSS·Tailwind를 내보낸다(React/.tsx 직출력은 아직 미지원). 커뮤니티 변환 도구(`stitch-to-shadcn`, `stitch-to-react`)가 있고, 우리는 아래 **변환 절차**로 우리 디자인 토큰에 매핑한다.

**출처**
- [Stitch SDK](https://github.com/google-labs-code/stitch-sdk) · [stitch-mcp](https://github.com/davideast/stitch-mcp) · [stitch-skills](https://github.com/google-labs-code/stitch-skills)
- [Codecademy 튜토리얼](https://www.codecademy.com/article/google-stitch-tutorial-ai-powered-ui-design-tool) · [shadcn 변환 feature request](https://discuss.ai.google.dev/t/feature-request-export-to-react-components-using-shadcn-ui/135255)

---

## 2. 셋업 (키 발급 — 사람만 가능한 한 단계)

1. https://stitch.withgoogle.com 접속 → Google 로그인
2. **Settings → API key** 발급 (Google Labs 무료 체험: 월 ~550 generations)
3. 키를 환경에 주입:
   - 로컬(PowerShell): `$env:STITCH_API_KEY="발급키"`
   - 또는 프로젝트 루트 `.env` 에 `STITCH_API_KEY=발급키`

> API 키는 비밀이다. `.env`는 커밋 금지(`.gitignore`에 포함). 채팅으로 평문 공유하지 말고 본인이 환경에 직접 넣을 것.

---

## 3. 실행 — 화면 일괄 생성

```bash
pnpm stitch:redesign                      # 정의된 전 화면 생성
pnpm stitch:redesign dashboard teamDetail # 특정 화면만
```

- 생성 정의: `scripts/stitch/screens.mjs` (브랜드 가이드 + 화면 10종 프롬프트)
- 러너: `scripts/stitch/redesign.mjs`
- 산출물: `scripts/stitch/out/<key>.html`, `<key>.image.txt`(스크린샷 URL), `_manifest.json`

화면 키: `home, dashboard, courses, courseDetail, matching, teamDetail, profile, professor, admin, evaluate`

브랜드는 프롬프트에 강하게 주입된다 — 보라 #5B2FBE→파랑 그라데이션, 모바일 우선, 한국어, shadcn new-york 무드.

---

## 4. 변환 — Stitch HTML → 우리 shadcn 컴포넌트

생성된 HTML을 그대로 쓰지 않고, **레이아웃·간격·구성**만 취하고 우리 디자인 토큰·컴포넌트로 옮긴다.

1. `out/<key>.image.txt` URL로 **시안 확인** → 방향이 맞는지 판단(아니면 `screens.mjs` 프롬프트 수정 후 재생성).
2. `out/<key>.html`의 구조를 분석해 우리 컴포넌트로 매핑:
   - 색/그라데이션 → `client/src/index.css` 토큰(`--primary`, `.gradient-primary`) 그대로 사용. Stitch가 박은 raw hex는 토큰으로 치환.
   - 카드/버튼/배지/탭 → `@/components/ui/*` (shadcn) 컴포넌트로 교체.
   - 간격·반경·그림자 → Tailwind 유틸 + `--radius(0.75rem)` 유지.
   - 아이콘 → `lucide-react`.
3. 해당 페이지(`client/src/pages/<Page>.tsx`)에 반영, `pnpm check`로 타입 확인.
4. 한 화면씩 PR/커밋 — 디자인 회귀를 페이지 단위로 검증.

> 자동 변환 보조가 필요하면 `stitch-to-shadcn` 스킬을 도입할 수 있으나, 우리는 토큰 체계가 이미 잘 잡혀 있어 **수동 매핑이 더 정확**하다.

---

## 5. 반복

- 특정 화면 톤이 마음에 안 들면 `screens.mjs` 프롬프트를 고쳐 그 화면만 재생성(`pnpm stitch:redesign <key>`).
- `screen.edit(prompt)`로 기존 시안을 미세 수정하는 것도 가능(러너에 `--edit` 모드 추가 여지).

---

*요약: 조사·자동화·변환 절차는 모두 준비 완료. 남은 단 한 단계는 **STITCH_API_KEY 발급**(Google 계정 필요 → 사람만 가능)이며, 키가 들어오면 `pnpm stitch:redesign` 한 번으로 전 화면 시안이 나오고, 변환 절차로 페이지에 반영한다.*
