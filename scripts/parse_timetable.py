#!/usr/bin/env python3
"""
백석대 수강편람 PDF → 구조화 JSON 파서.

- 전공(학과별) PDF와 교양(kyoyang) PDF는 컬럼 레이아웃이 다르다 → 헤더로 감지해 매핑.
- 과목코드(7자리) = courseGroupId(앞5자리, 과목) + section(뒤2자리, 분반).
- 요일/교시("목4,5/ 사") 파싱 → schedule 리스트 + 사이버 플래그.
- 2026-1 수강편람의 전공 PDF는 1학기/2학기 블록이 있음 → 이 학기(1학기) 개설만 뽑는다.

사용:
    python scripts/parse_timetable.py <pdf_path> --dept com --category 전공 --semester 2026-1 [--out out.json]
    python scripts/parse_timetable.py <pdf_path> --category 교양 --semester 2026-1

의존: pdfplumber
"""
import sys, re, json, argparse
from collections import Counter

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber 필요: pip install pdfplumber")

LINE_SETTINGS = {"vertical_strategy": "lines", "horizontal_strategy": "lines"}
DAY_CHARS = "월화수목금토일"

# 학과 코드 → 표기(프로필 COHORT_DEPARTMENTS와 일치해야 함)
DEPT_NAME = {
    "chr": "기독교학부", "lan": "어문학부", "wel": "사회복지학부", "law": "경찰학부",
    "biz": "경상학부", "tou": "관광학부", "foo": "외식산업학부", "edu": "사범학부",
    "com": "컴퓨터공학부", "sma": "첨단IT학부", "hea": "보건학부", "nur": "간호학과",
    "des": "디자인영상학부", "spo": "스포츠과학부", "art": "문화예술학부",
    "dls": "자유전공학부", "bug": "국제학부", "iis": "혁신교육플랫폼대학",
}


def cell(c):
    return (c or "")


def norm(s):
    return re.sub(r"\s+", "", cell(s))


def parse_schedule(raw):
    """'목4,5/ 사' → {'slots': [{'day':'목','period':4},{'day':'목','period':5}], 'cyber': True, 'raw': ...}
    규칙: '/'로 나눈 각 토막이 '사'(사이버) 또는 '{요일}{교시들}'.
    교시들은 콤마 구분. 요일 없이 교시만 있거나 빈 토막은 스킵.
    """
    raw = cell(raw).strip()
    out = {"slots": [], "cyber": False, "raw": raw}
    if not raw:
        return out
    for tok in raw.split("/"):
        t = tok.strip()
        if not t:
            continue
        if t.startswith("사") and not (len(t) > 1 and t[1] in "0123456789"):
            # '사' 또는 '사이버' → 사이버(교시 없음)
            out["cyber"] = True
            # '사' 뒤에 요일+교시가 붙는 경우는 드묾 — 우선 사이버로만
            rest = t[1:].strip()
            if rest and rest[0] in DAY_CHARS:
                t = rest  # 예외적으로 이어붙은 경우 계속 파싱
            else:
                continue
        if t and t[0] in DAY_CHARS:
            day = t[0]
            periods = re.findall(r"\d+", t[1:])
            if periods:
                for p in periods:
                    out["slots"].append({"day": day, "period": int(p)})
            else:
                out["slots"].append({"day": day, "period": None})
    return out


def parse_competencies(raw):
    """'전공(50),혁신(50)' → [{'name':'전공','ratio':50},{'name':'혁신','ratio':50}]"""
    raw = cell(raw).strip()
    if not raw:
        return []
    out = []
    for m in re.finditer(r"([가-힣A-Za-z]+)\s*\((\d+)\)", raw):
        out.append({"name": m.group(1), "ratio": int(m.group(2))})
    return out


def to_int(s):
    m = re.search(r"\d+", cell(s))
    return int(m.group()) if m else None


def find_header(table):
    """과목코드가 든 헤더 행 인덱스 반환(없으면 None)."""
    for ri, row in enumerate(table[:5]):
        if any(norm(c) == "과목코드" for c in row):
            return ri
    return None


def build_colmap(table, hidx):
    """헤더(전공은 2행 병합) → {필드: 컬럼인덱스}. 1학기 블록 우선."""
    h1 = [norm(c) for c in table[hidx]]
    h2 = [norm(c) for c in table[hidx + 1]] if hidx + 1 < len(table) else [""] * len(h1)

    def idx(name, header):
        return header.index(name) if name in header else None

    cmap = {
        "code": idx("과목코드", h1),
        "name": idx("과목명", h1),
        "credit": idx("학점", h1),
        "hours": idx("시수", h1),
        "capacity": idx("제한인원", h1) or idx("인원", h1),
        "gubun": idx("구분", h1),
        "track": idx("트랙", h1),
    }
    # 전공: 2행에 담당교수/요일교시/강의실/특이사항/핵심역량 (1학기 블록 = 첫 등장)
    def first(name, header):
        return header.index(name) if name in header else None
    cmap["prof"] = first("담당교수", h2) if "담당교수" in h2 else idx("담당교수", h1)
    # 요일교시: '요일/교시' 또는 '요일교시'
    def find_sched(header):
        for i, c in enumerate(header):
            if c in ("요일/교시", "요일교시"):
                return i
        return None
    cmap["sched"] = find_sched(h2)
    if cmap["sched"] is None:
        cmap["sched"] = find_sched(h1)
    cmap["room"] = (h2.index("강의실") if "강의실" in h2 else (h1.index("강의실") if "강의실" in h1 else None))
    cmap["comp"] = None
    for hh in (h2, h1):
        for i, c in enumerate(hh):
            if c.startswith("핵심역량"):
                cmap["comp"] = i
                break
        if cmap["comp"] is not None:
            break
    cmap["note"] = (h2.index("특이사항") if "특이사항" in h2 else (h1.index("비고") if "비고" in h1 else None))
    return cmap


