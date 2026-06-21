// A+ Mate — Google Stitch 일괄 리디자인 러너
//
// 사전 준비: 환경변수 STITCH_API_KEY 를 설정한다.
//   - 발급: https://stitch.withgoogle.com → 설정(Settings) → API key
//   - 로컬: PowerShell  $env:STITCH_API_KEY="..."  또는 .env 에 STITCH_API_KEY=...
//
// 실행:
//   node scripts/stitch/redesign.mjs                 # 전체 화면 생성
//   node scripts/stitch/redesign.mjs dashboard teamDetail   # 특정 화면만
//   STITCH_PROJECT_ID=xxx node scripts/stitch/redesign.mjs  # 기존 프로젝트에 이어서
//
// 산출물: scripts/stitch/out/<key>.html (생성된 HTML), <key>.image.txt (스크린샷 URL),
//         _manifest.json (프로젝트/스크린 ID 매핑 — 이후 변환·재생성에 사용)

import { stitch } from "@google/stitch-sdk";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, SCREENS } from "./screens.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
const MANIFEST = join(OUT, "_manifest.json");

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return { projectId: null, screens: {} };
  }
}

async function main() {
  if (!process.env.STITCH_API_KEY && !process.env.STITCH_ACCESS_TOKEN) {
    die(
      "STITCH_API_KEY 가 없습니다.\n" +
        "  1) https://stitch.withgoogle.com 에서 로그인 → Settings → API key 발급\n" +
        '  2) $env:STITCH_API_KEY="발급받은키"  (또는 .env 에 STITCH_API_KEY=...)\n' +
        "  3) 다시 실행: node scripts/stitch/redesign.mjs"
    );
  }

  await mkdir(OUT, { recursive: true });
  const manifest = await loadManifest();

  // 1) 프로젝트 확보 (환경변수 > 매니페스트 > 신규 생성)
  const projectId = process.env.STITCH_PROJECT_ID || manifest.projectId;
  const project = projectId
    ? stitch.project(projectId)
    : await stitch.createProject("A+ Mate Redesign");
  manifest.projectId = project.id ?? projectId ?? project.projectId;
  console.log(`▸ 프로젝트: ${manifest.projectId}`);

  // 2) 브랜드 디자인 시스템 등록(지원 시) — 전 화면 일관성 ↑. 실패해도 진행.
  try {
    await project.createDesignSystem({
      name: "A+ Mate Brand",
      description: BRAND,
    });
    console.log("▸ 디자인 시스템 등록 완료");
  } catch (e) {
    console.log(`▸ 디자인 시스템 등록 건너뜀(${e?.message ?? e}) — 프롬프트로 브랜드 주입`);
  }

  // 3) 대상 화면 결정 (인자로 특정 키 지정 가능)
  const wanted = process.argv.slice(2);
  const targets = wanted.length ? SCREENS.filter((s) => wanted.includes(s.key)) : SCREENS;
  if (!targets.length) die(`해당 화면 없음: ${wanted.join(", ")}`);

  // 4) 화면별 생성 → HTML/이미지 저장
  let ok = 0;
  for (const s of targets) {
    process.stdout.write(`▸ 생성: ${s.key} (${s.title}) ... `);
    try {
      const screen = await project.generate(s.prompt, "MOBILE", "GEMINI_3_PRO");
      const [html, image] = await Promise.all([screen.getHtml(), screen.getImage()]);
      await writeFile(join(OUT, `${s.key}.html`), html, "utf8");
      await writeFile(join(OUT, `${s.key}.image.txt`), image, "utf8");
      manifest.screens[s.key] = { screenId: screen.id ?? screen.screenId, title: s.title };
      console.log(`OK (HTML ${html.length}자)`);
      ok++;
    } catch (e) {
      console.log(`실패: ${e?.message ?? e}`);
    }
    await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
  }

  console.log(`\n완료: ${ok}/${targets.length} 화면. 산출물 → scripts/stitch/out/`);
  console.log("다음 단계: docs/STITCH-REDESIGN.md 의 '변환' 절차로 shadcn 컴포넌트에 반영");
}

main().catch((e) => die(e?.stack ?? String(e)));
