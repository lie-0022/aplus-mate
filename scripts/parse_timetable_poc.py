# 백석대 교양 시간표 PDF 파싱 PoC — pdfplumber 좌표 기반 추출 실현성 검증
# 분석 결론(워크플로우): pypdf extract_text는 컬럼 x좌표 소실 → pdfplumber 좌표추출이 정답.
import sys

sys.stdout.reconfigure(encoding="utf-8")
import pdfplumber

PDF = r"C:\Users\jayju\Downloads\2025년도 2학기 백석대학교 교양.pdf"

with pdfplumber.open(PDF) as pdf:
    pg = pdf.pages[23]  # 24페이지(0-index 23)
    print("=== 1) extract_tables (괘선 기반) ===")
    tbls = pg.extract_tables()
    print("표 개수:", len(tbls))
    if tbls and tbls[0]:
        print("첫 표 행수:", len(tbls[0]))
        for row in tbls[0][:3]:
            print("ROW:", row)

    print("\n=== 2) extract_words (좌표 기반) ===")
    ws = pg.extract_words()
    print("단어 수:", len(ws))
    # 헤더 라벨의 x좌표(컬럼 경계 학습용) 샘플
    print("상위 12단어 (text, x0, top):")
    for w in ws[:12]:
        print(f"  '{w['text']}' x0={round(w['x0'],1)} top={round(w['top'],1)}")

    # top으로 같은 행 묶기(±3px) — 한 강의행 재구성 가능성 확인
    print("\n=== 3) top 클러스터링으로 행 재구성 (샘플 3행) ===")
    rows = {}
    for w in ws:
        key = round(w["top"] / 3) * 3
        rows.setdefault(key, []).append(w)
    sorted_rows = sorted(rows.items())
    for top, words in sorted_rows[2:5]:  # 헤더 건너뛰고 데이터 3행
        words.sort(key=lambda x: x["x0"])
        line = " | ".join(f"{w['text']}@{round(w['x0'])}" for w in words)
        print(f"top={top}: {line[:200]}")
