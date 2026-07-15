# 모바일 앱 전환 가이드 (조사: 2026-07-16)

A+ Mate(React 19 + Vite SPA)를 안드로이드/아이폰 앱으로 내는 경로 조사와, 이 리포에 실제로 세팅된 것들.

## TL;DR — 권장 로드맵

| 단계 | 무엇 | 비용 | 상태 |
|------|------|------|------|
| **0. PWA** | 웹 그대로 "홈 화면에 추가" → 앱 아이콘·전체화면·오프라인 폴백 | ₩0 | ✅ **완료(배포됨)** |
| **1. 안드로이드 (TWA)** | PWA를 Play 스토어 앱으로 포장 — 코드 수정 0 | $25 (1회) | 🔧 키·assetlinks 세팅 완료, Play 계정만 남음 |
| **2. 아이폰 (Capacitor)** | 네이티브 셸 + 웹 자산 번들 — 인증 플로우 수정 필요 | $99/년 | 📋 수요 확인 후 (런북 아래) |

**핵심 판단**: 소프트런치(에타)는 **웹 링크가 최적**이다 — 설치 장벽 0, 클릭 즉시 사용. 스토어 앱은 "이미 쓰는 사람"의 재방문 편의를 위한 것이므로, 유저가 생긴 다음에 내는 게 순서다. Play의 신규 계정 테스트 요건(아래)도 유저가 있어야 통과된다.

---

## 경로 비교

| | PWA (완료) | TWA (안드로이드) | Capacitor | React Native |
|---|---|---|---|---|
| 코드 재사용 | 100% | 100% (수정 0) | ~95% (인증 수정) | UI 전면 재작성 |
| 스토어 등록 | ✗ (홈화면 추가만) | Play ✓ | Play + App Store ✓ | 둘 다 ✓ |
| 실체 | 브라우저 | **크롬 그 자체** (전체화면) | WebView 셸 | 네이티브 |
| 로그인(구글 OAuth) | 그대로 동작 | **그대로 동작** | ⚠️ WebView에서 구글이 차단 → 시스템 브라우저+딥링크로 우회 필요 | 네이티브 SDK |
| 푸시 알림 | 웹푸시(iOS 16.4+도 가능) | 웹푸시 | FCM/APNs 네이티브 | 네이티브 |
| 유지비용 | 0 | 낮음(버전 올려 재빌드) | 중간(네이티브 셸 관리) | 높음 |
| 애플 심사 리스크 | — | — (Play는 통과 무난) | **가이드라인 4.2(웹 래퍼) 리젝 가능** — 푸시·네이티브 기능 붙여 완화 | 낮음 |

**TWA(Trusted Web Activity)란**: 안드로이드 앱이 크롬을 주소창 없이 전체화면으로 여는 방식. 사이트가 곧 앱이라 **쿠키·구글 로그인·업데이트가 웹과 100% 동일**. 유일한 요건은 `assetlinks.json`으로 "이 앱 ↔ 이 사이트는 같은 소유자"를 증명하는 것(안 하면 주소창이 뜸).

## 스토어 요건·비용 (2026-07 기준 — 정책은 자주 바뀌니 등록 시 콘솔에서 재확인)

