#!/usr/bin/env python3
"""
백석대 2026-1 전체 시간표 데이터셋 빌더.

18개 학과(전공) + 교양 + 교직 PDF를 내려받아 parse_timetable로 파싱하고, 하나의
JSON 데이터셋 + 검증 리포트로 합친다. 시더(P2)와 검수(구글시트)의 입력.

사용:
    python scripts/build_timetable_dataset.py --semester 2026-1 --pdfdir <다운로드폴더> --out dataset.json [--report report.txt]
    # --skip-download 이면 pdfdir의 기존 파일 사용

전공: https://www.bu.ac.kr/sites/web/files/sugang/2026_1/2026_1_{code}.pdf
교양/교직: .../2026_1_kyoyang.pdf, .../2026_1_kyojik.pdf
"""
import sys, os, json, argparse, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_timetable import parse_pdf, DEPT_NAME  # noqa

BASE = "https://www.bu.ac.kr/sites/web/files/sugang/2026_1"
DEPT_CODES = list(DEPT_NAME.keys())  # 18개
EXTRA = [("kyoyang", "교양"), ("kyojik", "교직")]


def download(code, pdfdir, skip):
    path = os.path.join(pdfdir, f"2026_1_{code}.pdf")
    if skip and os.path.exists(path):
        return path
    url = f"{BASE}/2026_1_{code}.pdf"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
        return path
    except Exception as e:
        print(f"  [!] {code} 다운로드 실패: {e}")
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--semester", required=True)
    ap.add_argument("--pdfdir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report", default=None)
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.pdfdir, exist_ok=True)

    all_courses = []
    per_source = {}
    targets = [(c, "전공") for c in DEPT_CODES] + EXTRA
    for code, cat in targets:
        print(f"processing {code} ({cat}) ...")
        path = download(code, args.pdfdir, args.skip_download)
        if not path:
            per_source[code] = {"error": "download failed"}
            continue
        try:
            res = parse_pdf(path, code if cat == "전공" else None, cat, args.semester)
        except Exception as e:
            per_source[code] = {"error": f"parse: {e}"}
            continue
        all_courses.extend(res["courses"])
        per_source[code] = {"count": res["count"], "raw": res["count_raw"], "pages": res["npages"]}

    # 전역 dedup(sourceKey) — 학과 전역 공유 과목이 여러 PDF에 중복될 수 있음
    seen = {}
    for c in all_courses:
        seen[c["sourceKey"]] = c
    dataset = list(seen.values())

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=1)

    # 리포트
    R = []
    w = lambda s="": R.append(str(s))
    w(f"=== 2026-1 시간표 데이터셋 ===")
    w(f"총 개설(offering) {len(dataset)} · 고유 과목(courseGroupId) {len(set(c['courseGroupId'] for c in dataset))}")
    bycat = Counter(c["category"] for c in dataset)
    w(f"카테고리: {dict(bycat)}")
    w("소스별 개설 수:")
    for code, cat in targets:
        info = per_source.get(code, {})
        nm = DEPT_NAME.get(code, cat)
        w(f"  {code:<8}{nm:<12} {info}")
    # 검증 신호
    no_credit = sum(1 for c in dataset if c["credits"] is None)
    no_prof = sum(1 for c in dataset if not c["professor"])
    bad_code = sum(1 for c in dataset if len(c["courseCode"]) != 7)
    w(f"검증: 학점없음 {no_credit} · 교수없음 {no_prof} · 코드길이이상 {bad_code}")
    report = "\n".join(R)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(report)
    print(report)


if __name__ == "__main__":
    main()
