/**
 * Safely parse skillTags which may come from DB as a JSON string or already an array.
 */
export function parseSkillTags(raw: unknown): string[] {
  return parseJsonStringArray(raw);
}

/** MySQL json 컬럼은 드라이버에 따라 문자열로 올 수 있다 — 배열로 정규화. */
export function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not valid JSON
    }
  }
  return [];
}