### Google Play
- **$25 1회** (평생). 신분증 본인 확인 필요.
- ⚠️ **신규 개인 개발자 계정은 프로덕션 공개 전 "비공개 테스트" 요건**: 테스터 일정 인원(도입 당시 20명, 이후 12명으로 완화된 것으로 알려짐 — **콘솔에서 현재 기준 확인 필요**)이 14일 연속 옵트인해야 프로덕션 신청 가능. → **1차 코호트 지인들이 곧 테스터** — 소프트런치와 자연스럽게 맞물림.
- 그 외: 데이터 안전 양식, 콘텐츠 등급 설문, 개인정보처리방침 URL(✅ https://aplus-mate.onrender.com/privacy 있음).
- 조직 계정만 D-U-N-S 필요 — 개인 계정은 불필요.

### Apple App Store
- **$99/년** (Apple Developer Program). 개인 계정은 Apple ID만으로 가능(DUNS 불필요).
- **빌드에 macOS+Xcode 필요** — 이 PC는 Windows라 로컬 불가. 우회: **GitHub Actions macOS 러너(공개 리포는 무료!)** 또는 Codemagic(월 무료 분량). aplus-mate 리포가 public이라 CI 빌드 비용 0.
- **가이드라인 4.2 (최소 기능성)**: "웹사이트를 감싼 것뿐인 앱"은 리젝 — 푸시 알림, 네이티브 공유, 위젯 등 앱만의 가치를 붙여야 통과 확률이 올라간다.
- **아이폰도 지금 당장 무료 대안 있음**: 사파리 → 공유 → **홈 화면에 추가** = 설치형 PWA. iOS 16.4+는 설치된 PWA에 웹푸시도 지원. 스토어 없이 아이콘·전체화면 경험 제공(✅ 이미 세팅됨).

## 이 리포/머신에 이미 세팅된 것 (2026-07-16)

1. **PWA 완성** — `manifest.webmanifest`(id·아이콘·standalone), `sw.js`(서비스워커), `offline.html`, `main.tsx` 등록. 정책: HTML 비캐시(새 배포 즉시 반영) / `/assets/*` cache-first(콘텐츠 해시라 불변) / `/api/*` 비캐시.
2. **안드로이드 업로드 키** — `C:\dev\aplus-mate-keys\aplus-upload.keystore` (**리포 밖**, 커밋 금지). 비밀번호·지문은 같은 폴더 `KEYSTORE-INFO.txt`. 분실해도 Play App Signing으로 리셋 가능하지만 백업 권장(구글드라이브 등).
3. **assetlinks** — `https://aplus-mate.onrender.com/.well-known/assetlinks.json` 에 패키지 `com.aplusmate.app` + 업로드 키 SHA256 지문 서빙 중.

## 런북 A — 안드로이드 TWA 출시 (Play 계정 만든 뒤)

```bash
# 1) 프로젝트 생성 (질문에 기본값 엔터, 서명키는 C:\dev\aplus-mate-keys\aplus-upload.keystore / alias aplus 지정)
mkdir C:\dev\aplus-mate-twa && cd C:\dev\aplus-mate-twa
npx @bubblewrap/cli init --manifest https://aplus-mate.onrender.com/manifest.webmanifest
#    ⚠️ packageId 물으면: com.aplusmate.app  (assetlinks와 일치해야 함)

# 2) 빌드 (첫 실행 시 JDK/Android SDK 자동 다운로드 동의)
npx @bubblewrap/cli build
#    → app-release-signed.apk (사이드로드 테스트용) + app-release-bundle.aab (Play 업로드용)

# 3) 폰 테스트: APK를 폰에 옮겨 설치 → 주소창 없이 뜨면 assetlinks 검증 성공

# 4) Play Console: 앱 만들기 → 프로덕션 아님, "비공개 테스트" 트랙에 AAB 업로드
#    → 테스터 이메일 등록(지인들) → 14일 유지 → 프로덕션 신청

# 5) ⚠️ Play App Signing 사용 시(기본): 콘솔 > 설정 > 앱 서명에 나오는
#    "앱 서명 키 인증서"의 SHA-256을 assetlinks.json 배열에 **추가**하고 재배포
#    (업로드 키 지문만 있으면 스토어 설치본에서 주소창이 뜬다!)
```

버전 업데이트: 웹 배포는 자동 반영(앱은 크롬이므로). 앱 자체는 아이콘/이름 바뀔 때만 `twa-manifest.json`의 appVersionCode +1 후 재빌드·재업로드.

## 런북 B — 아이폰 Capacitor (수요 생기면)

1. `pnpm add @capacitor/core @capacitor/cli && npx cap init "A+ Mate" com.aplusmate.app`
2. `capacitor.config.ts`: `webDir: 'dist/public'` — 웹 자산 번들 방식(원격 URL 로딩은 애플이 싫어함)
3. **인증 수정(필수)**: 구글이 WebView 내 OAuth를 차단(`disallowed_useragent`) →
   - `@capacitor/browser`로 시스템 브라우저에서 `/api/auth/google` 열기
   - 콜백을 딥링크(`aplusmate://auth?...`)로 받는 라우트 추가 + 앱에서 세션 쿠키 대신 토큰 저장
   - tRPC 클라이언트 `httpBatchLink.url`을 절대 URL로 + 서버 CORS(`credentials`) 허용
4. iOS 빌드: GitHub Actions `macos-14` 러너(공개 리포 무료)로 `xcodebuild archive` → TestFlight 업로드(fastlane)
5. 심사 대비: FCM/APNs 푸시(알림 기능은 이미 인앱에 있음 → 네이티브 푸시로 확장) 등 앱 고유 가치 1개 이상

## 함정 모음

- **assetlinks에 Play 서명키 지문 누락** → 스토어 설치본만 주소창 뜸(로컬 APK는 정상이라 놓치기 쉬움). 런북 A-5 필수.
- **서비스워커가 HTML을 캐시하면** 새 배포가 반영 안 되는 유령 버그 — 지금 sw.js는 HTML 비캐시 정책. 바꾸지 말 것.
- **Render 콜드스타트**: 앱 첫 실행이 서버 깨우기와 겹치면 ~50초 — UptimeRobot 유지가 앱 경험에도 중요.
- **패키지명은 불변** — `com.aplusmate.app`으로 확정(나중에 도메인 사도 유지 가능). 첫 업로드 후 변경 불가.
- 이 문서의 스토어 정책 수치(테스터 수 등)는 **등록 시점에 콘솔 공지 재확인**.