def parse_pdf(path, dept_code, category, semester):
    dept = DEPT_NAME.get(dept_code) if dept_code else ("교양" if category == "교양" else "교직" if category == "교직" else None)
    courses = []
    errors = []
    with pdfplumber.open(path) as pdf:
        npages = len(pdf.pages)
        for pi, page in enumerate(pdf.pages):
            for table in page.extract_tables(LINE_SETTINGS):
                if not table or len(table) < 2:
                    continue
                hidx = find_header(table)
                if hidx is None:
                    continue
                cmap = build_colmap(table, hidx)
                if cmap["code"] is None or cmap["name"] is None:
                    continue
                # 전공은 헤더 2행 → 데이터는 hidx+2부터, 교양은 hidx+1부터
                data_start = hidx + 2 if (cmap.get("track") is not None) else hidx + 1
                for row in table[data_start:]:
                    if len(row) <= cmap["code"]:
                        continue
                    code = norm(row[cmap["code"]])
                    # 과목명 셀은 여러 줄로 접히기도 함 → 내부 공백/줄바꿈을 단일 공백으로.
                    name = re.sub(r"\s+", " ", cell(row[cmap["name"]])).strip()
                    if not re.fullmatch(r"\d{7}", code) or not name:
                        continue
                    def g(key):
                        i = cmap.get(key)
                        return cell(row[i]) if (i is not None and i < len(row)) else ""
                    sched_raw = g("sched")
                    rec = {
                        "courseCode": code,
                        "courseGroupId": code[:5],
                        "section": code[5:7],
                        "name": name,
                        "department": dept,
                        "category": category,
                        "subType": cell(g("gubun")).strip() or None,
                        "credits": to_int(g("credit")),
                        "hours": to_int(g("hours")),
                        "capacity": to_int(g("capacity")),
                        "professor": cell(g("prof")).strip() or None,
                        "room": cell(g("room")).strip() or None,
                        "competencies": parse_competencies(g("comp")),
                        "note": cell(g("note")).strip() or None,
                        "schedule": parse_schedule(sched_raw),
                        "semester": semester,
                        "sourceKey": f"{code}|{semester}",
                    }
                    # 전공 PDF에서 1학기 개설만: 담당교수/요일교시가 비면 이 학기 미개설(2학기 전용) → 스킵
                    if category == "전공" and not rec["professor"] and not sched_raw.strip():
                        continue
                    courses.append(rec)
    # 중복 제거(같은 sourceKey — 여러 트랙에 중복 표기)
    seen = {}
    for c in courses:
        seen[c["sourceKey"]] = c
    uniq = list(seen.values())
    return {"npages": npages, "count_raw": len(courses), "count": len(uniq), "courses": uniq}


def summarize(result):
    cs = result["courses"]
    lines = [
        f"페이지 {result['npages']} · 원행 {result['count_raw']} · 유니크(과목코드+학기) {result['count']}",
    ]
    groups = len(set(c["courseGroupId"] for c in cs))
    lines.append(f"고유 과목(courseGroupId) {groups}개")
    no_prof = sum(1 for c in cs if not c["professor"])
    no_sched = sum(1 for c in cs if not c["schedule"]["slots"] and not c["schedule"]["cyber"])
    no_credit = sum(1 for c in cs if c["credits"] is None)
    lines.append(f"교수없음 {no_prof} · 시간표없음 {no_sched} · 학점없음 {no_credit}")
    lines.append("샘플 5개:")
    for c in cs[:5]:
        sl = ",".join(f"{s['day']}{s['period']}" for s in c["schedule"]["slots"])
        cy = "+사이버" if c["schedule"]["cyber"] else ""
        lines.append(
            f"  [{c['courseCode']}] {c['name'][:16]} · {c['credits']}학점 · {c['professor']} · {sl}{cy} · {c['room']} · {c['subType']}"
        )
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--dept", default=None)
    ap.add_argument("--category", required=True, choices=["전공", "교양", "교직"])
    ap.add_argument("--semester", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--summary-out", default=None)
    args = ap.parse_args()
    result = parse_pdf(args.pdf, args.dept, args.category, args.semester)
    summary = summarize(result)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(result["courses"], f, ensure_ascii=False, indent=1)
    if args.summary_out:
        with open(args.summary_out, "w", encoding="utf-8") as f:
            f.write(summary)
    else:
        print(summary)


if __name__ == "__main__":
    main()
