// 로컬 개발용 — DATABASE_URL의 DB가 없으면 생성 (db:push 전에 실행).
// 실행: pnpm exec tsx scripts/dev-db-init.ts
import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 필요");
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, "") || "aplusmate";
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    // db 미지정으로 접속 → CREATE DATABASE
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`[db-init] 데이터베이스 준비 완료: ${dbName} @ ${u.hostname}:${u.port}`);
  await conn.end();
  process.exit(0);
}
main().catch((e) => {
  console.error("[db-init] 실패:", e.message);
  process.exit(1);
});
