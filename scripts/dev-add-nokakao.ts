// 로컬 dev — 프로필은 완성했지만 kakao가 없는 유저 (커넥트 시점 kakao 수집 테스트용).
import "dotenv/config";
import * as db from "../server/db";

async function main() {
  await db.upsertUser({
    openId: "dev-nokakao",
    name: "노카톡",
    email: "nokakao@local.test",
    loginMethod: "dev",
    lastSignedIn: new Date(),
  });
  const u = await db.getUserByOpenId("dev-nokakao");
  if (!u) throw new Error("생성 실패");
  // 프로필 완성(university/department/year) — 단 kakao는 비움
  await db.updateUserProfile(u.id, {
    university: "백석대학교",
    department: "첨단IT학부",
    year: 2,
    skillTags: ["Go"],
  });
  await db.enrollCourse(u.id, 1, "2026-1"); // 인공지능 수업(dev-local도 수강)
  const after = await db.getUserByOpenId("dev-nokakao");
  console.log(
    `dev-nokakao: id=${after?.id}, completed=${after?.profileCompleted}, kakao=${after?.kakaoOpenChatUrl}`
  );
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
