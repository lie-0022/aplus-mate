// 로컬 개발 전용 시드 — Docker MySQL에 테스트 데이터 생성.
// 실행: DATABASE_URL=... OWNER_OPEN_ID=dev-local pnpm exec tsx scripts/dev-seed.ts
// (앱의 db 함수를 그대로 재사용해 스키마와 항상 일치.)
import "dotenv/config";
import * as db from "../server/db";

async function ensureUser(openId: string, name: string, profile: {
  university: string; department: string; year: number; skillTags: string[]; kakaoOpenChatUrl: string;
}) {
  await db.upsertUser({ openId, name, email: `${openId}@local.test`, loginMethod: "dev", lastSignedIn: new Date() });
  const u = await db.getUserByOpenId(openId);
  if (!u) throw new Error(`유저 생성 실패: ${openId}`);
  await db.updateUserProfile(u.id, profile);
  const after = await db.getUserByOpenId(openId);
  console.log(`  유저 ${openId}: id=${after?.id}, profileCompleted=${after?.profileCompleted}, role=${after?.role}`);
  return after!;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 필요");
  console.log("[seed] 유저 생성...");
  const u1 = await ensureUser("dev-local", "개발테스트", {
    university: "백석대학교", department: "컴퓨터공학부", year: 3,
    skillTags: ["React", "TypeScript"], kakaoOpenChatUrl: "https://open.kakao.com/o/devlocal1",
  });
  const u2 = await ensureUser("dev-local-2", "윤어진", {
    university: "백석대학교", department: "첨단IT학부", year: 2,
    skillTags: ["Python", "Figma"], kakaoOpenChatUrl: "https://open.kakao.com/o/devlocal2",
  });

  console.log("[seed] 수업 생성...");
  // 같은 수업 — 두 명 모두 수강(매칭/커넥트 테스트용)
  const aiCourse = await db.createCourse({
    name: "인공지능", professor: "김교수", credits: 3, hasTeamProject: true,
    university: "백석대학교", courseCode: "AI101",
  });
  const aiId = (aiCourse as any)?.id;
  console.log(`  인공지능 id=${aiId}`);
  // 혼자만 수강(빈 로스터/초대 빈상태 테스트용)
  const soloCourse = await db.createCourse({
    name: "소프트웨어공학", professor: "이교수", credits: 3, hasTeamProject: true,
    university: "백석대학교", courseCode: "SE201",
  });
  const soloId = (soloCourse as any)?.id;
  console.log(`  소프트웨어공학 id=${soloId}`);

  console.log("[seed] 수강 등록(2026-1)...");
  await db.enrollCourse(u1.id, aiId, "2026-1");
  await db.enrollCourse(u2.id, aiId, "2026-1");
  await db.enrollCourse(u1.id, soloId, "2026-1");

  console.log("[seed] 완료. 로그인 유저: dev-local (admin), 같은수업 상대: dev-local-2");
  console.log(`  AI수업(둘다 수강)=/courses/${aiId}, 솔로수업(빈상태)=/courses/${soloId}`);
  process.exit(0);
}

main().catch((e) => { console.error("[seed] 실패:", e); process.exit(1); });
