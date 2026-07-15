// A+ Mate 서비스워커 — PWA 설치 경험 + 재방문 속도(무료 호스팅 콜드스타트 완화).
// 원칙: HTML(내비게이션)은 절대 캐시하지 않는다(새 배포 즉시 반영). 오프라인일 때만 폴백.
//       /assets/* 는 콘텐츠 해시가 붙어 불변이므로 cache-first가 안전하다.
//       /api/* 는 건드리지 않는다(인증 쿠키·실시간 데이터).

const CACHE = "aplus-static-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/logo-light.png", "/logo-dark.png"];
const MAX_ENTRIES = 100; // 배포가 쌓여도 캐시가 무한히 크지 않게 자른다

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache() {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  // 오래된 것부터(추가 순) 제거 — 프리캐시 항목은 건드리지 않는다
  for (const req of keys.slice(0, keys.length - MAX_ENTRIES)) {
    const url = new URL(req.url);
    if (!PRECACHE.includes(url.pathname)) await cache.delete(req);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // 인증·데이터는 항상 네트워크

  // 페이지 이동: network-first — 오프라인이면 브랜드 폴백 페이지
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // 불변 자산: cache-first
  const isStatic =
    url.pathname.startsWith("/assets/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname);
  if (isStatic) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(req, clone).then(trimCache));
            }
            return res;
          })
      )
    );
  }
});
