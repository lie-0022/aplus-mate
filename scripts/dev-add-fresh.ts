// 로컬 dev — 프로필 미완성 신규 유저 1명 추가 (ProfileSetup 동의 흐름 테스트용).
import "dotenv/config";
import * as db from "../server/db";

async function main() {
  await db.upsertUser({
    openId: "dev-fresh",
    name: "신규유저",
    email: "fresh@local.test",
    loginMethod: "dev",
    lastSignedIn: new Date(),
  });
  const u = await db.getUserByOpenId("dev-fresh");
  console.log(`fresh user: id=${u?.id}, profileCompleted=${u?.profileCompleted}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
