# Profile 리디자인 기록 + 잔여 화면 스윕

- 목업: [`mockups/profile.html`](mockups/profile.html) (라이트/다크 × 보기[데이터·빈]/수정 모드/PC)
- 상태: **✅ 구현·배포 완료** (2026-07-07, 사용자 /goal "알아서 적용" 위임)

## Profile (`client/src/pages/Profile.tsx`)

- **버튼**: 수정 outline → 소프트(`secondary`), 저장 그라데이션 → 솔리드, 취소 ghost 유지.
- **카드**(프로필·스킬·배지): `border+shadow-none` → `bg-card shadow-card`. 아바타는 gradient 스퀘어 포인트 유지.
- **스킬 태그**: secondary(라벤더) → **중립 알약**(`badge-tag`) — 태그 보라 금지 철칙.
- **신뢰 배지 아이콘 틴트**: `bg-primary/10`·`bg-sky-brand/10`(보라 2+파랑 1) → **약속철저=pos(그린)·아이디어=sky(블루)·마감준수=notice(앰버)** 다크안전 구분.
- **PC = 메인+우측레일**: 메인=프로필 카드+스킬, 레일=신뢰 배지+회원 탈퇴.

## §스윕 — 잔여 화면 일괄 정리 (목업 생략, 확립된 패턴 직접 적용)

공통 규칙: 구 카드(`border border-border/50 shadow-none`) → `border-0 shadow-card` 일괄 치환,
CTA `gradient-primary text-white border-0` → 솔리드(Button default), outline → `secondary`,
하드코딩 상태색(amber/green/red/sky/blue/emerald-N) → 시맨틱 토큰 알약(`badge-pos/notice/sky/danger`),
점선 빈 상태(`border-dashed`) → 소프트 카드. **아바타·아이콘 스퀘어의 그라데이션은 브랜드 포인트로 유지.**

| 화면 | 주요 변경 |
|---|---|
| ProfileSetup | CTA 솔리드화 (아이콘 스퀘어 그라데이션 유지) |
| SurveyAnswer | 응답함 배지→pos, 스케일 선택칩 그라데이션→솔리드 primary(비활성=muted 채움), 뒤로가기 secondary |
| TeamEvaluate | 안내 카드 amber→`notice-soft`, 돌아가기 secondary, CTA 솔리드 |
| PostDetail | 카테고리 outline 뱃지→중립 알약, 댓글 등록 솔리드, 카드 shadow-card |
| PublicProfile | 카드 shadow-card (아바타 그라데이션 유지) |
| Professor (차분) | 하이라이트 스탯 amber→notice-soft, 상태 blue/green→badge-sky/pos, CTA 솔리드, 점선→카드 |
| Admin (차분) | 상태 emerald/amber/red/sky→pos/notice/danger/sky, 카운트·CTA 솔리드, 점선→카드 (진행바 그라데이션 유지) |
| NotFound | slate/blue/red 하드코딩+영문 → 토큰(`bg-card shadow-card`·`badge-danger`)+한국어 재작성 |
| Home(랜딩) | 표현적 화면 — 그라데이션 히어로/CTA 유지 |
| Privacy·Terms | 텍스트 화면 — 토큰 자동 리스킨으로 충분, 수정 없음 |
